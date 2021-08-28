#version 100
#define NUM_CIRCLES 50
#define PI 3.14159
#define NUM_LAYERS 3.

precision highp float;
precision highp int;

uniform vec2 uRes;
uniform vec4 uCircleProps[NUM_CIRCLES];
uniform vec4 uCameraProps;
uniform float uTime;
uniform float uBorder;

const float WALL_FUZZ = .025;
const float CIRCLE_FUZZ = .00001;
const float BEND = .001;
const float BEND2 = .12;

float circleDist(vec2 p, float radius) {
  return length(p) - radius;
}

mat2 rot(float a) {
    float s=sin(a), c=cos(a);
    return mat2(c, -s, s, c);
}

float rand(vec2 co){
    return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
}

// https://www.youtube.com/watch?v=rvDo9LvfoVE
float starDist(vec2 uv, float flare) {
    float d = length(uv);
    float m = .02/d;
    // float rays = max(0.,1.-abs(uv.x * uv.y * 1000.));
    // float rays = 1.-abs(uv.x * uv.y * 1000.);

    // m += rays * flare;
    // uv *= rot(PI / 4.0);
    // rays = max(0.,1.-abs(uv.x * uv.y * 1000.));
    // rays = 1.-abs(uv.x * uv.y * 1000.);
    // m += rays * .3 * flare;
    m *= smoothstep(1., .2, d);

    return m;
}

vec3 starLayer(vec2 uv) {
  vec3 col = vec3(0);

  vec2 gv = fract(uv)-.5;
  vec2 id = floor(uv);

  float t = uTime / 1000.0;

  for (int y=-1; y<=1;y++) {
    for (int x=-1; x<=1;x++) {
      vec2 offset = vec2(x, y);
      float n = rand(id + offset);
      float size = fract(n*345.21);
      float d = starDist(gv- offset-vec2(n,fract(n*10.)-.5), smoothstep(.9,1.0, size)*.6);

      vec3 color = sin(vec3(.2,.3,.9)*fract(n*2345.6)*PI*4.)*.5+.5;
      color = color*vec3(1.,0.5,1.+size);

      d *= sin(t*3.+n*PI*2.)*.5+1.;
      col += d*size * color;
    }
  }

//     if (gv.x >.48 || gv.y > .48) col.r =1.;
  return col;
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

float lerp(float x1, float x2, float t) {
	return x1 * (1.0- t) + x2*t;
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
  float d = smoothstep(-fuzz, x-w*.5 - fuzz, x);
  float d2 = smoothstep(w*.5 + fuzz, x+w*.5 + fuzz, x);

  d = clamp(d, 0.0, 1.0);
  d2 = clamp(d2, 0.0, 1.0);

  return merge(d,d2);
}

// https://www.iquilezles.org/www/articles/smin/smin.htm
float smin( float a, float b, float k )
{
    float h = max( k-abs(a-b), 0.0 )/k;
    return min( a, b ) - h*h*k*(1.0/4.0);
}


vec4 colorCircle(vec4 _color, float _d) {
  return mix(vec4(1.0), _color, _d);
}

vec3 pal( in float t, in vec3 a, in vec3 b, in vec3 c, in vec3 d )
{
  return a + b*cos( 6.28318*(c*t+d) );
}

void main() {
  float zoom = max(log(uCircleProps[0].z/.1),1.); // zoom based on the player's size
  vec2 st = (gl_FragCoord.xy - .5 * uRes) / min(uRes.x, uRes.y) * zoom;
  float distortedT =  abs(cos(sin((st.x+st.y*5.)+uTime/1000.0))) + atan(st.x * st.y);
  float t = mod(uTime / 10000.0, 100000.);
  vec4 colorInside = vec4(pal(distortedT, vec3(0.025,0.025,0.1),vec3(0.025,0.025,0.1),vec3(1.0,1.0,1.0),vec3(0.0,0.1,0.2)), 1.);
  vec4 colorOutside = vec4(pal(distortedT, vec3(0.5,0.5,1.0),vec3(0.5,0.5,1.0),vec3(0.5,0.5,1.0),vec3(0.4,0.3,0.2)), 1.);
  vec4 color = colorInside;

  // Draw player
  float d = 99999.0;

  // Draw borders
  float top = smoothstep(uBorder - WALL_FUZZ, uBorder + WALL_FUZZ, (st + uCameraProps.xy).y);
  float right = smoothstep(uBorder - WALL_FUZZ, uBorder + WALL_FUZZ, (st + uCameraProps.xy).x);
  float bottom = smoothstep(-uBorder - WALL_FUZZ, -uBorder + WALL_FUZZ, (st + uCameraProps.xy).y);
  float left = smoothstep(-uBorder - WALL_FUZZ, -uBorder + WALL_FUZZ, (st + uCameraProps.xy).x);

  color = mix(color, colorOutside, top);
  color = mix(color, colorOutside, right);
  color = mix(colorOutside, color, bottom);
  color = mix(colorOutside, color, left);

  float dBoxT = sdBox(vec2(0.0,  uBorder) -st - uCameraProps.xy, vec2(uBorder, .00001));
  float dBoxR = sdBox(vec2(uBorder,  0.0) -st - uCameraProps.xy, vec2(.00001, uBorder));
  float dBoxB = sdBox(vec2(0.0, -uBorder) -st - uCameraProps.xy, vec2(uBorder, .00001));
  float dBoxL = sdBox(vec2(-uBorder, 0.0) -st - uCameraProps.xy, vec2(.00001, uBorder));

  float dBox = smin(dBoxT, dBoxR, BEND);
  dBox = smin(dBox, dBoxB, BEND);
  dBox = smin(dBox, dBoxL, BEND);

  d = smin(d, dBox, BEND2);

  // Draw circles
  for (int i = 0; i < NUM_CIRCLES; i++) {
    if (uCircleProps[i].z <= 0.0) continue;
    float d2 = circleDist(uCircleProps[i].xy - st - uCameraProps.xy, uCircleProps[i].z);
    d = smin(d2, d, BEND2);
  }

  // Draw star layers
  for (float i = 0.; i< 1.; i += 1./NUM_LAYERS) {
        vec2 uv2 = vec2(st);

        float scale = mix(10.,0.5, i);
        uv2 += uCameraProps.xy * i;
        color += vec4(starLayer(uv2 * scale + i*25.),1.);
    }

  color = colorCircle(color, strokeBoth(d, .01, CIRCLE_FUZZ));

  gl_FragColor = color;
}