const canvas = document.getElementById('glCanvas');
const gl = canvas.getContext('webgl');

if (!gl) {
  document.body.innerHTML = '<p style="color:white;text-align:center;margin-top:20px">A böngésző nem támogatja a WebGL 1-et.</p>';
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

  window.addEventListener('resize', resizeCanvas);
  requestAnimationFrame(render);
}
