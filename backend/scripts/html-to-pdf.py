#!/usr/bin/env python3
"""HTML → PDF via headless Chrome/Chromium. Used for Hebrew RTL kitchen reports."""
from __future__ import annotations

import os
import shutil
import subprocess
import sys
import tempfile


def find_chrome() -> str:
    env = os.environ.get("CHROME_PATH") or os.environ.get("PUPPETEER_EXECUTABLE_PATH")
    if env and os.path.exists(env):
        return env
    candidates = [
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "/Applications/Chromium.app/Contents/MacOS/Chromium",
        "/usr/bin/google-chrome",
        "/usr/bin/google-chrome-stable",
        "/usr/bin/chromium",
        "/usr/bin/chromium-browser",
    ]
    for c in candidates:
        if os.path.exists(c):
            return c
    raise SystemExit("Chrome/Chromium not found. Set CHROME_PATH.")


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit("Usage: html-to-pdf.py <input.html> <output.pdf>")
    html_path = os.path.abspath(sys.argv[1])
    pdf_path = os.path.abspath(sys.argv[2])
    if not os.path.isfile(html_path):
        raise SystemExit(f"Missing html: {html_path}")

    chrome = find_chrome()
    os.makedirs(os.path.dirname(pdf_path) or ".", exist_ok=True)
    if os.path.exists(pdf_path):
        os.remove(pdf_path)

    cmd = [
        chrome,
        "--headless=new",
        "--disable-gpu",
        "--no-pdf-header-footer",
        "--disable-dev-shm-usage",
        "--allow-file-access-from-files",
        f"--print-to-pdf={pdf_path}",
        f"file://{html_path}",
    ]
    try:
        proc = subprocess.run(cmd, capture_output=True, timeout=25, check=False)
    except subprocess.TimeoutExpired as exc:
        raise SystemExit(f"Chrome PDF timed out: {exc}") from exc

    if proc.returncode != 0 or not os.path.isfile(pdf_path):
        err = (proc.stderr or b"").decode("utf-8", "replace")[:400]
        raise SystemExit(f"Chrome PDF failed (code {proc.returncode}): {err}")

    print(pdf_path)


if __name__ == "__main__":
    main()
