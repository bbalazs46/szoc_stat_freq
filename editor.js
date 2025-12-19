import { colorToHex, hexToColor } from './utils.js';

export const createEditor = () => {
  const panel = document.createElement('div');
  panel.style.position = 'absolute';
  panel.style.padding = '8px';
  panel.style.background = '#fff';
  panel.style.border = '1px solid #ccc';
  panel.style.borderRadius = '6px';
  panel.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
  panel.style.minWidth = '180px';
  panel.style.fontFamily = 'sans-serif';
  panel.style.fontSize = '13px';
  panel.style.display = 'none';
  panel.style.pointerEvents = 'auto';
  panel.style.userSelect = 'none';
  panel.style.transform = 'translate(-50%, -100%)';

  const colorLabel = document.createElement('label');
  colorLabel.textContent = 'Color: ';
  const colorInput = document.createElement('input');
  colorInput.type = 'color';
  colorInput.style.marginBottom = '6px';
  colorInput.style.width = '70px';
  colorLabel.appendChild(colorInput);

  const freqLabel = document.createElement('label');
  freqLabel.textContent = 'Freqs: ';
  const freqInput = document.createElement('input');
  freqInput.type = 'text';
  freqInput.placeholder = '1.2,2.0';
  freqInput.style.width = '120px';
  freqInput.style.marginBottom = '6px';
  freqLabel.appendChild(freqInput);

  const phaseLabel = document.createElement('label');
  phaseLabel.textContent = 'Phase: ';
  const phaseInput = document.createElement('input');
  phaseInput.type = 'range';
  phaseInput.min = '0';
  phaseInput.max = `${Math.PI * 2}`;
  phaseInput.step = '0.01';
  phaseInput.style.width = '120px';
  phaseLabel.appendChild(phaseInput);

  const ampLabel = document.createElement('label');
  ampLabel.textContent = 'Amp: ';
  const ampInput = document.createElement('input');
  ampInput.type = 'range';
  ampInput.min = '10';
  ampInput.max = '150';
  ampInput.value = '60';
  ampInput.step = '1';
  ampInput.style.writingMode = 'vertical-rl';
  ampInput.style.transform = 'rotate(180deg)';
  ampInput.style.height = '120px';
  ampInput.style.marginLeft = '8px';
  ampInput.style.marginRight = '8px';

  const closeBtn = document.createElement('button');
  closeBtn.textContent = 'Close';
  closeBtn.style.marginTop = '6px';

  const layout = document.createElement('div');
  layout.style.display = 'grid';
  layout.style.gridTemplateColumns = 'auto 1fr';
  layout.style.gridRowGap = '6px';
  layout.style.columnGap = '6px';

  layout.appendChild(colorLabel);
  layout.appendChild(document.createElement('div'));
  layout.appendChild(freqLabel);
  layout.appendChild(document.createElement('div'));
  layout.appendChild(phaseLabel);
  layout.appendChild(document.createElement('div'));
  layout.appendChild(document.createElement('div'));
  layout.appendChild(document.createElement('div'));
  layout.appendChild(ampLabel);
  layout.appendChild(ampInput);
  layout.appendChild(closeBtn);

  panel.appendChild(layout);
  document.body.appendChild(panel);

  return {
    panel,
    colorInput,
    freqInput,
    phaseInput,
    ampInput,
    closeBtn,
    active: null,
    setFromMover(mover) {
      colorInput.value = colorToHex(mover.color);
      freqInput.value = mover.freqs.join(',');
      phaseInput.value = mover.phase;
      ampInput.value = mover.amp;
    },
    applyToMover(mover) {
      mover.color = hexToColor(colorInput.value);
      mover.freqs = freqInput.value
        .split(',')
        .map((v) => parseFloat(v.trim()))
        .filter((v) => !Number.isNaN(v) && Number.isFinite(v) && v > 0);
      if (mover.freqs.length === 0) mover.freqs = [1];
      mover.phase = parseFloat(phaseInput.value) || mover.phase;
      mover.amp = parseFloat(ampInput.value) || mover.amp;
    }
  };
};
