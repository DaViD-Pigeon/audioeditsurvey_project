#!/usr/bin/env python3
"""Build reproducible speech reverb/EQ illustrations with FFmpeg and NumPy."""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import subprocess
import wave

import numpy as np

RATE = 24000
SEED = 20261003
TAIL_SECONDS = 1.5
RT60 = 1.2
EQ_FILTER = 'bass=g=-9:f=350:t=q:w=0.707:r=f64,treble=g=7:f=2200:t=q:w=0.707:r=f64'
TEXT = 'The morning train leaves at nine, and the evening train leaves at six.'


def run(args, data=None):
    result = subprocess.run(args, input=data, capture_output=True)
    if result.returncode:
        raise RuntimeError(result.stderr.decode(errors='replace')[-4000:])
    return result.stdout


def pcm(path):
    with wave.open(str(path), 'rb') as audio:
        assert (audio.getnchannels(), audio.getsampwidth(), audio.getframerate()) == (1, 2, RATE)
        return np.frombuffer(audio.readframes(audio.getnframes()), dtype='<i2').astype(np.float64) / 32768


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def band_energy(samples, low, high):
    frequencies = np.fft.rfftfreq(len(samples), 1 / RATE)
    spectrum = np.fft.rfft(samples)
    return float(np.sum(np.abs(spectrum[(frequencies >= low) & (frequencies < high)]) ** 2))


def room_ir():
    samples = round(TAIL_SECONDS * RATE)
    rng = np.random.default_rng(SEED)
    noise = rng.standard_normal(samples)
    # A damped, dense tail supplements distinct early room reflections.
    alpha = np.exp(-2 * np.pi * 4500 / RATE)
    damped = np.empty(samples)
    previous = 0.0
    for index, value in enumerate(noise):
        previous = (1 - alpha) * value + alpha * previous
        damped[index] = previous
    t = np.arange(samples) / RATE
    envelope = 10 ** (-3 * t / RT60) * np.clip((t - .020) / .015, 0, 1)
    tail = damped * envelope
    tail *= .8 / np.sqrt(np.sum(tail ** 2))
    impulse = tail
    impulse[0] = .9
    reflections = [(.017, .34), (.031, .29), (.047, -.26), (.073, .20), (.107, -.16), (.149, .11)]
    for delay, gain in reflections:
        impulse[round(delay * RATE)] += gain
    return impulse.astype('<f4'), reflections


def build(source, output):
    output.mkdir(parents=True, exist_ok=True)
    source_hash = sha256(source)
    original = pcm(source)
    impulse, reflections = room_ir()
    ir_path = output / 'speech-room-impulse.wav'
    run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(RATE), '-ac', '1',
         '-i', 'pipe:0', '-c:a', 'pcm_f32le', str(ir_path)], impulse.tobytes())

    wet_path = output / 'speech-reverb-input.wav'
    wet_length = len(original) + len(impulse) - 1
    reverb_filter = (
        f'[0:a]apad=pad_len={len(impulse)-1}[padded];'
        '[padded][1:a]afir=irnorm=-1:dry=1:wet=1:irfmt=mono:precision=double,'
        f'atrim=end_sample={wet_length}[out]'
    )
    run(['ffmpeg', '-v', 'error', '-y', '-i', str(source), '-i', str(ir_path),
         '-filter_complex', reverb_filter, '-map', '[out]', '-c:a', 'pcm_s16le', str(wet_path)])
    eq_path = output / 'speech-eq-bright.wav'
    run(['ffmpeg', '-v', 'error', '-y', '-i', str(source), '-af', EQ_FILTER,
         '-c:a', 'pcm_s16le', str(eq_path)])

    wet, bright = pcm(wet_path), pcm(eq_path)
    assert len(wet) == wet_length
    assert len(bright) == len(original)
    for signal in [wet, bright]:
        assert float(np.max(np.abs(signal))) < .999, 'Clipping detected'
    fft_size = 1 << (wet_length - 1).bit_length()
    expected = np.fft.irfft(np.fft.rfft(original, fft_size) * np.fft.rfft(impulse, fft_size), fft_size)[:wet_length]
    convolution_error = float(np.max(np.abs(wet - expected)))
    assert convolution_error < 1 / 32768, f'Convolution mismatch: {convolution_error}'
    assert sha256(source) == source_hash, 'The clean output must remain unchanged'
    tail = wet[len(original):]
    assert np.count_nonzero(tail) > .1 * RATE, 'Reverb tail missing'
    low_gain = 10 * np.log10(band_energy(bright, 80, 300) / band_energy(original, 80, 300))
    high_gain = 10 * np.log10(band_energy(bright, 3000, 8000) / band_energy(original, 3000, 8000))
    assert low_gain < -3 and high_gain > 3, 'EQ must reduce bass and boost treble'
    checks = {
        'sourceUnchanged': True,
        'dryOutputIsOriginalInput': True,
        'eqSampleCountUnchanged': True,
        'reverbConvolutionMaxError': convolution_error,
        'reverbTailNonzeroSamples': int(np.count_nonzero(tail)),
        'eqLowBandGainDb_80_300Hz': float(low_gain),
        'eqHighBandGainDb_3000_8000Hz': float(high_gain),
        'reverbPeak': float(np.max(np.abs(wet))),
        'eqPeak': float(np.max(np.abs(bright))),
        'noClipping': True,
    }
    metadata = {
        'generatedAt': datetime.now(timezone.utc).isoformat(),
        'method': 'FFmpeg convolution reverb and shelving equalization',
        'inputText': TEXT,
        'source': {'file': source.name, 'sha256': source_hash, 'duration': len(original) / RATE,
                   'provenance': 'Controlled synthetic speech; see volume-generation.json.'},
        'sampleRate': RATE,
        'reverberation': {
            'input': wet_path.name, 'output': source.name,
            'inputDuration': len(wet) / RATE, 'outputDuration': len(original) / RATE,
            'construction': 'The wet input is synthesized from the original dry recording. The displayed output is that original dry recording, not a dereverberation-model prediction.',
            'impulseResponse': ir_path.name, 'randomSeed': SEED, 'tailSeconds': TAIL_SECONDS,
            'decayEnvelopeRT60Seconds': RT60, 'directGain': .9, 'diffuseTailL2Norm': .8,
            'earlyReflectionsSecondsGain': reflections, 'filter': reverb_filter,
        },
        'equalization': {
            'input': source.name, 'output': eq_path.name,
            'inputDuration': len(original) / RATE, 'outputDuration': len(bright) / RATE,
            'lowShelf': {'frequencyHz': 350, 'gainDb': -9, 'q': .707},
            'highShelf': {'frequencyHz': 2200, 'gainDb': 7, 'q': .707},
            'filter': EQ_FILTER,
        },
        'checks': checks,
        'sha256': {path.name: sha256(path) for path in [source, ir_path, wet_path, eq_path]},
    }
    (output / 'speech-acoustic-generation.json').write_text(json.dumps(metadata, indent=2) + '\n')
    print(json.dumps({'reverbDuration': len(wet) / RATE, 'eqDuration': len(bright) / RATE, 'checks': checks}, indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    assets = Path(__file__).resolve().parents[1] / 'assets/audio'
    parser.add_argument('--input', type=Path, default=assets / 'volume-input.wav')
    parser.add_argument('--output', type=Path, default=assets)
    arguments = parser.parse_args()
    build(arguments.input, arguments.output)
