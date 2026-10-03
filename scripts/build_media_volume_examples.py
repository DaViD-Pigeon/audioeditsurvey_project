#!/usr/bin/env python3
"""Build Music / Audio percentage-volume examples from existing demo inputs."""
import argparse
import array
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import urllib.request
import wave

SOURCES = {
    'music': ('auk-lyric', '86b17d8cb34ca40c5feb8e2ff61fe793887f779c72a7742c8cac662243341275'),
    'audio': ('omni-add', '48e43e07fd21b7a0afc10611ae523527c922f00a5e314a27ecf09e84f04cabe9'),
}


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def pcm(path):
    with wave.open(str(path), 'rb') as stream:
        assert stream.getsampwidth() == 2, 'Expected 16-bit PCM source'
        samples = array.array('h', stream.readframes(stream.getnframes()))
        if sys.byteorder != 'little':
            samples.byteswap()
        return stream.getframerate(), stream.getnchannels(), samples


def run(args):
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', *args], check=True)


def build(root, output, cache):
    examples = {e['id']: e for e in json.loads((root / 'data/media-examples.json').read_text())['examples']}
    output.mkdir(parents=True, exist_ok=True)
    cache.mkdir(parents=True, exist_ok=True)
    records = []
    for domain, (source_id, source_sha) in SOURCES.items():
        example = examples[source_id]
        source = cache / (source_id + '.wav')
        if not source.exists():
            request = urllib.request.Request(example['inputAudio'], headers={'User-Agent': 'AudioEditSurvey-volume-examples'})
            with urllib.request.urlopen(request, timeout=30) as response:
                source.write_bytes(response.read())
        assert digest(source) == source_sha, f'{source_id}: upstream input changed'
        rate, channels, original = pcm(source)
        frames = len(original) // channels
        boundary = rate * 3
        split = boundary * channels
        assert frames > boundary
        assert max(abs(x) for x in original) * 1.25 < 32767, 'Insufficient headroom'

        global_filter = 'volume=1.25:precision=double'
        # Split by sample count so that gain changes exactly at 3.000 s.
        local_filter = (
            f'[0:a]asplit=2[first][rest];'
            f'[first]atrim=end_sample={boundary},asetpts=PTS-STARTPTS[head];'
            f'[rest]atrim=start_sample={boundary},asetpts=PTS-STARTPTS,'
            f'volume=0.5:precision=double[tail];'
            f'[head][tail]concat=n=2:v=0:a=1[out]'
        )
        global_name = f'{domain}-volume-plus25.wav'
        local_name = f'{domain}-volume-from3s-50.wav'
        run(['-i', str(source), '-af', global_filter, '-c:a', 'pcm_s16le', str(output / global_name)])
        run(['-i', str(source), '-filter_complex', local_filter, '-map', '[out]',
             '-c:a', 'pcm_s16le', str(output / local_name)])
        global_rate, global_channels, louder = pcm(output / global_name)
        local_rate, local_channels, quieter = pcm(output / local_name)
        assert (rate, channels, len(original)) == (global_rate, global_channels, len(louder))
        assert (rate, channels, len(original)) == (local_rate, local_channels, len(quieter))
        assert quieter[:split] == original[:split]
        global_error = max(abs(y - x * 1.25) for x, y in zip(original, louder))
        tail_error = max(abs(y - x * .5) for x, y in zip(original[split:], quieter[split:]))
        assert global_error <= 1 and tail_error <= 1, 'Unexpected gain or boundary'
        peak = max(max(abs(x) for x in samples) for samples in (original, louder, quieter))
        assert peak < 32767, 'Clipping'
        records.append({
            'domain': example['domain'], 'sourceExampleId': source_id,
            'inputAudio': example['inputAudio'], 'sourceUrl': example['sourceUrl'],
            'sourceSha256': source_sha, 'sampleRate': rate, 'channels': channels,
            'frames': frames, 'duration': frames / rate, 'gainChangeAt': 3,
            'gainChangeSample': boundary,
            'filters': {global_name: global_filter, local_name: local_filter},
            'checks': {'globalGain': 1.25, 'tailGain': .5, 'first3SecondsBitExact': True,
                       'globalMaxErrorPCM': global_error, 'tailMaxErrorPCM': tail_error,
                       'peakSample': peak, 'sameFrameCount': True},
            'sha256': {name: digest(output / name) for name in (global_name, local_name)},
        })
    metadata = {'generated': datetime.now(timezone.utc).isoformat(),
                'method': 'FFmpeg linear amplitude gains; sample-exact split at 3 seconds',
                'examples': records}
    (output / 'media-volume-generation.json').write_text(json.dumps(metadata, indent=2) + '\n')
    print(json.dumps(metadata, indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument('--output', type=Path)
    parser.add_argument('--cache', type=Path)
    args = parser.parse_args()
    with tempfile.TemporaryDirectory(prefix='audioedit-media-volume-') as temporary:
        build(args.root, args.output or args.root / 'assets/audio', args.cache or Path(temporary))
