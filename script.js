const canvas = document.getElementById('glCanvas');

const DPR_FALLBACK = 1;
const BG_COLOR = [0.9, 0.9, 0.9, 1];
const POINT_COLOR = [1, 1, 1, 1];
const GRID_SPACING = 48;
const BASE_POINT_SIZE = 10;
const MIN_POINT_SIZE = 1.5;
const SIZE_FALLOFF = 0.0004;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4;
const EPS = 1e-4;
const DET_EPS = 1e-8;
const TRAIL_DURATION = 5.0;
const TRAIL_SAMPLES = 120;
const HEAD_POINT_SIZE = 24;
const MOVER_X_OFFSET = -300;
const HIT_RADIUS = 50;
const WARP_LERP = 0.1;
const HIT_EXTRA = 8;

const identityTransform = () => ({
  m00: 1, m01: 0,
  m10: 0, m11: 1,
  tx: 0, ty: 0
});

const transformPoint = (t, p) => ({
  x: t.m00 * p.x + t.m01 * p.y + t.tx,
  y: t.m10 * p.x + t.m11 * p.y + t.ty
});

const invertTransform = (t) => {
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

const effectiveScale = (t) => {
  const sx = Math.hypot(t.m00, t.m10);
  const sy = Math.hypot(t.m01, t.m11);
  return 0.5 * (sx + sy);
};

const clamp = (val, min, max) => Math.min(Math.max(val, min), max);

const colorToHex = (c) => {
  const toByte = (v) => Math.round(clamp(v, 0, 1) * 255);
  const [r, g, b] = c;
  return `#${[r, g, b].map(toByte).map((v) => v.toString(16).padStart(2, '0')).join('')}`;
};

const hexToColor = (hex) => {
  const clean = hex.replace('#', '');
  const num = parseInt(clean, 16);
  return [
    ((num >> 16) & 0xff) / 255,
    ((num >> 8) & 0xff) / 255,
    (num & 0xff) / 255,
    1
  ];
};

const trailColorFromHead = (color) => [color[0], color[1], color[2], 0.5];

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
      uniform mat3 u_transform;
      uniform vec2 u_cameraWorld;
      uniform float u_zoom;
      uniform float u_pointSize;
      uniform float u_sizeFalloff;
      uniform float u_minPointSize;

      void main() {
        vec3 transformed = u_transform * vec3(a_position, 1.0);
        vec2 view = transformed.xy;
        vec2 clip = view / (u_resolution * 0.5);
        gl_Position = vec4(clip, 0.0, 1.0);
        float size = u_pointSize * u_zoom / (1.0 + u_sizeFalloff * length(a_position - u_cameraWorld));
        gl_PointSize = max(u_minPointSize, size);
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

    const lineVertexSource = `
      attribute vec2 a_position;
      uniform vec2 u_resolution;
      uniform mat3 u_transform;

      void main() {
        vec3 transformed = u_transform * vec3(a_position, 1.0);
        vec2 clip = transformed.xy / (u_resolution * 0.5);
        gl_Position = vec4(clip, 0.0, 1.0);
      }
    `;

    const lineFragmentSource = `
      precision mediump float;
      uniform vec4 u_color;

      void main() {
        gl_FragColor = u_color;
      }
    `;

    const bgVertexSource = `
      attribute vec2 a_position;
      void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `;

    const bgFragmentSource = `
      precision mediump float;
      uniform vec2 u_resolution;
      uniform mat3 u_invTransform;
      uniform mat2 u_warp;
      uniform float u_gridSpacing;
      uniform float u_verticalSpacing;
      uniform float u_halfSpacing;
      uniform float u_baseSize;
      uniform float u_sizeFalloff;
      uniform float u_zoom;
      uniform vec2 u_cameraWorld;
      uniform vec4 u_color;

      float roundf(float v) { return floor(v + 0.5); }

      void main() {
        vec2 frag = gl_FragCoord.xy;
        vec2 view = vec2(frag.x - u_resolution.x * 0.5, frag.y - u_resolution.y * 0.5);
        vec3 world3 = u_invTransform * vec3(view, 1.0);
        vec2 world = world3.xy;

        float row = roundf(world.y / u_verticalSpacing);
        float offset = mod(row, 2.0) * u_halfSpacing;
        float col = roundf((world.x - offset) / u_gridSpacing);
        vec2 center = vec2(col * u_gridSpacing + offset, row * u_verticalSpacing);

        vec2 local = world - center;
        vec2 warped = u_warp * local;

        float radius = u_baseSize * u_zoom / (1.0 + u_sizeFalloff * length(center - u_cameraWorld));
        float d = length(warped);
        if (d > radius) discard;

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

    const createProgram = (vSrc, fSrc) => {
      const vShader = compileShader(gl.VERTEX_SHADER, vSrc);
      const fShader = compileShader(gl.FRAGMENT_SHADER, fSrc);
      if (!vShader || !fShader) return null;
      const prog = gl.createProgram();
      gl.attachShader(prog, vShader);
      gl.attachShader(prog, fShader);
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        console.error(gl.getProgramInfoLog(prog));
        return null;
      }
      gl.deleteShader(vShader);
      gl.deleteShader(fShader);
      return prog;
    };

    const program = createProgram(vertexSource, fragmentSource);
    const lineProgram = createProgram(lineVertexSource, lineFragmentSource);
    const bgProgram = createProgram(bgVertexSource, bgFragmentSource);

    if (!program || !lineProgram || !bgProgram) {
      displayMessage('Shader compilation failed.');
    } else {
      gl.useProgram(program);

      const attribPosition = gl.getAttribLocation(program, 'a_position');
      const uniResolution = gl.getUniformLocation(program, 'u_resolution');
      const uniTransform = gl.getUniformLocation(program, 'u_transform');
      const uniCameraWorld = gl.getUniformLocation(program, 'u_cameraWorld');
      const uniZoom = gl.getUniformLocation(program, 'u_zoom');
      const uniPointSize = gl.getUniformLocation(program, 'u_pointSize');
      const uniSizeFalloff = gl.getUniformLocation(program, 'u_sizeFalloff');
      const uniMinPointSize = gl.getUniformLocation(program, 'u_minPointSize');
      const uniColor = gl.getUniformLocation(program, 'u_color');

      const lineAttribPosition = gl.getAttribLocation(lineProgram, 'a_position');
      const lineUniResolution = gl.getUniformLocation(lineProgram, 'u_resolution');
      const lineUniTransform = gl.getUniformLocation(lineProgram, 'u_transform');
      const lineUniColor = gl.getUniformLocation(lineProgram, 'u_color');

      const bgAttribPosition = gl.getAttribLocation(bgProgram, 'a_position');
      const bgUniResolution = gl.getUniformLocation(bgProgram, 'u_resolution');
      const bgUniInvTransform = gl.getUniformLocation(bgProgram, 'u_invTransform');
      const bgUniWarp = gl.getUniformLocation(bgProgram, 'u_warp');
      const bgUniGridSpacing = gl.getUniformLocation(bgProgram, 'u_gridSpacing');
      const bgUniVerticalSpacing = gl.getUniformLocation(bgProgram, 'u_verticalSpacing');
      const bgUniHalfSpacing = gl.getUniformLocation(bgProgram, 'u_halfSpacing');
      const bgUniBaseSize = gl.getUniformLocation(bgProgram, 'u_baseSize');
      const bgUniSizeFalloff = gl.getUniformLocation(bgProgram, 'u_sizeFalloff');
      const bgUniZoom = gl.getUniformLocation(bgProgram, 'u_zoom');
      const bgUniCameraWorld = gl.getUniformLocation(bgProgram, 'u_cameraWorld');
      const bgUniColor = gl.getUniformLocation(bgProgram, 'u_color');

      const positionBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.enableVertexAttribArray(attribPosition);
      gl.vertexAttribPointer(attribPosition, 2, gl.FLOAT, false, 0, 0);
      gl.useProgram(lineProgram);
      gl.enableVertexAttribArray(lineAttribPosition);
      gl.useProgram(program);

      const bgBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, bgBuffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([
          -1, -1,
          3, -1,
          -1, 3
        ]),
        gl.STATIC_DRAW
      );

      gl.uniform4fv(uniColor, POINT_COLOR);
      gl.uniform1f(uniPointSize, BASE_POINT_SIZE);
      gl.uniform1f(uniSizeFalloff, SIZE_FALLOFF);
      gl.uniform1f(uniMinPointSize, MIN_POINT_SIZE);

      const state = {
        transform: identityTransform(),
        warp: { m00: 1, m01: 0, m10: 0, m11: 1 },
        prevLinear: { m00: 1, m01: 0, m10: 0, m11: 1 },
        lockTransform: false
      };

      const pointers = new Map();
      const startTime = performance.now();
      const editor = (() => {
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
          active: null
        };
      })();

      const movers = [
        { amp: 50, freq: 1.1, speed: 90, phase: 0, color: [5, 0.1, 0.1, 1], flat: new Float32Array(TRAIL_SAMPLES * 2) },
        { amp: 70, freq: 0.9, speed: 70, phase: 1.2, color: [0.1, 0.3, 0.5, 1], flat: new Float32Array(TRAIL_SAMPLES * 2) },
        { amp: 60, freq: 1.4, speed: 110, phase: -0.8, color: [0.05, 0.45, 0.25, 1], flat: new Float32Array(TRAIL_SAMPLES * 2) }
      ];
      const moverScreens = new Array(movers.length).fill(null);

      const moverBuffers = movers.map(() => gl.createBuffer());

      let canvasDirty = true;

      const resizeCanvas = () => {
        const dpr = window.devicePixelRatio || DPR_FALLBACK;
        const displayWidth = Math.floor(canvas.clientWidth * dpr);
        const displayHeight = Math.floor(canvas.clientHeight * dpr);

        if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
          canvas.width = displayWidth;
          canvas.height = displayHeight;
        }
        gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
        gl.useProgram(program);
        gl.uniform2f(uniResolution, gl.drawingBufferWidth, gl.drawingBufferHeight);
        gl.useProgram(lineProgram);
        gl.uniform2f(lineUniResolution, gl.drawingBufferWidth, gl.drawingBufferHeight);
        gl.useProgram(bgProgram);
        gl.uniform2f(bgUniResolution, gl.drawingBufferWidth, gl.drawingBufferHeight);
        gl.useProgram(program);
        canvasDirty = false;
      };

      const screenToView = (x, y) => ({
        x: x - canvas.clientWidth * 0.5,
        y: canvas.clientHeight * 0.5 - y
      });

      const viewToWorld = (viewPt) => {
        const inv = invertTransform(state.transform);
        return transformPoint(inv, viewPt);
      };

      const worldToScreen = (p) => {
        const view = transformPoint(state.transform, p);
        return {
          x: view.x + canvas.clientWidth * 0.5,
          y: canvas.clientHeight * 0.5 - view.y
        };
      };

      const updateTransformFromPointers = () => {
        if (state.lockTransform) return;
        const pointerArray = Array.from(pointers.values());
        const count = pointerArray.length;
        if (count === 0) return;

        if (count >= 3) {
          const [p1, p2, p3] = pointerArray;
          const w1 = p1.world;
          const w2 = p2.world;
          const w3 = p3.world;
          const v1 = screenToView(p1.x, p1.y);
          const v2 = screenToView(p2.x, p2.y);
          const v3 = screenToView(p3.x, p3.y);
          const dw1 = { x: w2.x - w1.x, y: w2.y - w1.y };
          const dw2 = { x: w3.x - w1.x, y: w3.y - w1.y };
          const det = dw1.x * dw2.y - dw1.y * dw2.x;
          if (Math.abs(det) < EPS) return;
          const invDet = 1 / det;
          const inv00 = dw2.y * invDet;
          const inv01 = -dw2.x * invDet;
          const inv10 = -dw1.y * invDet;
          const inv11 = dw1.x * invDet;
          const dv1 = { x: v2.x - v1.x, y: v2.y - v1.y };
          const dv2 = { x: v3.x - v1.x, y: v3.y - v1.y };
          const m00 = dv1.x * inv00 + dv2.x * inv10;
          const m01 = dv1.x * inv01 + dv2.x * inv11;
          const m10 = dv1.y * inv00 + dv2.y * inv10;
          const m11 = dv1.y * inv01 + dv2.y * inv11;
          const tx = v1.x - (m00 * w1.x + m01 * w1.y);
          const ty = v1.y - (m10 * w1.x + m11 * w1.y);
          state.transform = { m00, m01, m10, m11, tx, ty };
          return;
        }

        if (count === 2) {
          const [p1, p2] = pointerArray;
          const w1 = p1.world;
          const w2 = p2.world;
          const v1 = screenToView(p1.x, p1.y);
          const v2 = screenToView(p2.x, p2.y);
          const dw = { x: w2.x - w1.x, y: w2.y - w1.y };
          const dv = { x: v2.x - v1.x, y: v2.y - v1.y };
          const lenDw = Math.hypot(dw.x, dw.y);
          const lenDv = Math.hypot(dv.x, dv.y);
          if (lenDw < EPS || lenDv < EPS) return;
          const baseScale = lenDv / lenDw;
          const angle = Math.atan2(dv.y, dv.x) - Math.atan2(dw.y, dw.x);
          const c = Math.cos(angle);
          const s = Math.sin(angle);
          const m00 = baseScale * c;
          const m01 = -baseScale * s;
          const m10 = baseScale * s;
          const m11 = baseScale * c;
          const tx = v1.x - (m00 * w1.x + m01 * w1.y);
          const ty = v1.y - (m10 * w1.x + m11 * w1.y);
          state.transform = { m00, m01, m10, m11, tx, ty };
          return;
        }

        if (count === 1) {
          const [p] = pointerArray;
          const world = p.world;
          const view = screenToView(p.x, p.y);
          const { m00, m01, m10, m11 } = state.transform;
          const tx = view.x - (m00 * world.x + m01 * world.y);
          const ty = view.y - (m10 * world.x + m11 * world.y);
          state.transform = { m00, m01, m10, m11, tx, ty };
        }
      };

      const evalMover = (mover, t) => ({
        x: (t * mover.speed) + MOVER_X_OFFSET,
        y: mover.amp * Math.sin(t * mover.freq + mover.phase)
      });

      canvas.addEventListener('pointerdown', (e) => {
        const world = viewToWorld(screenToView(e.clientX, e.clientY));

        // Hit test movers in screen space
        let hitIdx = -1;
        for (let i = 0; i < movers.length; i++) {
          const screen = moverScreens[i];
          if (!screen) continue;
          const dx = e.clientX - screen.x;
          const dy = e.clientY - screen.y;
          const radius = (screen.r || 0) + HIT_EXTRA;
          if (Math.hypot(dx, dy) <= radius) {
            hitIdx = i;
            break;
          }
        }

        if (hitIdx >= 0) {
          editor.active = hitIdx;
          const mover = movers[hitIdx];
          editor.colorInput.value = colorToHex(mover.color);
          editor.freqInput.value = mover.freq;
          editor.phaseInput.value = mover.phase;
          editor.panel.style.display = 'block';
          canvas.setPointerCapture(e.pointerId);
          return;
        }

        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, world });
        if (pointers.size === 1) {
          state.lockTransform = false;
        }
        canvas.setPointerCapture(e.pointerId);
        updateTransformFromPointers();
      });

      canvas.addEventListener('pointermove', (e) => {
        if (!pointers.has(e.pointerId)) return;
        const data = pointers.get(e.pointerId);
        data.x = e.clientX;
        data.y = e.clientY;
        updateTransformFromPointers();
      });

      const removePointer = (id) => {
        const prevCount = pointers.size;
        pointers.delete(id);
        if (prevCount >= 3 && pointers.size < 3) {
          state.lockTransform = true;
        }
        if (pointers.size === 0) {
          state.lockTransform = false;
        }
      };

      canvas.addEventListener('pointerup', (e) => removePointer(e.pointerId));
      canvas.addEventListener('pointercancel', (e) => removePointer(e.pointerId));

      editor.colorInput.addEventListener('input', () => {
        if (editor.active === null) return;
        const mover = movers[editor.active];
        mover.color = hexToColor(editor.colorInput.value);
      });

      editor.freqInput.addEventListener('input', () => {
        if (editor.active === null) return;
        const mover = movers[editor.active];
        mover.freq = parseFloat(editor.freqInput.value) || mover.freq;
      });

      editor.phaseInput.addEventListener('input', () => {
        if (editor.active === null) return;
        const mover = movers[editor.active];
        mover.phase = parseFloat(editor.phaseInput.value) || mover.phase;
      });

      editor.closeBtn.addEventListener('click', () => {
        editor.active = null;
        editor.panel.style.display = 'none';
      });

      const render = () => {
        const t = (performance.now() - startTime) * 0.001;
        if (canvasDirty) {
          resizeCanvas();
        }

        const tf = state.transform;
        const matrixArr = new Float32Array([
          tf.m00, tf.m10, 0,
          tf.m01, tf.m11, 0,
          tf.tx, tf.ty, 1
        ]);
        const cameraWorld = viewToWorld({ x: 0, y: 0 });
        const zoomVal = effectiveScale(tf);
        const invTf = invertTransform(state.transform);
        const invArr = new Float32Array([
          invTf.m00, invTf.m10, 0,
          invTf.m01, invTf.m11, 0,
          invTf.tx, invTf.ty, 1
        ]);

        const lin = { m00: tf.m00, m01: tf.m01, m10: tf.m10, m11: tf.m11 };
        state.warp = { ...lin };
        state.prevLinear = { ...lin };
        const warpArr = new Float32Array([
          state.warp.m00, state.warp.m10,
          state.warp.m01, state.warp.m11
        ]);

        gl.clearColor(BG_COLOR[0], BG_COLOR[1], BG_COLOR[2], BG_COLOR[3]);
        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.useProgram(bgProgram);
        gl.bindBuffer(gl.ARRAY_BUFFER, bgBuffer);
        gl.enableVertexAttribArray(bgAttribPosition);
        gl.vertexAttribPointer(bgAttribPosition, 2, gl.FLOAT, false, 0, 0);
        gl.uniform2f(bgUniResolution, gl.drawingBufferWidth, gl.drawingBufferHeight);
        gl.uniformMatrix3fv(bgUniInvTransform, false, invArr);
        gl.uniformMatrix2fv(bgUniWarp, false, warpArr);
        gl.uniform1f(bgUniGridSpacing, GRID_SPACING);
        gl.uniform1f(bgUniVerticalSpacing, GRID_SPACING * Math.sqrt(3) * 0.5);
        gl.uniform1f(bgUniHalfSpacing, GRID_SPACING * 0.5);
        gl.uniform1f(bgUniBaseSize, BASE_POINT_SIZE);
        gl.uniform1f(bgUniSizeFalloff, SIZE_FALLOFF);
        gl.uniform1f(bgUniZoom, zoomVal);
        gl.uniform2f(bgUniCameraWorld, cameraWorld.x, cameraWorld.y);
        gl.uniform4fv(bgUniColor, POINT_COLOR);
        gl.drawArrays(gl.TRIANGLES, 0, 3);

        gl.useProgram(program);
        gl.uniformMatrix3fv(uniTransform, false, matrixArr);
        gl.uniform1f(uniZoom, effectiveScale(tf));
        gl.uniform2f(uniCameraWorld, cameraWorld.x, cameraWorld.y);

        movers.forEach((mover, idx) => {
          const pos = evalMover(mover, t);
          const screenPos = worldToScreen(pos);
          const distCam = Math.hypot(pos.x - cameraWorld.x, pos.y - cameraWorld.y);
          const sizePx = (HEAD_POINT_SIZE * zoomVal) / (1 + SIZE_FALLOFF * distCam);
          moverScreens[idx] = { x: screenPos.x, y: screenPos.y, r: sizePx * 0.5 };

          const sampleCount = TRAIL_SAMPLES;
          const dt = TRAIL_DURATION / sampleCount;
          for (let i = 0; i < sampleCount; i++) {
            const tt = t - TRAIL_DURATION + dt * i;
            const sample = evalMover(mover, tt);
            const idx2 = i * 2;
            mover.flat[idx2] = sample.x;
            mover.flat[idx2 + 1] = sample.y;
          }
          const slice = mover.flat;

          if (sampleCount >= 2) {
            gl.useProgram(lineProgram);
            gl.uniformMatrix3fv(lineUniTransform, false, matrixArr);
            const trailColor = trailColorFromHead(mover.color);
            gl.uniform4fv(lineUniColor, trailColor);
            gl.bindBuffer(gl.ARRAY_BUFFER, moverBuffers[idx]);
            gl.bufferData(gl.ARRAY_BUFFER, slice, gl.DYNAMIC_DRAW);
            gl.enableVertexAttribArray(lineAttribPosition);
            gl.vertexAttribPointer(lineAttribPosition, 2, gl.FLOAT, false, 0, 0);
            gl.drawArrays(gl.LINE_STRIP, 0, sampleCount);
          }

          if (sampleCount >= 1) {
            gl.useProgram(program);
            gl.bindBuffer(gl.ARRAY_BUFFER, moverBuffers[idx]);
            gl.vertexAttribPointer(attribPosition, 2, gl.FLOAT, false, 0, 0);
            gl.uniform1f(uniPointSize, HEAD_POINT_SIZE);
            gl.uniform4fv(uniColor, mover.color);
            gl.drawArrays(gl.POINTS, sampleCount - 1, 1);
          }
        });

        if (editor.active !== null) {
          const screenPos = moverScreens[editor.active];
          if (screenPos) {
            editor.panel.style.left = `${screenPos.x}px`;
            editor.panel.style.top = `${screenPos.y}px`;
          }
        }

        requestAnimationFrame(render);
      };

      resizeCanvas();
      requestAnimationFrame(render);

      window.addEventListener('resize', () => {
        canvasDirty = true;
        requestAnimationFrame(render);
      });
    }
  }
}
