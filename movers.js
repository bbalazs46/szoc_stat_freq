import { MOVER_X_OFFSET } from './constants.js';

export const createMovers = (samples) => ([
  {
    amp: 50,
    freqs: [1.1, 1.6],
    ampLevels: [50, 50],
    phaseLevels: [0, 0],
    freqVectors: [{ amp: 50, phase: 0 }, { amp: 50, phase: 0 }],
    speed: 90,
    phase: 0,
    color: [0.5, 0.1, 0.1, 1],
    radius: 10,
    flat: new Float32Array(samples * 20)
  },
  {
    amp: 70,
    freqs: [0.9, 1.3],
    ampLevels: [70, 70],
    phaseLevels: [1.2, 1.2],
    freqVectors: [{ amp: 70, phase: 1.2 }, { amp: 70, phase: 1.2 }],
    speed: 70,
    phase: 1.2,
    color: [0.1, 0.3, 0.5, 1],
    radius: 10,
    flat: new Float32Array(samples * 2)
  },
  {
    amp: 60,
    freqs: [1.4, 2.2],
    ampLevels: [60, 60],
    phaseLevels: [-0.8, -0.8],
    freqVectors: [{ amp: 60, phase: -0.8 }, { amp: 60, phase: -0.8 }],
    speed: 110,
    phase: -0.8,
    color: [0.05, 0.45, 0.25, 1],
    radius: 10,
    flat: new Float32Array(samples * 2)
  }
]);

export const evalMover = (mover, t) => {
  let y = 0;
  for (let i = 0; i < mover.freqs.length; i++) {
    const f = mover.freqs[i];
    const weight = mover.freqVectors && mover.freqVectors.length
      ? mover.freqVectors[i % mover.freqVectors.length].amp
      : mover.ampLevels && mover.ampLevels.length
        ? mover.ampLevels[i % mover.ampLevels.length]
        : mover.amp;
    const phase = mover.freqVectors && mover.freqVectors.length
      ? mover.freqVectors[i % mover.freqVectors.length].phase
      : mover.phaseLevels && mover.phaseLevels.length
        ? mover.phaseLevels[i % mover.phaseLevels.length]
        : mover.phase || 0;
    y += weight * Math.sin(t * f + phase);
  }
  return {
    x: (t * mover.speed) + MOVER_X_OFFSET,
    y: y / mover.freqs.length
  };
};
