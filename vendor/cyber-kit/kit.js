// cyber-kit — shared engine pieces for the CYBER arcade games (Three.js r169, no build step, ES modules).
// Import map in the game's index.html must provide "three" and "three/addons/".
export const KIT_VERSION = '0.1.0';
export { parseFlags, flags } from './core/flags.js';
export { createStore } from './core/storage.js';
export { createStage } from './core/renderer.js';
export { CyberShader } from './core/post.js';
export { U, THEMES, themeFor, ThemeController } from './core/theme.js';
export { Particles, Shockwaves, FxState } from './core/fx.js';
export { NeonCity, NOISE_GLSL, FOG_GLSL } from './core/backdrop.js';
export { SynthAudio, MUSIC, mtof } from './audio/synth.js';
export { createInput, DEFAULT_KEYS, DEFAULT_ACTIONS } from './input/input.js';
export { CyberUI } from './ui/ui.js';
export { STR, t2 } from './ui/strings.js';
export { Platform, isNative } from './platform/platform.js';
export { createAds, TEST_UNITS } from './platform/ads.js';
