#!/usr/bin/env python3
"""Install CAGE Crop Intelligence dependencies and run its local web interface.

Python standard library only. All server traffic binds to 127.0.0.1.
"""
from __future__ import annotations

import argparse
import functools
import http.server
import os
from pathlib import Path
import platform
import shutil
import subprocess
import sys
import webbrowser


ROOT = Path(__file__).resolve().parent
DIST = ROOT / "dist"


def run(*args: str) -> None:
    print("\n→ " + " ".join(args), flush=True)
    subprocess.run(args, cwd=ROOT, check=True)


def ensure_node(bootstrap: bool) -> None:
    if shutil.which("node") and shutil.which("npm"):
        version = subprocess.check_output(["node", "--version"], text=True).strip()
        major = int(version.removeprefix("v").split(".")[0])
        if major < 20:
            raise RuntimeError(f"Node.js 20+ required; found {version}. Update Node.js and rerun.")
        print(f"✓ Node.js {version} and npm found")
        return

    if bootstrap and platform.system() == "Darwin" and shutil.which("brew"):
        print("Node.js missing. Installing with Homebrew (may require your confirmation)…")
        run("brew", "install", "node")
        if shutil.which("node") and shutil.which("npm"):
            return

    raise RuntimeError(
        "Node.js/npm not found. On macOS install Node.js 20+ from https://nodejs.org/ "
        "or install Homebrew and rerun with --bootstrap-node."
    )


def build() -> None:
    if not (ROOT / "package.json").is_file():
        raise RuntimeError("package.json missing: run this script inside the CAGE project folder")
    if (ROOT / "package-lock.json").exists():
        run("npm", "ci", "--no-audit", "--no-fund")
    else:
        run("npm", "install", "--no-audit", "--no-fund")
    run("npm", "run", "build")
    if not (DIST / "index.html").is_file():
        raise RuntimeError("Build did not create dist/index.html")


def serve(port: int, open_browser: bool) -> None:
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(DIST))
    with http.server.ThreadingHTTPServer(("127.0.0.1", port), handler) as server:
        url = f"http://127.0.0.1:{server.server_port}/"
        print(f"\n✓ CAGE Crop Intelligence is running locally at {url}")
        print("Your imported raster files are handled by the browser app; this server serves static files only.")
        print("Press Ctrl+C in this terminal to stop.\n")
        if open_browser:
            webbrowser.open(url)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            print("\nStopped.")


def main() -> int:
    parser = argparse.ArgumentParser(description="Install and run CAGE Crop Intelligence locally")
    parser.add_argument("--bootstrap-node", action="store_true", help="Install Node.js via existing Homebrew if missing (macOS)")
    parser.add_argument("--install-only", action="store_true", help="Install dependencies and build without launching the server")
    parser.add_argument("--no-browser", action="store_true", help="Do not automatically open a browser")
    parser.add_argument("--port", type=int, default=8765, help="Local HTTP port (default: 8765)")
    args = parser.parse_args()
    if not 0 <= args.port <= 65535:
        parser.error("--port must be between 0 and 65535")
    try:
        ensure_node(args.bootstrap_node)
        build()
        if not args.install_only:
            serve(args.port, not args.no_browser)
        return 0
    except (RuntimeError, subprocess.CalledProcessError, OSError, ValueError) as exc:
        print(f"\nError: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
