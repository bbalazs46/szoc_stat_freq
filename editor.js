import { colorToHex, hexToColor } from './utils.js';

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

const createVectorPad = (label, initialAmp, initialPhase, onChange, max = 150) => {
  const wrap = document.createElement('div');
  wrap.className = 'freq-item';

  const title = document.createElement('div');
  title.className = 'freq-label';
  title.textContent = label;

  const circle = document.createElement('div');
  circle.className = 'vector-circle';

  const handle = document.createElement('div');
  handle.className = 'vector-handle';
  circle.appendChild(handle);

  const valueLabel = document.createElement('div');
  valueLabel.className = 'freq-value';

  wrap.append(title, circle, valueLabel);

  let amp = initialAmp;
  let phase = initialPhase;

  const getRadius = () => {
    const rect = circle.getBoundingClientRect();
    const r = Math.min(rect.width || 0, rect.height || 0) * 0.5 - 6;
    return r > 0 ? r : 48;
  };

  const render = () => {
    const radius = getRadius();
    const pct = clamp(amp / max, 0, 1);
    const dist = pct * radius;
    const drawAngle = phase - Math.PI * 0.5;
    const x = Math.cos(drawAngle) * dist;
    const y = Math.sin(drawAngle) * dist;
    handle.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px)`;
    const norm = ((phase % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const deg = Math.round((norm * 180) / Math.PI);
    valueLabel.textContent = `${Math.round(amp)} · ${deg}°`;
  };

  const commit = () => onChange && onChange({ amp, phase });

  const updateFromEvent = (clientX, clientY) => {
    const rect = circle.getBoundingClientRect();
    const cx = rect.left + rect.width * 0.5;
    const cy = rect.top + rect.height * 0.5;
    const dx = clientX - cx;
    const dy = clientY - cy;
    let angle = Math.atan2(dy, dx) + Math.PI * 0.5;
    if (angle < 0) angle += Math.PI * 2;
    const radius = getRadius();
    const dist = Math.min(radius, Math.hypot(dx, dy));
    amp = clamp((dist / radius) * max, 0, max);
    phase = angle;
    render();
    commit();
  };

  circle.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    updateFromEvent(e.clientX, e.clientY);
    const move = (ev) => updateFromEvent(ev.clientX, ev.clientY);
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  });

  const setValue = (vec, silent = false) => {
    amp = clamp(vec?.amp ?? 0, 0, max);
    phase = vec?.phase ?? 0;
    render();
    if (!silent) commit();
  };

  const getValue = () => ({ amp, phase });

  render();

  return { root: wrap, setValue, getValue };
};

export const createEditor = () => {
  const overlay = document.createElement('div');
  overlay.className = 'editor-overlay';

  const panel = document.createElement('div');
  panel.className = 'editor-panel';
  panel.style.display = 'none';

  const header = document.createElement('div');
  header.className = 'editor-header';

  const title = document.createElement('div');
  title.className = 'editor-title';
  title.textContent = 'Pont szerkesztése';

  const closeBtn = document.createElement('button');
  closeBtn.className = 'editor-close';
  closeBtn.textContent = '×';

  header.append(title, closeBtn);

  const colorRow = document.createElement('div');
  colorRow.className = 'editor-row';
  const colorLabel = document.createElement('label');
  colorLabel.textContent = 'Szín';
  const colorInput = document.createElement('input');
  colorInput.type = 'color';
  colorInput.className = 'editor-input color';
  colorRow.append(colorLabel, colorInput);

  const freqRow = document.createElement('div');
  freqRow.className = 'editor-row';
  const freqLabel = document.createElement('label');
  freqLabel.textContent = 'Frekvenciák';
  const freqInput = document.createElement('input');
  freqInput.type = 'text';
  freqInput.placeholder = '1.2,2.0';
  freqInput.className = 'editor-input';
  freqRow.append(freqLabel, freqInput);

  const vectorsTitle = document.createElement('div');
  vectorsTitle.className = 'section-title';
  vectorsTitle.textContent = 'Amplitúdó / fázis vektorok';

  const freqGrid = document.createElement('div');
  freqGrid.className = 'freq-grid';

  let vectorPads = [];
  let vectorChangeCb = () => {};

  panel.append(header, colorRow, freqRow, vectorsTitle, freqGrid);
  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  const getVectors = () => vectorPads.map((p) => p.getValue());

  const rebuildVectorPads = (freqs, vectors) => {
    freqGrid.innerHTML = '';
    vectorPads = freqs.map((_, idx) => {
      const pad = createVectorPad(
        `f${idx + 1}`,
        vectors[idx]?.amp ?? 60,
        vectors[idx]?.phase ?? 0,
        () => vectorChangeCb(getVectors())
      );
      freqGrid.appendChild(pad.root);
      return pad;
    });
  };

  const vectorsFromMover = (mover) => {
    if (mover.freqVectors && mover.freqVectors.length) {
      return mover.freqs.map((_, idx) => mover.freqVectors[idx % mover.freqVectors.length]);
    }
    const amps = mover.ampLevels && mover.ampLevels.length
      ? mover.ampLevels
      : mover.freqs.map(() => mover.amp);
    const phases = mover.phaseLevels && mover.phaseLevels.length
      ? mover.phaseLevels
      : mover.freqs.map(() => mover.phase ?? 0);
    return mover.freqs.map((_, idx) => ({
      amp: amps[idx] ?? mover.amp,
      phase: phases[idx] ?? mover.phase ?? 0
    }));
  };

  return {
    panel,
    colorInput,
    freqInput,
    closeBtn,
    active: null,
    setTheme(themeKey) {
      // Remove all theme classes
      panel.classList.remove('theme-light', 'theme-radar', 'theme-neon');
      // Map canvas theme keys to editor theme classes
      // 'soft' (Finom) -> light theme, 'radar' -> radar theme, 'audio' (Wave) -> neon theme
      const themeMap = {
        'soft': 'theme-light',
        'radar': 'theme-radar',
        'audio': 'theme-neon'
      };
      const editorTheme = themeMap[themeKey];
      if (editorTheme) {
        panel.classList.add(editorTheme);
      }
      // If no mapping exists, panel uses base dark theme styles
    },
    setFromMover(mover) {
      colorInput.value = colorToHex(mover.color);
      freqInput.value = mover.freqs.join(',');
      const vectors = vectorsFromMover(mover);
      rebuildVectorPads(mover.freqs, vectors);
    },
    setVectors(vectors) {
      vectorPads.forEach((p, idx) => p.setValue(vectors[idx] ?? p.getValue(), true));
    },
    getVectors,
    onVectorChange(cb) {
      vectorChangeCb = cb;
    },
    applyToMover(mover) {
      mover.color = hexToColor(colorInput.value);
      mover.freqs = freqInput.value
        .split(',')
        .map((v) => parseFloat(v.trim()))
        .filter((v) => !Number.isNaN(v) && Number.isFinite(v) && v > 0);
      if (mover.freqs.length === 0) mover.freqs = [1];
      const vectors = getVectors();
      const adjusted = mover.freqs.map((_, idx) => vectors[idx] ?? { amp: mover.amp, phase: mover.phase ?? 0 });
      mover.freqVectors = adjusted;
      mover.ampLevels = adjusted.map((v) => v.amp);
      mover.phaseLevels = adjusted.map((v) => v.phase);
      mover.amp = adjusted.length
        ? adjusted.reduce((acc, v) => acc + v.amp, 0) / adjusted.length
        : mover.amp;
      mover.phase = adjusted[0]?.phase ?? mover.phase ?? 0;
    }
  };
};
