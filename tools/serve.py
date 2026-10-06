#!/usr/bin/env python3
"""Static development server with caching disabled.

Usage: python3 tools/serve.py [port]
"""
import http.server
import os
import sys


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


def main() -> None:
    os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    print(f'Vector Space: http://localhost:{port}/')
    http.server.ThreadingHTTPServer(('', port), NoCacheHandler).serve_forever()


if __name__ == '__main__':
    main()
