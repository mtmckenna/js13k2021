#version 100
precision highp float;

uniform vec2 uRes;
uniform vec4 uPlayerProps;
uniform vec4 uCircleProps[3];
uniform vec4 uCameraProps;
uniform float uTime;
uniform float uBorder;

float circleDist(vec2 p, float radius) {
  return length(p) - radius;
}

float sdRoundedBox( in vec2 p, in vec2 b, in vec4 r )
{
    r.xy = (p.x>0.0)?r.xy : r.zw;
    r.x  = (p.y>0.0)?r.x  : r.y;
    vec2 q = abs(p)-b+r.x;
    return min(max(q.x,q.y),0.0) + length(max(q,0.0)) - r.x;
}

float sdBox( in vec2 p, in vec2 b )
{
    vec2 d = abs(p)-b;
    return length(max(d,0.0)) + min(max(d.x,d.y),0.0);
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

float lerp(float x1, float x2, float t) {
	return x1 * (1.0- t) + x2*t;
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

float interpolate(float shape1, float shape2, float amount){
  return lerp(shape1, shape2, amount);
}

float stroke(float x, float w) {
  float d = step(0., x+w*.5) - step(0., x-w*.5);
  return 1.0 -clamp(d, 0.0, 1.0);
}

float strokeBoth(float x, float w, float fuzz) {
  float d = smoothstep(-fuzz, x-w*.5 - fuzz, x);
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

vec3 pal( in float t, in vec3 a, in vec3 b, in vec3 c, in vec3 d )
{
    return a + b*cos( 6.28318*(c*t+d) );
}

void main() {
  vec2 st = (gl_FragCoord.xy - .5 * uRes) / min(uRes.x, uRes.y);
  // vec4 color = vec4(.3*abs(sin(st.x+uTime/10000.0)),abs(cos(st.y+uTime/3000.0)),.8 * abs(cos(sin((st.x+st.y)+uTime/2000.0))),1.0);
  // color = vec4(1.0,0.,0.,1.);
  float t =  abs(cos(sin((st.x+st.y)+uTime/2000.0)));
  vec4 color = vec4(pal(t, vec3(0.025,0.025,0.1),vec3(0.025,0.025,0.1),vec3(1.0,1.0,1.0),vec3(0.0,0.1,0.2)), 1.);


  float d = circleDist(st, uPlayerProps.z);

  
  float dBoxT  = sdBox(vec2(0.0,  uBorder) -st - uCameraProps.xy, vec2(uBorder, .00001));
  float dBoxR  = sdBox(vec2(uBorder,  0.0) -st - uCameraProps.xy, vec2(.00001, uBorder));
  float dBoxB  = sdBox(vec2(0.0, -uBorder) -st - uCameraProps.xy, vec2(uBorder, .00001));
  float dBoxL  = sdBox(vec2(-uBorder, 0.0) -st - uCameraProps.xy, vec2(.00001, uBorder));

  float dBox = smin(dBoxT, dBoxR, .001);
  dBox = smin(dBox, dBoxB, .001);
  dBox = smin(dBox, dBoxL, .001);

  d = smin(d, dBox, .12);

  for (int i = 0; i < 3; i++) {
    float d2 = circleDist(uCircleProps[i].xy - st - uCameraProps.xy, uCircleProps[i].z);
    d = smin(d2, d, 0.12);
  }

  color = colorCircle(color, strokeBoth(d, .01, .001));



  gl_FragColor = color;
}