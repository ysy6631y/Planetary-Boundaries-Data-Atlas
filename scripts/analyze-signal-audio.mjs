import fs from 'node:fs';

function readWav(path) {
  const file = fs.readFileSync(path);
  let channels, rate, pcm;
  for (let offset = 12; offset + 8 < file.length;) {
    const size = file.readUInt32LE(offset + 4);
    const id = file.toString('ascii', offset, offset + 4);
    if (id === 'fmt ') { channels = file.readUInt16LE(offset + 10); rate = file.readUInt32LE(offset + 12); }
    if (id === 'data') pcm = file.subarray(offset + 8, offset + 8 + size);
    offset += 8 + size + size % 2;
  }
  const samples = new Float64Array(pcm.length / 2 / channels);
  for (let i = 0; i < samples.length; i++) {
    for (let c = 0; c < channels; c++) samples[i] += pcm.readInt16LE((i * channels + c) * 2) / 32768 / channels;
  }
  return { samples, rate };
}

function spectrum(samples, offset) {
  const n = 1024, re = new Float64Array(n), im = new Float64Array(n);
  for (let i = 0; i < n; i++) re[i] = (samples[offset + i] || 0) * (.5 - .5 * Math.cos(2 * Math.PI * i / (n - 1)));
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) [re[i], re[j]] = [re[j], re[i]];
  }
  for (let len = 2; len <= n; len <<= 1) {
    const angle = -2 * Math.PI / len;
    for (let i = 0; i < n; i += len) {
      for (let j = 0; j < len / 2; j++) {
        const wr = Math.cos(angle * j), wi = Math.sin(angle * j), a = i + j, b = a + len / 2;
        const tr = re[b] * wr - im[b] * wi, ti = re[b] * wi + im[b] * wr;
        re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
      }
    }
  }
  return Array.from({ length: n / 2 }, (_, i) => re[i] ** 2 + im[i] ** 2);
}

const analysis = {};
for (const layer of (process.argv.length > 2 ? process.argv.slice(2) : ['flow', 'micro', 'detail', 'archived'])) {
  const { samples, rate } = readWav(`/tmp/atlas-${layer}.wav`);
  const rows = [];
  for (let offset = 0; offset + 1024 < samples.length; offset += 480) {
    const power = spectrum(samples, offset);
    const total = power.reduce((a, b) => a + b, 0);
    const max = Math.max(...power), bin = power.indexOf(max);
    const purity = ((power[bin - 1] || 0) + max + (power[bin + 1] || 0)) / Math.max(1e-12, total);
    const centroid = power.reduce((a, b, i) => a + b * i * rate / 1024, 0) / Math.max(1e-12, total);
    const rms = Math.sqrt(samples.subarray(offset, offset + 480).reduce((a, b) => a + b * b, 0) / 480);
    rows.push({ time: offset / rate, frequency: bin * rate / 1024, purity, centroid, rms });
  }
  analysis[layer] = rows;
  if (layer !== 'micro') {
    const candidates = [];
    for (let i = 0; i < rows.length - 12; i += 5) {
      const window = rows.slice(i, i + 12);
      const pure = window.filter(row => row.purity > .5 && row.frequency > 700 && row.frequency < 7000 && row.rms > .015);
      if (pure.length >= 7) candidates.push({ start: rows[i].time, frequency: Math.round(pure[0].frequency), score: pure.reduce((s, r) => s + r.purity, 0) });
    }
    const picked = [];
    for (const candidate of candidates.sort((a, b) => b.score - a.score)) {
      if (picked.every(p => Math.abs(p.start - candidate.start) > 1)) picked.push(candidate);
      if (picked.length === 12) break;
    }
    console.log(layer, picked);
  } else {
    const picked = [];
    const onsets = rows.map((row, i) => ({ ...row, rise: row.rms - (rows[i - 1]?.rms || row.rms) })).filter(row => row.centroid > 1400 && row.rise > .04).sort((a, b) => b.rise - a.rise);
    for (const row of onsets) {
      if (picked.every(p => Math.abs(p.time - row.time) > 3)) picked.push(row);
      if (picked.length === 10) break;
    }
    console.log(layer, picked);
  }
}
fs.writeFileSync('/tmp/atlas-spectral-analysis.json', JSON.stringify(analysis));
