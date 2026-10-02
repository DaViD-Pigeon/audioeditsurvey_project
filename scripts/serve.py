#!/usr/bin/env python3
"""Loopback-only preview with the GitHub Pages project path."""
import argparse
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
PREFIX = '/audioeditsurvey_project/'

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self):
        path = unquote(urlsplit(self.path).path)
        if path in ('/', PREFIX.rstrip('/')):
            self.send_response(302)
            self.send_header('Location', PREFIX)
            self.end_headers()
            return
        if not path.startswith(PREFIX) or any(part.startswith('.') for part in path.split('/')):
            self.send_error(404)
            return
        self.path = self.path[len(PREFIX)-1:]
        super().do_GET()

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def list_directory(self, path):
        self.send_error(404)
        return None

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=8000)
    args = parser.parse_args()
    server = ThreadingHTTPServer(('127.0.0.1', args.port), Handler)
    print(f'Preview: http://127.0.0.1:{args.port}{PREFIX}', flush=True)
    try: server.serve_forever()
    except KeyboardInterrupt: pass
    finally: server.server_close()
