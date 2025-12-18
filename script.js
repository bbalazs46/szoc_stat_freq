const canvas = document.getElementById('glCanvas');

const DPR_FALLBACK = 1;
const BG_COLOR = [0.6667, 0.6667, 0.6667, 1];
const POINT_COLOR = [1, 1, 1, 1];
const GRID_SPACING = 48;
const GRID_RANGE = 120;
const BASE_POINT_SIZE = 10;
const SIZE_FALLOFF = 0.0004;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4;

const displayMessage = (text) => {
  const message = document.createElement('p');
  message.textContent = text;
  message.style.color = '#222';
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
    const vertexSource = `
      attribute vec2 a_position;
      uniform vec2 u_resolution;
      uniform vec2 u_camera;
      uniform float u_zoom;
      uniform float u_pointSize;
      uniform float u_sizeFalloff;

      void main() {
        vec2 world = a_position - u_camera;
        vec2 view = world * u_zoom;
        vec2 clip = view / (u_resolution * 0.5);
        gl_Position = vec4(clip, 0.0, 1.0);
        float size = u_pointSize * u_zoom / (1.0 + u_sizeFalloff * length(world));
        gl_PointSize = max(1.5, size);
      }
    `;

    const fragmentSource = `
      precision mediump float;
      uniform vec4 u_color;

      void main() {
        vec2 coord = gl_PointCoord - 0.5;
        float dist = length(coord);
        if (dist > 0.5) {
          discard;
        }
        gl_FragColor = u_color;
      }
    `;

    const compileShader = (type, source) => {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };

    const program = (() => {
      const vShader = compileShader(gl.VERTEX_SHADER, vertexSource);
      const fShader = compileShader(gl.FRAGMENT_SHADER, fragmentSource);
      if (!vShader || !fShader) return null;
      const prog = gl.createProgram();
      gl.attachShader(prog, vShader);
      gl.attachShader(prog, fShader);
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        console.error(gl.getProgramInfoLog(prog));
        return null;
      }
      return prog;
    })();

    if (!program) {
      displayMessage('Shader compilation failed.');
    } else {
      gl.useProgram(program);

      const attribPosition = gl.getAttribLocation(program, 'a_position');
      const uniResolution = gl.getUniformLocation(program, 'u_resolution');
      const uniCamera = gl.getUniformLocation(program, 'u_camera');
      const uniZoom = gl.getUniformLocation(program, 'u_zoom');
      const uniPointSize = gl.getUniformLocation(program, 'u_pointSize');
      const uniSizeFalloff = gl.getUniformLocation(program, 'u_sizeFalloff');
      const uniColor = gl.getUniformLocation(program, 'u_color');

      const positions = [];
      const halfSpacing = GRID_SPACING * 0.5;
      const verticalSpacing = GRID_SPACING * Math.sqrt(3) * 0.5;

      for (let row = -GRID_RANGE; row <= GRID_RANGE; row++) {
        const y = row * verticalSpacing;
        const offset = (row & 1) ? halfSpacing : 0;
        for (let col = -GRID_RANGE; col <= GRID_RANGE; col++) {
          const x = (col * GRID_SPACING) + offset;
          positions.push(x, y);
        }
      }

      const positionBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(attribPosition);
      gl.vertexAttribPointer(attribPosition, 2, gl.FLOAT, false, 0, 0);

      gl.uniform4fv(uniColor, POINT_COLOR);
      gl.uniform1f(uniPointSize, BASE_POINT_SIZE);
      gl.uniform1f(uniSizeFalloff, SIZE_FALLOFF);

      const state = {
        zoom: 1,
        camera: { x: 0, y: 0 }
      };

      const pointers = new Map();

      const resizeCanvas = () => {
        const dpr = window.devicePixelRatio || DPR_FALLBACK;
        const displayWidth = Math.floor(canvas.clientWidth * dpr);
        const displayHeight = Math.floor(canvas.clientHeight * dpr);

        if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
          canvas.width = displayWidth;
          canvas.height = displayHeight;
        }
        gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
        gl.uniform2f(uniResolution, gl.drawingBufferWidth, gl.drawingBufferHeight);
      };

      const clamp = (val, min, max) => Math.min(Math.max(val, min), max);

      const screenToWorld = (x, y) => {
        const cx = x - canvas.clientWidth * 0.5;
        const cy = canvas.clientHeight * 0.5 - y;
        return {
          x: state.camera.x + cx / state.zoom,
          y: state.camera.y + cy / state.zoom
        };
      };

      const handleSinglePan = (prev, next) => {
        const dx = next.x - prev.x;
        const dy = next.y - prev.y;
        state.camera.x -= dx / state.zoom;
        state.camera.y += dy / state.zoom;
      };

      const handlePinch = (prevA, prevB, nextA, nextB) => {
        const prevMid = { x: (prevA.x + prevB.x) * 0.5, y: (prevA.y + prevB.y) * 0.5 };
        const nextMid = { x: (nextA.x + nextB.x) * 0.5, y: (nextA.y + nextB.y) * 0.5 };

        const prevDist = Math.hypot(prevA.x - prevB.x, prevA.y - prevB.y);
        const nextDist = Math.hypot(nextA.x - nextB.x, nextA.y - nextB.y);

        if (prevDist === 0) return;

        const zoomFactor = nextDist / prevDist;
        const prevMidWorld = screenToWorld(prevMid.x, prevMid.y);

        state.zoom = clamp(state.zoom * zoomFactor, MIN_ZOOM, MAX_ZOOM);

        state.camera.x = prevMidWorld.x - (nextMid.x - canvas.clientWidth * 0.5) / state.zoom;
        state.camera.y = prevMidWorld.y - (canvas.clientHeight * 0.5 - nextMid.y) / state.zoom;
      };

      canvas.addEventListener('pointerdown', (e) => {
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, prevX: e.clientX, prevY: e.clientY });
        canvas.setPointerCapture(e.pointerId);
      });

      canvas.addEventListener('pointermove', (e) => {
        if (!pointers.has(e.pointerId)) return;
        const data = pointers.get(e.pointerId);
        data.prevX = data.x;
        data.prevY = data.y;
        data.x = e.clientX;
        data.y = e.clientY;

        if (pointers.size === 1) {
          handleSinglePan({ x: data.prevX, y: data.prevY }, { x: data.x, y: data.y });
        } else if (pointers.size === 2) {
          const ptrs = Array.from(pointers.values()).slice(0, 2);
          const [a, b] = ptrs;
          handlePinch(
            { x: a.prevX, y: a.prevY },
            { x: b.prevX, y: b.prevY },
            { x: a.x, y: a.y },
            { x: b.x, y: b.y }
          );
        }
        scheduleRender();
      });

      const removePointer = (id) => {
        pointers.delete(id);
      };

      canvas.addEventListener('pointerup', (e) => removePointer(e.pointerId));
      canvas.addEventListener('pointercancel', (e) => removePointer(e.pointerId));

      let renderRequested = false;
      const scheduleRender = () => {
        if (!renderRequested) {
          renderRequested = true;
          requestAnimationFrame(render);
        }
      };

      const render = () => {
        renderRequested = false;
        resizeCanvas();
        gl.clearColor(BG_COLOR[0], BG_COLOR[1], BG_COLOR[2], BG_COLOR[3]);
        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.uniform2f(uniCamera, state.camera.x, state.camera.y);
        gl.uniform1f(uniZoom, state.zoom);

        gl.drawArrays(gl.POINTS, 0, positions.length / 2);
      };

      resizeCanvas();
      scheduleRender();

      window.addEventListener('resize', scheduleRender);
    }
  }
}
