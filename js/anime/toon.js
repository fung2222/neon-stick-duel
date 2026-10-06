// Anime / cel-shaded materials (procedural, no external assets):
//   toonMat()    3-step ramp (shadow · mid · lit) with tinted shadows, a stepped rim light, per-vertex colour + per-vertex
//                emissive trim (`aGlow`, kept LOW so the neon accents stay crisp under Glow LOW bloom), optional hair
//                highlight (soft, crisp-edged spec band). Light direction is fixed in view space (anime key light from the
//                upper front), so the read never depends on which way the fighter faces. Works on Mesh and SkinnedMesh.
//   outlineMat() inverted-hull outline: back faces pushed out along the (skinned) normal by a constant number of SCREEN
//                pixels (so the line holds up at phone scale and does not balloon in close-ups).
//   faceAtlas()  canvas texture with 4 expressions (neutral, blink, hurt, fierce) drawn procedurally: big anime eyes with
//                iris gradient + two highlights, brows, nose hint, blush, simple mouth, and painted skin shade (bangs shadow,
//                far-cheek / jaw crescent) in the same warm shade the toon ramp uses for skin.
import * as THREE from 'three';

const VERT = /* glsl */`
#include <common>
#include <skinning_pars_vertex>
#include <fog_pars_vertex>
attribute vec3 color;
attribute float aGlow; attribute float aShine; attribute float aSkin; attribute float aAO;
varying vec3 vCol; varying float vGlow; varying float vShine; varying float vSkin; varying float vAO; varying vec3 vN; varying vec3 vV;
void main() {
  vCol = color; vGlow = aGlow; vShine = aShine; vSkin = aSkin; vAO = aAO;
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
uniform vec3 uLight; uniform vec3 uShadow; uniform vec3 uSkinShadow; uniform vec3 uRim; uniform float uRimK; uniform float uRimW; uniform float uGlowK; uniform float uFlash; uniform float uDim;
varying vec3 vCol; varying float vGlow; varying float vShine; varying float vSkin; varying float vAO; varying vec3 vN; varying vec3 vV;
void main() {
  vec3 n = normalize(vN); if (!gl_FrontFacing) n = -n;
  vec3 v = normalize(vV);
  float d = dot(n, uLight) - vAO;                    // baked occlusion (under the chin, …) pushes the ramp into shadow
  // 3-step ramp with a narrow soft edge (cel bands, no banding noise)
  float lit = smoothstep(0.02, 0.07, d), hi = smoothstep(0.52, 0.57, d);
  vec3 base = vCol;
  vec3 c = mix(base * mix(uShadow, uSkinShadow, vSkin), base * 0.86, lit);   // skin shadows are warm (peach-rose), the rest cool
  c = mix(c, base * uSkinShadow * 0.8, vSkin * smoothstep(0.34, 0.42, vAO) * (1.0 - lit));   // skin creases: a second, deeper shade step
  c = mix(c, base, hi);
  // stepped rim (neon edge on the shadow side; uRimK / uRimW per fighter — the Mage's is stronger so the dark suit separates)
  float rimF = 1.0 - clamp(dot(n, v), 0.0, 1.0);
  float rim = smoothstep(0.62 - uRimW, 0.7 - uRimW, rimF) * (0.55 + 0.45 * (1.0 - lit)) * (1.0 - 0.6 * vSkin);
  c += uRim * rim * uRimK;
  // soft anime highlight (hair band, blade glint): crisp-edged where the half vector meets the normal; masked per vertex
  vec3 h = normalize(uLight + v); float nh = dot(n, h);
  c += (smoothstep(0.86, 0.9, nh) * 0.36 + smoothstep(0.955, 0.975, nh) * 0.22) * vShine * min(vec3(1.0), base * 3.5 + 0.15);   // tinted on dark hair, white on light
  c *= uDim;
  c += vCol * vGlow * uGlowK;                        // emissive trims (vertex colour × glow)
  c = mix(c, vec3(1.0), uFlash);                     // hit flash
  gl_FragColor = vec4(c, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

const LIGHT = new THREE.Vector3(-0.35, 0.62, 0.7).normalize();
/** warm skin shadow (linear multiplier). The face atlas paints its cheek / bangs shadows with skin × this, so painted and lit shade match */
export const SKIN_SHADOW = [0.8, 0.56, 0.57];
/** shared uniforms per fighter (one set → body, hair, weapon). o.rimK / o.rimW: rim strength / extra width (Mage: stronger rim) */
export function toonUniforms(rim = 0x00e5ff, o = {}) {
  return {
    uLight: { value: LIGHT.clone() }, uShadow: { value: new THREE.Color(0.42, 0.42, 0.62) }, uSkinShadow: { value: new THREE.Color().setRGB(...SKIN_SHADOW) },
    uRim: { value: new THREE.Color(rim) }, uRimK: { value: o.rimK ?? 0.42 }, uRimW: { value: o.rimW ?? 0 },
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
// v2.5 face pass: the face used to read as a flat pale disc with eyes at 412×915. Each tile now also paints, in the skin's own
// shade colours (skin × SKIN_SHADOW, the same warm shade the toon ramp uses, so painted and lit shadow meet without a seam):
// a jagged shadow under the bangs, a far-side cheek → jaw crescent (defines the jaw line in 3/4), a small nose hint (shade tick +
// highlight), soft blush with hatch strokes; eyes get a lid shadow on the sclera, a darker iris top → bright bottom, a dark iris
// rim, bigger pupils and two large highlights; brows are thick tapered strokes set low enough to show under the fringe.
// Layout: u = 0 → camera side, eyes around u = 0.5, v grows downward; drawn in 256-unit logical space, rendered at 384 px per tile.
export const FACE = { neutral: 0, blink: 1, hurt: 2, fierce: 3 };
const css = (hex, k = [1, 1, 1], m = 1) => new THREE.Color(hex).multiply(new THREE.Color().setRGB(k[0] * m, k[1] * m, k[2] * m)).getStyle();
export function faceAtlas(cfg = {}) {
  const S = 384, K = S / 256, cv = document.createElement('canvas'); cv.width = S * 4; cv.height = S; const g = cv.getContext('2d');
  const iris = cfg.iris || '#1fd6ff', irisDark = cfg.irisDark || '#0a3d7a', line = cfg.line || '#120c1c', brow = cfg.brow || '#2a2f4a', blush = cfg.blush || 'rgba(255,120,140,0.28)';
  const skin = cfg.skin ?? 0xf9cfb6, shade = css(skin, SKIN_SHADOW), deep = css(skin, SKIN_SHADOW, 0.8), noseLine = css(skin, SKIN_SHADOW, 0.62);
  const L = cfg.lash === 'long';
  const eye = (cx, cy, w, h, mode, mirror, cyber = false) => {
    g.save(); g.translate(cx, cy); if (mirror) g.scale(-1, 1);
    if (mode === 'blink' || mode === 'hurt') {   // closed: a curved lash line (hurt: squeezed chevron)
      g.strokeStyle = line; g.lineWidth = 8; g.lineCap = 'round'; g.beginPath();
      if (mode === 'blink') { g.moveTo(-w * 0.58, -h * 0.02); g.quadraticCurveTo(0, h * 0.3, w * 0.6, -h * 0.04); }
      else { g.moveTo(-w * 0.5, -h * 0.25); g.lineTo(w * 0.15, h * 0.05); g.lineTo(-w * 0.45, h * 0.3); }
      g.stroke();
      if (mode === 'blink') { g.lineWidth = 3; g.beginPath(); g.moveTo(w * 0.5, -h * 0.02); g.lineTo(w * 0.72, -h * 0.14); g.stroke(); }
      g.restore(); return;
    }
    const sq = mode === 'fierce' ? (L ? 0.8 : 0.72) : 1;   // fierce: lids narrowed
    const ey0 = h * 0.05, ry = h * 0.5 * sq;
    // sclera (slightly cool white) + the upper-lid shadow band across its top
    g.fillStyle = '#f4f6ff'; g.beginPath(); g.ellipse(0, ey0, w * 0.5, ry, 0, 0, Math.PI * 2); g.fill();
    g.save(); g.beginPath(); g.ellipse(0, ey0, w * 0.5, ry, 0, 0, Math.PI * 2); g.clip();
    // iris: tall ellipse, dark top → iris → bright bottom; dark rim, big pupil, two large highlights + a small coloured bounce
    const ix = w * 0.07, iy = h * 0.09, irx = w * 0.37, iry = h * 0.47;
    const ci = cyber ? cfg.cyberEye : null;   // Brawler: cyber-eye — glowing iris, targeting ring + ticks, hex pupil
    const gr = g.createLinearGradient(0, iy - iry, 0, iy + iry); gr.addColorStop(0, ci ? ci.dark : irisDark); gr.addColorStop(0.42, ci ? ci.dark : irisDark); gr.addColorStop(0.62, ci ? ci.iris : iris); gr.addColorStop(1, ci ? '#fff4d6' : '#e6fdff');
    g.fillStyle = gr; g.beginPath(); g.ellipse(ix, iy, irx, iry, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = ci ? ci.iris : irisDark; g.lineWidth = 4; g.stroke();
    if (ci) {
      g.strokeStyle = '#fff1c8'; g.lineWidth = 2.2; g.beginPath(); g.ellipse(ix, iy, irx * 0.7, iry * 0.7, 0, 0, Math.PI * 2); g.stroke();
      for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + 0.4; g.beginPath(); g.moveTo(ix + Math.cos(a) * irx * 0.7, iy + Math.sin(a) * iry * 0.7); g.lineTo(ix + Math.cos(a) * irx * 0.98, iy + Math.sin(a) * iry * 0.98); g.stroke(); }
      g.fillStyle = '#1a0800'; g.beginPath(); for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; g.lineTo(ix + Math.cos(a) * w * 0.12, iy + h * 0.02 + Math.sin(a) * h * 0.15); } g.closePath(); g.fill();
      g.fillStyle = ci.iris; g.beginPath(); g.arc(ix, iy + h * 0.02, w * 0.045, 0, Math.PI * 2); g.fill();
    } else { g.fillStyle = '#05030c'; g.beginPath(); g.ellipse(ix, iy + h * 0.02, w * 0.16, h * 0.24, 0, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = 'rgba(10,6,24,0.55)'; g.beginPath(); g.ellipse(0, ey0 - ry * 0.98, w * 0.62, h * 0.24, 0, 0, Math.PI * 2); g.fill();   // lid shadow
    g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(-w * 0.07, -h * 0.1, w * 0.13, h * 0.14, -0.4, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(w * 0.22, h * 0.27, w * 0.065, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.55)'; g.beginPath(); g.ellipse(ix, iy + iry * 0.72, irx * 0.55, h * 0.06, 0, 0, Math.PI * 2); g.fill();
    g.restore();
    // upper lash line (thick, winged, heavier at the outer corner) + lower lid hint
    g.fillStyle = line; g.beginPath();
    const top = -h * 0.45 * sq + h * 0.05;
    g.moveTo(-w * 0.64, top + h * 0.24); g.quadraticCurveTo(-w * 0.1, top - h * 0.18, w * 0.58, top + h * 0.06); g.lineTo(w * 0.74, top - h * 0.04);
    g.quadraticCurveTo(w * 0.12, top - h * 0.36, -w * 0.68, top + h * 0.12); g.closePath(); g.fill();
    g.strokeStyle = line; g.lineWidth = 3.4; g.lineCap = 'round'; g.beginPath(); g.moveTo(-w * 0.32, h * 0.55 * sq + h * 0.04); g.quadraticCurveTo(0, h * 0.58 * sq + h * 0.05, w * 0.36, h * 0.5 * sq + h * 0.04); g.stroke();
    if (L) {   // Mage: winged outer lashes + a lower lash tick (softer, more feminine read)
      g.lineWidth = 4.5;
      for (const [a, l] of [[-0.35, 0.3], [-0.05, 0.36], [0.28, 0.26]]) { g.beginPath(); g.moveTo(w * 0.6, top + h * 0.02); g.lineTo(w * 0.6 + Math.cos(a) * w * l, top + h * 0.02 - Math.sin(a + 0.5) * w * l); g.stroke(); }
      g.lineWidth = 2.5; g.beginPath(); g.moveTo(w * 0.36, h * 0.5 * sq + h * 0.05); g.lineTo(w * 0.52, h * 0.44 * sq + h * 0.06); g.stroke();
    }
    g.restore();
  };
  // brow: thick tapered stroke (thick at the inner end), dark, so it still reads as a mark at phone scale
  const browL = (cx, cy, w, ang, mirror) => {
    g.save(); g.translate(cx, cy); if (mirror) g.scale(-1, 1); g.rotate(ang); g.fillStyle = brow; g.beginPath();
    g.moveTo(-w * 0.52, 6); g.quadraticCurveTo(-w * 0.1, -9, w * 0.55, -3); g.lineTo(w * 0.5, 2); g.quadraticCurveTo(-w * 0.05, -2, -w * 0.5, 13); g.closePath(); g.fill(); g.restore();
  };
  const modes = ['neutral', 'blink', 'hurt', 'fierce'];
  modes.forEach((mode, i) => {
    g.save(); g.translate(i * S, 0); g.scale(K, K);
    const W = 256, ey = W * 0.52, ew = W * 0.2 * (cfg.eyeW || 1), eh = W * 0.28 * (cfg.eyeK || 1), dx = W * 0.155;
    // shadow under the bangs: a band below the hairline with a jagged lower edge (one tooth per lock)
    g.fillStyle = shade; g.beginPath(); g.moveTo(0, 0); g.lineTo(W, 0); g.lineTo(W, 60);
    const teeth = 7; for (let t = teeth; t >= 0; t--) { const x = W * (0.06 + 0.88 * t / teeth), y = (t % 2 ? 76 : 64) + (t === 3 ? 4 : 0); g.lineTo(x, y); if (t) g.lineTo(x - W * 0.88 / teeth * 0.5, 54 + (t % 3) * 3); }
    g.lineTo(0, 60); g.closePath(); g.fill();
    // far-side cheek → jaw crescent (the side turned away from the camera): thin under the eye corner, widest on the cheek, wrapping toward the chin
    g.fillStyle = shade; g.beginPath(); g.moveTo(W, 118); g.lineTo(242, 118); g.bezierCurveTo(222, 158, 214, 196, 196, 226); g.bezierCurveTo(186, 242, 166, 252, 140, 256); g.lineTo(W, 256); g.closePath(); g.fill();
    g.fillStyle = deep; g.beginPath(); g.moveTo(W, 196); g.bezierCurveTo(236, 220, 214, 246, 176, 256); g.lineTo(W, 256); g.closePath(); g.fill();   // under the jaw: deeper shade
    // blush: soft pink under each eye + three short hatch strokes
    if (!cfg.noBlush) for (const sx of [-1, 1]) {
      const bx = W / 2 + sx * (dx + 5), by = ey + eh * 0.72;
      const rg = g.createRadialGradient(bx, by, 1, bx, by, 22); rg.addColorStop(0, blush); rg.addColorStop(1, 'rgba(255,140,160,0)');
      g.fillStyle = rg; g.save(); g.translate(bx, by); g.scale(1, 0.42); g.translate(-bx, -by); g.beginPath(); g.arc(bx, by, 22, 0, Math.PI * 2); g.fill(); g.restore();
      g.strokeStyle = 'rgba(230,90,120,0.55)'; g.lineWidth = 1.8; g.lineCap = 'round';
      for (let k = -1; k <= 1; k++) { g.beginPath(); g.moveTo(bx + k * 7 - 2, by + 3); g.lineTo(bx + k * 7 + 3, by - 3); g.stroke(); }
    }
    const bAng = (mode === 'fierce' ? 0.32 : mode === 'hurt' ? -0.3 : 0.1) * (L ? 0.7 : 1);
    const by0 = ey - eh * (cfg.browY || 0.74);
    if (cfg.browK) { g.save(); g.translate(W / 2 - dx, by0); g.scale(1, cfg.browK); g.translate(-(W / 2 - dx), -by0); browL(W / 2 - dx, by0, ew * 1.08, bAng, false); g.restore();
      g.save(); g.translate(W / 2 + dx, by0); g.scale(1, cfg.browK); g.translate(-(W / 2 + dx), -by0); browL(W / 2 + dx, by0, ew * 1.08, bAng, true); g.restore(); }
    else { browL(W / 2 - dx, by0, ew * 1.08, bAng, false); browL(W / 2 + dx, by0, ew * 1.08, bAng, true); }
    eye(W / 2 - dx, ey, ew, eh, mode, false, !!cfg.cyberEye); eye(W / 2 + dx, ey, ew, eh, mode, true);
    if (cfg.cyberEye && mode !== 'blink' && mode !== 'hurt') {   // circuit trace from the cyber-eye to the temple (camera side)
      g.strokeStyle = cfg.cyberEye.iris; g.fillStyle = cfg.cyberEye.iris; g.lineWidth = 2.4; g.lineCap = 'square';
      const tx = W / 2 - dx - ew * 0.62; g.beginPath(); g.moveTo(tx, ey + 4); g.lineTo(tx - 12, ey + 4); g.lineTo(tx - 20, ey - 6); g.lineTo(tx - 30, ey - 6); g.stroke();
      g.beginPath(); g.arc(tx - 31, ey - 6, 3, 0, Math.PI * 2); g.fill();
    }
    if (cfg.scar) {   // scar: a diagonal pale slash through the camera-side brow and cheek (past the cyber-eye) with stitch ticks
      g.strokeStyle = cfg.scar; g.lineWidth = 4.2; g.lineCap = 'round'; const sx0 = W / 2 - dx + ew * 0.32, sy0 = ey - eh * 1.05;
      g.beginPath(); g.moveTo(sx0, sy0); g.lineTo(sx0 - ew * 0.75, ey + eh * 1.05); g.stroke();
      g.strokeStyle = 'rgba(120,40,40,0.75)'; g.lineWidth = 2;
      for (const k of [0.15, 0.82, 0.95]) { const x = sx0 - ew * 0.75 * k, y = sy0 + (ey + eh * 1.05 - sy0) * k; g.beginPath(); g.moveTo(x - 6, y - 2); g.lineTo(x + 6, y + 2); g.stroke(); }
    }
    // nose hint: a short shade tick on the far side of the bridge, a tiny shadow under the tip, a highlight dot on the camera side
    { const nx = W / 2 + 6, ny = ey + eh * 0.8;
      g.strokeStyle = noseLine; g.lineWidth = 2.6; g.lineCap = 'round'; g.beginPath(); g.moveTo(nx + 1, ny - 12); g.quadraticCurveTo(nx + 5, ny - 2, nx + 1, ny + 3); g.stroke();
      g.fillStyle = shade; g.beginPath(); g.ellipse(nx - 1, ny + 5, 6, 2.6, -0.15, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.8)'; g.beginPath(); g.ellipse(nx - 5, ny - 3, 1.8, 2.6, 0, 0, Math.PI * 2); g.fill(); }
    if (cfg.tattoo) {   // glowing circuit trace on the camera-side cheek (Mage)
      g.strokeStyle = cfg.tattoo; g.fillStyle = cfg.tattoo; g.lineWidth = 2.2; g.lineCap = 'square'; g.lineJoin = 'miter';
      const tx = W / 2 - dx - ew * 0.62, ty = ey + eh * 1.05;   // two parallel right-angle traces from the cheekbone toward the jaw, pad terminals
      for (const o of [0, 7]) { g.beginPath(); g.moveTo(tx + 18 - o * 0.4, ty + o); g.lineTo(tx + 4, ty + o); g.lineTo(tx - 6, ty + 10 + o); g.lineTo(tx - 6, ty + 20 + o * 0.6); g.stroke(); }
      g.fillRect(tx + 18, ty - 2.5, 5, 5); g.beginPath(); g.arc(tx - 6, ty + 26, 2.6, 0, Math.PI * 2); g.fill(); g.beginPath(); g.arc(tx - 6, ty + 22 + 7 * 0.6 + 4, 2, 0, Math.PI * 2); g.fill();
    }
    // mouth
    g.strokeStyle = line; g.fillStyle = '#5a1020'; g.lineWidth = 3.4; g.lineCap = 'round'; const my = W * 0.86;
    g.beginPath();
    if (cfg.mouth === 'small' && mode !== 'hurt' && mode !== 'fierce') { g.moveTo(W / 2 - 7, my - 1); g.quadraticCurveTo(W / 2 - 2, my + 3.5, W / 2, my); g.quadraticCurveTo(W / 2 + 2, my + 3.5, W / 2 + 7, my - 1); g.stroke(); }
    else if (mode === 'hurt') { g.ellipse(W / 2, my, 9, 7, 0, 0, Math.PI * 2); g.fill(); g.stroke(); }
    else if (mode === 'fierce' && cfg.shout) {   // Brawler kiai: open shouting mouth, upper teeth
      g.moveTo(W / 2 - 14, my - 4); g.quadraticCurveTo(W / 2, my - 8, W / 2 + 14, my - 4); g.quadraticCurveTo(W / 2 + 9, my + 12, W / 2, my + 13); g.quadraticCurveTo(W / 2 - 9, my + 12, W / 2 - 14, my - 4); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#fff6ee'; g.beginPath(); g.moveTo(W / 2 - 11, my - 3.5); g.quadraticCurveTo(W / 2, my - 6.5, W / 2 + 11, my - 3.5); g.lineTo(W / 2 + 9, my); g.lineTo(W / 2 - 9, my); g.closePath(); g.fill();
    }
    else if (mode === 'fierce') { g.moveTo(W / 2 - 12, my); g.lineTo(W / 2 + 12, my - 1); g.stroke(); g.beginPath(); g.moveTo(W / 2 - 6, my + 3); g.lineTo(W / 2 + 6, my + 3); g.stroke(); }
    else { g.moveTo(W / 2 - 9, my); g.quadraticCurveTo(W / 2, my + 2.5, W / 2 + 9, my - 1); g.stroke(); }
    g.restore();
  });
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.repeat.set(0.25, 1); tex.anisotropy = 4;
  tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter;
  return tex;
}
