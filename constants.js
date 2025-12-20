export const DPR_FALLBACK = 1;
export const GRID_SPACING = 48;
export const BASE_POINT_SIZE = 10;
export const MIN_POINT_SIZE = 1.5;
export const SIZE_FALLOFF = 0.0004;
export const MIN_ZOOM = 0.5;
export const MAX_ZOOM = 4;
export const EPS = 1e-4;
export const DET_EPS = 1e-8;
export const TRAIL_DURATION = 5.0;
export const TRAIL_SAMPLES = 120;
export const HEAD_POINT_SIZE = 24;
export const MOVER_X_OFFSET = -300;
export const HIT_RADIUS = 50;
export const WARP_LERP = 0.1;
export const HIT_EXTRA = 8;

const radarTheme = {
  key: 'radar',
  label: 'Radar',
  clearColor: [0.03, 0.07, 0.1, 1],
  fillColor: [0.09, 0.6, 0.3, 0.28],
  outlineColor: [0.34, 0.98, 0.63, 0.9],
  outlineThickness: 2.3,
  style: 0,
  pageBackground: '#04121e',
  trailOpacity: 0.55,
  baseSize: BASE_POINT_SIZE,
  gridSpacing: GRID_SPACING
};

const softTheme = {
  key: 'soft',
  label: 'Finom',
  clearColor: [0.97, 0.97, 0.95, 1],
  fillColor: [0.3, 0.34, 0.4, 0.24],
  outlineColor: [0.08, 0.1, 0.16, 0.94],
  outlineThickness: 4.2,
  style: 1,
  pageBackground: '#f6d434',
  trailOpacity: 0.5,
  baseSize: BASE_POINT_SIZE,
  gridSpacing: GRID_SPACING
};

const audioTheme = {
  key: 'audio',
  label: 'Wave',
  clearColor: [0.06, 0.04, 0.12, 1],
  fillColor: [0.32, 0.18, 0.64, 0.42],
  outlineColor: [0.1, 0.8, 0.95, 0.9],
  outlineThickness: 3.2,
  style: 2,
  pageBackground: '#0b0618',
  trailOpacity: 0.6,
  baseSize: BASE_POINT_SIZE + 2,
  gridSpacing: GRID_SPACING + 6
};

export const THEMES = {
  radar: radarTheme,
  soft: softTheme,
  audio: audioTheme
};

export const DEFAULT_THEME = 'soft';
export const THEME_ORDER = ['radar', 'soft', 'audio'];
