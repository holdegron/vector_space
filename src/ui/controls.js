import { byId } from './dom.js';

const HOUR_S = 3600;
const TEN_MINUTES_S = 600;

/** Buttons, phase jump, layer toggles and keyboard shortcuts. */
export function createControls({ model, player, getScene, setView }) {
  const playButton = byId('playButton');
  const speedButtons = [...document.querySelectorAll('[data-speed]')];
  const viewButtons = [...document.querySelectorAll('[data-view]')];
  const phaseSelect = byId('phaseSelect');

  playButton.addEventListener('click', () => player.toggle());
  byId('restartButton').addEventListener('click', () => player.restart());
  for (const button of speedButtons) {
    button.addEventListener('click', () => player.setSpeed(Number(button.dataset.speed)));
  }
  for (const button of viewButtons) {
    button.addEventListener('click', () => setView(button.dataset.view));
  }

  for (const phase of model.mission.phases) {
    phaseSelect.append(new Option(phase.name, phase.id));
  }
  phaseSelect.addEventListener('change', () => {
    const phase = model.mission.phases.find((p) => p.id === phaseSelect.value);
    phaseSelect.value = '';
    if (!phase) return;
    const isEntry = phase.id === model.mission.phases[model.mission.phases.length - 1].id;
    player.seek(isEntry ? phase.from - 20 * 60 : phase.from);
    if (isEntry) player.setSpeed(1);
    setView(phase.view);
  });

  byId('trueScale').addEventListener('change', (e) => {
    const scene = getScene();
    if (!scene) return;
    scene.options.trueScale = e.target.checked;
    scene.update(player.state.t);
    setView(scene.view);
  });
  for (const input of document.querySelectorAll('[data-option]')) {
    input.addEventListener('change', () => {
      const scene = getScene();
      if (scene) scene.options[input.dataset.option] = input.checked;
    });
  }

  window.addEventListener('keydown', (e) => {
    if (e.target.closest('input[type="range"], select, input[type="text"]')) return;
    const step = e.shiftKey ? TEN_MINUTES_S : HOUR_S;
    if (e.code === 'Space') {
      e.preventDefault();
      player.toggle();
    } else if (e.key === 'ArrowRight') player.seek(player.state.t + step);
    else if (e.key === 'ArrowLeft') player.seek(player.state.t - step);
    else if (e.key === 'Home') player.seek(0);
    else if (e.key === 'End') player.seek(model.duration);
  });

  return {
    render(state, view) {
      playButton.textContent = state.playing ? 'Pause' : 'Play';
      for (const b of speedButtons) b.classList.toggle('is-on', Number(b.dataset.speed) === state.speed);
      for (const b of viewButtons) b.classList.toggle('is-on', b.dataset.view === view);
    },
  };
}
