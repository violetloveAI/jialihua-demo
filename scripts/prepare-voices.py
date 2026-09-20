#!/usr/bin/env python3
"""Generate ordinary Mandarin demo samples with the existing MBTI voice presets.

Requires Python 3 and uvx. edge-tts is isolated in uvx's cache; no project
dependency or API key is added. Only the fictional text in voice-options.json
is sent to Microsoft's online speech service.
"""

import argparse
from collections import Counter
import json
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile


ROOT = Path(__file__).resolve().parents[1]
OPTIONS = ROOT / "src/voice-options.json"
DESTINATION = ROOT / "public/voices"
REFERENCE = ROOT.parents[1] / "mbti绿人组企划/配音设定/小艺_默认声线参考.mp3"
VOICE_MODELS = {
    "xiaoyi": "zh-CN-XiaoyiNeural",
    "xiaoxiao-warm": "zh-CN-XiaoxiaoNeural",
    "xiaoxiao-bright": "zh-CN-XiaoxiaoNeural",
    "yunxi": "zh-CN-YunxiNeural",
    "yunyang": "zh-CN-YunyangNeural",
    "yunjian": "zh-CN-YunjianNeural",
}


def media_info(path):
    """Check media structure and obtain duration without a Python dependency."""
    if not path.is_file() or path.stat().st_size < 1000:
        raise ValueError(f"Missing or empty audio: {path}")
    with path.open("rb") as stream:
        header = stream.read(3)
    if not (header == b"ID3" or (header[0] == 0xFF and header[1] & 0xE0 == 0xE0)):
        raise ValueError(f"Not an MP3 stream: {path}")
    duration = None
    if shutil.which("ffprobe"):
        result = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration",
             "-of", "default=noprint_wrappers=1:nokey=1", str(path)],
            capture_output=True, text=True, check=True, timeout=30,
        )
        duration = float(result.stdout.strip())
    elif shutil.which("afinfo"):
        result = subprocess.run(
            ["afinfo", str(path)], capture_output=True, text=True,
            check=True, timeout=30,
        )
        match = re.search(r"estimated duration:\s*([\d.]+)\s*sec", result.stdout)
        if not match:
            raise ValueError(f"afinfo could not inspect audio duration: {path}")
        duration = float(match.group(1))
    if duration is not None and duration <= 0:
        raise ValueError(f"Invalid audio duration: {path}")
    return {"file": path.name, "bytes": path.stat().st_size,
            "durationSeconds": round(duration, 3) if duration is not None else None}


def load_options():
    options = json.loads(OPTIONS.read_text(encoding="utf-8"))
    if Counter(item["role"] for item in options) != {
        "narrator": 3, "granddaughter": 3, "son": 3,
    }:
        raise ValueError("Expected three samples for each of the three roles")
    ids = [item["id"] for item in options]
    if len(ids) != len(set(ids)):
        raise ValueError("Sample IDs must be unique")
    for item in options:
        if not re.fullmatch(r"(?:narrator|granddaughter|son)-[abc]", item["id"]):
            raise ValueError("Unexpected sample ID")
        if item["url"] != f'/voices/{item["id"]}.mp3':
            raise ValueError("Audio URLs must point into public/voices")
        if item["voiceKey"] not in VOICE_MODELS or item["language"] != "普通话":
            raise ValueError("Only the configured Mandarin voice presets are allowed")
    return options


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--validate-only", action="store_true", help="Inspect existing audio without network calls")
    parser.add_argument("--force", action="store_true", help="Regenerate existing samples")
    parser.add_argument("--only", nargs="+", help="Generate or validate selected sample IDs")
    parser.add_argument("--reference", type=Path, default=REFERENCE, help="Read-only source of the original Xiaoyi reference")
    args = parser.parse_args()
    options = load_options()
    if args.only:
        unknown = set(args.only) - {item["id"] for item in options}
        if unknown:
            parser.error(f"Unknown sample IDs: {', '.join(sorted(unknown))}")
        options = [item for item in options if item["id"] in args.only]
    if not args.validate_only and not shutil.which("uvx"):
        parser.error("uvx is required to run the isolated edge-tts 7.2.8 client")
    if not args.validate_only:
        DESTINATION.mkdir(parents=True, exist_ok=True)
    for item in options:
        destination = DESTINATION / f'{item["id"]}.mp3'
        if not args.validate_only and (args.force or not destination.exists()):
            # Use an atomic replacement so failed generation leaves existing audio intact.
            with tempfile.NamedTemporaryFile(dir=DESTINATION, suffix=".part.mp3", delete=False) as stream:
                temporary = Path(stream.name)
            try:
                subprocess.run(
                    ["uvx", "--from", "edge-tts==7.2.8", "edge-tts",
                     "--voice", VOICE_MODELS[item["voiceKey"]],
                     f'--rate={item["rate"]}', f'--pitch={item["pitch"]}',
                     "--volume=+0%", "--text", item["text"],
                     "--write-media", str(temporary)],
                    check=True, timeout=90,
                )
                media_info(temporary)
                temporary.replace(destination)
            finally:
                temporary.unlink(missing_ok=True)
        print(json.dumps(media_info(destination), ensure_ascii=False), flush=True)
    reference_destination = DESTINATION / "mbti-xiaoyi-reference.mp3"
    if not args.validate_only and args.reference.is_file():
        media_info(args.reference)
        shutil.copy2(args.reference, reference_destination)
    if reference_destination.exists():
        print(json.dumps(media_info(reference_destination), ensure_ascii=False), flush=True)
    elif not args.only:
        raise FileNotFoundError("Original Xiaoyi reference is missing; pass --reference with the local source MP3")


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, subprocess.SubprocessError) as error:
        print(f"Voice preparation failed: {error}", file=sys.stderr)
        sys.exit(1)
