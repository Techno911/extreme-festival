#!/usr/bin/env python3
"""
Local Whisper transcription via faster-whisper.
Usage: python3 whisper_transcribe.py <audio_file_path>
Prints transcription to stdout, errors to stderr.
Model: small (500MB, good Russian quality, fits in 4GB RAM)
"""

import sys
import os

# Подставляем ffmpeg из imageio-ffmpeg если системный не найден
try:
    import imageio_ffmpeg
    ffmpeg_path = imageio_ffmpeg.get_ffmpeg_exe()
    os.environ["PATH"] = os.path.dirname(ffmpeg_path) + os.pathsep + os.environ.get("PATH", "")
    # faster-whisper ищет ffmpeg в PATH — добавляем симлинк если нужно
    if not os.path.exists("/usr/local/bin/ffmpeg"):
        os.makedirs("/usr/local/bin", exist_ok=True)
except Exception:
    pass

def transcribe(file_path):
    from faster_whisper import WhisperModel

    # Cache dir: ~/.cache/whisper (model downloaded once)
    model = WhisperModel("small", device="cpu", compute_type="int8")

    segments, info = model.transcribe(file_path, language="ru", beam_size=5)

    text = " ".join(segment.text.strip() for segment in segments)
    print(text)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("[Ошибка: не указан путь к файлу]", file=sys.stderr)
        sys.exit(1)

    file_path = sys.argv[1]

    if not os.path.exists(file_path):
        print(f"[Ошибка: файл не найден: {file_path}]", file=sys.stderr)
        sys.exit(1)

    try:
        transcribe(file_path)
    except Exception as e:
        print(f"[Ошибка транскрипции: {e}]", file=sys.stderr)
        sys.exit(1)
