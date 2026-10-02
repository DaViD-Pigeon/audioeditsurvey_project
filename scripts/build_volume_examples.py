#!/usr/bin/env python3
"""Rebuild the survey's two controlled volume examples (macOS + FFmpeg)."""
import argparse
import array
import hashlib
import json
import math
from pathlib import Path
import subprocess
import sys
import tempfile
import wave

FIRST = 'The morning train leaves at nine,'
SECOND = 'and the evening train leaves at six.'
TEXT = FIRST + ' ' + SECOND
RATE = 24000

def run(args):
    subprocess.run(args, check=True, capture_output=True)

def pcm(path):
    with wave.open(str(path), 'rb') as stream:
        assert stream.getnchannels() == 1 and stream.getsampwidth() == 2
        samples = array.array('h', stream.readframes(stream.getnframes()))
        if sys.byteorder != 'little':
            samples.byteswap()
        return samples

def rms(samples):
    return math.sqrt(sum(float(x) ** 2 for x in samples) / len(samples))

def db_ratio(a, b):
    return 20 * math.log10(rms(a) / rms(b))

def build(output):
    output.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='audioedit-volume-') as temp:
        tmp = Path(temp)
        # Separately rendered clauses provide a reproducible linguistic boundary.
        for i, text in enumerate([FIRST, SECOND]):
            run(['say', '-v', 'Samantha', '-r', '165', '-o', str(tmp / f'{i}.aiff'), text])
            run(['ffmpeg', '-v', 'error', '-y', '-i', str(tmp / f'{i}.aiff'),
                 '-ar', str(RATE), '-ac', '1', '-c:a', 'pcm_s16le', str(tmp / f'{i}.wav')])
        first, second = pcm(tmp / '0.wav'), pcm(tmp / '1.wav')
        gap = array.array('h', [0] * int(RATE * .4))
        combined = first + gap + second
        if sys.byteorder != 'little':
            combined.byteswap()
        with wave.open(str(tmp / 'combined.wav'), 'wb') as stream:
            stream.setparams((1, 2, RATE, 0, 'NONE', 'not compressed'))
            stream.writeframes(combined.tobytes())
        peak = max(abs(x) for x in pcm(tmp / 'combined.wav')) / 32768
        preparation_gain = -10 - 20 * math.log10(peak)
        source = output / 'volume-input.wav'
        run(['ffmpeg', '-v', 'error', '-y', '-i', str(tmp / 'combined.wav'), '-af',
             f'volume={preparation_gain:.8f}dB', '-c:a', 'pcm_s16le', str(source)])
        # Activate in the middle of the known silent gap, before clause two.
        change_at = (len(first) + len(gap) / 2) / RATE
        second_start = (len(first) + len(gap)) / RATE
        filters = {
            'volume-global-plus6.wav': 'volume=6dB',
            'volume-second-minus10.wav': f"volume=-10dB:enable='gte(t,{change_at:.6f})'",
        }
        for filename, audio_filter in filters.items():
            run(['ffmpeg', '-v', 'error', '-y', '-i', str(source), '-af', audio_filter,
                 '-c:a', 'pcm_s16le', str(output / filename)])

        original = pcm(source)
        louder = pcm(output / 'volume-global-plus6.wav')
        quieter = pcm(output / 'volume-second-minus10.wav')
        assert len(original) == len(louder) == len(quieter)
        assert original[:len(first)] == quieter[:len(first)]
        tail = len(first) + len(gap)
        checks = {
            'globalGainDb': db_ratio(louder, original),
            'secondClauseGainDb': db_ratio(quieter[tail:], original[tail:]),
            'firstClauseBitExact': True,
            'peakSample': max(max(abs(x) for x in track) for track in [original, louder, quieter]),
        }
        assert abs(checks['globalGainDb'] - 6) < .01
        assert abs(checks['secondClauseGainDb'] + 10) < .01
        assert checks['peakSample'] < 32767
        meta = {
            'inputText': TEXT, 'source': 'Controlled synthetic speech; macOS Samantha, 165 words/minute',
            'sampleRate': RATE, 'duration': len(original) / RATE,
            'secondClauseStart': second_start, 'gainChangeAt': change_at,
            'filters': filters, 'checks': checks,
            'sha256': {name: hashlib.sha256((output / name).read_bytes()).hexdigest()
                       for name in ['volume-input.wav', *filters]},
        }
        (output / 'volume-generation.json').write_text(json.dumps(meta, indent=2) + '\n')
        print(json.dumps(meta, indent=2))

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path,
                        default=Path(__file__).resolve().parents[1] / 'assets/audio')
    build(parser.parse_args().output)
