import * as THREE from "three";

// The drum's faces: a name painted on a canvas, one canvas per face.
//
// A single texture wrapped around a cylinder would be fewer draw calls and
// unreadable Thai — the cylinder's own UVs run around the circumference, so
// every name would be turned on its side and stretched by the curve. Flat
// panels arranged in a ring keep the text upright, let each one be redrawn
// on its own between spins, and make "which face is at the front" a number
// rather than a texture offset.

export const FACE_COUNT = 18;
// The drum sits in a column now rather than across the page, and at the old
// size it ran into both edges of its own frame — a machine with no room
// around it reads as a cropped photograph of one.
export const DRUM_RADIUS = 2.45;
export const FACE_WIDTH = 5.9;
/** A hair over the exact chord, so neighbours meet instead of showing a seam. */
export const FACE_HEIGHT = 2 * DRUM_RADIUS * Math.tan(Math.PI / FACE_COUNT) * 1.04;

const TEX_W = 1024;
const TEX_H = 256;

/**
 * One colour for everybody.
 *
 * The panels were lit in three colours for the three bands, which turned the
 * band into something the room could read off the screen — a colour saying
 * how much this person spent, next to their name. The bands decide which bag
 * a name is drawn from and that is the end of their business; on the stage
 * every winner looks like every other winner.
 */
export const ACCENT = "#c9b8ff";

/**
 * The same colour, for paper rather than for a lit panel.
 *
 * ACCENT is read off a screen that is almost black, where pale lavender is
 * bright. On the white card beside the stage it is a tint, and white numerals
 * sitting on it cannot be read at all.
 */
export const ACCENT_UI = "#6c5ce0";

export type FaceContent = {
  name: string;
  /** The one the drum is going to stop on. Painted brighter. */
  winner?: boolean;
};

/** Thai does not break on spaces, so a long name is shrunk, never wrapped. */
function fitFont(ctx: CanvasRenderingContext2D, text: string, max: number) {
  let size = 96;
  do {
    // Light rather than bold. Bold Thai at this size closes up its own
    // loops — ฐ, ญ and ณ stop being distinguishable at a glance, which is
    // the only thing a name on a spinning drum has to do.
    ctx.font = `400 ${size}px "IBM Plex Sans Thai", "Noto Sans Thai", "Sarabun", sans-serif`;
    if (ctx.measureText(text).width <= max) return;
    size -= 4;
  } while (size > 34);
}

export function paintFace(canvas: HTMLCanvasElement, face: FaceContent) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const accent = ACCENT;

  ctx.clearRect(0, 0, TEX_W, TEX_H);

  // The panel itself: a dark plate with a lit edge, so the drum reads as
  // made of something under the spotlights rather than as a floating word.
  const plate = ctx.createLinearGradient(0, 0, 0, TEX_H);
  if (face.winner) {
    plate.addColorStop(0, "#2b2360");
    plate.addColorStop(0.5, "#140e33");
    plate.addColorStop(1, "#2b2360");
  } else {
    plate.addColorStop(0, "#171f3f");
    plate.addColorStop(0.5, "#0a0f24");
    plate.addColorStop(1, "#171f3f");
  }
  ctx.fillStyle = plate;
  ctx.fillRect(0, 0, TEX_W, TEX_H);

  ctx.fillStyle = accent;
  ctx.globalAlpha = face.winner ? 0.95 : 0.35;
  ctx.fillRect(0, 0, TEX_W, 4);
  ctx.fillRect(0, TEX_H - 4, TEX_W, 4);
  ctx.globalAlpha = 1;

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // The name and nothing else.
  const name = face.name || "(ไม่มีชื่อ)";
  fitFont(ctx, name, TEX_W - 180);
  if (face.winner) {
    ctx.shadowColor = accent;
    ctx.shadowBlur = 34;
  }
  ctx.fillStyle = face.winner ? "#ffffff" : "#dde4f5";
  ctx.fillText(name, TEX_W / 2, TEX_H / 2);
  ctx.shadowBlur = 0;
}

export function makeFaceCanvas(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = TEX_W;
  canvas.height = TEX_H;
  return canvas;
}

/**
 * A radial glow, as a texture.
 *
 * Standing in for a bloom pass: the scene needs light to look like it is
 * coming off the drum, and a postprocessing chain for one effect is a
 * dependency and a second render target. An additive sprite behind the thing
 * that glows costs neither.
 */
export function glowTexture(color: string): THREE.Texture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, color);
  g.addColorStop(0.35, `${color}66`);
  g.addColorStop(1, "#00000000");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
