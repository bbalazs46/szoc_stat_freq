import { MOVER_X_OFFSET } from './constants.js';

export const createMovers = (samples) => ([
  { amp: 50, freqs: [1.1, 1.6], speed: 90, phase: 0, color: [0.5, 0.1, 0.1, 1], flat: new Float32Array(samples * 2) },
  { amp: 70, freqs: [0.9, 1.3], speed: 70, phase: 1.2, color: [0.1, 0.3, 0.5, 1], flat: new Float32Array(samples * 2) },
  { amp: 60, freqs: [1.4, 2.2], speed: 110, phase: -0.8, color: [0.05, 0.45, 0.25, 1], flat: new Float32Array(samples * 2) }
]);

export const evalMover = (mover, t) => {
  let y = 0;
  for (let i = 0; i < mover.freqs.length; i++) {
    const f = mover.freqs[i];
    y += Math.sin(t * f + mover.phase);
  }
  return {
    x: (t * mover.speed) + MOVER_X_OFFSET,
    y: mover.amp * y / mover.freqs.length
  };
};
