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
  freqLabel.textContent = 'Freq: ';
  const freqInput = document.createElement('input');
  freqInput.type = 'number';
  freqInput.step = '0.1';
  freqInput.style.width = '80px';
  freqInput.style.marginBottom = '6px';
  freqLabel.appendChild(freqInput);

  const phaseLabel = document.createElement('label');
  phaseLabel.textContent = 'Phase: ';
  const phaseInput = document.createElement('input');
  phaseInput.type = 'number';
  phaseInput.step = '0.1';
  phaseInput.style.width = '80px';
  phaseLabel.appendChild(phaseInput);

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
  layout.appendChild(closeBtn);

  panel.appendChild(layout);
  document.body.appendChild(panel);

  return {
    panel,
    colorInput,
    freqInput,
    phaseInput,
    closeBtn,
    active: null,
    setFromMover(mover) {
      colorInput.value = colorToHex(mover.color);
      freqInput.value = mover.freq;
      phaseInput.value = mover.phase;
    },
    applyToMover(mover) {
      mover.color = hexToColor(colorInput.value);
      mover.freq = parseFloat(freqInput.value) || mover.freq;
      mover.phase = parseFloat(phaseInput.value) || mover.phase;
    }
  };
};
