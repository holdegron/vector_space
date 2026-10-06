import { prepareCanvas } from './dom.js';

const COLORS = { moonTrack: 'rgba(139,148,168,0.45)', path: 'rgba(94,234,212,0.35)', flown: '#7dd3fc', earth: '#7dd3fc', moon: '#e5e7eb', craft: '#fbbf24' };

/**
 * Top-down (ecliptic) map of the whole flight, rotated so the Earth -> Moon
 * axis at closest approach points left.
 */
export function createMinimap(canvas, { model, samples }) {
  const flyby = model.stateAt(model.stats.closestMoonMet).moonPosition;
  const angle = Math.PI - Math.atan2(flyby[1], flyby[0]);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const rotate = (p) => [p[0] * cos - p[1] * sin, p[0] * sin + p[1] * cos];

  const path = samples.map((s) => rotate(s.position));
  const moonTrack = samples.map((s) => rotate(s.moonPosition));
  const bounds = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [x, y] of [...path, ...moonTrack, [0, 0]]) {
    bounds[0] = Math.min(bounds[0], x);
    bounds[1] = Math.min(bounds[1], y);
    bounds[2] = Math.max(bounds[2], x);
    bounds[3] = Math.max(bounds[3], y);
  }

  return {
    draw(state) {
      const { ctx, width, height } = prepareCanvas(canvas);
      const scale = Math.min((width - 70) / (bounds[2] - bounds[0]), (height - 24) / (bounds[3] - bounds[1]));
      const cx = width / 2 - ((bounds[0] + bounds[2]) / 2) * scale;
      const cy = height / 2 + ((bounds[1] + bounds[3]) / 2) * scale;
      const X = (x) => cx + x * scale;
      const Y = (y) => cy - y * scale;
      const polyline = (points, count = points.length) => {
        ctx.beginPath();
        for (let i = 0; i < count; i++) {
          const [x, y] = points[i];
          if (i) ctx.lineTo(X(x), Y(y));
          else ctx.moveTo(X(x), Y(y));
        }
      };

      ctx.setLineDash([3, 4]);
      ctx.strokeStyle = COLORS.moonTrack;
      ctx.lineWidth = 1;
      polyline(moonTrack);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.strokeStyle = COLORS.path;
      ctx.lineWidth = 1.3;
      polyline(path);
      ctx.stroke();

      const [ox, oy] = rotate(state.position);
      const [mx, my] = rotate(state.moonPosition);
      const flownCount = Math.round((state.t / model.duration) * (path.length - 1)) + 1;
      ctx.strokeStyle = COLORS.flown;
      ctx.lineWidth = 2;
      ctx.shadowColor = COLORS.flown;
      ctx.shadowBlur = 6;
      polyline(path, flownCount);
      ctx.lineTo(X(ox), Y(oy));
      ctx.stroke();
      ctx.shadowBlur = 0;

      ctx.font = '600 9.5px "IBM Plex Mono", monospace';
      const dot = (x, y, r, color, label, dx, dy) => {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(X(x), Y(y), r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillText(label, X(x) + dx, Y(y) + dy);
      };
      dot(0, 0, 5, COLORS.earth, 'EARTH', 8, -6);
      dot(mx, my, 4, COLORS.moon, 'MOON', -40, 4);
      dot(ox, oy, 3.5, COLORS.craft, model.mission.spacecraftLabel, 8, 4);
    },
  };
}
