import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { formatMet, met } from '../src/core/time.js';
import { createFlightModel } from '../src/mission/flight-model.js';
import artemisII from '../src/mission/artemis-ii/index.js';

const model = createFlightModel(artemisII);
const within = (actual, expected, tolerance, what) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${what}: ${actual} not within ${tolerance} of ${expected}`);

describe('Artemis II trajectory matches published NASA / JPL figures', () => {
  it('closest lunar approach is 8,282 km from the Moon centre around 5/00:26', () => {
    within(model.stats.closestMoonKm, 8282, 1, 'closest approach');
    within(model.stats.closestMoonMet, met(5, 0, 26), 90, 'closest approach time');
  });

  it('maximum distance from Earth centre is 413,146 km around 5/00:30', () => {
    within(model.stats.maxEarthKm, 413146.2, 5, 'max distance');
    within(model.stats.maxEarthMet, met(5, 0, 30), 90, 'max distance time');
  });

  it('peak altitude is the 406,771 km record reported by NASA', () => {
    within(model.stateAt(model.stats.maxEarthMet).altitude, 406771, 10, 'peak altitude');
  });

  it('entry interface is reached at 9/01:18 at about 11 km/s', () => {
    within(model.stats.entryInterfaceMet, met(9, 1, 18), 60, 'entry interface time');
    within(model.stats.entryInterfaceSpeedKmS, 11, 0.1, 'entry speed');
  });

  it('splashes down at 00:07:27 UTC on 11 April near walking speed relative to Earth', () => {
    assert.equal(new Date(model.utcMs(model.duration)).toISOString(), '2026-04-11T00:07:27.000Z');
    const end = model.stateAt(model.duration);
    within(end.altitude, 0, 0.01, 'splashdown altitude');
    within(end.speedEarthRelative * 3600, 27, 10, 'splashdown speed km/h');
  });
});

describe('derived windows', () => {
  it('finds one ~40 minute loss of signal behind the Moon', () => {
    assert.equal(model.lossOfSignalWindows.length, 1);
    const [from, to] = model.lossOfSignalWindows[0];
    within((to - from) / 60, 40, 2, 'LOS minutes');
  });

  it('finds the Earth shadow pass listed by Horizons (1/01:35 - 1/02:41)', () => {
    assert.equal(model.earthShadowWindows.length, 1);
    const [from, to] = model.earthShadowWindows[0];
    within(from, met(1, 1, 35), 60, 'shadow entry');
    within(to, met(1, 2, 41), 150, 'shadow exit');
  });
});

describe('model queries', () => {
  it('marks only the separation-to-23:51 UTC span as JPL data', () => {
    assert.equal(model.stateAt(met(0, 1)).fromJpl, false);
    assert.equal(model.stateAt(met(3)).fromJpl, true);
    assert.equal(model.stateAt(met(9, 1, 25)).fromJpl, false);
  });

  it('reports the navigation file for a time', () => {
    assert.equal(model.navigationFileAt(met(5)), 'Orion_OEM_20260408_0223.V0.1');
    assert.equal(model.navigationFileAt(met(0, 1)), null);
  });

  it('returns the latest milestone and the next one', () => {
    const { current, next } = model.milestoneAt(met(2));
    assert.equal(current.id, 'tli');
    assert.equal(next.id, 'otc3');
  });

  it('keeps the altitude non-negative along the whole track', () => {
    for (let t = 0; t <= model.duration; t += 30) {
      assert.ok(model.stateAt(t).altitude > -0.01, `altitude below ground at ${formatMet(t)}`);
    }
  });
});
