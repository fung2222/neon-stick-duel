// Anime / cel-shaded materials (procedural, no external assets):
//   toonMat()    3-step ramp (shadow · mid · lit) with tinted shadows, a stepped rim light, per-vertex colour + per-vertex
//                emissive trim (`aGlow`, kept LOW so the neon accents stay crisp under Glow LOW bloom), optional hair
//                highlight (soft, crisp-edged spec band). Light direction is fixed in view space (anime key light from the
//                upper front), so the read never depends on which way the fighter faces. Works on Mesh and SkinnedMesh.
//   outlineMat() inverted-hull outline: back faces pushed out along the (skinned) normal by a constant number of SCREEN
//                pixels (so the line holds up at phone scale and does not balloon in close-ups).
//   faceAtlas()  canvas texture with 4 expressions (neutral, blink, hurt, fierce) drawn procedurally: big anime eyes with
//                iris gradient + two highlights, brows, simple mouth.
import * as THREE from 'three';

const VERT = /* glsl */`
#include <common>
#include <skinning_pars_vertex>
#include <fog_pars_vertex>
attribute vec3 color;
attribute float aGlow; attribute float aShine;
varying vec3 vCol; varying float vGlow; varying float vShine; varying vec3 vN; varying vec3 vV;
void main() {
  vCol = color; vGlow = aGlow; vShine = aShine;
  #include <skinbase_vertex>
  #include <beginnormal_vertex>
  #include <skinnormal_vertex>
  #include <defaultnormal_vertex>
  #include <begin_vertex>
  #include <skinning_vertex>
  #include <project_vertex>
  vN = normalize(transformedNormal); vV = -mvPosition.xyz;
  #include <fog_vertex>
}`;
const FRAG = /* glsl */`
#include <common>
#include <fog_pars_fragment>
uniform vec3 uLight; uniform vec3 uShadow; uniform vec3 uRim; uniform float uGlowK; uniform float uFlash; uniform float uDim;
varying vec3 vCol; varying float vGlow; varying float vShine; varying vec3 vN; varying vec3 vV;
void main() {
  vec3 n = normalize(vN); if (!gl_FrontFacing) n = -n;
  vec3 v = normalize(vV);
  float d = dot(n, uLight);
  // 3-step ramp with a narrow soft edge (cel bands, no banding noise)
  float lit = smoothstep(0.02, 0.07, d), hi = smoothstep(0.52, 0.57, d);
  vec3 base = vCol;
  vec3 c = mix(base * uShadow, base * 0.86, lit);
  c = mix(c, base, hi);
  // stepped rim (neon edge on the shadow side, kept subtle)
  float rimF = 1.0 - clamp(dot(n, v), 0.0, 1.0);
  float rim = smoothstep(0.62, 0.7, rimF) * (0.55 + 0.45 * (1.0 - lit));
  c += uRim * rim * 0.42;
  // soft anime highlight (hair band, blade glint): crisp-edged where the half vector meets the normal; masked per vertex
  vec3 h = normalize(uLight + v); float nh = dot(n, h);
  c += vec3(smoothstep(0.86, 0.9, nh) * 0.36 + smoothstep(0.955, 0.975, nh) * 0.22) * vShine;
  c *= uDim;
  c += vCol * vGlow * uGlowK;                        // emissive trims (vertex colour × glow)
  c = mix(c, vec3(1.0), uFlash);                     // hit flash
  gl_FragColor = vec4(c, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

const LIGHT = new THREE.Vector3(-0.35, 0.62, 0.7).normalize();
/** shared uniforms per fighter (one set → body, hair, weapon) */
export function toonUniforms(rim = 0x00e5ff) {
  return {
    uLight: { value: LIGHT.clone() }, uShadow: { value: new THREE.Color(0.42, 0.42, 0.62) }, uRim: { value: new THREE.Color(rim) },
    uGlowK: { value: 0.85 }, uFlash: { value: 0 }, uDim: { value: 1 },
  };
}
export function toonMat(U, { side = THREE.DoubleSide } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), ...U },
    vertexShader: VERT, fragmentShader: FRAG, fog: true, side,
  });
}

const OVERT = /* glsl */`
#include <common>
#include <skinning_pars_vertex>
#include <fog_pars_vertex>
attribute float aLine;
uniform float uPx; uniform float uPxK; uniform float uMax;
void main() {
  #include <skinbase_vertex>
  #include <beginnormal_vertex>
  #include <skinnormal_vertex>
  #include <begin_vertex>
  #include <skinning_vertex>
  vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);
  vec3 nv = normalize(normalMatrix * objectNormal);
  float w = min(uPx * uPxK * max(0.1, -mvPosition.z), uMax) * aLine;   // constant screen-space width, capped in world units
  mvPosition.xyz += normalize(vec3(nv.xy, nv.z * 0.35)) * w;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;
const OFRAG = /* glsl */`
#include <common>
#include <fog_pars_fragment>
uniform vec3 uColor;
void main() { gl_FragColor = vec4(uColor, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;
const _sz = new THREE.Vector2();
/** OU = shared outline uniforms (uPx = width in CSS px). Call hookOutline(mesh) so the px → world factor tracks the camera. */
export function outlineUniforms(px = 1.9, color = 0x07060f) {
  return { uPx: { value: px }, uPxK: { value: 0.002 }, uMax: { value: 0.03 }, uColor: { value: new THREE.Color(color) } };
}
export function outlineMat(OU) {
  return new THREE.ShaderMaterial({ uniforms: { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), ...OU }, vertexShader: OVERT, fragmentShader: OFRAG, side: THREE.BackSide, fog: true });
}
export function hookOutline(mesh, OU) {
  mesh.onBeforeRender = (renderer, scene, camera) => {
    renderer.getDrawingBufferSize(_sz);
    const pr = renderer.getPixelRatio();
    // world units per CSS pixel at depth 1 (× depth in the shader); a floor of 1.25 physical px keeps it visible on hi-dpi phones
    const k = 2 * Math.tan(THREE.MathUtils.degToRad((camera.fov || 40) / 2)) / Math.max(1, _sz.y);
    OU.uPxK.value = k * Math.max(pr, 1.25 / Math.max(0.5, OU.uPx.value));
  };
}

// ------------------------------------------------------------------ face atlas (4 expressions side by side)
export const FACE = { neutral: 0, blink: 1, hurt: 2, fierce: 3 };
export function faceAtlas(cfg = {}) {
  const S = 256, cv = document.createElement('canvas'); cv.width = S * 4; cv.height = S; const g = cv.getContext('2d');
  const iris = cfg.iris || '#1fd6ff', irisDark = cfg.irisDark || '#0a3d7a', line = cfg.line || '#120c1c', brow = cfg.brow || '#2a2f4a', blush = cfg.blush || 'rgba(255,120,140,0.28)';
  const eye = (cx, cy, w, h, mode, mirror) => {
    g.save(); g.translate(cx, cy); if (mirror) g.scale(-1, 1);
    if (mode === 'blink' || mode === 'hurt') {   // closed: a curved lash line (hurt: squeezed chevron)
      g.strokeStyle = line; g.lineWidth = 7; g.lineCap = 'round'; g.beginPath();
      if (mode === 'blink') { g.moveTo(-w * 0.55, -h * 0.05); g.quadraticCurveTo(0, h * 0.28, w * 0.55, -h * 0.02); }
      else { g.moveTo(-w * 0.5, -h * 0.25); g.lineTo(w * 0.15, h * 0.05); g.lineTo(-w * 0.45, h * 0.3); }
      g.stroke(); g.restore(); return;
    }
    const sq = mode === 'fierce' ? (cfg.lash === 'long' ? 0.8 : 0.72) : 1;   // fierce: lids narrowed
    // sclera
    g.fillStyle = '#fbfbff'; g.beginPath(); g.ellipse(0, h * 0.05, w * 0.5, h * 0.5 * sq, 0, 0, Math.PI * 2); g.fill();
    // iris (tall ellipse, gradient) + pupil + highlights
    const gr = g.createLinearGradient(0, -h * 0.45, 0, h * 0.45); gr.addColorStop(0, irisDark); gr.addColorStop(0.55, iris); gr.addColorStop(1, '#c8fbff');
    g.save(); g.beginPath(); g.ellipse(0, h * 0.05, w * 0.5, h * 0.5 * sq, 0, 0, Math.PI * 2); g.clip();
    g.fillStyle = gr; g.beginPath(); g.ellipse(w * 0.08, h * 0.08, w * 0.33, h * 0.44, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = irisDark; g.beginPath(); g.ellipse(w * 0.08, h * 0.1, w * 0.14, h * 0.22, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(-w * 0.06, -h * 0.12, w * 0.11, h * 0.12, -0.4, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(w * 0.2, h * 0.24, w * 0.05, 0, Math.PI * 2); g.fill();
    g.restore();
    // upper lash line (thick, winged) + lower lid hint
    g.fillStyle = line; g.beginPath();
    const top = -h * 0.45 * sq + h * 0.05;
    g.moveTo(-w * 0.62, top + h * 0.22); g.quadraticCurveTo(-w * 0.1, top - h * 0.16, w * 0.58, top + h * 0.06); g.lineTo(w * 0.7, top - h * 0.02);
    g.quadraticCurveTo(w * 0.1, top - h * 0.3, -w * 0.66, top + h * 0.12); g.closePath(); g.fill();
    g.strokeStyle = line; g.lineWidth = 3; g.beginPath(); g.moveTo(-w * 0.3, h * 0.55 * sq + h * 0.04); g.lineTo(w * 0.32, h * 0.5 * sq + h * 0.04); g.stroke();
    if (cfg.lash === 'long') {   // Mage: winged outer lashes + a lower lash tick (softer, more feminine read)
      g.lineWidth = 4.5; g.lineCap = 'round';
      for (const [a, l] of [[-0.35, 0.3], [-0.05, 0.36], [0.28, 0.26]]) { g.beginPath(); g.moveTo(w * 0.6, top + h * 0.02); g.lineTo(w * 0.6 + Math.cos(a) * w * l, top + h * 0.02 - Math.sin(a + 0.5) * w * l); g.stroke(); }
      g.lineWidth = 2.5; g.beginPath(); g.moveTo(w * 0.36, h * 0.5 * sq + h * 0.05); g.lineTo(w * 0.52, h * 0.44 * sq + h * 0.06); g.stroke();
    }
    g.restore();
  };
  const browL = (cx, cy, w, ang, mirror) => { g.save(); g.translate(cx, cy); if (mirror) g.scale(-1, 1); g.rotate(ang); g.fillStyle = brow; g.beginPath(); g.moveTo(-w * 0.5, 4); g.quadraticCurveTo(0, -6, w * 0.5, -2); g.lineTo(w * 0.48, 3); g.quadraticCurveTo(0, -1, -w * 0.5, 8); g.closePath(); g.fill(); g.restore(); };
  const modes = ['neutral', 'blink', 'hurt', 'fierce'];
  modes.forEach((mode, i) => {
    const ox = i * S; g.save(); g.translate(ox, 0);
    // layout: u = 0 → near side (camera), eyes centred around u = 0.5; v grows downward
    const ey = S * 0.52, ew = S * 0.2, eh = S * 0.28, dx = S * 0.155;
    const bAng = (mode === 'fierce' ? 0.32 : mode === 'hurt' ? -0.3 : 0.12) * (cfg.lash === 'long' ? 0.7 : 1);
    browL(S / 2 - dx, ey - eh * 0.85, ew * 1.1, bAng, false); browL(S / 2 + dx, ey - eh * 0.85, ew * 1.1, bAng, true);
    eye(S / 2 - dx, ey, ew, eh, mode, false); eye(S / 2 + dx, ey, ew, eh, mode, true);
    g.fillStyle = blush; g.beginPath(); g.ellipse(S / 2 - dx - 6, ey + eh * 0.72, 14, 5, 0, 0, Math.PI * 2); g.ellipse(S / 2 + dx + 6, ey + eh * 0.72, 14, 5, 0, 0, Math.PI * 2); g.fill();
    if (cfg.tattoo) {   // glowing circuit trace on the camera-side cheek (Mage)
      g.strokeStyle = cfg.tattoo; g.fillStyle = cfg.tattoo; g.lineWidth = 3; g.lineCap = 'round'; g.lineJoin = 'round';
      const tx = S / 2 - dx - ew * 0.25, ty = ey + eh * 0.62;
      g.beginPath(); g.moveTo(tx + 14, ty); g.lineTo(tx, ty); g.lineTo(tx - 10, ty + 10); g.lineTo(tx - 10, ty + 24); g.stroke();
      g.beginPath(); g.arc(tx + 16, ty, 3.4, 0, Math.PI * 2); g.fill(); g.beginPath(); g.arc(tx - 10, ty + 27, 3.4, 0, Math.PI * 2); g.fill();
    }
    // mouth
    g.strokeStyle = line; g.fillStyle = '#5a1020'; g.lineWidth = 3.2; g.lineCap = 'round'; const my = S * 0.86;
    g.beginPath();
    if (cfg.mouth === 'small' && mode !== 'hurt' && mode !== 'fierce') { g.moveTo(S / 2 - 6, my - 1); g.quadraticCurveTo(S / 2 - 2, my + 3, S / 2, my); g.quadraticCurveTo(S / 2 + 2, my + 3, S / 2 + 6, my - 1); g.stroke(); }
    else if (mode === 'hurt') { g.ellipse(S / 2, my, 9, 7, 0, 0, Math.PI * 2); g.fill(); g.stroke(); }
    else if (mode === 'fierce') { g.moveTo(S / 2 - 12, my); g.lineTo(S / 2 + 12, my - 1); g.stroke(); g.beginPath(); g.moveTo(S / 2 - 6, my + 3); g.lineTo(S / 2 + 6, my + 3); g.stroke(); }
    else { g.moveTo(S / 2 - 9, my); g.quadraticCurveTo(S / 2, my + 2.5, S / 2 + 9, my - 1); g.stroke(); }
    g.restore();
  });
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.repeat.set(0.25, 1); tex.anisotropy = 4;
  tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter;
  return tex;
}
