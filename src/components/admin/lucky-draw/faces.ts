import * as THREE from "three";
import type { BandKey } from "@/lib/lucky-draw";

// The drum's faces: a name painted on a canvas, one canvas per face.
//
// A single texture wrapped around a cylinder would be fewer draw calls and
// unreadable Thai — the cylinder's own UVs run around the circumference, so
// every name would be turned on its side and stretched by the curve. Flat
// panels arranged in a ring keep the text upright, let each one be redrawn
// on its own between spins, and make "which face is at the front" a number
// rather than a texture offset.

export const FACE_COUNT = 18;
export const DRUM_RADIUS = 3.25;
export const FACE_WIDTH = 7.6;
/** A hair over the exact chord, so neighbours meet instead of showing a seam. */
export const FACE_HEIGHT = 2 * DRUM_RADIUS * Math.tan(Math.PI / FACE_COUNT) * 1.04;

const TEX_W = 1024;
const TEX_H = 256;

export const BAND_COLOR: Record<BandKey, string> = {
  gold: "#f5c451",
  silver: "#9fd8ff",
  open: "#c7a6ff",
};

const BAND_LABEL: Record<BandKey, string> = {
  gold: "แฟนตัวจริง",
  silver: "แฟนตัวยง",
  open: "สายเปย์หน้าใหม่",
};

export type FaceContent = {
  name: string;
  band: BandKey;
  /** The one the drum is going to stop on. Painted brighter. */
  winner?: boolean;
};

/** Thai does not break on spaces, so a long name is shrunk, never wrapped. */
function fitFont(ctx: CanvasRenderingContext2D, text: string, max: number) {
  let size = 96;
  do {
    ctx.font = `700 ${size}px "IBM Plex Sans Thai", "Noto Sans Thai", "Sarabun", sans-serif`;
    if (ctx.measureText(text).width <= max) return;
    size -= 4;
  } while (size > 34);
}

export function paintFace(canvas: HTMLCanvasElement, face: FaceContent) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const accent = BAND_COLOR[face.band];

  ctx.clearRect(0, 0, TEX_W, TEX_H);

  // The panel itself: a dark plate with a lit edge, so the drum reads as
  // made of something under the spotlights rather than as a floating word.
  const plate = ctx.createLinearGradient(0, 0, 0, TEX_H);
  if (face.winner) {
    plate.addColorStop(0, "#2a1d05");
    plate.addColorStop(0.5, "#120c02");
    plate.addColorStop(1, "#2a1d05");
  } else {
    plate.addColorStop(0, "#15161d");
    plate.addColorStop(0.5, "#0a0b10");
    plate.addColorStop(1, "#15161d");
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

  const name = face.name || "(ไม่มีชื่อ)";
  fitFont(ctx, name, TEX_W - 260);
  if (face.winner) {
    ctx.shadowColor = accent;
    ctx.shadowBlur = 34;
  }
  ctx.fillStyle = face.winner ? "#fff8e6" : "#e8eaf2";
  ctx.fillText(name, TEX_W / 2, TEX_H / 2 - 14);
  ctx.shadowBlur = 0;

  ctx.font = '600 38px "IBM Plex Sans Thai", "Noto Sans Thai", "Sarabun", sans-serif';
  ctx.fillStyle = accent;
  ctx.globalAlpha = face.winner ? 1 : 0.6;
  // The band, not the count. How many receipts somebody sent in is their
  // business and the room's — it decides which band they are drawn from and
  // then has no further part to play, and a number beside a name on a screen
  // being filmed is a number everyone else in the room can read too.
  ctx.fillText(BAND_LABEL[face.band], TEX_W / 2, TEX_H / 2 + 62);
  ctx.globalAlpha = 1;
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
