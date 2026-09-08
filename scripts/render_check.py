#!/usr/bin/env python3
"""Serve a static directory, screenshot it with headless Chromium, and check
that every local href/src resolves on disk.

    python3 scripts/render_check.py --dir public

Screenshots land in .render-check/ (desktop and mobile per page). Look at them
before showing them to anyone: an unstyled page is the failure this catches.
"""

import argparse
import functools
import http.server
import os
import re
import shutil
import socketserver
import subprocess
import sys
import threading
from pathlib import Path

CHROME_CANDIDATES = [
    "chromium", "chromium-browser", "google-chrome", "google-chrome-stable",
    "chrome", "headless_shell",
    "/usr/bin/chromium", "/usr/bin/chromium-browser",
    "/usr/bin/google-chrome-stable",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
]

VIEWPORTS = [("desktop", 1440, 900), ("mobile", 390, 844)]

LINK_RE = re.compile(r"""(?:href|src)\s*=\s*["']([^"'#?]+)""", re.I)


def find_chrome():
    for candidate in CHROME_CANDIDATES:
        path = shutil.which(candidate) or (candidate if os.path.exists(candidate) else None)
        if path:
            return path
    return None


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args, **kwargs):
        pass


def serve(directory: Path):
    handler = functools.partial(QuietHandler, directory=str(directory))
    httpd = socketserver.TCPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd, httpd.server_address[1]


def check_links(directory: Path, pages):
    """Report local href/src values that do not resolve on disk."""
    problems = []
    for page in pages:
        html = (directory / page).read_text(encoding="utf-8", errors="ignore")
        for raw in LINK_RE.findall(html):
            link = raw.strip()
            if not link or link.startswith(("http://", "https://", "//", "data:",
                                            "mailto:", "tel:", "javascript:")):
                continue
            target = directory / link.lstrip("/") if link.startswith("/") \
                else (directory / page).parent / link
            if not target.exists():
                problems.append(f"{page}: {link}")
    return problems


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dir", default="public", help="directory to serve")
    ap.add_argument("--out", default=".render-check", help="screenshot output directory")
    ap.add_argument("--pages", nargs="*", help="pages to render (default: index.html, 404.html)")
    args = ap.parse_args()

    directory = Path(args.dir).resolve()
    if not directory.is_dir():
        sys.exit(f"no such directory: {directory}")

    pages = args.pages or [p for p in ("index.html", "404.html")
                           if (directory / p).exists()]
    if not pages:
        sys.exit(f"no pages to render in {directory}")

    out = Path(args.out).resolve()
    out.mkdir(parents=True, exist_ok=True)

    problems = check_links(directory, pages)
    if problems:
        print("Unresolved local references:")
        for problem in problems:
            print(f"  ✗ {problem}")
    else:
        print("Local references: all resolve on disk.")

    chrome = find_chrome()
    if not chrome:
        sys.exit("\nNo Chromium binary found. Tried: " + ", ".join(CHROME_CANDIDATES[:6]))

    httpd, port = serve(directory)
    shots = []
    try:
        for page in pages:
            for label, width, height in VIEWPORTS:
                target = out / f"{Path(page).stem}-{label}.png"
                subprocess.run([
                    chrome,
                    "--headless=new",
                    "--disable-gpu",
                    "--no-sandbox",
                    "--hide-scrollbars",
                    "--force-device-scale-factor=1",
                    "--virtual-time-budget=6000",
                    f"--window-size={width},{height}",
                    f"--screenshot={target}",
                    f"http://127.0.0.1:{port}/{page}",
                ], check=True, capture_output=True)
                shots.append(target)
    except subprocess.CalledProcessError as exc:
        sys.exit(f"Chromium failed: {exc.stderr.decode(errors='ignore')[:500]}")
    finally:
        httpd.shutdown()

    print("\nScreenshots:")
    for shot in shots:
        size = shot.stat().st_size if shot.exists() else 0
        flag = "✗ empty" if size < 1000 else f"{size // 1024} KB"
        print(f"  {shot}  ({flag})")
    print("\nOpen each one and confirm styles applied, fonts loaded, layout intact.")

    sys.exit(1 if problems else 0)


if __name__ == "__main__":
    main()
