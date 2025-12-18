const canvas = document.getElementById('glCanvas');
const gl = canvas.getContext('webgl');

if (!gl) {
  const message = document.createElement('p');
  message.textContent = 'This browser does not support WebGL 1.';
  message.style.color = 'white';
  message.style.textAlign = 'center';
  message.style.marginTop = '20px';
  document.body.replaceChildren(message);
} else {
  const resizeCanvas = () => {
    const dpr = window.devicePixelRatio || 1;
    const displayWidth = Math.floor(canvas.clientWidth * dpr);
    const displayHeight = Math.floor(canvas.clientHeight * dpr);

    if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
      canvas.width = displayWidth;
      canvas.height = displayHeight;
    }

    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
  };

  const render = (time) => {
    resizeCanvas();

    const t = time * 0.001;
    const r = 0.2 + 0.3 * Math.sin(t);
    const g = 0.2 + 0.3 * Math.sin(t + 2.0);
    const b = 0.3 + 0.3 * Math.sin(t + 4.0);

    gl.clearColor(r, g, b, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    requestAnimationFrame(render);
  };

  requestAnimationFrame(render);
}
