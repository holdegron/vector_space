import { formatDuration, formatInt, formatMet, formatUtc } from '../core/time.js';
import { byId } from './dom.js';

const km = (v) => `${formatInt(v)} km`;
const kmh = (kmPerSecond) => `${formatInt(kmPerSecond * 3600)} km/h`;

/** Text readouts: clock, distances, milestone card, data-source panel and status chips. */
export function createTelemetry({ model }) {
  const { mission, stats } = model;
  const el = Object.fromEntries(
    [
      'met', 'utc', 'earthDistance', 'altitude', 'moonDistance', 'phase', 'replayClock',
      'milestoneCode', 'milestoneTitle', 'milestoneDesc', 'milestoneNext',
      'speedLabel', 'speed', 'earthChartValue', 'moonChartValue',
      'legLabel', 'sourceTitle', 'sourceDetail', 'moonRelativeSpeed',
      'sourceChip', 'signalChip', 'shadowChip',
    ].map((id) => [id, byId(id)])
  );

  byId('missionTitle').textContent = `${mission.name} · ${mission.vehicle}`;
  byId('followButton').textContent = `Follow ${mission.spacecraftName}`;
  byId('statClosest').textContent = `${km(stats.closestMoonKm)} from centre`;
  byId('statFarthest').textContent = km(stats.maxEarthKm);
  const signalLoss = byId('statSignalLoss');
  signalLoss.textContent = model.lossOfSignalWindows.map(([a, b]) => `${Math.round((b - a) / 60)} min`).join(', ') || '—';
  signalLoss.title = model.lossOfSignalWindows.map(([a, b]) => `${formatMet(a)} – ${formatMet(b)}`).join('\n');

  return {
    render(state, milestone) {
      const phase = model.phaseAt(state.t);
      const earthRelative = mission.usesEarthRelativeSpeed(state.t);

      el.met.textContent = formatMet(state.t);
      el.replayClock.textContent = formatMet(state.t);
      el.utc.textContent = formatUtc(model.utcMs(state.t));
      el.earthDistance.textContent = km(state.earthDistance);
      el.earthChartValue.textContent = km(state.earthDistance);
      el.altitude.textContent = km(Math.max(0, state.altitude));
      el.moonDistance.textContent = km(state.moonDistance);
      el.moonChartValue.textContent = km(state.moonDistance);
      el.phase.textContent = phase.name;
      el.phase.style.color = phase.color;
      el.speedLabel.textContent = earthRelative ? 'Speed · Earth-relative' : 'Speed · inertial';
      el.speed.textContent = kmh(earthRelative ? state.speedEarthRelative : state.speed);
      el.moonRelativeSpeed.textContent = kmh(state.speedMoonRelative);

      el.milestoneCode.textContent = milestone.current.code;
      el.milestoneTitle.textContent = milestone.current.title;
      el.milestoneDesc.textContent = milestone.current.desc;
      el.milestoneNext.textContent = milestone.next
        ? `${milestone.next.title} in ${formatDuration(milestone.next.met - state.t)}`
        : 'Mission complete';
      el.legLabel.textContent = state.t < stats.closestMoonMet ? 'Outbound' : 'Return';

      if (state.fromJpl) {
        el.sourceChip.textContent = 'JPL VECTOR';
        el.sourceTitle.textContent = 'JPL state vectors';
        el.sourceDetail.textContent = `NASA/JSC navigation file · ${model.navigationFileAt(state.t)}`;
      } else {
        el.sourceChip.textContent = 'RECONSTRUCTED';
        el.sourceTitle.textContent = 'Reconstructed segment';
        el.sourceDetail.textContent = state.t < stats.jplStartMet ? mission.reconstructedNotes.before : mission.reconstructedNotes.after;
      }
      el.sourceChip.classList.toggle('chip--reconstructed', !state.fromJpl);
      el.sourceDetail.classList.toggle('is-reconstructed', !state.fromJpl);
      el.signalChip.hidden = !state.moonBlocksEarth;
      el.shadowChip.hidden = !state.inEarthShadow;
    },
  };
}
