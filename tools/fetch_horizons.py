#!/usr/bin/env python3
"""Download the raw JPL Horizons tables used by build_ephemeris.py.

All queries: geocentric (500@399), ecliptic J2000 / ICRF, km and km/s,
UT time scale, CSV output.

Usage: python3 tools/fetch_horizons.py
"""
from __future__ import annotations

import urllib.parse
import urllib.request
from pathlib import Path

API = 'https://ssd.jpl.nasa.gov/api/horizons.api'
OUT_DIR = Path(__file__).resolve().parent.parent / 'data' / 'horizons' / 'artemis-ii'

COMMON = {
    'format': 'text',
    'MAKE_EPHEM': 'YES',
    'EPHEM_TYPE': 'VECTORS',
    'CENTER': '500@399',
    'OUT_UNITS': 'KM-S',
    'REF_PLANE': 'ECLIPTIC',
    'REF_SYSTEM': 'ICRF',
    'VEC_TABLE': '2',
    'CSV_FORMAT': 'YES',
    'TIME_TYPE': 'UT',
    'VEC_LABELS': 'NO',
}

# file name -> (target, start, stop, step). Orion coverage ends at 2026-04-10 23:51 UTC.
TABLES = {
    'orion_1m.txt': ('-1024', '2026-04-02 01:59:30', '2026-04-10 23:51', '1m'),
    'orion_tail_10s.txt': ('-1024', '2026-04-10 23:49:30', '2026-04-10 23:51', '9'),
    'moon_10m.txt': ('301', '2026-04-01 22:30', '2026-04-11 00:40', '10m'),
    'sun_1h.txt': ('10', '2026-04-01 22:00', '2026-04-11 01:00', '1h'),
}


def quoted(value: str) -> str:
    return f"'{value}'"


def fetch(params: dict[str, str]) -> str:
    query = urllib.parse.urlencode({k: (v if k == 'format' else quoted(v)) for k, v in params.items()})
    with urllib.request.urlopen(f'{API}?{query}', timeout=180) as response:
        return response.read().decode()


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for name, (target, start, stop, step) in TABLES.items():
        text = fetch({**COMMON, 'COMMAND': target, 'START_TIME': start, 'STOP_TIME': stop, 'STEP_SIZE': step})
        if '$$SOE' not in text:
            raise SystemExit(f'{name}: Horizons returned no ephemeris table\n{text[-800:]}')
        (OUT_DIR / name).write_text(text)
        print(f'{name}: {text.count(chr(10))} lines')

    header = fetch({'format': 'text', 'COMMAND': '-1024', 'MAKE_EPHEM': 'NO'})
    (OUT_DIR / 'header.txt').write_text(header)
    print('header.txt: mission event table and OEM file list')


if __name__ == '__main__':
    main()
