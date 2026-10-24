// MediaPipe's WASM loader requires a classic worker (importScripts).
importScripts('./vision_bundle.js');
const { FaceDetector, FilesetResolver } = Vision;

let detector;
self.onmessage = async ({ data }) => {
  try {
    if (data.type === 'init') {
      const vision = await FilesetResolver.forVisionTasks(data.wasm);
      detector = await FaceDetector.createFromOptions(vision, {
        baseOptions: { modelAssetPath: data.model, delegate: 'CPU' },
        runningMode: 'VIDEO', minDetectionConfidence: .65,
      });
      self.postMessage({ type: 'ready' });
    } else if (data.type === 'frame') {
      try {
        const result = detector.detectForVideo(data.frame, data.time);
        const ratio = Math.max(0, ...result.detections.map(face => face.boundingBox.width / data.frame.width));
        self.postMessage({ type: 'result', ratio });
      } finally { data.frame.close(); }
    }
  } catch (error) { self.postMessage({ type: 'error', message: error.message }); }
};
