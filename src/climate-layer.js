import * as THREE from 'three';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';
import { climateLayout } from './climate-layout.js';

export function createClimateLayer(data, direction, scene, labelHost) {
  const root = new THREE.Group();
  // One stable atlas anchor for the entire chapter, independent of selected control.
  root.position.fromArray(direction).multiplyScalar(18);
  scene.add(root);
  const material = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { opacity: { value: 0 }, pixelRatio: { value: 1 }, selected: { value: -1 } },
    vertexShader: `
      attribute float observationIndex;
      uniform float pixelRatio;
      uniform float selected;
      varying float selectedPoint;
      varying float depthLight;
      void main() {
        vec4 view = modelViewMatrix * vec4(position, 1.0);
        selectedPoint = abs(observationIndex - selected) < 0.1 ? 1.0 : 0.0;
        depthLight = clamp(16.0 / max(1.0, -view.z), 0.4, 1.0);
        gl_PointSize = (clamp(130.0 / max(1.0, -view.z), 8.0, 12.0) + selectedPoint * 3.0) * pixelRatio;
        gl_Position = projectionMatrix * view;
      }`,
    fragmentShader: `
      uniform float opacity;
      varying float selectedPoint;
      varying float depthLight;
      void main() {
        float radius = length(gl_PointCoord - vec2(0.5)) * 2.0;
        if (radius > 1.0) discard;
        float core = 1.0 - smoothstep(0.15, 0.37, radius);
        float halo = pow(max(0.0, 1.0 - radius), 2.4) * 0.32;
        vec3 color = mix(vec3(0.92, 0.96, 1.0), vec3(1.0, 0.19, 0.12), selectedPoint);
        color = mix(color, vec3(1.0), core * 0.75);
        gl_FragColor = vec4(color, max(core, halo) * depthLight * opacity);
      }`,
  });
  const points = new THREE.Points(new THREE.BufferGeometry(), material);
  root.add(points);
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

  function setMode(mode) {
    layout = climateLayout(data.observations, mode);
    points.geometry.dispose();
    points.geometry = new THREE.BufferGeometry();
    points.geometry.setAttribute('position', new THREE.Float32BufferAttribute(layout.positions.flat(), 3));
    points.geometry.setAttribute('observationIndex', new THREE.Float32BufferAttribute(data.observations.map((_, i) => i), 1));
    for (const child of [...envelope.children]) {
      child.geometry.dispose(); child.material.dispose(); envelope.remove(child);
    }
    const geometry = new ConvexGeometry(layout.positions.map((xyz) => new THREE.Vector3(...xyz)));
    const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: 0x9aa9b0, transparent: true, opacity: 0.025, depthWrite: false, side: THREE.DoubleSide }));
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 1), new THREE.LineBasicMaterial({ color: 0xa6b2b9, transparent: true, opacity: 0.13, depthWrite: false }));
    envelope.add(mesh, edges);
    envelope.visible = active && surface;
  }
  setMode('log');

  function worldPosition(index) {
    return root.localToWorld(new THREE.Vector3(...layout.positions[index]));
  }
  function projected(camera, width, height) {
    camera.updateMatrixWorld(); root.updateMatrixWorld();
    return data.observations.map((observation, index) => {
      const world = worldPosition(index);
      const depth = -world.clone().applyMatrix4(camera.matrixWorldInverse).z;
      const p = world.project(camera);
      return { index, code: observation.code, x: (p.x + 1) * width / 2, y: (1 - p.y) * height / 2, depth,
        visible: depth > camera.near && p.z < 1 && Math.abs(p.x) < 1 && Math.abs(p.y) < 1 };
    });
  }
  return {
    root, data, setMode, worldPosition, projected,
    get active() { return active; },
    get mode() { return layout.mode; },
    get selectedIndex() { return chosen; },
    get positions() { return layout.positions; },
    activate(value) { active = value; envelope.visible = active && surface; if (!value) this.select(-1); },
    select(index) { chosen = index; material.uniforms.selected.value = index; },
    setSurface(value) { surface = value; envelope.visible = active && surface; },
    pick(x, y, camera, width, height) {
      if (!active || alpha < 0.2) return null;
      return projected(camera, width, height).filter((p) => p.visible && Math.hypot(x - p.x, y - p.y) < 8)
        .sort((a, b) => Math.hypot(x - a.x, y - a.y) - Math.hypot(x - b.x, y - b.y))[0] ?? null;
    },
    update(now, camera, width, height, pixelRatio, rightLimit) {
      const dt = Math.min(0.1, (now - (lastTime ?? now)) / 1000); lastTime = now;
      alpha = THREE.MathUtils.damp(alpha, active ? 1 : 0.025, 4, dt);
      material.uniforms.opacity.value = alpha;
      material.uniforms.pixelRatio.value = pixelRatio;
      labels.forEach((el) => { el.hidden = true; });
      if (!active || alpha < 0.6) return;
      const candidates = projected(camera, width, height).filter((p) => p.visible && p.x > 30 && p.x < rightLimit - 55 && p.y > 140 && p.y < height - 150);
      candidates.sort((a, b) => (a.index === chosen ? -1 : b.index === chosen ? 1 : a.depth - b.depth));
      const placed = [];
      for (const p of candidates) {
        if (placed.length >= labels.length) break;
        if (placed.some((q) => Math.abs(p.x - q.x) < 85 && Math.abs(p.y - q.y) < 32)) continue;
        const el = labels[placed.length];
        el.textContent = p.code; el.style.left = `${p.x + 8}px`; el.style.top = `${p.y - 5}px`;
        el.classList.toggle('active', p.index === chosen); el.hidden = false; placed.push(p);
      }
    },
  };
}
