#!/usr/bin/env python3
"""Build src/mission/artemis-ii/ephemeris.js from the raw JPL Horizons tables.

Horizons publishes Orion (-1024) from ICPS separation (MET 0/03:24:18) to
2026-04-10 23:51:00 UTC. Outside that window the path is reconstructed and
flagged as such in the output (`source` = 0):

  0 .. ARM          ascent blend + 185 x 2223 km checkout orbit (NASA figures)
  ARM burn window   smooth blend into the back-propagated orbit
  ARM .. separation back-propagation of the first JPL state (gravity + J2)
  23:51 UTC .. EI   forward propagation of the last JPL state (gravity + J2)
  EI .. splashdown  guided-entry profile to the NASA recovery point

Usage: python3 tools/build_ephemeris.py
"""
from __future__ import annotations

import json
import math
from pathlib import Path

from orbit import (
    MU_EARTH,
    R_EARTH,
    EarthFrame,
    State,
    Table,
    apoapsis_altitude,
    decimate,
    dot,
    finite_difference_velocity,
    great_circle_km,
    great_circle_point,
    norm,
    propagate,
    slerp,
)

ROOT = Path(__file__).resolve().parent.parent
RAW_DIR = ROOT / 'data' / 'horizons' / 'artemis-ii'
OUT_FILE = ROOT / 'src' / 'mission' / 'artemis-ii' / 'ephemeris.js'

LAUNCH_JD = 2461131.5 + (22 * 3600 + 35 * 60 + 12) / 86400  # 2026-04-01 22:35:12 UTC


def met(d: int, h: int = 0, m: int = 0, s: float = 0) -> float:
    return d * 86400 + h * 3600 + m * 60 + s


T_INSERTION = 500.0  # approximate main engine cut-off / orbit insertion
T_ARM = met(0, 1, 47, 57)  # apogee raise maneuver start (Horizons event table)
ARM_BURN_S = 900.0  # approximate ICPS burn duration
T_SPLASHDOWN = met(9, 1, 32, 15)  # 2026-04-11 00:07:27 UTC
CHECKOUT_APOGEE_KM = 2223.0
ENTRY_INTERFACE_KM = 122.0
DROGUE_ALTITUDE_KM = 7.6
LAUNCH_PAD = (math.radians(28.6272), math.radians(-80.6208))  # LC-39B
SPLASHDOWN_SITE = (math.radians(32.3), math.radians(-117.8))

INTERPOLATION_TOLERANCE_KM = 0.25
MOON_TOLERANCE_KM = 0.05

earth = EarthFrame(LAUNCH_JD)


def load_horizons_vectors(name: str) -> list[State]:
    """Parse a Horizons CSV vector table (VEC_TABLE=2, TIME_TYPE=UT) into MET-stamped states."""
    states, inside = [], False
    for line in (RAW_DIR / name).read_text().splitlines():
        if line.startswith('$$SOE'):
            inside = True
        elif line.startswith('$$EOE'):
            break
        elif inside:
            cols = [c.strip() for c in line.split(',')]
            t = round((float(cols[0]) - LAUNCH_JD) * 86400, 1)
            states.append(State(t, [float(c) for c in cols[2:5]], [float(c) for c in cols[5:8]]))
    return states


def blend(a: State, b: State, w: float, t: float) -> State:
    return State(t, [a.p[i] * (1 - w) + b.p[i] * w for i in range(3)], [a.v[i] * (1 - w) + b.v[i] * w for i in range(3)])


def smoothstep(x: float) -> float:
    return x * x * (3 - 2 * x)


def reconstruct_launch_segment(first_jpl: State) -> list[State]:
    """Launch pad .. first JPL vector."""
    back = propagate(first_jpl, T_ARM, step=2.0, sample_every=30.0)[::-1]
    arm = back[0]

    # ARM is a perigee burn: the checkout orbit has its perigee at the ARM point.
    r_p = norm(arm.p)
    a = (r_p + R_EARTH + CHECKOUT_APOGEE_KM) / 2
    speed = math.sqrt(MU_EARTH * (2 / r_p - 1 / a))
    radial = [x / r_p for x in arm.p]
    v_radial = dot(radial, arm.v)
    horizontal = [arm.v[k] - v_radial * radial[k] for k in range(3)]
    checkout_v = [x / norm(horizontal) * speed for x in horizontal]
    checkout_start = State(arm.met, arm.p, checkout_v)

    checkout = propagate(checkout_start, T_INSERTION, step=2.0, sample_every=20.0)[::-1]
    insertion = checkout[0]

    checkout_after_arm = Table(propagate(checkout_start, T_ARM + ARM_BURN_S, step=2.0, sample_every=10.0))
    post_arm = Table(back)
    burn = []
    for k in range(1, int(ARM_BURN_S // 10)):
        t = T_ARM + k * 10
        burn.append(blend(checkout_after_arm.at(t), post_arm.at(t), smoothstep(k * 10 / ARM_BURN_S), t))
    coast = [s for s in back if s.met >= T_ARM + ARM_BURN_S]

    insertion_alt = earth.to_geodetic(insertion.p, insertion.met)[2]

    def ascent_position(t: float) -> list[float]:
        s = max(0.0, min(1.0, t / insertion.met))
        pad = earth.to_ecliptic(*LAUNCH_PAD, 0.0, t)
        direction = slerp(pad, insertion.p, smoothstep(s) ** 2)
        r = R_EARTH + insertion_alt * math.sin(s * math.pi / 2) ** 1.2
        return [x * r for x in direction]

    ascent = [
        State(t, ascent_position(t), finite_difference_velocity(ascent_position, t, 0, insertion.met))
        for t in (i * 10.0 for i in range(int(insertion.met // 10) - 1))
    ]
    ascent.append(insertion)
    return ascent + checkout[1:] + burn + coast[:-1]


def reconstruct_entry_segment(last_jpl: State) -> tuple[list[State], dict]:
    """Last JPL vector .. splashdown."""
    coast = propagate(
        last_jpl, last_jpl.met + 1200, step=0.5, sample_every=10.0,
        stop=lambda r: norm(r) - R_EARTH <= ENTRY_INTERFACE_KM,
    )
    ei = coast[-1]
    lat, lon, _ = earth.to_geodetic(ei.p, ei.met)
    ei_site = (lat, lon)
    downrange = great_circle_km(ei_site, SPLASHDOWN_SITE)
    v_radial = dot(ei.p, ei.v) / norm(ei.p)
    v_horizontal = math.sqrt(max(0.0, dot(ei.v, ei.v) - v_radial**2))
    shape = 1.6
    t_hypersonic = shape * downrange / v_horizontal

    def entry_position(t: float) -> list[float]:
        u = max(0.0, min(1.0, (t - ei.met) / t_hypersonic))
        site = great_circle_point(ei_site, SPLASHDOWN_SITE, 1 - (1 - u) ** shape)
        if t <= ei.met + t_hypersonic:
            alt = DROGUE_ALTITUDE_KM + (ENTRY_INTERFACE_KM - DROGUE_ALTITUDE_KM) * (1 - u) ** 1.35
        else:
            w = (t - ei.met - t_hypersonic) / (T_SPLASHDOWN - ei.met - t_hypersonic)
            alt = DROGUE_ALTITUDE_KM * (1 - w) ** 1.15
        return earth.to_ecliptic(*site, alt, t)

    entry, t = [], ei.met + 5
    while t < T_SPLASHDOWN:
        entry.append(State(t, entry_position(t), finite_difference_velocity(entry_position, t, ei.met, T_SPLASHDOWN)))
        t += 5 if t < ei.met + t_hypersonic else 20
    entry.append(State(T_SPLASHDOWN, entry_position(T_SPLASHDOWN),
                       finite_difference_velocity(entry_position, T_SPLASHDOWN, ei.met, T_SPLASHDOWN)))

    info = {
        'entryInterfaceMet': round(ei.met, 1),
        'entryInterfaceSpeedKmS': round(norm(ei.v), 3),
        'entryFlightPathAngleDeg': round(math.degrees(math.asin(v_radial / norm(ei.v))), 2),
        'entryDownrangeKm': round(downrange),
    }
    return decimate(coast[1:], INTERPOLATION_TOLERANCE_KM) + entry, info


def verify(orion: list[State], moon: list[State]) -> dict:
    """Mission figures computed from the JPL vectors, compared with NASA numbers in the README."""
    moon_table = Table(moon)
    closest = min((math.dist(s.p, moon_table.at(s.met).p), s.met) for s in orion)
    farthest = max((norm(s.p), s.met) for s in orion)
    return {
        'closestMoonKm': round(closest[0], 1),
        'closestMoonMet': round(closest[1]),
        'maxEarthKm': round(farthest[0], 1),
        'maxEarthMet': round(farthest[1]),
    }


def flat(states: list[State], attr: str, digits: int) -> list[float]:
    return [round(c, digits) for s in states for c in getattr(s, attr)]


def main() -> None:
    orion = load_horizons_vectors('orion_1m.txt')
    orion += [s for s in load_horizons_vectors('orion_tail_10s.txt') if s.met > orion[-1].met + 1]
    moon = load_horizons_vectors('moon_10m.txt')
    sun = load_horizons_vectors('sun_1h.txt')

    launch = decimate(reconstruct_launch_segment(orion[0]), INTERPOLATION_TOLERANCE_KM)
    jpl = decimate(orion, INTERPOLATION_TOLERANCE_KM)
    entry, entry_info = reconstruct_entry_segment(orion[-1])
    track = launch + jpl + entry
    source = [0] * len(launch) + [1] * len(jpl) + [0] * len(entry)

    stats = {
        **verify(orion, moon),
        **entry_info,
        'jplStartMet': orion[0].met,
        'jplEndMet': orion[-1].met,
        'jplSampleCount': len(orion),
        'highEarthOrbitApogeeKm': round(apoapsis_altitude(orion[0])),
    }
    moon_kept = decimate(moon, MOON_TOLERANCE_KM)

    data = {
        'spacecraft': {
            't': [s.met for s in track],
            'p': flat(track, 'p', 2),
            'v': flat(track, 'v', 6),
            'source': source,
        },
        'moon': {'t': [s.met for s in moon_kept], 'p': flat(moon_kept, 'p', 2), 'v': flat(moon_kept, 'v', 6)},
        'sun': {'t': [s.met for s in sun], 'dir': [round(c / norm(s.p), 5) for s in sun for c in s.p]},
        'stats': stats,
    }
    OUT_FILE.write_text(
        '// Generated by tools/build_ephemeris.py from data/horizons/artemis-ii. Do not edit by hand.\n'
        '// Geocentric ecliptic J2000 (ICRF), km and km/s; t = seconds after launch (UT).\n'
        '// spacecraft.source: 1 = JPL Horizons vector, 0 = reconstructed segment.\n'
        f'export const EPHEMERIS = {json.dumps(data, separators=(",", ":"))};\n'
    )
    print(json.dumps(stats, indent=2))
    print(f'{len(track)} spacecraft samples ({len(jpl)} of {len(orion)} JPL vectors kept), '
          f'{len(moon_kept)} Moon samples -> {OUT_FILE.relative_to(ROOT)} ({OUT_FILE.stat().st_size} bytes)')


if __name__ == '__main__':
    main()
