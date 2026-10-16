"""Extract real frequency-varying data fragments; no synthesized audio.
Uses macOS afconvert or ffmpeg. --analyze also exports 10 ms energy envelopes.
"""
import array
import hashlib
import json
import math
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import wave

ROOT = Path(__file__).resolve().parents[1]
SOURCES = {
    'flow': ('665957', 'wav', 'newlocknew', 'see bundled attribution'),
    'detail': ('511418', 'wav', 'Sky_Motion', 'CC0-1.0'),
    'micro': ('860912', 'wav', 'AirwaveXV', 'CC0-1.0'),
}
# Continuous, naturally frequency-varying excerpts; no single tones or stitched beeps.
SELECTIONS = [
    ('flow-01', 'flow', .35, 1.45),
    ('flow-02', 'flow', 2.4, 3.55),
    ('flow-03', 'flow', 4.8, 5.7),
    ('flow-04', 'flow', 7.1, 8.5),
    ('flow-05', 'flow', 10.0, 11.25),
    ('flow-06', 'flow', 13.2, 14.45),
    ('detail-01', 'detail', .05, .65),
    ('detail-02', 'detail', .45, 1.15),
    ('detail-03', 'detail', 1.0, 1.7),
    ('detail-04', 'detail', 1.55, 2.25),
    ('micro-01', 'micro', .88, 1.08),
    ('micro-02', 'micro', 36.68, 36.91),
    ('micro-03', 'micro', 59.57, 59.77),
    ('micro-04', 'micro', 74.77, 74.99),
]


def decode(path, destination):
    if shutil.which('afconvert'):
        subprocess.run(['afconvert', '-f', 'WAVE', '-d', 'LEI16@48000', str(path), str(destination)], check=True)
    else:
        subprocess.run(['ffmpeg', '-v', 'error', '-i', str(path), '-ar', '48000', '-c:a', 'pcm_s16le', str(destination)], check=True)
    with wave.open(str(destination), 'rb') as handle:
        values = array.array('h', handle.readframes(handle.getnframes()))
        if sys.byteorder != 'little':
            values.byteswap()
        return values, handle.getnchannels(), handle.getframerate()


with tempfile.TemporaryDirectory(prefix='atlas-audio-') as temp:
    decoded, analysis = {}, {}
    for family, (source_id, extension, author, license_name) in SOURCES.items():
        path = ROOT / 'public/audio/source' / f'{source_id}.{extension}'
        values, channels, rate = decode(path, Path(temp) / f'{source_id}.wav')
        decoded[family] = (values, channels, rate)
        if '--analyze' in sys.argv:
            shutil.copyfile(Path(temp) / f'{source_id}.wav', Path('/tmp') / f'atlas-{family}.wav')
            bins = []
            for frame in range(0, len(values) // channels, 480):
                window = values[frame * channels:(frame + 480) * channels]
                rms = math.sqrt(sum((v / 32768) ** 2 for v in window) / max(1, len(window)))
                bins.append([round(rms, 6), max((abs(v) / 32768 for v in window), default=0)])
            analysis[family] = {'duration': len(values) / channels / rate, 'bins': bins}
            print(family, analysis[family]['duration'])
    if '--analyze' in sys.argv:
        Path('/tmp/atlas-signal-analysis.json').write_text(json.dumps(analysis))
    else:
        manifest = {'sources': [], 'samples': []}
        for family, (source_id, extension, author, license_name) in SOURCES.items():
            path = ROOT / 'public/audio/source' / f'{source_id}.{extension}'
            manifest['sources'].append({
                'id': source_id, 'author': author, 'license': license_name,
                'url': f'https://freesound.org/people/{author}/sounds/{source_id}/',
                'file': f'/audio/source/{path.name}', 'used': family != 'archived',
                'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
            })
        for name, family, start, end in SELECTIONS:
            values, channels, rate = decoded[family]
            clip = values[int(start * rate) * channels:int(end * rate) * channels]
            frames = len(clip) // channels
            dc = [sum(clip[ch::channels]) / frames for ch in range(channels)]
            rms = math.sqrt(sum((v / 32768) ** 2 for v in clip) / len(clip))
            peak = max(abs(v) / 32768 for v in clip)
            gain = min(3.0 if family == 'micro' else 6.0, .50 / max(peak, 1e-8), (.10 if family == 'micro' else .07) / max(rms, 1e-8))
            attack, release = (.004, .012) if family == 'micro' else (.055, .14)
            for frame in range(frames):
                # Raised cosine boundaries merge each fragment into the background.
                envelope = min(1, frame / (rate * attack), (frames - 1 - frame) / (rate * release))
                fade = .5 - .5 * math.cos(math.pi * max(0, envelope))
                for ch in range(channels):
                    index = frame * channels + ch
                    clip[index] = max(-32767, min(32767, round((clip[index] - dc[ch]) * gain * fade)))
            output = ROOT / 'public/audio/signals' / f'{name}.wav'
            with wave.open(str(output), 'wb') as handle:
                handle.setnchannels(channels)
                handle.setsampwidth(2)
                handle.setframerate(rate)
                if sys.byteorder != 'little':
                    clip.byteswap()
                handle.writeframes(clip.tobytes())
            manifest['samples'].append({
                'id': name, 'family': family, 'kind': 'data-stream' if family != 'micro' else 'micro-scan',
                'file': f'/audio/signals/{name}.wav', 'start': start, 'end': end,
                'duration': frames / rate, 'source': SOURCES[family][0],
                'gain': round(gain, 5), 'fadeIn': attack, 'fadeOut': release,
            })
        (ROOT / 'src/signal-samples.generated.json').write_text(json.dumps(manifest, indent=2) + '\n')
