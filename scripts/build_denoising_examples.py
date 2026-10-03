#!/usr/bin/env python3
"""Mix a MUSAN background-noise excerpt into existing Speech/Music/Audio inputs."""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import subprocess
import tempfile
import urllib.request

import numpy as np

from build_media_volume_examples import SOURCES, digest, pcm

SNR_DB = 6.0


def ffmpeg(args, data=None):
    result = subprocess.run(['ffmpeg', '-v', 'error', '-y', *args], input=data, capture_output=True)
    if result.returncode:
        raise RuntimeError(result.stderr.decode(errors='replace')[-4000:])
    return result.stdout


def signal(path):
    rate, channels, samples = pcm(path)
    assert channels == 1, 'Selected recordings must be mono'
    return rate, np.asarray(samples, dtype=np.float64) / 32768


def build(root, output, cache, noise, snr_db):
    output.mkdir(parents=True, exist_ok=True)
    cache.mkdir(parents=True, exist_ok=True)
    examples = {item['id']: item for item in json.loads((root / 'data/media-examples.json').read_text())['examples']}
    sources = [('Speech', 'volume-global', root / 'assets/audio/volume-input.wav', 'assets/audio/volume-input.wav')]
    for domain, (source_id, source_hash) in SOURCES.items():
        example = examples[source_id]
        source = cache / (source_id + '.wav')
        if not source.exists():
            request = urllib.request.Request(example['inputAudio'], headers={'User-Agent': 'AudioEditSurvey-denoising-examples'})
            with urllib.request.urlopen(request, timeout=30) as response:
                source.write_bytes(response.read())
        assert digest(source) == source_hash, f'{source_id}: upstream input changed'
        sources.append((example['domain'], source_id, source, example['inputAudio']))

    noise_hash = digest(noise)
    records = []
    for domain, source_id, source, clean_url in sources:
        source_hash = digest(source)
        rate, original = signal(source)
        duration = len(original) / rate
        noise_filter = (
            f'aresample={rate},atrim=end_sample={len(original)},asetpts=PTS-STARTPTS,'
            f'afade=t=in:st=0:d=0.02,afade=t=out:st={duration-.02:.12g}:d=0.02'
        )
        prepared_noise = np.frombuffer(ffmpeg([
            '-i', str(noise), '-af', noise_filter, '-f', 'f64le', '-c:a', 'pcm_f64le', 'pipe:1']), dtype='<f8')
        assert len(prepared_noise) == len(original), 'Noise excerpt is too short'
        signal_power = float(np.mean(original ** 2))
        noise_power = float(np.mean(prepared_noise ** 2))
        assert signal_power > 0 and noise_power > 0
        noise_gain = np.sqrt(signal_power / (noise_power * 10 ** (snr_db / 10)))
        mix_filter = (
            f'[0:a]aformat=sample_fmts=dbl:sample_rates={rate}:channel_layouts=mono[clean];'
            f'[1:a]{noise_filter},volume={noise_gain:.17g}:precision=double[noise];'
            '[clean][noise]amix=inputs=2:normalize=0:duration=first[mixed]'
        )
        mixed_float = np.frombuffer(ffmpeg([
            '-i', str(source), '-i', str(noise), '-filter_complex', mix_filter,
            '-map', '[mixed]', '-f', 'f64le', '-c:a', 'pcm_f64le', 'pipe:1']), dtype='<f8')
        assert len(mixed_float) == len(original)
        peak = float(np.max(np.abs(mixed_float)))
        assert np.all(np.isfinite(mixed_float)) and peak < .999, 'Raise SNR to leave clipping headroom'
        expected = original + prepared_noise * noise_gain
        mix_error = float(np.max(np.abs(mixed_float - expected)))
        assert mix_error < 1e-6, 'Mix must preserve original amplitude and only add noise'
        noisy_path = output / f'{domain.lower()}-noisy-input.wav'
        ffmpeg(['-f', 'f64le', '-ar', str(rate), '-ac', '1', '-i', 'pipe:0',
                '-c:a', 'pcm_s16le', str(noisy_path)], mixed_float.astype('<f8').tobytes())
        output_rate, noisy = signal(noisy_path)
        assert output_rate == rate and len(noisy) == len(original)
        pcm_error = float(np.max(np.abs(noisy - expected)))
        assert pcm_error < 1 / 32768
        measured_snr = float(10 * np.log10(signal_power / np.mean((noisy - original) ** 2)))
        assert abs(measured_snr - snr_db) < .01
        assert digest(source) == source_hash and digest(noise) == noise_hash
        checks = {
            'sourceUnchanged': True, 'outputIsOriginalInput': True,
            'sameSampleCountAndRate': True, 'floatMixMaxError': mix_error,
            'pcmMixMaxError': pcm_error, 'measuredSnrDb': measured_snr,
            'noisyFloatPeak': peak, 'noClipping': True,
        }
        records.append({
            'domain': domain, 'sourceExampleId': source_id,
            'source': {'url': clean_url, 'sha256': source_hash},
            'input': noisy_path.name, 'output': clean_url,
            'duration': duration, 'sampleRate': rate, 'channels': 1,
            'noiseGain': float(noise_gain), 'snrDb': snr_db,
            'snrDefinition': 'Full-clip mean signal power divided by added-noise power, including source silences.',
            'noiseFilter': noise_filter, 'mixFilter': mix_filter,
            'construction': 'MUSAN background noise is added to the existing recording for the input. The output is the unmodified original, not a denoising-model prediction; existing ambience in the source is retained.',
            'checks': checks, 'sha256': {noisy_path.name: digest(noisy_path)},
        })
        print(json.dumps({'domain': domain, 'duration': duration, 'checks': checks}, indent=2))
    metadata = {
        'generatedAt': datetime.now(timezone.utc).isoformat(),
        'method': 'FFmpeg additive mixing without automatic normalization',
        'noise': {'file': noise.name, 'sha256': noise_hash,
                  'provenance': 'assets/audio/musan-noise-source.json'},
        'examples': records,
    }
    (output / 'denoising-generation.json').write_text(json.dumps(metadata, indent=2) + '\n')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument('--noise', type=Path)
    parser.add_argument('--output', type=Path)
    parser.add_argument('--cache', type=Path)
    parser.add_argument('--snr-db', type=float, default=SNR_DB)
    args = parser.parse_args()
    with tempfile.TemporaryDirectory(prefix='audioedit-denoising-') as temporary:
        build(args.root, args.output or args.root / 'assets/audio', args.cache or Path(temporary),
              args.noise or args.root / 'assets/audio/musan-background-noise.wav', args.snr_db)
