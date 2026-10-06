import { formatMet } from '../core/time.js';
import { byId } from './dom.js';

const SNAP_PX = 6;

/** Scrubber with phase bands, event ticks and a hover tooltip. */
export function createTimeline({ model, player }) {
  const input = byId('timeline');
  const progress = byId('timelineProgress');
  const tip = byId('timelineTip');
  const events = model.mission.events.filter((e) => !e.cancelled);
  input.max = String(model.duration);

  const phases = byId('timelinePhases');
  for (const phase of model.mission.phases) {
    const band = document.createElement('div');
    band.style.flex = String(phase.to - phase.from);
    band.style.background = phase.color;
    band.title = phase.name;
    phases.appendChild(band);
  }

  const ticks = byId('timelineTicks');
  for (const event of events) {
    const tick = document.createElement('i');
    tick.className = event.milestone ? 'is-milestone' : '';
    tick.style.left = `${(event.met / model.duration) * 100}%`;
    ticks.appendChild(tick);
  }

  input.addEventListener('input', () => player.seek(Number(input.value)));
  input.addEventListener('pointermove', (e) => {
    const rect = input.getBoundingClientRect();
    const f = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const t = f * model.duration;
    const near = events.find((ev) => (Math.abs(ev.met - t) / model.duration) * rect.width < SNAP_PX);
    tip.hidden = false;
    tip.style.left = `${f * 100}%`;
    tip.textContent = near ? `${near.code} · T+${near.label}` : formatMet(t, { withSeconds: false });
  });
  input.addEventListener('pointerleave', () => {
    tip.hidden = true;
  });

  return {
    render(t) {
      input.value = String(t);
      progress.style.width = `${(t / model.duration) * 100}%`;
    },
  };
}
