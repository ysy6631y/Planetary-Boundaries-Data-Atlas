// Linear gains; time intervals are seconds. No sound controls are added to the UI.
export const SOUND_CONFIG = {
  primaryFamily: 'detail', // 511418; keep 665957 assets for later comparison.
  enabledFamilies: ['detail', 'micro'],
  volumes: { ambient: 0.16, flow: 0.34, detail: 0.65 },
  fragments: { flow: [.22, .55], detail: [.18, .43], micro: [.07, .12] },
  flow: { first: [.25, 1.2], interval: [.8, 3.6], nearInterval: [.22, .95], nearChance: .62, quietInterval: [3, 7], quietChance: .03 },
  detail: { first: [.5, 2.5], interval: [.65, 5.5], clearance: .2 },
  micro: { gain: .36, tailLead: [.065, .11], cooldown: 1.1 },
  activity: { window: 2, attack: .45, release: 1.2, deadzone: .02, fullScale: .65, filterSmoothing: .8, detailDepth: 0, tailThreshold: .025, tailChance: .9 },
  maxVoices: 2,
  minOnsetGap: .18,
  eq: { highpass: 1100, detailHighpass: 750, lowpass: 9000, shelfFrequency: 5800, shelfGain: -3, flowCutoff: [5600, 7200], detailCutoff: [6500, 7900], microCutoff: [7400, 8800] },
};
