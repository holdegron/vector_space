import { met } from '../core/time.js';

const SPEEDS = [1, 5, 20];

/**
 * Reads replay settings from the URL hash, e.g. `#t=5/00:15&view=moon&play=0&speed=1`.
 * `t` accepts "d/hh:mm[:ss]" or plain seconds. Unknown or invalid values are ignored.
 */
export function parseDeepLink(hash, views) {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const result = {};

  const t = params.get('t');
  if (t) {
    const match = t.match(/^(\d+)\/(\d+):(\d+)(?::(\d+))?$/);
    const seconds = match ? met(+match[1], +match[2], +match[3], +(match[4] ?? 0)) : Number(t);
    if (Number.isFinite(seconds)) result.t = seconds;
  }
  if (params.get('play') === '0') result.playing = false;
  const speed = Number(params.get('speed'));
  if (SPEEDS.includes(speed)) result.speed = speed;
  if (views.includes(params.get('view'))) result.view = params.get('view');
  return result;
}
