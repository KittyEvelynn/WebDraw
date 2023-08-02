precision mediump float;
varying vec2 v_uv;
uniform vec2 u_size;

void main() {
  gl_FragColor = vec4(v_uv, 0.0, 1.0);
}