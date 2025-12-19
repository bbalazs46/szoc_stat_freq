export const shaderSources = {
  vertexSource: `
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
      float size = u_pointSize / (1.0 + u_sizeFalloff * length(a_position - u_cameraWorld));
      gl_PointSize = max(u_minPointSize, size);
    }
  `,
  fragmentSource: `
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
  `,
  lineVertexSource: `
    attribute vec2 a_position;
    uniform vec2 u_resolution;
    uniform mat3 u_transform;

    void main() {
      vec3 transformed = u_transform * vec3(a_position, 1.0);
      vec2 clip = transformed.xy / (u_resolution * 0.5);
      gl_Position = vec4(clip, 0.0, 1.0);
    }
  `,
  lineFragmentSource: `
    precision mediump float;
    uniform vec4 u_color;

    void main() {
      gl_FragColor = u_color;
    }
  `,
  bgVertexSource: `
    attribute vec2 a_position;
    void main() {
      gl_Position = vec4(a_position, 0.0, 1.0);
    }
  `,
  bgFragmentSource: `
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

    vec2 rand2(vec2 st) {
      st = vec2(
        dot(st, vec2(127.1, 311.7)),
        dot(st, vec2(269.5, 183.3))
      );
      return fract(sin(st) * 43758.5453);
    }

    float roundf(float v) { return floor(v + 0.5); }

    void main() {
      vec2 frag = gl_FragCoord.xy;
      vec2 view = vec2(frag.x - u_resolution.x * 0.5, frag.y - u_resolution.y * 0.5);
      vec3 world3 = u_invTransform * vec3(view, 1.0);
      vec2 world = world3.xy;

      vec2 cell = floor(world / vec2(u_gridSpacing, u_verticalSpacing));
      float best = 1e9;
      vec2 bestCenter = vec2(0.0);
      for (int dx = -1; dx <= 1; dx++) {
        for (int dy = -1; dy <= 1; dy++) {
          vec2 c = cell + vec2(float(dx), float(dy));
          vec2 jitter = rand2(c);
          vec2 candidate = (c + jitter) * vec2(u_gridSpacing, u_verticalSpacing);
          float d = length(world - candidate);
          if (d < best) {
            best = d;
            bestCenter = candidate;
          }
        }
      }

      vec2 local = world - bestCenter;
      vec2 warped = u_warp * local;

      float radius = u_baseSize / (1.0 + u_sizeFalloff * length(bestCenter - u_cameraWorld));
      float d = length(warped);
      if (d > radius) discard;

      gl_FragColor = u_color;
    }
  `
};

const compileShader = (gl, type, source) => {
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

const createProgram = (gl, vSrc, fSrc) => {
  const vShader = compileShader(gl, gl.VERTEX_SHADER, vSrc);
  const fShader = compileShader(gl, gl.FRAGMENT_SHADER, fSrc);
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

export const createPrograms = (gl) => {
  const program = createProgram(gl, shaderSources.vertexSource, shaderSources.fragmentSource);
  const lineProgram = createProgram(gl, shaderSources.lineVertexSource, shaderSources.lineFragmentSource);
  const bgProgram = createProgram(gl, shaderSources.bgVertexSource, shaderSources.bgFragmentSource);
  return { program, lineProgram, bgProgram };
};
