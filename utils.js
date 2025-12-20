import { DET_EPS } from './constants.js';

export const identityTransform = () => ({
  m00: 1, m01: 0,
  m10: 0, m11: 1,
  tx: 0, ty: 0
});

export const transformPoint = (t, p) => ({
  x: t.m00 * p.x + t.m01 * p.y + t.tx,
  y: t.m10 * p.x + t.m11 * p.y + t.ty
});

export const invertTransform = (t) => {
  const det = t.m00 * t.m11 - t.m01 * t.m10;
  if (Math.abs(det) < DET_EPS) {
    return identityTransform();
  }
  const invDet = 1 / det;
  const m00 = t.m11 * invDet;
  const m01 = -t.m01 * invDet;
  const m10 = -t.m10 * invDet;
  const m11 = t.m00 * invDet;
  return {
    m00,
    m01,
    m10,
    m11,
    tx: -(m00 * t.tx + m01 * t.ty),
    ty: -(m10 * t.tx + m11 * t.ty)
  };
};

export const effectiveScale = (t) => {
  const sx = Math.hypot(t.m00, t.m10);
  const sy = Math.hypot(t.m01, t.m11);
  return 0.5 * (sx + sy);
};

export const clamp = (val, min, max) => Math.min(Math.max(val, min), max);

export const colorToHex = (c) => {
  const toByte = (v) => Math.round(clamp(v, 0, 1) * 255);
  const [r, g, b] = c;
  return `#${[r, g, b].map(toByte).map((v) => v.toString(16).padStart(2, '0')).join('')}`;
};

export const hexToColor = (hex) => {
  const clean = hex.replace('#', '');
  const num = parseInt(clean, 16);
  return [
    ((num >> 16) & 0xff) / 255,
    ((num >> 8) & 0xff) / 255,
    (num & 0xff) / 255,
    1
  ];
};

export const trailColorFromHead = (color, alpha = 0.5) => [color[0], color[1], color[2], alpha];

export const displayMessage = (text) => {
  const message = document.createElement('p');
  message.textContent = text;
  message.style.color = '#222';
  message.style.textAlign = 'center';
  message.style.marginTop = '20px';
  document.body.replaceChildren(message);
};
