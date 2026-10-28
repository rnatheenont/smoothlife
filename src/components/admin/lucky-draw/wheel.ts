import * as THREE from "three";

// The wheel face: one canvas, painted whole, mapped onto a disc.
//
// Twelve wedges rather than twelve meshes. The whole face is redrawn between
// spins anyway — every name on it changes — so there is nothing to be gained
// by making each wedge its own object, and a single texture keeps the seams
// exact: a wedge boundary is a line in the same drawing as the two colours
// either side of it, not two triangles that have to meet.

export const WEDGES = 12;
export const WHEEL_RADIUS = 3.9;
const TEX = 1600;

/** Lit lavender, for the near-black stage. */
export const ACCENT = "#c9b8ff";

/**
 * The same colour, for paper rather than for a lit panel.
 *
 * ACCENT is read off a screen that is almost black, where pale lavender is
 * bright. On the white card beside the stage it is a tint, and white numerals
 * sitting on it cannot be read at all.
 */
export const ACCENT_UI = "#6c5ce0";

const WEDGE_DARK = "#4c3a9e";
const WEDGE_LIGHT = "#8f7ee8";
const WEDGE_WINNER = "#fff6d8";

/** Thai does not break on spaces, so a long name is shrunk, never wrapped. */
function fitFont(ctx: CanvasRenderingContext2D, text: string, max: number, start: number) {
  let size = start;
  do {
    ctx.font = `700 ${size}px "IBM Plex Sans Thai", "Noto Sans Thai", "Sarabun", sans-serif`;
    if (ctx.measureText(text).width <= max) return;
    size -= 3;
  } while (size > 26);
}

export function makeWheelCanvas(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = TEX;
  return canvas;
}

/**
 * Paint the face.
 *
 * Wedge 0 is centred at twelve o'clock, which is where the pointer is, so
 * "stop on the winner" is "stop with the wheel back at zero" and the caller
 * never has to work out an angle.
 */
export function paintWheel(canvas: HTMLCanvasElement, names: string[], winner = 0) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const c = TEX / 2;
  const R = TEX / 2 - 26;
  const step = (Math.PI * 2) / WEDGES;

  ctx.clearRect(0, 0, TEX, TEX);

  for (let i = 0; i < WEDGES; i++) {
    // Canvas angles run clockwise from three o'clock, so twelve o'clock is
    // −π/2 and a wedge is centred on its own index from there.
    const mid = -Math.PI / 2 + i * step;
    const a0 = mid - step / 2;
    const a1 = mid + step / 2;

    ctx.beginPath();
    ctx.moveTo(c, c);
    ctx.arc(c, c, R, a0, a1);
    ctx.closePath();
    ctx.fillStyle = i === winner ? WEDGE_WINNER : i % 2 === 0 ? WEDGE_DARK : WEDGE_LIGHT;
    ctx.fill();
    // A hairline between wedges, the colour of the rim, so the face reads as
    // made of parts at any size.
    ctx.strokeStyle = "#ffffff55";
    ctx.lineWidth = 5;
    ctx.stroke();

    // The name, lying along its own radius.
    //
    // Flipped on the left-hand side of the wheel. Rotating every wedge by
    // its own angle and drawing outwards puts the left half upside down —
    // a wedge at nine o'clock has its radius pointing away from the reader.
    // Turning those a further half-turn and drawing inwards instead keeps
    // every name the right way up, which is the only thing anybody is
    // trying to do with it.
    const name = names[i] || "(ไม่มีชื่อ)";
    const flipped = Math.cos(mid) < 0;
    ctx.save();
    ctx.translate(c, c);
    ctx.rotate(flipped ? mid + Math.PI : mid);
    ctx.textAlign = flipped ? "left" : "right";
    ctx.textBaseline = "middle";
    fitFont(ctx, name, R - 250, i === winner ? 66 : 58);
    ctx.fillStyle = i === winner ? "#2a1c62" : "#ffffff";
    ctx.fillText(name, flipped ? -(R - 54) : R - 54, 0);
    ctx.restore();
  }

  // The hub covers where twelve wedge points meet, which no amount of care
  // makes tidy.
  const hub = ctx.createRadialGradient(c, c, 10, c, c, 190);
  hub.addColorStop(0, "#ffffff");
  hub.addColorStop(0.55, "#e7ecff");
  hub.addColorStop(1, "#b9a8ff");
  ctx.beginPath();
  ctx.arc(c, c, 190, 0, Math.PI * 2);
  ctx.fillStyle = hub;
  ctx.fill();
  ctx.lineWidth = 10;
  ctx.strokeStyle = "#ffffffcc";
  ctx.stroke();
}

/**
 * A radial glow, as a texture.
 *
 * Standing in for a bloom pass: the scene needs light to look like it is
 * coming off the wheel, and a postprocessing chain for one effect is a
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
