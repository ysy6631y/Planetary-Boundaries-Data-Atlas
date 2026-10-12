import * as THREE from 'three';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';
import { climateLayout } from './climate-layout.js';

export function createClimateLayer(data, direction, scene, labelHost) {
  let boundaryTitle = 'CLIMATE';
  let projectionCache = null;
  let geometryVersion = 0;
  let canSurface = false;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let projectionStarted = performance.now();
  let fadingAt = null;
  const root = new THREE.Group();
  // Keep the country field near the climate chapter, without assigning it a PB risk radius.
  root.position.fromArray(direction).multiplyScalar(3.5);
  root.scale.setScalar(0.36);
  scene.add(root);
  const material = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { opacity: { value: 0 }, pixelRatio: { value: 1 }, selected: { value: -1 }, hovered: { value: -1 }, overview: { value: 0 }, projection: { value: 1 }, observationCount: { value: data.observations.length }, clock: { value: 0 }, idle: { value: 0 } },
    vertexShader: `
      attribute float observationIndex;
      uniform float pixelRatio;
      uniform float selected;
      uniform float hovered;
      uniform float overview;
      uniform float projection;
      uniform float observationCount;
      uniform float clock;
      uniform float idle;
      varying float reveal;
      varying float scan;
      varying float hoverLight;
      varying float selectedPoint;
      varying float depthLight;
      void main() {
        vec4 view = modelViewMatrix * vec4(position, 1.0);
        selectedPoint = abs(observationIndex - selected) < 0.1 ? 1.0 : 0.0;
        float order = observationIndex / max(1.0, observationCount - 1.0);
        reveal = max(selectedPoint, smoothstep(order * 0.72, order * 0.72 + 0.28, projection));
        float cycle = mod(clock, 8.0);
        float scanned = mod(floor(clock / 8.0) * 17.0, max(1.0, observationCount));
        scan = idle * (abs(observationIndex - scanned) < 0.1 ? 1.0 : 0.0) * sin(clamp(cycle / 1.2, 0.0, 1.0) * 3.14159265);
        depthLight = clamp(16.0 / max(1.0, -view.z), 0.4, 1.0);
        float hoverPoint = abs(observationIndex - hovered) < 0.1 ? 1.0 : 0.0;
        hoverLight = hoverPoint;
        float detailSize = clamp(50.0 / max(1.0, -view.z), 2.1, 3.4) + selectedPoint * 1.4 + hoverPoint * 0.7;
        float overviewSize = clamp(32.0 / max(1.0, -view.z), 1.4, 2.2);
        gl_PointSize = mix(detailSize, overviewSize, overview) * pixelRatio * mix(0.9, 1.0, reveal);
        gl_Position = projectionMatrix * view;
      }`,
    fragmentShader: `
      uniform float opacity;
      uniform float overview;
      varying float selectedPoint;
      varying float depthLight;
      varying float reveal;
      varying float scan;
      varying float hoverLight;
      void main() {
        float radius = length(gl_PointCoord - vec2(0.5)) * 2.0;
        if (radius > 1.0) discard;
        float disc = 1.0 - smoothstep(0.62, 0.86, radius);
        // Keep source observations in the same warm white language as the
        // atlas nodes; reserve color for the selected signal and axis guide.
        vec3 color = mix(vec3(0.93, 0.92, 0.88), vec3(0.78, 0.80, 0.79), overview);
        color = mix(color, vec3(1.0, 0.30, 0.23), selectedPoint);
        color = mix(color, vec3(1.0), max(scan * 0.35, hoverLight * 0.3));
        gl_FragColor = vec4(color, disc * depthLight * opacity * reveal * mix(1.0, 0.85, overview));
      }`,
  });
  const points = new THREE.Points(new THREE.BufferGeometry(), material);
  root.add(points);
  const axisOrigin = new THREE.Vector3(-4, -3, -4);
  const axisEnds = [new THREE.Vector3(-2.4, -3, -4), new THREE.Vector3(-4, -1.4, -4), new THREE.Vector3(-4, -3, -2.4)];
  const axisGuide = new THREE.LineSegments(
    new THREE.BufferGeometry().setFromPoints(axisEnds.flatMap((end) => [axisOrigin, end])),
    new THREE.LineBasicMaterial({ color: 0x6e9298, transparent: true, opacity: 0.55, depthWrite: false }),
  );
  axisGuide.visible = false;
  root.add(axisGuide);
  const envelope = new THREE.Group();
  root.add(envelope);
  let layout;
  let active = false;
  let chosen = -1;
  let surface = false;
  let alpha = 0;
  let lastTime = null;
  const labels = Array.from({ length: 7 }, () => {
    const element = document.createElement('div');
    element.className = 'country-label';
    element.hidden = true;
    labelHost.append(element);
    return element;
  });
  const fieldLabel = document.createElement('div');
  fieldLabel.className = 'climate-field-label';
  fieldLabel.append(document.createElement('strong'), document.createElement('span'));
  fieldLabel.hidden = true;
  labelHost.append(fieldLabel);
  const axisLabels = ['X', 'Y', 'Z'].map((title, index) => {
    const element = document.createElement('div');
    element.className = 'climate-axis-label';
    element.textContent = title;
    element.title = data.axes[index];
    element.hidden = true;
    labelHost.append(element);
    return element;
  });

  function setMode(mode) {
    geometryVersion++; projectionCache = null;
    layout = climateLayout(data.observations, mode, data.domainObservations);
    points.geometry.dispose();
    points.geometry = new THREE.BufferGeometry();
    points.geometry.setAttribute('position', new THREE.Float32BufferAttribute(layout.positions.flat(), 3));
    points.geometry.setAttribute('observationIndex', new THREE.Float32BufferAttribute(data.observations.map((_, i) => i), 1));
    for (const child of [...envelope.children]) {
      child.geometry.dispose(); child.material.dispose(); envelope.remove(child);
    }
    // Only a genuinely three-dimensional point set can define a volume envelope.
    const vertices = layout.positions.map((xyz) => new THREE.Vector3(...xyz));
    const a = vertices[0];
    const b = a && vertices.find((v) => v.distanceToSquared(a) > 1e-10);
    const ab = b && b.clone().sub(a);
    const c = ab && vertices.find((v) => ab.clone().cross(v.clone().sub(a)).lengthSq() > 1e-10);
    const normal = c && ab.clone().cross(c.clone().sub(a));
    canSurface = Boolean(normal && vertices.some((v) => Math.abs(normal.dot(v.clone().sub(a))) > 1e-8));
    if (canSurface) {
      const geometry = new ConvexGeometry(vertices);
      const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: 0x9aa9b0, transparent: true, opacity: 0.025, depthWrite: false, side: THREE.DoubleSide }));
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 1), new THREE.LineBasicMaterial({ color: 0xa6b2b9, transparent: true, opacity: 0.13, depthWrite: false }));
      envelope.add(mesh, edges);
    }
    envelope.visible = active && surface && canSurface;
    fieldLabel.children[0].textContent = `${boundaryTitle} / LOCAL ANALYSIS`;
    fieldLabel.children[1].textContent = `${data.observations.length.toLocaleString('en')} OBSERVATIONS`;
    const z = data.axes.length === 3 ? -4 : 0;
    axisOrigin.set(-4, -3, z);
    axisEnds[0].set(-2.4, -3, z); axisEnds[1].set(-4, -1.4, z); axisEnds[2].set(-4, -3, z + 1.6);
    axisGuide.geometry.dispose();
    axisGuide.geometry = new THREE.BufferGeometry().setFromPoints(axisEnds.slice(0, data.axes.length).flatMap((end) => [axisOrigin, end]));
  }
  setMode(data.defaultMode ?? 'log');

  function worldPosition(index) {
    return root.localToWorld(new THREE.Vector3(...layout.positions[index]));
  }
  function projected(camera, width, height) {
    camera.updateMatrixWorld(); root.updateMatrixWorld();
    const key = `${geometryVersion}/${width}/${height}/${camera.matrixWorld.elements}/${camera.projectionMatrix.elements}/${root.matrixWorld.elements}`;
    if (projectionCache?.key === key) return projectionCache.points;
    const projectedPoints = data.observations.map((observation, index) => {
      const world = worldPosition(index);
      const depth = -world.clone().applyMatrix4(camera.matrixWorldInverse).z;
      const p = world.project(camera);
      return { index, code: observation.code, x: (p.x + 1) * width / 2, y: (1 - p.y) * height / 2, depth,
        visible: depth > camera.near && p.z < 1 && Math.abs(p.x) < 1 && Math.abs(p.y) < 1 };
    });
    projectionCache = { key, points: projectedPoints };
    return projectedPoints;
  }
  return {
    root, setMode, worldPosition, projected,
    overview: false,
    get data() { return data; },
    get canSurface() { return canSurface; },
    setData(next, nextDirection, title) {
      chosen = -1; material.uniforms.selected.value = -1; material.uniforms.hovered.value = -1;
      alpha = 0;
      projectionStarted = performance.now(); fadingAt = null;
      material.uniforms.projection.value = reducedMotion.matches ? 1 : 0;
      material.uniforms.observationCount.value = next.observations.length;
      data = next; boundaryTitle = title;
      root.position.fromArray(nextDirection).multiplyScalar(3.5);
      axisLabels.forEach((el, index) => { el.title = data.axes[index] ?? ''; });
      setMode(data.defaultMode ?? 'linear');
    },
    get active() { return active; },
    get mode() { return layout.mode; },
    get selectedIndex() { return chosen; },
    get positions() { return layout.positions; },
    get projectionProgress() { return material.uniforms.projection.value; },
    fadeOut() { fadingAt = performance.now(); envelope.visible = false; this.select(-1); },
    activate(value) { active = value; envelope.visible = active && surface && canSurface; axisGuide.visible = active; if (!value) this.select(-1); },
    select(index) { chosen = index; material.uniforms.selected.value = index; },
    hover(index) { material.uniforms.hovered.value = index; },
    setSurface(value) { surface = value; envelope.visible = active && surface && canSurface; },
    pick(x, y, camera, width, height) {
      if (!active || alpha < 0.2 || fadingAt !== null) return null;
      return projected(camera, width, height).filter((p) => p.visible && material.uniforms.projection.value >= p.index / Math.max(1, data.observations.length - 1) * .72 + .28 && Math.hypot(x - p.x, y - p.y) < 8)
        .sort((a, b) => Math.hypot(x - a.x, y - a.y) - Math.hypot(x - b.x, y - b.y))[0] ?? null;
    },
    update(now, camera, width, height, pixelRatio, rightLimit) {
      axisGuide.visible = active && !this.overview && fadingAt === null;
      const dt = Math.min(0.1, (now - (lastTime ?? now)) / 1000); lastTime = now;
      alpha = reducedMotion.matches ? (active ? 1 : .025) : THREE.MathUtils.damp(alpha, active ? 1 : 0.025, 8, dt);
      material.uniforms.opacity.value = alpha * (fadingAt === null ? 1 : reducedMotion.matches ? 0 : Math.max(0, 1 - (now - fadingAt) / 120));
      material.uniforms.projection.value = reducedMotion.matches ? 1 : Math.min(1, Math.max(0, (now - projectionStarted) / 640));
      material.uniforms.clock.value = now / 1000 + direction[0] * 2 + direction[1] * 3;
      material.uniforms.idle.value = this.overview && !reducedMotion.matches ? 1 : 0;
      material.uniforms.pixelRatio.value = pixelRatio;
      material.uniforms.overview.value = this.overview ? 1 : 0;
      labels.forEach((el) => { el.hidden = true; });
      axisLabels.forEach((el) => { el.hidden = true; });
      fieldLabel.hidden = true;
      if (!active || alpha < 0.6 || this.overview || fadingAt !== null) return;
      camera.updateMatrixWorld(); root.updateMatrixWorld();
      const projectLocal = (local) => {
        const p = root.localToWorld(local.clone()).project(camera);
        return { x: (p.x + 1) * width / 2, y: (1 - p.y) * height / 2, visible: p.z > -1 && p.z < 1 };
      };
      const reserved = [];
      axisEnds.forEach((end, index) => {
        if (index >= data.axes.length) return;
        const p = projectLocal(end);
        const label = axisLabels[index];
        if (!p.visible || p.x < 15 || p.x > rightLimit - 105 || p.y < 120 || p.y > height - 105) return;
        label.style.left = `${p.x + 7}px`;
        label.style.top = `${p.y - 4}px`;
        label.hidden = false;
        reserved.push({ x: p.x + 7, y: p.y - 4, w: 16, h: 14 });
      });
      const projectedPoints = projected(camera, width, height).filter((p) => p.visible && (p.index === chosen || material.uniforms.projection.value >= p.index / Math.max(1, data.observations.length - 1) * .72 + .28));
      if (projectedPoints.length) {
        const x = Math.min(...projectedPoints.map((p) => p.x));
        const y = Math.min(...projectedPoints.map((p) => p.y));
        const labelX = Math.max(30, Math.min(rightLimit - 132, x - 12));
        const labelY = Math.max(125, y - 46);
        fieldLabel.style.left = `${labelX}px`;
        fieldLabel.style.top = `${labelY}px`;
        fieldLabel.hidden = false;
        reserved.push({ x: labelX, y: labelY, w: 132, h: 26 });
      }
      const stride = Math.max(1, Math.ceil(projectedPoints.length / 250));
      const candidates = projectedPoints.filter((p, i) => (i % stride === 0 || p.index === chosen) && p.x > 30 && p.x < rightLimit - 55 && p.y > 140 && p.y < height - 150);
      candidates.sort((a, b) => (a.index === chosen ? -1 : b.index === chosen ? 1 : a.depth - b.depth));
      const placed = [];
      for (const p of candidates) {
        if (placed.length >= labels.length) break;
        if (placed.some((q) => Math.abs(p.x - q.x) < 85 && Math.abs(p.y - q.y) < 32)) continue;
        if (reserved.some((box) => p.x + 8 < box.x + box.w + 5 && p.x + 36 > box.x - 5 && p.y - 5 < box.y + box.h + 5 && p.y + 7 > box.y - 5)) continue;
        const el = labels[placed.length];
        el.textContent = p.code; el.style.left = `${p.x + 8}px`; el.style.top = `${p.y - 5}px`;
        el.classList.toggle('active', p.index === chosen); el.hidden = false; placed.push(p);
      }
    },
  };
}
