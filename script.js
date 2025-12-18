const canvas = document.getElementById('glCanvas');

const DPR_FALLBACK = 1;
const BASE_COLOR = 0.2;
const COLOR_AMPLITUDE = 0.3;
const COLOR_PHASE_G = 2.0;
const COLOR_PHASE_B = 4.0;

const displayMessage = (text) => {
  const message = document.createElement('p');
  message.textContent = text;
  message.style.color = 'white';
  message.style.textAlign = 'center';
  message.style.marginTop = '20px';
  document.body.replaceChildren(message);
};

if (!canvas) {
  displayMessage('Canvas element not found.');
} else {
  const gl = canvas.getContext('webgl');

  if (!gl) {
    displayMessage('This browser does not support WebGL 1.');
  } else {
    const resizeCanvas = () => {
      const dpr = window.devicePixelRatio || DPR_FALLBACK;
      const displayWidth = Math.floor(canvas.clientWidth * dpr);
      const displayHeight = Math.floor(canvas.clientHeight * dpr);

      if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
        canvas.width = displayWidth;
        canvas.height = displayHeight;
        gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      }
    };

    const render = (time) => {
      const t = time * 0.001;
      const r = BASE_COLOR + COLOR_AMPLITUDE * Math.sin(t);
      const g = BASE_COLOR + COLOR_AMPLITUDE * Math.sin(t + COLOR_PHASE_G);
      const b = BASE_COLOR + COLOR_AMPLITUDE * Math.sin(t + COLOR_PHASE_B);

      gl.clearColor(r, g, b, 1.0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      requestAnimationFrame(render);
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    requestAnimationFrame(render);
  }
}
