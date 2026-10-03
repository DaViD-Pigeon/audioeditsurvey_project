#!/usr/bin/env python3
"""Build Music / Audio reverb and EQ illustrations from existing demo inputs."""
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

SEED = 20261003
TAIL_SECONDS = 1.5
RT60 = 1.2
EQ_FILTER = 'bass=g=-9:f=350:t=q:w=0.707:r=f64,treble=g=7:f=2200:t=q:w=0.707:r=f64'


def ffmpeg(args, data=None):
    result = subprocess.run(['ffmpeg', '-v', 'error', '-y', *args], input=data, capture_output=True)
    if result.returncode:
        raise RuntimeError(result.stderr.decode(errors='replace')[-4000:])
    return result.stdout


def signal(path):
    rate, channels, samples = pcm(path)
    assert channels == 1, 'These selected inputs are mono'
    return rate, np.asarray(samples, dtype=np.float64) / 32768


def room_ir(rate):
    noise = np.random.default_rng(SEED).standard_normal(round(TAIL_SECONDS * rate))
    alpha = np.exp(-2 * np.pi * 4500 / rate)
    damped = np.empty(len(noise))
    previous = 0.0
    for index, value in enumerate(noise):
        previous = (1 - alpha) * value + alpha * previous
        damped[index] = previous
    time = np.arange(len(noise)) / rate
    impulse = damped * 10 ** (-3 * time / RT60) * np.clip((time - .020) / .015, 0, 1)
    impulse *= .8 / np.sqrt(np.sum(impulse ** 2))
    impulse[0] = .9
    reflections = [(.017, .34), (.031, .29), (.047, -.26), (.073, .20), (.107, -.16), (.149, .11)]
    for delay, gain in reflections:
        impulse[round(delay * rate)] += gain
    return impulse.astype('<f4'), reflections


def band_energy(samples, rate, low, high):
    frequencies = np.fft.rfftfreq(len(samples), 1 / rate)
    spectrum = np.fft.rfft(samples)
    return float(np.sum(np.abs(spectrum[(frequencies >= low) & (frequencies < high)]) ** 2))


def write_pcm(samples, rate, path, gain=1.0):
    # Check floating-point samples before encoding, so clipping cannot go unnoticed.
    assert np.all(np.isfinite(samples))
    assert float(np.max(np.abs(samples))) * gain < .999, f'Insufficient headroom: {path.name}'
    ffmpeg(['-f', 'f64le', '-ar', str(rate), '-ac', '1', '-i', 'pipe:0',
            '-af', f'volume={gain:.17g}:precision=double',
            '-c:a', 'pcm_s16le', str(path)], samples.astype('<f8').tobytes())


def build(root, output, cache):
    examples = {item['id']: item for item in json.loads((root / 'data/media-examples.json').read_text())['examples']}
    output.mkdir(parents=True, exist_ok=True)
    cache.mkdir(parents=True, exist_ok=True)
    records = []
    for domain, (source_id, source_hash) in SOURCES.items():
        example = examples[source_id]
        source = cache / (source_id + '.wav')
        if not source.exists():
            request = urllib.request.Request(example['inputAudio'], headers={'User-Agent': 'AudioEditSurvey-acoustic-examples'})
            with urllib.request.urlopen(request, timeout=30) as response:
                source.write_bytes(response.read())
        assert digest(source) == source_hash, f'{source_id}: upstream input changed'
        rate, original = signal(source)
        impulse, reflections = room_ir(rate)
        ir_path = output / f'media-room-impulse-{rate}.wav'
        ffmpeg(['-f', 'f32le', '-ar', str(rate), '-ac', '1', '-i', 'pipe:0',
                '-c:a', 'pcm_f32le', str(ir_path)], impulse.tobytes())

        wet_length = len(original) + len(impulse) - 1
        reverb_filter = (
            f'[0:a]apad=pad_len={len(impulse)-1}[padded];'
            '[padded][1:a]afir=irnorm=-1:dry=1:wet=1:irfmt=mono:precision=double,'
            f'atrim=end_sample={wet_length}[out]'
        )
        wet_float = np.frombuffer(ffmpeg([
            '-i', str(source), '-i', str(ir_path), '-filter_complex', reverb_filter,
            '-map', '[out]', '-f', 'f64le', '-c:a', 'pcm_f64le', 'pipe:1']), dtype='<f8')
        bright_float = np.frombuffer(ffmpeg([
            '-i', str(source), '-af', EQ_FILTER, '-f', 'f64le', '-c:a', 'pcm_f64le', 'pipe:1']), dtype='<f8')
        wet_path = output / f'{domain}-reverb-input.wav'
        eq_path = output / f'{domain}-eq-bright.wav'
        reverb_gain = min(1.0, .95 / float(np.max(np.abs(wet_float))))
        write_pcm(wet_float, rate, wet_path, reverb_gain)
        write_pcm(bright_float, rate, eq_path)
        wet_rate, wet = signal(wet_path)
        eq_rate, bright = signal(eq_path)
        assert wet_rate == eq_rate == rate
        assert len(wet) == wet_length and len(bright) == len(original)

        fft_size = 1 << (wet_length - 1).bit_length()
        expected = np.fft.irfft(np.fft.rfft(original, fft_size) * np.fft.rfft(impulse, fft_size), fft_size)[:wet_length]
        convolution_error = float(np.max(np.abs(wet - expected * reverb_gain)))
        assert convolution_error < 1 / 32768, 'Unexpected reverb convolution'
        assert digest(source) == source_hash, 'The original must remain unchanged'
        tail_nonzero = int(np.count_nonzero(wet[len(original):]))
        assert tail_nonzero > .1 * rate, 'Reverb tail missing'
        low_gain = 10 * np.log10(band_energy(bright, rate, 80, 300) / band_energy(original, rate, 80, 300))
        high_gain = 10 * np.log10(band_energy(bright, rate, 3000, 8000) / band_energy(original, rate, 3000, 8000))
        assert low_gain < -3 and high_gain > 3, 'EQ must reduce bass and boost treble'
        checks = {
            'sourceUnchanged': True, 'dryOutputIsOriginalInput': True,
            'eqSampleCountUnchanged': True, 'reverbConvolutionMaxError': convolution_error,
            'reverbTailNonzeroSamples': tail_nonzero,
            'eqLowBandGainDb_80_300Hz': float(low_gain),
            'eqHighBandGainDb_3000_8000Hz': float(high_gain),
            'reverbFloatPeakBeforeHeadroomGain': float(np.max(np.abs(wet_float))),
            'reverbFloatPeak': float(np.max(np.abs(wet_float))) * reverb_gain,
            'eqFloatPeak': float(np.max(np.abs(bright_float))), 'noClipping': True,
        }
        records.append({
            'domain': example['domain'], 'sourceExampleId': source_id,
            'source': {'url': example['inputAudio'], 'page': example['sourceUrl'],
                       'sha256': source_hash, 'duration': len(original) / rate},
            'sampleRate': rate, 'channels': 1,
            'reverberation': {
                'input': wet_path.name, 'output': example['inputAudio'],
                'inputDuration': len(wet) / rate, 'outputDuration': len(original) / rate,
                'construction': 'Room reverberation is added to the existing recording for the input. The displayed output is the unmodified original, not a dereverberation-model prediction. Any ambience already present in the original is retained.',
                'impulseResponse': ir_path.name, 'randomSeed': SEED,
                'tailSeconds': TAIL_SECONDS, 'decayEnvelopeRT60Seconds': RT60,
                'directGain': .9, 'diffuseTailL2Norm': .8,
                'earlyReflectionsSecondsGain': reflections, 'filter': reverb_filter,
                'headroomGain': reverb_gain,
                'encodingFilter': f'volume={reverb_gain:.17g}:precision=double',
            },
            'equalization': {
                'input': example['inputAudio'], 'output': eq_path.name,
                'inputDuration': len(original) / rate, 'outputDuration': len(bright) / rate,
                'lowShelf': {'frequencyHz': 350, 'gainDb': -9, 'q': .707},
                'highShelf': {'frequencyHz': 2200, 'gainDb': 7, 'q': .707}, 'filter': EQ_FILTER,
            },
            'checks': checks,
            'sha256': {path.name: digest(path) for path in [ir_path, wet_path, eq_path]},
        })
        print(json.dumps({'domain': example['domain'], 'checks': checks}, indent=2))
    metadata = {'generatedAt': datetime.now(timezone.utc).isoformat(),
                'method': 'FFmpeg convolution reverb and shelving equalization', 'examples': records}
    (output / 'media-acoustic-generation.json').write_text(json.dumps(metadata, indent=2) + '\n')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument('--output', type=Path)
    parser.add_argument('--cache', type=Path)
    args = parser.parse_args()
    with tempfile.TemporaryDirectory(prefix='audioedit-media-acoustic-') as temporary:
        build(args.root, args.output or args.root / 'assets/audio', args.cache or Path(temporary))
