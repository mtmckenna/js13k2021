#version 100
precision highp float;

uniform vec2 uRes;
uniform vec4 uPlayerProps;
uniform vec4 uCircleProps[3];
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

float intersect(float shape1, float shape2){
    return max(shape1, shape2);
}

float merge(float shape1, float shape2){
    return min(shape1, shape2);
}

float stroke(float x, float w) {
  float d = step(0., x+w*.5) - step(0., x-w*.5);
  return 1.0 -clamp(d, 0.0, 1.0);
}

float strokeBoth(float x, float w, float fuzz) {
  float d = smoothstep(fuzz, x-w*.5 - fuzz, x);
  float d2 = smoothstep(w*.5 + fuzz, x+w*.5 + fuzz, x);
  d = clamp(d, 0.0, 1.0);
  d2 = clamp(d2, 0.0, 1.0);

  return merge(d,d2);
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

  float d = circleDist(uPlayerProps.xy - st, uPlayerProps.z);

  for (int i = 0; i < 3; i++) {
    float d2 = circleDist(uCircleProps[i].xy - st, uCircleProps[i].z);
    d = smin(d2, d, 0.12);
  }

  color = colorCircle(color, strokeBoth(d, .01, .001));


  gl_FragColor = color;
}