import { MOVER_X_OFFSET } from './constants.js';

export const createMovers = (samples) => ([
  { amp: 50, freq: 1.1, speed: 90, phase: 0, color: [1, 0.2, 0.2, 1], flat: new Float32Array(samples * 2) },
  { amp: 70, freq: 0.9, speed: 70, phase: 1.2, color: [0.2, 0.6, 1, 1], flat: new Float32Array(samples * 2) },
  { amp: 60, freq: 1.4, speed: 110, phase: -0.8, color: [0.1, 0.9, 0.5, 1], flat: new Float32Array(samples * 2) }
]);

export const evalMover = (mover, t) => ({
  x: (t * mover.speed) + MOVER_X_OFFSET,
  y: mover.amp * Math.sin(t * mover.freq + mover.phase)
});
