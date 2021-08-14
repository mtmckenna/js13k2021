#version 100

attribute vec2 aSquarePosition;

void main() {
  gl_Position =  vec4(aSquarePosition.x, aSquarePosition.y, 0.0, 1.0);
}