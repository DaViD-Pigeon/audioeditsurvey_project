#!/usr/bin/env python3
"""Generate survey speech samples with ScriptSpeech's SeedAudio client.

Credentials are read from environment variables or a hidden terminal prompt.
They are never written to the output metadata.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import getpass
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys


TEXT = "The morning train leaves at nine, and the evening train leaves at six."
DOCS_URL = "https://docs.volcengine.com/docs/DoubaoVoice/audio-generation-http?lang=zh"
CASES = {
    "prosody": {
        "file": "seed-speech-faster.wav",
        "mode": "TA2A",
        "audio_config": {"speech_rate": 40},
        "instruction": "Say the same sentence faster, keeping the same voice and words.",
        "prompt": (
            "请用@音频1中同一位说话人的音色和英语口音，急促、快速地说下面这句话。"
            "语速明显快于参考录音，紧凑连贯地快速读完，缩短停顿，但每个单词都要清楚。"
            "只朗读引号中的英文，逐字一致，不要增加解释、背景音或音乐："
            f'“{TEXT}”'
        ),
    },
    "identity": {
        "file": "seed-speech-new-voice.wav",
        "mode": "T2A",
        "instruction": "Change the voice to a deep, warm male voice, keeping the same words.",
        "prompt": (
            "一位成年男性，用低沉、浑厚、温暖、略带颗粒感的男中音，"
            "以自然平稳的语气、正常语速和标准美式英语说下面这句话。"
            "只朗读引号中的英文，逐字一致，不要增加解释、背景音或音乐："
            f'“{TEXT}”'
        ),
    },
}


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def probe(path: Path) -> dict:
    result = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries",
         "format=duration:stream=codec_name,sample_rate,channels", "-of", "json", str(path)],
        capture_output=True, text=True, check=True,
    )
    info = json.loads(result.stdout)
    return {"duration": float(info["format"]["duration"]), **info["streams"][0]}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--scriptspeech", type=Path, required=True)
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--app-id", default=os.environ.get("SEED_AUDIO_APP_ID"))
    parser.add_argument("--case", choices=["all", *CASES], default="all")
    args = parser.parse_args()
    sys.dont_write_bytecode = True
    sys.path.insert(0, str(args.scriptspeech.resolve()))
    from data_gen.model_clients.providers.volc_seed_audio import VolcSeedAudioClient

    class AppTokenSeedAudioClient(VolcSeedAudioClient):
        """Legacy app/token headers documented by the same SeedAudio endpoint."""
        def _headers(self, key: str, request_id: str) -> dict[str, str]:
            return {
                "Content-Type": "application/json",
                "X-Api-App-Id": args.app_id,
                "X-Api-Access-Key": key,
                "X-Api-Request-Id": request_id,
            }

    credential = (
        os.environ.get("SEED_AUDIO_ACCESS_TOKEN") if args.app_id
        else os.environ.get("SEED_AUDIO_API_KEY")
    ) or getpass.getpass("SeedAudio credential (hidden): ")
    if not credential:
        raise SystemExit("SeedAudio credential is required.")
    args.output.mkdir(parents=True, exist_ok=True)
    input_info = probe(args.input)
    if input_info["duration"] > 30 or args.input.stat().st_size > 10 * 1024 * 1024:
        raise SystemExit("Reference recording exceeds SeedAudio limits.")
    client_type = AppTokenSeedAudioClient if args.app_id else VolcSeedAudioClient
    chosen = CASES if args.case == "all" else {args.case: CASES[args.case]}
    with client_type(
        model_name="seed-audio-1.0", api_keys=credential,
        api_base="https://openspeech.bytedance.com", create_path="/api/v3/tts/create",
        max_retries=0, timeout=300,
    ) as client:
        for name, case in chosen.items():
            target = args.output / case["file"]
            if target.exists():
                print(json.dumps({"case": name, "status": "already exists", "file": target.name}), flush=True)
                continue
            print(json.dumps({"case": name, "status": "generating", "mode": case["mode"]}), flush=True)
            audio_config = {"format": "wav", "sample_rate": 24000, "enable_subtitle": True,
                            **case.get("audio_config", {})}
            try:
                result = client.generate(
                    case["prompt"],
                    references=[{"audio_path": str(args.input)}] if case["mode"] == "TA2A" else None,
                    audio_config=audio_config,
                )
            except Exception as error:
                message = str(error).replace(credential, "[redacted]")
                if args.app_id:
                    message = message.replace(args.app_id, "[app id]")
                print(json.dumps({"case": name, "status": "failed", "error": message}, ensure_ascii=False), flush=True)
                raise SystemExit(1) from None
            result.save(target)
            output_info = probe(target)
            record = {
                "generatedAt": datetime.now(timezone.utc).isoformat(),
                "model": result.model,
                "mode": case["mode"],
                "apiDocumentation": DOCS_URL,
                "generationPrompt": case["prompt"],
                "editingInstruction": case["instruction"],
                "inputText": TEXT,
                "outputText": TEXT,
                "input": {"file": args.input.name, "sha256": sha256(args.input), **input_info},
                "referenceInputUsed": case["mode"] == "TA2A",
                "output": {"file": target.name, "sha256": sha256(target), **output_info},
                "audioConfig": audio_config,
                "responseDuration": result.duration,
                "originalDuration": result.original_duration,
                "subtitle": result.subtitle,
            }
            (args.output / (target.stem + ".json")).write_text(
                json.dumps(record, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
            )
            print(json.dumps({"case": name, "status": "generated", "file": target.name,
                              "duration": output_info["duration"], "subtitle": result.subtitle},
                             ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
