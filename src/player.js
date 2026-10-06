/** Mission seconds per real second at 1x. */
export const PLAYBACK_RATE = 1800;
export const SLOW_MOTION_RATE = 60;

/**
 * Playback clock. Holds mission time, play state and speed multiplier and
 * notifies subscribers on every change.
 */
export function createPlayer({ duration, startAt = 0, playing = true, speed = 5, slowMotion = [] }) {
  const state = { t: startAt, playing, speed };
  const listeners = new Set();
  const emit = () => listeners.forEach((fn) => fn(state));
  const inSlowMotion = (t) => slowMotion.some(([from, to]) => t >= from && t < to);

  return {
    state,
    duration,
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    seek(t) {
      state.t = Math.min(duration, Math.max(0, t));
      emit();
    },
    toggle() {
      if (!state.playing && state.t >= duration) state.t = 0;
      state.playing = !state.playing;
      emit();
    },
    pause() {
      state.playing = false;
      emit();
    },
    restart() {
      state.t = 0;
      state.playing = false;
      emit();
    },
    setSpeed(speed) {
      state.speed = speed;
      emit();
    },
    /** Advances mission time by a real-time step (seconds). */
    advance(dt) {
      if (!state.playing) return;
      const rate = inSlowMotion(state.t) ? SLOW_MOTION_RATE : PLAYBACK_RATE;
      state.t = Math.min(duration, state.t + dt * rate * state.speed);
      if (state.t >= duration) state.playing = false;
      emit();
    },
  };
}
