/** Mission elapsed time in seconds from days/hours/minutes/seconds. */
export const met = (d, h = 0, m = 0, s = 0) => d * 86400 + h * 3600 + m * 60 + s;

const pad = (n) => String(n).padStart(2, '0');

/** "T+d/hh:mm:ss" (or "T+d/hh:mm" without seconds). */
export function formatMet(seconds, { withSeconds = true } = {}) {
  const t = Math.max(0, Math.floor(seconds));
  const d = Math.floor(t / 86400);
  const hh = pad(Math.floor((t % 86400) / 3600));
  const mm = pad(Math.floor((t % 3600) / 60));
  return withSeconds ? `T+${d}/${hh}:${mm}:${pad(t % 60)}` : `T+${d}/${hh}:${mm}`;
}

/** "d/hh:mm" duration without the T+ prefix. */
export const formatDuration = (seconds) => formatMet(seconds, { withSeconds: false }).slice(2);

export const formatUtc = (utcMs) => `${new Date(utcMs).toISOString().slice(0, 19).replace('T', ' ')} UTC`;

export const formatInt = (v) => Math.round(v).toLocaleString('en-US');
