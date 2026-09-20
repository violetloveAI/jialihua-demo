"""Xiaoyi audio and provider word boundaries in one request; no credentials."""
import asyncio
import json
import pathlib
import sys
import edge_tts

async def main():
    source, output, timing, voice, rate, pitch = sys.argv[1:]
    speech = edge_tts.Communicate(pathlib.Path(source).read_text(), voice, rate=rate,
                                 pitch=pitch, boundary="WordBoundary")
    words = []
    with open(output, "wb") as audio:
        async for packet in speech.stream():
            if packet["type"] == "audio":
                audio.write(packet["data"])
            elif packet["type"] == "WordBoundary":
                words.append({"text": packet["text"], "start": packet["offset"] / 10_000_000,
                              "end": (packet["offset"] + packet["duration"]) / 10_000_000})
    pathlib.Path(timing).write_text(json.dumps(words, ensure_ascii=False))

asyncio.run(main())
