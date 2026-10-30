// Smoothie mascot renderer — a small Rive/Spine-style skeletal rig on WebGL.
//
// Bones with parents → world matrices; every part is a grid mesh skinned to
// one or two bones (linear blend); animations are keyframes with bezier
// easing (smoothie-anims.ts) crossfaded into an always-running idle, plus a
// few procedural layers on top: look-at, blinking, talking mouth, and ears
// and hands that lag behind on springs.
//
// One instance per <canvas>. Nothing here touches the DOM beyond the canvas
// it is given, so a page can hold the chat launcher and the hero at once.

import { ANIMS, ARM_DOWN, BONES, EASE, REST_CH, type Anim } from "./smoothie-anims";
import type { MascotTheme } from "./mascot-theme";

export type View = { x0: number; x1: number; y0: number; y1: number };
/** Whole body with headroom for jumps. */
export const VIEW_FULL: View = { x0: -50, x1: 1050, y0: -230, y1: 950 };
/** Head and shoulders, for small round spots like the chat launcher. */
export const VIEW_BUST: View = { x0: 110, x1: 890, y0: -40, y1: 740 };

/**
 * Bump whenever a picture in public/mascot/rig changes. The service worker
 * (public/sw.js) keeps anything under /mascot/ forever and never asks again,
 * so a changed file under the same URL never reaches anyone who has visited
 * before — the query string makes it a new URL.
 */
export const MASCOT_ASSET_VERSION = "2026-10-30d";
export const mascotAsset = (file: string) => `/mascot/rig/${file}?v=${MASCOT_ASSET_VERSION}`;

/** Gestures and moods the storefront may trigger (sad / angry / love are left out on purpose). */
export const SMOOTHIE_ACTIONS = Object.keys(ANIMS).filter((n) => n !== "idle");
export type SmoothieAction = string;

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const smooth = (a: number, b: number, v: number) => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const D2R = Math.PI / 180;
const REST = { rot: 0, x: 0, y: 0, sx: 1, sy: 1 };
type Pose = Record<string, number>;
type BoneState = { name: string; parent: string | null; px: number; py: number; m: number[] };

// Fixed adjustments layered on every pose — tuned with the team, see rive-handoff/SPEC.md.
const HEAD_DROP = 32; // head sits lower on the body
const SHOULDER_LIFT = -24; // shoulder height while an arm is raised
const SHOULDER_IN = 34; // raised arms pivot inside the coat so the shoulder cap never shows
const ARM_OUT = 13; // …and lean out to keep the mitten beside the head

const restOf = (ch: string) => REST_CH[ch] ?? REST[ch.split(".")[1] as keyof typeof REST];

function sample(anim: Anim, t: number): Pose {
  const pose: Pose = {};
  for (const ch in anim.keys) {
    const ks = anim.keys[ch];
    if (t <= ks[0][0]) { pose[ch] = ks[0][1]; continue; }
    const last = ks[ks.length - 1];
    if (t >= last[0]) { pose[ch] = last[1]; continue; }
    let i = 1;
    while (ks[i][0] < t) i++;
    const a = ks[i - 1], b = ks[i], u = (t - a[0]) / (b[0] - a[0]);
    pose[ch] = a[1] + (b[1] - a[1]) * EASE[(b[2] as string) || "io"](u);
  }
  return pose;
}
function blend(a: Pose, b: Pose, w: number): Pose {
  const out: Pose = {};
  for (const ch of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const r = restOf(ch);
    out[ch] = (a[ch] ?? r) * (1 - w) + (b[ch] ?? r) * w;
  }
  return out;
}
const add = (pose: Pose, ch: string, v: number) => { pose[ch] = (pose[ch] ?? restOf(ch)) + v; };
const mul = (p: number[], q: number[]) => [
  p[0] * q[0] + p[2] * q[1], p[1] * q[0] + p[3] * q[1], p[0] * q[2] + p[2] * q[3], p[1] * q[2] + p[3] * q[3],
  p[0] * q[4] + p[2] * q[5] + p[4], p[1] * q[4] + p[3] * q[5] + p[5],
];

class Spring {
  x = 0; v = 0; target = 0;
  constructor(public k: number, public d: number) {}
  step(dt: number) { this.v += (this.k * (this.target - this.x) - this.d * this.v) * dt; this.x += this.v * dt; }
}

// ---------- layers + skin weights ----------
type Weight = [bone: string, w: number];
type LayerDef = {
  name: string; src?: string; bbox: number[]; grid: number[]; w: (x: number, y: number) => Weight[];
  group?: "base-head" | "base"; react?: string; armSide?: "front" | "back"; armRSide?: "up" | "down";
  /** Only drawn in this outfit (see mascot-theme.ts). */
  theme?: MascotTheme;
  /** The artboard box the texture covers. Body parts are full 1000×1000 artboards; props are
   *  tight pictures that may reach past its edges (the witch hat pokes above y=0). */
  texBox?: number[];
};
const FACE_C = [512, 395];
const headWeights = (x: number, y: number): Weight[] => {
  // Ear weights fade both ways — a straight cut tears the hood into a step when the ear moves.
  let ear = 0, earBone: string | null = null;
  if (x < 500) { ear = smooth(235, 120, y) * smooth(470, 380, x); earBone = "earL"; }
  else { ear = smooth(245, 130, y) * smooth(540, 630, x); earBone = "earR"; }
  const dx = x - FACE_C[0], dy = y - FACE_C[1];
  const wf = clamp(1 - (dx * dx + dy * dy) / (280 * 280), 0, 1) * 0.4 * (1 - ear);
  const out: Weight[] = [];
  if (ear > 0) out.push([earBone, ear]);
  out.push(["face", wf], ["head", 1 - ear - wf]);
  return out;
};
const armWeights = (J: number[], C: number[], hand: string, arm: string) => (x: number, y: number): Weight[] => {
  const vx = C[0] - J[0], vy = C[1] - J[1], L = Math.hypot(vx, vy);
  const s = ((x - J[0]) * vx + (y - J[1]) * vy) / L, w = smooth(L - 14, L + 4, s);
  return [[hand, w], [arm, 1 - w]];
};
const ARM_R = armWeights([688, 640], [710, 706], "handR", "armR");
const ARM_L = armWeights([280, 574], [235, 521], "handL", "armL");
const FACES: Record<string, number[]> = {
  happy: [176, 6, 818, 568], laugh: [176, 14, 818, 568],
  surprised: [176, 20, 818, 568], curious: [176, 17, 858, 568], worried: [176, 17, 818, 568],
};
// Halloween (Dracula): the cape from smoothlife-mascot/halloween/build_dracula.py,
// the pumpkin from build_halloween.py.
const CAPE_BOX = [0, 352, 1000, 908];
const PUMPKIN_BOX = [11, 740, 225, 956];
// Christmas props: smoothlife-mascot/christmas/build_christmas.py.
const SANTA_HAT_BOX = [374, -71, 718, 167];
// Outfits that change clothes, not just add props: these parts load
// "<part>-<theme>.webp" instead (Santa suit: smoothlife-mascot/christmas/build_santa.py).
const SUIT: Partial<Record<MascotTheme, string[]>> = {
  christmas: ["body", "arm-left", "arm-left-down", "arm-right", "arm-right-up", "arm-left-hand", "arm-right-hand"],
  halloween: ["body", "arm-left", "arm-left-down", "arm-right", "arm-right-up", "arm-left-hand", "arm-right-hand"],
};
const GIFT_BOX = [20, 755, 217, 959];
// New Year props: smoothlife-mascot/newyear/build_newyear.py.
const PARTY_HAT_BOX = [440, -61, 605, 160];
const BALLOONS_BOX = [786, 749, 993, 941];
const LAYERS: LayerDef[] = [
  // behind everything, swaying with the body the way the coat does; its collar stands up beside the hood
  { name: "halloween-cape", theme: "halloween", bbox: CAPE_BOX, texBox: CAPE_BOX, grid: [12, 10], w: (_x, y) => { const c = smooth(830, 640, y); return [["chest", c], ["hips", 1 - c]]; } },
  // stands on the ground beside the feet — the "world" bone never moves, so it stays put when he jumps
  { name: "halloween-pumpkin", theme: "halloween", bbox: PUMPKIN_BOX, texBox: PUMPKIN_BOX, grid: [1, 1], w: () => [["world", 1]] },
  { name: "christmas-gift", theme: "christmas", bbox: GIFT_BOX, texBox: GIFT_BOX, grid: [1, 1], w: () => [["world", 1]] },
  { name: "newyear-balloons", theme: "newyear", bbox: BALLOONS_BOX, texBox: BALLOONS_BOX, grid: [1, 1], w: () => [["world", 1]] },
  { name: "leg-left", bbox: [268, 769, 474, 930], grid: [6, 6], w: () => [["legL", 1]] },
  { name: "leg-right", bbox: [518, 772, 724, 932], grid: [6, 6], w: () => [["legR", 1]] },
  { name: "arm-right", armRSide: "down", bbox: [597, 559, 795, 825], grid: [12, 12], w: ARM_R },
  { name: "arm-right-up", armRSide: "up", bbox: [619, 557, 797, 824], grid: [12, 12], w: ARM_R },
  { name: "arm-left-back", src: "arm-left-down", armSide: "back", bbox: [135, 412, 371, 652], grid: [14, 14], w: ARM_L },
  { name: "arm-left", armSide: "front", bbox: [135, 412, 371, 652], grid: [14, 14], w: ARM_L },
  { name: "body", bbox: [250, 530, 741, 862], grid: [16, 16], w: (_x, y) => { const c = smooth(830, 640, y); return [["chest", c], ["hips", 1 - c]]; } },
  { name: "head", bbox: [177, 34, 818, 568], grid: [28, 24], w: headWeights, group: "base-head" },
  { name: "brow-left", bbox: [369, 264, 421, 298], grid: [2, 1], w: () => [["browL", 1]], group: "base" },
  { name: "brow-right", bbox: [607, 280, 659, 314], grid: [2, 1], w: () => [["browR", 1]], group: "base" },
  { name: "eye-left", bbox: [358, 294, 446, 400], grid: [2, 2], w: () => [["eyeL", 1]], group: "base" },
  { name: "eye-right", bbox: [574, 311, 662, 417], grid: [2, 2], w: () => [["eyeR", 1]], group: "base" },
  { name: "nose", bbox: [477, 357, 537, 397], grid: [1, 1], w: () => [["face", 1]], group: "base" },
  { name: "mouth", bbox: [466, 394, 543, 448], grid: [2, 2], w: () => [["mouth", 1]], group: "base" },
  ...Object.entries(FACES).map(([id, bbox]): LayerDef => ({ name: "face-" + id, react: id, bbox, grid: [26, 22], w: headWeights })),
  // over the hood and every face, under the raised mittens
  { name: "christmas-hat", theme: "christmas", bbox: SANTA_HAT_BOX, texBox: SANTA_HAT_BOX, grid: [4, 3], w: () => [["head", 1]] },
  { name: "newyear-hat", theme: "newyear", bbox: PARTY_HAT_BOX, texBox: PARTY_HAT_BOX, grid: [3, 3], w: () => [["head", 1]] },
  { name: "arm-left-hand", armSide: "front", bbox: [129, 406, 377, 657], grid: [16, 16], w: ARM_L },
  { name: "arm-right-hand", armRSide: "up", bbox: [614, 553, 802, 829], grid: [16, 16], w: ARM_R },
];

type Layer = LayerDef & {
  rest: Float32Array; pos: Float32Array; wts: [BoneState, number][][]; count: number;
  uvBuf: WebGLBuffer; posBuf: WebGLBuffer; idxBuf: WebGLBuffer; tex?: WebGLTexture;
};

export type EngineOptions = {
  assetBase?: string;
  view?: View;
  reducedMotion?: boolean;
  /** Outfit; layers tagged with another theme are left out. Default "default". */
  theme?: MascotTheme;
  /** Called with how far the body has lifted off the ground (0 = standing), for a drop shadow. */
  onGround?: (scale: number, opacity: number) => void;
};

export class SmoothieEngine {
  private gl: WebGLRenderingContext;
  private layers: Layer[] = [];
  private B: Record<string, BoneState> = {};
  private aP = 0; private aU = 0; private uA: WebGLUniformLocation;
  private view: View;
  private reduce: boolean;
  private base: string;
  private suit: Set<string>;
  private theme: MascotTheme;
  private onGround?: EngineOptions["onGround"];

  private cur: string | null = null; private curT = 0; private prevPose: Pose | null = null;
  private mix = 1; private idleT = 0; private queued: string | null = null;
  private pose: Pose = {};
  private sec = {
    earL: new Spring(170, 9), earR: new Spring(160, 9), handL: new Spring(140, 10), handR: new Spring(140, 10),
    lookX: new Spring(60, 11), lookY: new Spring(60, 11), mouth: new Spring(450, 24), blink: new Spring(900, 45), faceMix: new Spring(320, 34),
  };
  private prevAng = { head: 0, armL: 0, armR: 0, rootY: 0 };
  private look: [number, number] | null = null; private lookAt = -99;
  private glance: [number, number] = [0, 0]; private nextGlance = 2;
  private blinkAt = 1.4; private blinkUntil = 0; private secondBlinkAt = 0; private talkNext = 0;
  private clock = 0; private exprId: string | null = null;
  private loadedFaces = new Set<string>();

  constructor(canvas: HTMLCanvasElement, opts: EngineOptions = {}) {
    const gl = canvas.getContext("webgl", { premultipliedAlpha: true, alpha: true, antialias: true });
    if (!gl) throw new Error("no webgl");
    this.gl = gl;
    this.view = opts.view ?? VIEW_FULL;
    this.reduce = !!opts.reducedMotion;
    this.base = opts.assetBase ?? "/mascot/rig/";
    this.onGround = opts.onGround;
    this.sec.mouth.x = this.sec.mouth.target = 1;
    for (const [n, p, x, y] of BONES) this.B[n] = { name: n, parent: p, px: x, py: y, m: [1, 0, 0, 1, 0, 0] };
    // Not in BONES, so solve() never moves it: for props that stand on the ground.
    this.B.world = { name: "world", parent: null, px: 0, py: 0, m: [1, 0, 0, 1, 0, 0] };
    const theme = opts.theme ?? "default";
    this.theme = theme;
    this.suit = new Set(SUIT[theme] ?? []);

    const sh = (t: number, src: string) => { const s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s); return s; };
    const prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, "attribute vec2 p;attribute vec2 u;varying vec2 v;void main(){v=u;gl_Position=vec4(p,0.,1.);}"));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, "precision mediump float;varying vec2 v;uniform sampler2D t;uniform float a;void main(){gl_FragColor=texture2D(t,v)*a;}"));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) || "link");
    gl.useProgram(prog);
    this.aP = gl.getAttribLocation(prog, "p"); this.aU = gl.getAttribLocation(prog, "u"); this.uA = gl.getUniformLocation(prog, "a");
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    for (const def of LAYERS) {
      if (def.theme && def.theme !== theme) continue;
      const [x0, y0, x1, y1] = def.bbox, [nx, ny] = def.grid, n = (nx + 1) * (ny + 1);
      const [tx0, ty0, tx1, ty1] = def.texBox ?? [0, 0, 1000, 1000];
      const rest = new Float32Array(n * 2), uv = new Float32Array(n * 2), idx: number[] = [], wts: [BoneState, number][][] = [];
      for (let j = 0, k = 0; j <= ny; j++) for (let i = 0; i <= nx; i++, k++) {
        const x = x0 + ((x1 - x0) * i) / nx, y = y0 + ((y1 - y0) * j) / ny;
        rest[k * 2] = x; rest[k * 2 + 1] = y; uv[k * 2] = (x - tx0) / (tx1 - tx0); uv[k * 2 + 1] = (y - ty0) / (ty1 - ty0);
        wts.push(def.w(x, y).filter(([, w]) => w > 1e-4).map(([b, w]) => [this.B[b], w] as [BoneState, number]));
      }
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1;
        idx.push(a, b, c, b, d, c);
      }
      const uvBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, uvBuf); gl.bufferData(gl.ARRAY_BUFFER, uv, gl.STATIC_DRAW);
      const pos = new Float32Array(n * 2);
      const posBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, posBuf); gl.bufferData(gl.ARRAY_BUFFER, pos, gl.DYNAMIC_DRAW);
      const idxBuf = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(idx), gl.STATIC_DRAW);
      this.layers.push({ ...def, rest, pos, wts, count: idx.length, uvBuf, posBuf, idxBuf });
    }
  }

  /** Loads the body; emotion heads follow in the background (they are only needed once a mood plays). */
  async load(): Promise<void> {
    const body = this.layers.filter((l) => !l.react);
    await Promise.all(body.map((l) => this.loadTexture(l)));
    void this.loadFaces();
  }
  private async loadFaces() {
    for (const l of this.layers.filter((x) => x.react)) {
      try { await this.loadTexture(l); this.loadedFaces.add(l.react); } catch { /* the plain face stays on */ }
    }
  }
  private async loadTexture(l: Layer) {
    const gl = this.gl;
    const part = l.src ?? l.name;
    const url = `${this.base}${part}${this.suit.has(part) ? `-${this.theme}` : ""}.webp?v=${MASCOT_ASSET_VERSION}`;
    const r = await fetch(url);
    if (!r.ok) throw new Error(`${url}: ${r.status}`);
    const bmp = await createImageBitmap(await r.blob(), { premultiplyAlpha: "premultiply" });
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bmp);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    bmp.close?.();
    l.tex = tex;
  }

  /** Plays a gesture or mood. While one is half-way through, the next waits its turn. */
  play(name: string) {
    if (!ANIMS[name] || name === "idle") return;
    if (this.cur && this.curT < ANIMS[this.cur].dur * 0.5) { this.queued = name; return; }
    this.prevPose = this.pose;
    this.cur = name; this.curT = 0; this.mix = 0;
  }
  get playing() { return this.cur; }

  /** Pointer position relative to the mascot, each in -1…1. */
  lookAtPoint(x: number, y: number) { this.look = [clamp(x, -1, 1), clamp(y, -1, 1)]; this.lookAt = this.clock; }

  private solve(pose: Pose) {
    for (const [n] of BONES) {
      const b = this.B[n];
      const v = { ...REST };
      for (const k in REST) { const ch = `${n}.${k}`, val = pose[ch] ?? REST_CH[ch]; if (val !== undefined) (v as Record<string, number>)[k] = val; }
      const c = Math.cos(v.rot * D2R), s = Math.sin(v.rot * D2R);
      const a = c * v.sx, bb = s * v.sx, cc = -s * v.sy, d = c * v.sy;
      const L = [a, bb, cc, d, b.px + v.x - (a * b.px + cc * b.py), b.py + v.y - (bb * b.px + d * b.py)];
      b.m = b.parent ? mul(this.B[b.parent].m, L) : L;
    }
  }
  private angOf(b: string) { const m = this.B[b].m; return Math.atan2(m[1], m[0]) / D2R; }

  private update(dt: number): Pose {
    const sec = this.sec;
    this.clock += dt;
    this.idleT = (this.idleT + dt) % ANIMS.idle.dur;
    let pose = sample(ANIMS.idle, this.reduce ? 0 : this.idleT);
    let face: string | null = null, talkOn = false;
    if (this.cur) {
      const a = ANIMS[this.cur];
      this.curT += dt;
      const w = this.curT > a.dur - 0.32 ? 1 - smooth(a.dur - 0.32, a.dur, this.curT) : 1;
      pose = blend(pose, sample(a, Math.min(this.curT, a.dur)), w);
      if (a.face && this.curT < a.dur - 0.28 && this.loadedFaces.has(a.face)) face = a.face;
      if (a.talk && this.curT > a.talk[0] && this.curT < a.talk[1]) talkOn = true;
      if (this.curT >= a.dur) {
        this.cur = null;
        if (this.queued) { const q = this.queued; this.queued = null; this.play(q); }
      }
    }
    if (this.mix < 1 && this.prevPose) { this.mix = Math.min(1, this.mix + dt / 0.18); pose = blend(this.prevPose, pose, EASE.io(this.mix)); }
    this.pose = { ...pose };

    // Look at the pointer, or glance around on its own when nobody moves it.
    let lx: number, ly: number;
    if (this.look && this.clock - this.lookAt < 4) [lx, ly] = this.look;
    else {
      if (this.clock > this.nextGlance) {
        this.glance = Math.random() < 0.4 ? [0, 0] : [(Math.random() * 2 - 1) * 0.7, (Math.random() * 2 - 1) * 0.35];
        this.nextGlance = this.clock + 1.6 + Math.random() * 3;
      }
      [lx, ly] = this.glance;
    }
    const la = this.reduce ? 0.3 : 1;
    sec.lookX.target = lx * la; sec.lookY.target = ly * la;
    add(pose, "face.x", sec.lookX.x * 13); add(pose, "face.y", sec.lookY.x * 9);
    add(pose, "head.rot", sec.lookX.x * 3.5); add(pose, "head.x", sec.lookX.x * 5);
    for (const e of ["eyeL", "eyeR"]) { add(pose, e + ".x", sec.lookX.x * 7); add(pose, e + ".y", sec.lookY.x * 5); }

    add(pose, "head.y", HEAD_DROP);
    const rL = smooth(ARM_DOWN, ARM_DOWN * 0.15, pose["armL.rot"] ?? ARM_DOWN);
    pose["armL.x"] = (pose["armL.x"] ?? REST_CH["armL.x"]) * (1 - rL) + SHOULDER_IN * rL;
    pose["armL.y"] = (pose["armL.y"] ?? REST_CH["armL.y"]) * (1 - rL) - SHOULDER_LIFT * rL;
    const rR = smooth(0, ARM_DOWN * 0.85, pose["armR.rot"] ?? 0);
    add(pose, "armR.x", (999 - 280 - this.B.armR.px - SHOULDER_IN) * rR);
    add(pose, "armL.rot", -ARM_OUT * rL);
    add(pose, "armR.rot", ARM_OUT * rR);
    add(pose, "armR.y", -(this.B.armR.py - 574 + SHOULDER_LIFT) * rR);

    // Blink at random, sometimes twice.
    if (this.clock > this.blinkAt) {
      this.blinkUntil = this.clock + 0.09;
      this.blinkAt = this.clock + 2 + Math.random() * 3.5;
      this.secondBlinkAt = Math.random() < 0.2 ? this.clock + 0.23 : 0;
    }
    if (this.secondBlinkAt && this.clock > this.secondBlinkAt) { this.blinkUntil = this.clock + 0.09; this.secondBlinkAt = 0; }
    sec.blink.target = this.clock < this.blinkUntil ? 1 : 0;
    for (const e of ["eyeL", "eyeR"]) pose[e + ".sy"] = (pose[e + ".sy"] ?? 1) * (1 - sec.blink.x * 0.88);

    if (talkOn && this.clock > this.talkNext) { sec.mouth.target = 0.45 + Math.random() * 0.85; this.talkNext = this.clock + 0.07 + Math.random() * 0.09; }
    if (!talkOn) sec.mouth.target = 1;
    pose["mouth.sy"] = (pose["mouth.sy"] ?? 1) * sec.mouth.x;
    pose["mouth.sx"] = 1 + (sec.mouth.x - 1) * 0.15;

    if (face && face !== this.exprId && sec.faceMix.x < 0.04) this.exprId = face;
    sec.faceMix.target = face && face === this.exprId ? 1 : 0;

    // Ears and hands trail the motion: solve once, read angular speed, shake, solve again.
    this.solve(pose);
    const hA = this.angOf("head"), aL = this.angOf("armL"), aR = this.angOf("armR"), ry = this.B.root.m[5];
    const inv = 1 / Math.max(dt, 1e-3), p = this.prevAng;
    const hv = (hA - p.head) * inv, lv = (aL - p.armL) * inv, rv = (aR - p.armR) * inv, yv = (ry - p.rootY) * inv;
    this.prevAng = { head: hA, armL: aL, armR: aR, rootY: ry };
    sec.earL.target = clamp(-hv * 0.05 + yv * 0.012, -12, 12); sec.earR.target = clamp(-hv * 0.05 - yv * 0.012, -12, 12);
    sec.handL.target = clamp(-lv * 0.045, -14, 14); sec.handR.target = clamp(-rv * 0.045, -14, 14);
    for (const k in sec) for (let s = 0; s < 3; s++) sec[k as keyof typeof sec].step(dt / 3);
    add(pose, "earL.rot", sec.earL.x); add(pose, "earR.rot", sec.earR.x);
    add(pose, "handL.rot", sec.handL.x); add(pose, "handR.rot", sec.handR.x);
    this.solve(pose);
    return pose;
  }

  /** Advances by dt seconds and draws into a canvas of W×H device pixels. */
  render(dt: number, W: number, H: number) {
    const gl = this.gl, V = this.view;
    const pose = this.update(dt);
    const armFront = (pose["armL.rot"] ?? ARM_DOWN) > -60;
    const armRUp = (pose["armR.rot"] ?? 0) < -70;
    const cv = gl.canvas as HTMLCanvasElement;
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    gl.viewport(0, 0, W, H); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    const sx = 2 / (V.x1 - V.x0), sy = 2 / (V.y1 - V.y0), mix = clamp(this.sec.faceMix.x, 0, 1);
    for (const L of this.layers) {
      if (!L.tex) continue;
      // Mood heads: plain eyes/mouth fade out first, then the mood head fades in over the
      // still-solid head, which only hides once it is fully covered — never two faces at once.
      const alpha = L.react ? (L.react === this.exprId ? smooth(0.3, 1, mix) : 0)
        : L.group === "base-head" ? (mix > 0.98 ? 0 : 1)
        : L.group === "base" ? 1 - smooth(0, 0.35, mix)
        : L.armSide ? ((L.armSide === "front") === armFront ? 1 : 0)
        : L.armRSide ? ((L.armRSide === "up") === armRUp ? 1 : 0) : 1;
      if (alpha < 0.01) continue;
      const rr = L.rest, o = L.pos;
      for (let k = 0, vi = 0; k < rr.length; k += 2, vi++) {
        const x = rr[k], y = rr[k + 1];
        let X = 0, Y = 0;
        for (const [b, w] of L.wts[vi]) { const m = b.m; X += w * (m[0] * x + m[2] * y + m[4]); Y += w * (m[1] * x + m[3] * y + m[5]); }
        o[k] = (X - V.x0) * sx - 1; o[k + 1] = 1 - (Y - V.y0) * sy;
      }
      gl.uniform1f(this.uA, alpha);
      gl.bindBuffer(gl.ARRAY_BUFFER, L.posBuf); gl.bufferSubData(gl.ARRAY_BUFFER, 0, o);
      gl.enableVertexAttribArray(this.aP); gl.vertexAttribPointer(this.aP, 2, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, L.uvBuf);
      gl.enableVertexAttribArray(this.aU); gl.vertexAttribPointer(this.aU, 2, gl.FLOAT, false, 0, 0);
      gl.bindTexture(gl.TEXTURE_2D, L.tex);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, L.idxBuf);
      gl.drawElements(gl.TRIANGLES, L.count, gl.UNSIGNED_SHORT, 0);
    }
    if (this.onGround) {
      const r = this.B.root.m, lift = Math.max(0, -(r[3] * 930 + r[5] - 930));
      const g = 1 - clamp(lift / 260, 0, 0.5);
      this.onGround(g * r[0], g);
    }
  }

  destroy() {
    const gl = this.gl;
    for (const L of this.layers) {
      gl.deleteBuffer(L.uvBuf); gl.deleteBuffer(L.posBuf); gl.deleteBuffer(L.idxBuf);
      if (L.tex) gl.deleteTexture(L.tex);
    }
    gl.getExtension("WEBGL_lose_context")?.loseContext();
  }
}
