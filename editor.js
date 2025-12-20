import { colorToHex, hexToColor } from './utils.js';

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

const createVerticalSlider = (label, initial, onChange, max = 150) => {
  const wrap = document.createElement('div');
  wrap.className = 'amp-slider';

  const title = document.createElement('div');
  title.className = 'amp-label';
  title.textContent = label;

  const track = document.createElement('div');
  track.className = 'amp-track';

  const fill = document.createElement('div');
  fill.className = 'amp-fill';

  const thumb = document.createElement('div');
  thumb.className = 'amp-thumb';

  track.append(fill, thumb);

  const valueLabel = document.createElement('div');
  valueLabel.className = 'amp-value';

  wrap.append(title, track, valueLabel);

  let value = initial;

  const render = () => {
    const pct = clamp(value / max, 0, 1);
    fill.style.height = `${pct * 100}%`;
    thumb.style.bottom = `${pct * 100}%`;
    valueLabel.textContent = `${Math.round(value)}`;
  };

  const commit = () => onChange && onChange(value);

  const updateFromPos = (clientY) => {
    const rect = track.getBoundingClientRect();
    const pct = 1 - (clientY - rect.top) / rect.height;
    value = clamp(pct * max, 0, max);
    render();
    commit();
  };

  track.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    updateFromPos(e.clientY);
    const move = (ev) => updateFromPos(ev.clientY);
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  });

  const setValue = (v, silent = false) => {
    value = clamp(v, 0, max);
    render();
    if (!silent) commit();
  };

  const getValue = () => value;

  render();

  return { root: wrap, setValue, getValue };
};

const createKnob = (initial, onChange) => {
  const wrap = document.createElement('div');
  wrap.className = 'phase-wrapper';

  const label = document.createElement('div');
  label.className = 'phase-label';
  label.textContent = 'Fázis';

  const knob = document.createElement('div');
  knob.className = 'phase-knob';

  const indicator = document.createElement('div');
  indicator.className = 'phase-indicator';
  knob.appendChild(indicator);

  const center = document.createElement('div');
  center.className = 'phase-center';
  knob.appendChild(center);

  const valueLabel = document.createElement('div');
  valueLabel.className = 'phase-value';

  wrap.append(label, knob, valueLabel);

  let value = initial;

  const render = () => {
    const norm = ((value % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const deg = Math.round((norm * 180) / Math.PI);
    indicator.style.transform = `translate(-50%, -100%) rotate(${norm}rad)`;
    valueLabel.textContent = `${deg}°`;
  };

  const commit = () => onChange && onChange(value);

  const updateFromEvent = (clientX, clientY) => {
    const rect = knob.getBoundingClientRect();
    const cx = rect.left + rect.width * 0.5;
    const cy = rect.top + rect.height * 0.5;
    let angle = Math.atan2(clientY - cy, clientX - cx) + Math.PI * 0.5;
    if (angle < 0) angle += Math.PI * 2;
    value = angle;
    render();
    commit();
  };

  knob.addEventListener('pointerdown', (e) => {
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

  const setValue = (v, silent = false) => {
    value = v;
    render();
    if (!silent) commit();
  };

  const getValue = () => value;

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

  const ampTitle = document.createElement('div');
  ampTitle.className = 'section-title';
  ampTitle.textContent = 'Amplitúdók';

  const ampRow = document.createElement('div');
  ampRow.className = 'amp-row';

  let ampSliders = [];
  let ampChangeCb = () => {};
  let phaseChangeCb = () => {};

  const phaseKnob = createKnob(0, (value) => phaseChangeCb(value));

  panel.append(header, colorRow, freqRow, ampTitle, ampRow, phaseKnob.root);
  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  const getAmpLevels = () => ampSliders.map((s) => s.getValue());

  const rebuildAmpSliders = (freqs, levels) => {
    ampRow.innerHTML = '';
    ampSliders = freqs.map((_, idx) => {
      const slider = createVerticalSlider(
        `f${idx + 1}`,
        levels[idx] ?? 60,
        () => ampChangeCb(getAmpLevels())
      );
      ampRow.appendChild(slider.root);
      return slider;
    });
  };

  return {
    panel,
    colorInput,
    freqInput,
    closeBtn,
    active: null,
    setFromMover(mover) {
      colorInput.value = colorToHex(mover.color);
      freqInput.value = mover.freqs.join(',');
      const amps = mover.ampLevels && mover.ampLevels.length
        ? mover.ampLevels
        : mover.freqs.map(() => mover.amp);
      rebuildAmpSliders(mover.freqs, amps);
      phaseKnob.setValue(mover.phase, true);
    },
    setAmpLevels(levels) {
      ampSliders.forEach((s, idx) => s.setValue(levels[idx] ?? s.getValue(), true));
    },
    getAmpLevels,
    setPhase(value) {
      phaseKnob.setValue(value, true);
    },
    onAmpChange(cb) {
      ampChangeCb = cb;
    },
    onPhaseChange(cb) {
      phaseChangeCb = cb;
    },
    applyToMover(mover) {
      mover.color = hexToColor(colorInput.value);
      mover.freqs = freqInput.value
        .split(',')
        .map((v) => parseFloat(v.trim()))
        .filter((v) => !Number.isNaN(v) && Number.isFinite(v) && v > 0);
      if (mover.freqs.length === 0) mover.freqs = [1];
      mover.ampLevels = getAmpLevels();
      mover.phase = phaseKnob.getValue();
    }
  };
};
