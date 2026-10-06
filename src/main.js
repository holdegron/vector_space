import { formatInt } from './core/time.js';
import artemisII from './mission/artemis-ii/index.js';
import { createFlightModel } from './mission/flight-model.js';
import { createPlayer } from './player.js';
import { createControls } from './ui/controls.js';
import { parseDeepLink } from './ui/deep-link.js';
import { byId } from './ui/dom.js';
import { createFlightLog } from './ui/flight-log.js';
import { createMinimap } from './ui/minimap.js';
import { createSparkline } from './ui/sparkline.js';
import { createTelemetry } from './ui/telemetry.js';
import { createTimeline } from './ui/timeline.js';

const VIEWS = ['overview', 'earth', 'moon', 'spacecraft'];
const CHART_SAMPLES = 700;
const REFRAME_AFTER_JUMP_S = 3600;

const model = createFlightModel(artemisII);
const link = parseDeepLink(location.hash, VIEWS);
const player = createPlayer({
  duration: model.duration,
  startAt: link.t ?? artemisII.initialMet,
  playing: link.playing ?? true,
  speed: link.speed ?? 5,
  slowMotion: artemisII.slowMotion,
});

let scene = null;
let view = link.view ?? 'overview';

function setView(name, options) {
  view = name;
  scene?.setView(name, options);
  controls.render(player.state, view);
}

const samples = model.samples(CHART_SAMPLES);
const seek = (t) => player.seek(t);
const km = (v) => `${formatInt(v)} km`;
const charts = [
  createSparkline(byId('speedChart'), {
    values: samples.map((s) => (artemisII.usesEarthRelativeSpeed(s.t) ? s.speedEarthRelative : s.speed) * 3600),
    duration: model.duration, color: '#7dd3fc', format: (v) => `${formatInt(v)} km/h`, onSeek: seek,
  }),
  createSparkline(byId('earthChart'), {
    values: samples.map((s) => s.earthDistance),
    duration: model.duration, color: '#7dd3fc', fill: 'rgba(125,211,252,0.22)', format: km, onSeek: seek,
  }),
  createSparkline(byId('moonChart'), {
    values: samples.map((s) => s.moonDistance),
    duration: model.duration, color: '#fbbf24', fill: 'rgba(251,191,36,0.28)', format: km, onSeek: seek,
  }),
];
const telemetry = createTelemetry({ model });
const timeline = createTimeline({ model, player });
const flightLog = createFlightLog({ model, player });
const minimap = createMinimap(byId('minimap'), { model, samples });
const controls = createControls({ model, player, getScene: () => scene, setView });

let lastRenderedT = player.state.t;

function render() {
  const state = model.stateAt(player.state.t);
  // A long jump while following would carry the old camera offset somewhere meaningless (even inside Earth).
  const jumped = Math.abs(state.t - lastRenderedT) > REFRAME_AFTER_JUMP_S;
  lastRenderedT = state.t;
  const milestone = model.milestoneAt(state.t);
  telemetry.render(state, milestone);
  timeline.render(state.t);
  flightLog.render(state.t, milestone.current);
  minimap.draw(state);
  for (const chart of charts) chart.setTime(state.t);
  controls.render(player.state, view);
  scene?.update(state.t);
  if (jumped && view === 'spacecraft') scene?.setView(view, { instant: true });
}

player.subscribe(render);
window.addEventListener('resize', render);
render();

// The 3D view loads separately so the panels keep working without WebGL or the CDN.
import('./scene/index.js')
  .then(({ createScene }) => {
    scene = createScene(byId('stage'), { model, onSelectTime: seek });
    byId('stageStatus').remove();
    render();
    if (view !== 'overview') setView(view, { instant: true });
  })
  .catch((error) => {
    console.error(error);
    byId('stageStatus').textContent = 'The 3D view needs WebGL and access to cdn.jsdelivr.net. Panels and timeline still work.';
  });

let previous = performance.now();
requestAnimationFrame(function tick(now) {
  player.advance(Math.min(0.1, (now - previous) / 1000));
  previous = now;
  requestAnimationFrame(tick);
});
