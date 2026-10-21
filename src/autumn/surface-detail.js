// Surface detail is evaluated in model/world metres, so it does not sharpen or
// change scale as the camera approaches. The cotangent frames work on cliffs
// and instanced boulders without stretched UVs or projection seams.
export const surfaceDetail = /* glsl */`
float detailHash(vec3 p) { return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453); }
float detailNoise(vec3 p) {
  vec3 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(mix(detailHash(i),detailHash(i+vec3(1,0,0)),f.x),
                 mix(detailHash(i+vec3(0,1,0)),detailHash(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(detailHash(i+vec3(0,0,1)),detailHash(i+vec3(1,0,1)),f.x),
                 mix(detailHash(i+vec3(0,1,1)),detailHash(i+vec3(1,1,1)),f.x),f.y),f.z);
}
vec3 projectionWeights(vec3 n) {
  vec3 w=pow(abs(normalize(n)),vec3(5.)); return w/max(dot(w,vec3(1.)),.0001);
}
vec4 projectSurface(sampler2D tex,vec3 p,vec3 w) {
  return texture2D(tex,p.yz)*w.x+texture2D(tex,p.xz)*w.y+texture2D(tex,p.xy)*w.z;
}
mat3 surfaceFrame(vec3 eye,vec3 n,vec2 uv) {
  vec3 dx=dFdx(eye),dy=dFdy(eye); vec2 sx=dFdx(uv),sy=dFdy(uv);
  vec3 a=cross(dy,n),b=cross(n,dx),t=a*sx.x+b*sy.x,bt=a*sx.y+b*sy.y;
  float scale=inversesqrt(max(max(dot(t,t),dot(bt,bt)),1.e-12));
  return mat3(t*scale,bt*scale,n);
}
vec3 projectedNormal(sampler2D tex,vec3 p,vec3 w,vec3 n,vec3 eye,float strength) {
  vec3 x=texture2D(tex,p.yz).xyz*2.-1.; x.xy*=strength;
  vec3 y=texture2D(tex,p.xz).xyz*2.-1.; y.xy*=strength;
  vec3 z=texture2D(tex,p.xy).xyz*2.-1.; z.xy*=strength;
  return normalize(surfaceFrame(eye,n,p.yz)*x*w.x+surfaceFrame(eye,n,p.xz)*y*w.y+surfaceFrame(eye,n,p.xy)*z*w.z);
}
vec3 reliefNormal(vec3 n,vec3 eye,float height) {
  vec3 dx=dFdx(eye),dy=dFdy(eye),r1=cross(dy,n),r2=cross(n,dx);
  float det=dot(dx,r1);
  return normalize(abs(det)*n-sign(det)*(dFdx(height)*r1+dFdy(height)*r2));
}
`;
