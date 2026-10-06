"""Small orbital-mechanics toolkit used by the ephemeris builder (stdlib only).

Vectors are geocentric ecliptic J2000 in km and km/s; time is seconds of
mission elapsed time (MET). A State is (met, position, velocity).
"""
from __future__ import annotations

import bisect
import math
from typing import Callable, NamedTuple, Sequence

MU_EARTH = 398600.4418  # km^3/s^2
R_EARTH = 6378.137  # km
J2 = 1.08262668e-3
OBLIQUITY = math.radians(23.439291)

Vec = list[float]


class State(NamedTuple):
    met: float
    p: Vec
    v: Vec


def norm(v: Sequence[float]) -> float:
    return math.hypot(*v)


def dot(a: Sequence[float], b: Sequence[float]) -> float:
    return sum(x * y for x, y in zip(a, b))


def unit(v: Sequence[float]) -> Vec:
    n = norm(v)
    return [x / n for x in v]


def ecliptic_to_equatorial(v: Sequence[float]) -> Vec:
    c, s = math.cos(OBLIQUITY), math.sin(OBLIQUITY)
    return [v[0], c * v[1] - s * v[2], s * v[1] + c * v[2]]


def equatorial_to_ecliptic(v: Sequence[float]) -> Vec:
    c, s = math.cos(OBLIQUITY), math.sin(OBLIQUITY)
    return [v[0], c * v[1] + s * v[2], -s * v[1] + c * v[2]]


def gmst(julian_date_ut: float) -> float:
    d = julian_date_ut - 2451545.0
    t = d / 36525
    return math.radians((280.46061837 + 360.98564736629 * d + 0.000387933 * t * t) % 360)


class EarthFrame:
    """Converts between geodetic (spherical) coordinates and the ecliptic frame for a mission."""

    def __init__(self, launch_jd: float):
        self.launch_jd = launch_jd

    def _theta(self, met: float, lon: float) -> float:
        return gmst(self.launch_jd + met / 86400) + lon

    def to_ecliptic(self, lat: float, lon: float, alt_km: float, met: float) -> Vec:
        th = self._theta(met, lon)
        r = R_EARTH + alt_km
        return equatorial_to_ecliptic([r * math.cos(lat) * math.cos(th), r * math.cos(lat) * math.sin(th), r * math.sin(lat)])

    def to_geodetic(self, p: Sequence[float], met: float) -> tuple[float, float, float]:
        q = ecliptic_to_equatorial(p)
        r = norm(q)
        lon = math.atan2(q[1], q[0]) - gmst(self.launch_jd + met / 86400)
        return math.asin(q[2] / r), math.atan2(math.sin(lon), math.cos(lon)), r - R_EARTH


def _acceleration(r: Sequence[float]) -> Vec:
    """Point-mass gravity plus the J2 oblateness term (equatorial frame)."""
    x, y, z = r
    rr = norm(r)
    k = -MU_EARTH / rr**3
    f = 1.5 * J2 * MU_EARTH * R_EARTH**2 / rr**5
    zz = 5 * z * z / rr**2
    return [k * x + f * x * (zz - 1), k * y + f * y * (zz - 1), k * z + f * z * (zz - 3)]


def _rk4(r: Vec, v: Vec, h: float) -> tuple[Vec, Vec]:
    def add(a, b, s):
        return [a[i] + s * b[i] for i in range(3)]

    k1r, k1v = v, _acceleration(r)
    k2r, k2v = add(v, k1v, h / 2), _acceleration(add(r, k1r, h / 2))
    k3r, k3v = add(v, k2v, h / 2), _acceleration(add(r, k2r, h / 2))
    k4r, k4v = add(v, k3v, h), _acceleration(add(r, k3r, h))
    r2 = [r[i] + h / 6 * (k1r[i] + 2 * k2r[i] + 2 * k3r[i] + k4r[i]) for i in range(3)]
    v2 = [v[i] + h / 6 * (k1v[i] + 2 * k2v[i] + 2 * k3v[i] + k4v[i]) for i in range(3)]
    return r2, v2


def propagate(
    start: State,
    t_end: float,
    step: float,
    sample_every: float,
    stop: Callable[[Vec], bool] | None = None,
) -> list[State]:
    """Integrate forwards or backwards in time. Returns samples including both ends."""
    r, w = ecliptic_to_equatorial(start.p), ecliptic_to_equatorial(start.v)
    out = [start]
    sign = 1 if t_end > start.met else -1
    t, since_sample = start.met, 0.0
    while (t_end - t) * sign > 1e-9:
        h = sign * min(step, abs(t_end - t))
        r, w = _rk4(r, w, h)
        t += h
        since_sample += abs(h)
        hit_stop = stop is not None and stop(r)
        if hit_stop or since_sample >= sample_every - 1e-9 or abs(t_end - t) < 1e-9:
            out.append(State(t, equatorial_to_ecliptic(r), equatorial_to_ecliptic(w)))
            since_sample = 0.0
        if hit_stop:
            break
    return out


def hermite(a: State, b: State, t: float) -> Vec:
    dt = b.met - a.met
    s = (t - a.met) / dt
    s2, s3 = s * s, s * s * s
    h00, h10, h01, h11 = 2 * s3 - 3 * s2 + 1, s3 - 2 * s2 + s, -2 * s3 + 3 * s2, s3 - s2
    return [h00 * a.p[k] + h10 * a.v[k] * dt + h01 * b.p[k] + h11 * b.v[k] * dt for k in range(3)]


class Table:
    """Time-sorted state table with Hermite position lookup."""

    def __init__(self, states: Sequence[State]):
        self.states = sorted(states, key=lambda s: s.met)
        self.times = [s.met for s in self.states]

    def at(self, t: float) -> State:
        i = max(0, min(len(self.states) - 2, bisect.bisect_right(self.times, t) - 1))
        a, b = self.states[i], self.states[i + 1]
        s = (t - a.met) / (b.met - a.met)
        return State(t, hermite(a, b, t), [a.v[k] * (1 - s) + b.v[k] * s for k in range(3)])


def decimate(states: Sequence[State], tolerance_km: float) -> list[State]:
    """Drop samples while Hermite interpolation still reproduces every dropped one within tolerance."""
    keep, i, n = [0], 0, len(states)
    while i < n - 1:
        j = i + 1
        while j + 1 < n and all(
            math.dist(hermite(states[i], states[j + 1], states[k].met), states[k].p) < tolerance_km
            for k in range(i + 1, j + 1)
        ):
            j += 1
        keep.append(j)
        i = j
    return [states[k] for k in keep]


def slerp(a: Sequence[float], b: Sequence[float], s: float) -> Vec:
    ua, ub = unit(a), unit(b)
    ang = math.acos(max(-1.0, min(1.0, dot(ua, ub))))
    if ang < 1e-9:
        return ua
    sn = math.sin(ang)
    return [(math.sin((1 - s) * ang) * x + math.sin(s * ang) * y) / sn for x, y in zip(ua, ub)]


def _lat_lon_to_unit(lat: float, lon: float) -> Vec:
    return [math.cos(lat) * math.cos(lon), math.cos(lat) * math.sin(lon), math.sin(lat)]


def great_circle_point(a: tuple[float, float], b: tuple[float, float], f: float) -> tuple[float, float]:
    d = slerp(_lat_lon_to_unit(*a), _lat_lon_to_unit(*b), f)
    return math.asin(d[2]), math.atan2(d[1], d[0])


def great_circle_km(a: tuple[float, float], b: tuple[float, float]) -> float:
    c = math.sin(a[0]) * math.sin(b[0]) + math.cos(a[0]) * math.cos(b[0]) * math.cos(a[1] - b[1])
    return R_EARTH * math.acos(max(-1.0, min(1.0, c)))


def finite_difference_velocity(fn: Callable[[float], Vec], t: float, t_lo: float, t_hi: float, h: float = 1.0) -> Vec:
    a, b = max(t_lo, t - h), min(t_hi, t + h)
    pa, pb = fn(a), fn(b)
    return [(pb[k] - pa[k]) / (b - a) for k in range(3)]


def apoapsis_altitude(state: State) -> float:
    r, v = norm(state.p), norm(state.v)
    a = 1 / (2 / r - v * v / MU_EARTH)
    p, w = state.p, state.v
    h = [p[1] * w[2] - p[2] * w[1], p[2] * w[0] - p[0] * w[2], p[0] * w[1] - p[1] * w[0]]
    ecc = math.sqrt(max(0.0, 1 - norm(h) ** 2 / (MU_EARTH * a)))
    return a * (1 + ecc) - R_EARTH
