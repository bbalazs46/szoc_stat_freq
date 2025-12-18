const canvas = document.getElementById('glCanvas');

const DPR_FALLBACK = 1;
const BG_COLOR = [0.6667, 0.6667, 0.6667, 1];
const POINT_COLOR = [1, 1, 1, 1];
const GRID_SPACING = 48;
const GRID_RANGE = 120;
const BASE_POINT_SIZE = 20;
const MIN_POINT_SIZE = 1.5;
const SIZE_FALLOFF = 0.0004;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4;
const EPS = 1e-4;
const DET_EPS = 1e-8;
const TRAIL_LENGTH = 400;
const HEAD_POINT_SIZE = 8;
const TRAIL_POINT_SIZE = 6;
const MOVER_X_OFFSET = -300;

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
      uniform float u_zoom;
      uniform float u_pointSize;
      uniform float u_sizeFalloff;
      uniform float u_minPointSize;

      void main() {
        vec3 transformed = u_transform * vec3(a_position, 1.0);
        vec2 view = transformed.xy;
        vec2 clip = view / (u_resolution * 0.5);
        gl_Position = vec4(clip, 0.0, 1.0);
        float size = u_pointSize * u_zoom / (1.0 + u_sizeFalloff * length(a_position));
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
      gl.deleteShader(vShader);
      gl.deleteShader(fShader);
      return prog;
    })();

    if (!program) {
      displayMessage('Shader compilation failed.');
    } else {
      gl.useProgram(program);

      const attribPosition = gl.getAttribLocation(program, 'a_position');
      const uniResolution = gl.getUniformLocation(program, 'u_resolution');
      const uniTransform = gl.getUniformLocation(program, 'u_transform');
      const uniZoom = gl.getUniformLocation(program, 'u_zoom');
      const uniPointSize = gl.getUniformLocation(program, 'u_pointSize');
      const uniSizeFalloff = gl.getUniformLocation(program, 'u_sizeFalloff');
      const uniMinPointSize = gl.getUniformLocation(program, 'u_minPointSize');
      const uniColor = gl.getUniformLocation(program, 'u_color');

      const buildPositions = () => {
        const list = [];
        const halfSpacing = GRID_SPACING * 0.5;
        const verticalSpacing = GRID_SPACING * Math.sqrt(3) * 0.5;

        for (let row = -GRID_RANGE; row <= GRID_RANGE; row++) {
          const y = row * verticalSpacing;
          const offset = (row & 1) ? halfSpacing : 0;
          for (let col = -GRID_RANGE; col <= GRID_RANGE; col++) {
            const x = (col * GRID_SPACING) + offset;
            list.push(x, y);
          }
        }
        return new Float32Array(list);
      };

      const positions = buildPositions();

      const positionBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(attribPosition);
      gl.vertexAttribPointer(attribPosition, 2, gl.FLOAT, false, 0, 0);

      gl.uniform4fv(uniColor, POINT_COLOR);
      gl.uniform1f(uniPointSize, BASE_POINT_SIZE);
      gl.uniform1f(uniSizeFalloff, SIZE_FALLOFF);
      gl.uniform1f(uniMinPointSize, MIN_POINT_SIZE);

      const state = {
        transform: identityTransform()
      };

      const pointers = new Map();
      const startTime = performance.now();

      const movers = [
        { amp: 50, freq: 1.1, speed: 90, phase: 0, color: [1, 0.2, 0.2, 1], trailColor: [1, 0.2, 0.2, 0.5], trail: [] },
        { amp: 70, freq: 0.9, speed: 70, phase: 1.2, color: [0.2, 0.6, 1, 1], trailColor: [0.2, 0.6, 1, 0.5], trail: [] },
        { amp: 60, freq: 1.4, speed: 110, phase: -0.8, color: [0.1, 0.9, 0.5, 1], trailColor: [0.1, 0.9, 0.5, 0.5], trail: [] }
      ];

      const moverBuffers = movers.map(() => gl.createBuffer());

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

      const screenToView = (x, y) => ({
        x: x - canvas.clientWidth * 0.5,
        y: canvas.clientHeight * 0.5 - y
      });

      const viewToWorld = (viewPt) => {
        const inv = invertTransform(state.transform);
        return transformPoint(inv, viewPt);
      };

      const updateTransformFromPointers = () => {
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
          const baseScale = clamp(lenDv / lenDw, MIN_ZOOM, MAX_ZOOM);
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

      const updateMoverTrail = (mover, pos) => {
        mover.trail.push(pos);
        let distance = 0;
        for (let i = mover.trail.length - 1; i > 0; i--) {
          const a = mover.trail[i];
          const b = mover.trail[i - 1];
          distance += Math.hypot(a.x - b.x, a.y - b.y);
          if (distance > TRAIL_LENGTH) {
            mover.trail.splice(0, i - 1);
            break;
          }
        }
      };

      canvas.addEventListener('pointerdown', (e) => {
        const world = viewToWorld(screenToView(e.clientX, e.clientY));
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, world });
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
        pointers.delete(id);
        updateTransformFromPointers();
      };

      canvas.addEventListener('pointerup', (e) => removePointer(e.pointerId));
      canvas.addEventListener('pointercancel', (e) => removePointer(e.pointerId));

      const render = () => {
        const t = (performance.now() - startTime) * 0.001;
        resizeCanvas();

        const tf = state.transform;
        gl.uniformMatrix3fv(
          uniTransform,
          false,
          new Float32Array([
            tf.m00, tf.m10, 0,
            tf.m01, tf.m11, 0,
            tf.tx, tf.ty, 1
          ])
        );
        gl.uniform1f(uniZoom, effectiveScale(tf));

        gl.clearColor(BG_COLOR[0], BG_COLOR[1], BG_COLOR[2], BG_COLOR[3]);
        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.uniform4fv(uniColor, POINT_COLOR);
        gl.uniform1f(uniPointSize, BASE_POINT_SIZE);
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.vertexAttribPointer(attribPosition, 2, gl.FLOAT, false, 0, 0);
        gl.drawArrays(gl.POINTS, 0, positions.length / 2);

        movers.forEach((mover, idx) => {
          const pos = evalMover(mover, t);
          updateMoverTrail(mover, pos);

          const trailFlat = [];
          for (let i = 0; i < mover.trail.length; i++) {
            trailFlat.push(mover.trail[i].x, mover.trail[i].y);
          }

          if (trailFlat.length >= 4) {
            gl.bindBuffer(gl.ARRAY_BUFFER, moverBuffers[idx]);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(trailFlat), gl.DYNAMIC_DRAW);
            gl.vertexAttribPointer(attribPosition, 2, gl.FLOAT, false, 0, 0);
            gl.uniform4fv(uniColor, mover.trailColor);
            gl.uniform1f(uniPointSize, TRAIL_POINT_SIZE);
            gl.drawArrays(gl.LINE_STRIP, 0, trailFlat.length / 2);
          }

          if (trailFlat.length >= 2) {
            gl.uniform1f(uniPointSize, HEAD_POINT_SIZE);
            gl.uniform4fv(uniColor, mover.color);
            gl.drawArrays(gl.POINTS, trailFlat.length / 2 - 1, 1);
          }
        });

        requestAnimationFrame(render);
      };

      resizeCanvas();
      requestAnimationFrame(render);

      window.addEventListener('resize', () => requestAnimationFrame(render));
    }
  }
}
