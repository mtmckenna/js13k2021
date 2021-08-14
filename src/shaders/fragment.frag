#version 100
precision highp float;

uniform vec2 uRes;
uniform vec2 uPosition;
uniform vec2 uCirclePos[3];
uniform float uTime;

float circleDist(vec2 p, float radius) {
  return length(p) - radius;
}

float smoothFill(float x, float size, float fuzz) {
  return smoothstep(size - fuzz, size + fuzz, x);
}

float fill(float x, float size) {
  return step(size, x);
}

float flip(float v, float pct) {
  return mix(v, 1.-v, pct);
}

// substracts shape d1 from shape d2
float opS( float d1, float d2 )
{
    return max(-d1,d2);
}

float stroke(float x, float w) {
  float d = step(0., x+w*.5) - step(0., x-w*.5);
  return 1.0 -clamp(d, 0.0, 1.0);
}

float strokeIn(float x, float w, float fuzz) {
  float d = smoothstep(fuzz, x-w*.5 - fuzz, x);
  return clamp(d, 0.0, 1.0);
}

float strokeOut(float x, float w, float fuzz) {
  float d = smoothstep(w*.5 + fuzz, x+w*.5 + fuzz, x);
  return clamp(d, 0.0, 1.0);
}

float smin( float a, float b, float k )
{
    float h = clamp( 0.5+0.5*(b-a)/k, 0.0, 1.0 );
    return mix( b, a, h ) - k*h*(1.0-h);
}

vec4 colorCircle(vec4 _color, float _d) {
  return mix(vec4(1.0), _color, _d);
}

void main() {
  vec2 st = (gl_FragCoord.xy - .5 * uRes) / min(uRes.x, uRes.y);
  vec4 color = vec4(.3*abs(sin(st.x+uTime/10000.0)),abs(cos(st.y+uTime/3000.0)),.8 * abs(cos(sin((st.x+st.y)+uTime/2000.0))),1.0);

  float d = circleDist(uPosition - st, 0.1);

  for (int i = 0; i < 3; i++) {
    float d2 = circleDist(uCirclePos[i]- st, 0.025);
    d = smin(d2, d, 0.12);
  }

  // color = colorCircle(color, smoothFill(d, 0.0000001, 0.01));
    // color = colorCircle(color, stroke(d, .01));

  color = colorCircle(color, strokeIn(d, .01, .001));
  color += colorCircle(color, strokeOut(d, .01, .001));
  // color = colorCircle(color, fill(d, .000001));


  gl_FragColor = color;
}