import {
  DPR_FALLBACK,
  BG_COLOR,
  POINT_COLOR,
  GRID_SPACING,
  BASE_POINT_SIZE,
  MIN_POINT_SIZE,
  SIZE_FALLOFF,
  EPS,
  TRAIL_DURATION,
  TRAIL_SAMPLES,
  HEAD_POINT_SIZE,
  HIT_RADIUS,
  WARP_LERP,
  HIT_EXTRA
} from './constants.js';
import {
  identityTransform,
  transformPoint,
  invertTransform,
  effectiveScale,
  hexToColor,
  trailColorFromHead,
  displayMessage
} from './utils.js';
import { createPrograms } from './shaders.js';
import { createEditor } from './editor.js';
import { createMovers, evalMover } from './movers.js';

const identityWarp = { m00: 1, m01: 0, m10: 0, m11: 1 };
const lerpWarp = (a, b) => a + WARP_LERP * (b - a);
const lerpMat2 = (cur, target) => ({
  m00: lerpWarp(cur.m00, target.m00),
  m01: lerpWarp(cur.m01, target.m01),
  m10: lerpWarp(cur.m10, target.m10),
  m11: lerpWarp(cur.m11, target.m11)
});
const matDiff = (a, b) =>
  Math.abs(a.m00 - b.m00) > EPS ||
  Math.abs(a.m01 - b.m01) > EPS ||
  Math.abs(a.m10 - b.m10) > EPS ||
  Math.abs(a.m11 - b.m11) > EPS;

const canvas = document.getElementById('glCanvas');

if (!canvas) {
  displayMessage('Canvas element not found.');
} else {
  const gl = canvas.getContext('webgl');

  if (!gl) {
    displayMessage('This browser does not support WebGL 1.');
  } else {
    const { program, lineProgram, bgProgram } = createPrograms(gl);

    if (!program || !lineProgram || !bgProgram) {
      displayMessage('Shader compilation failed.');
    } else {
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
        warp: { ...identityWarp },
        prevLinear: { m00: 1, m01: 0, m10: 0, m11: 1 }
      };

  const pointers = new Map();
  const gesture = { baseTransform: identityTransform(), basePointers: new Map() };
  let skipOnce = false;
  const startTime = performance.now();
  const editor = createEditor();
  let followTransform = identityTransform();

      const movers = createMovers(TRAIL_SAMPLES);
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

      const viewToWorldWith = (viewPt, t) => {
        const inv = invertTransform(t);
        return transformPoint(inv, viewPt);
      };

      const viewToWorld = (viewPt) => viewToWorldWith(viewPt, state.transform);

      const worldToScreen = (p, tOverride) => {
        const t = tOverride || state.transform;
        const view = transformPoint(t, p);
        return {
          x: view.x + canvas.clientWidth * 0.5,
          y: canvas.clientHeight * 0.5 - view.y
        };
      };

      const resetGesture = () => {
        gesture.baseTransform = { ...state.transform };
        gesture.basePointers = new Map();
        const invBase = invertTransform(gesture.baseTransform);
        pointers.forEach((p, id) => {
          const view = screenToView(p.x, p.y);
          const world = transformPoint(invBase, view);
          gesture.basePointers.set(id, { view, world });
        });
      };

      const updateTransformFromPointers = () => {
        if (skipOnce) {
          skipOnce = false;
          return;
        }
        const pointerArray = Array.from(pointers.values());
        const count = pointerArray.length;
        if (count === 0) return;

        const base = gesture.baseTransform;
        const invBase = invertTransform(base);
        const applyLinear = (mat, vec) => ({
          x: mat.m00 * vec.x + mat.m01 * vec.y,
          y: mat.m10 * vec.x + mat.m11 * vec.y
        });

        if (count >= 3) {
          const [p1, p2, p3] = pointerArray;
          const b1 = gesture.basePointers.get(p1.id);
          const b2 = gesture.basePointers.get(p2.id);
          const b3 = gesture.basePointers.get(p3.id);
          if (!b1 || !b2 || !b3) return;
          const w1 = b1.world;
          const w2 = b2.world;
          const w3 = b3.world;
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
          const b1 = gesture.basePointers.get(p1.id);
          const b2 = gesture.basePointers.get(p2.id);
          if (!b1 || !b2) return;
          const w1 = b1.world;
          const w2 = b2.world;
          const v1 = screenToView(p1.x, p1.y);
          const v2 = screenToView(p2.x, p2.y);
          const dw = { x: w2.x - w1.x, y: w2.y - w1.y };
          const dv = { x: v2.x - v1.x, y: v2.y - v1.y };
          const baseVec = applyLinear(base, dw);
          const lenBase = Math.hypot(baseVec.x, baseVec.y);
          const lenDv = Math.hypot(dv.x, dv.y);
          if (lenBase < EPS || lenDv < EPS) return;
          const baseScale = lenDv / lenBase;
          const angle = Math.atan2(dv.y, dv.x) - Math.atan2(baseVec.y, baseVec.x);
          const c = Math.cos(angle);
          const s = Math.sin(angle);
          const m00 = baseScale * (c * base.m00 + -s * base.m10);
          const m01 = baseScale * (c * base.m01 + -s * base.m11);
          const m10 = baseScale * (s * base.m00 + c * base.m10);
          const m11 = baseScale * (s * base.m01 + c * base.m11);
          const tx = v1.x - (m00 * w1.x + m01 * w1.y);
          const ty = v1.y - (m10 * w1.x + m11 * w1.y);
          state.transform = { m00, m01, m10, m11, tx, ty };
          return;
        }

        if (count === 1) {
          const [p] = pointerArray;
          const basePtr = gesture.basePointers.get(p.id);
          if (!basePtr) return;
          const world = basePtr.world;
          const view = screenToView(p.x, p.y);
          const { m00, m01, m10, m11 } = base;
          const tx = view.x - (m00 * world.x + m01 * world.y);
          const ty = view.y - (m10 * world.x + m11 * world.y);
          state.transform = { m00, m01, m10, m11, tx, ty };
        }
      };

      canvas.addEventListener('pointerdown', (e) => {
        const world = viewToWorld(screenToView(e.clientX, e.clientY));

        let hitIdx = -1;
        for (let i = 0; i < movers.length; i++) {
          const screen = moverScreens[i];
          if (!screen) continue;
          const dx = e.clientX - screen.x;
          const dy = e.clientY - screen.y;
          const radius = (screen.r ?? HEAD_POINT_SIZE * 0.5) + HIT_EXTRA;
          if (Math.hypot(dx, dy) <= radius) {
            hitIdx = i;
            break;
          }
        }

        if (hitIdx >= 0) {
          editor.active = hitIdx;
          const mover = movers[hitIdx];
          editor.setFromMover(mover);
          editor.panel.style.display = 'block';
          canvas.setPointerCapture(e.pointerId);
          return;
        }

        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, id: e.pointerId, world });
        skipOnce = true;
        resetGesture();
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
        if (pointers.size > 0) {
          skipOnce = true;
          resetGesture();
          updateTransformFromPointers();
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
        mover.freqs = editor.freqInput.value
          .split(',')
          .map((v) => parseFloat(v.trim()))
          .filter((v) => !Number.isNaN(v) && Number.isFinite(v) && v > 0);
        if (mover.freqs.length === 0) mover.freqs = [1];
      });

      editor.phaseInput.addEventListener('input', () => {
        if (editor.active === null) return;
        const mover = movers[editor.active];
        mover.phase = parseFloat(editor.phaseInput.value) || mover.phase;
      });

      editor.ampInput.addEventListener('input', () => {
        if (editor.active === null) return;
        const mover = movers[editor.active];
        mover.amp = parseFloat(editor.ampInput.value) || mover.amp;
      });

      editor.closeBtn.addEventListener('click', () => {
        state.transform = { ...followTransform };
        editor.active = null;
        editor.panel.style.display = 'none';
      });

      const render = () => {
        const t = (performance.now() - startTime) * 0.001;
        if (canvasDirty) {
          resizeCanvas();
        }

        let tf = state.transform;
        if (editor.active !== null) {
          const mover = movers[editor.active];
          const pos = evalMover(mover, t);
          tf = {
            ...tf,
            tx: -(tf.m00 * pos.x + tf.m01 * pos.y),
            ty: -(tf.m10 * pos.x + tf.m11 * pos.y)
          };
          followTransform = tf;
        }

        const linear = { m00: tf.m00, m01: tf.m01, m10: tf.m10, m11: tf.m11 };
        const linChanged = matDiff(linear, state.prevLinear);

        const det = linear.m00 * linear.m11 - linear.m01 * linear.m10;
        // Normalize linear part to preserve area (keep radius invariant)
        const absDet = Math.abs(det);
        const signDet = Math.sign(det) || 1;
        const scale = absDet > EPS ? signDet * Math.sqrt(absDet) : 1;
        const normWarp = absDet > EPS
          ? {
              m00: linear.m00 / scale,
              m01: linear.m01 / scale,
              m10: linear.m10 / scale,
              m11: linear.m11 / scale
            }
          : { ...state.warp };

        if (linChanged) {
          state.warp = { ...normWarp };
          state.prevLinear = { ...linear };
        }

        // Always relax current warp back toward identity for the slow "flow" effect
        if (matDiff(state.warp, identityWarp)) {
          state.warp = lerpMat2(state.warp, identityWarp);
        }

        const matrixArr = new Float32Array([
          tf.m00, tf.m10, 0,
          tf.m01, tf.m11, 0,
          tf.tx, tf.ty, 1
        ]);
        const cameraWorld = viewToWorldWith({ x: 0, y: 0 }, tf);
        const invTf = invertTransform(tf);
        const invArr = new Float32Array([
          invTf.m00, invTf.m10, 0,
          invTf.m01, invTf.m11, 0,
          invTf.tx, invTf.ty, 1
        ]);

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
        const zoomVal = effectiveScale(tf);
        gl.uniform1f(bgUniZoom, zoomVal);
        gl.uniform2f(bgUniCameraWorld, cameraWorld.x, cameraWorld.y);
        gl.uniform4fv(bgUniColor, POINT_COLOR);
        gl.drawArrays(gl.TRIANGLES, 0, 3);

        gl.useProgram(program);
        gl.uniformMatrix3fv(uniTransform, false, matrixArr);
        gl.uniform1f(uniZoom, zoomVal);
        gl.uniform2f(uniCameraWorld, cameraWorld.x, cameraWorld.y);

        movers.forEach((mover, idx) => {
           const pos = evalMover(mover, t);
           const screenPos = worldToScreen(pos, tf);
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
