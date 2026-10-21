// @ts-nocheck — keyframe data built with small helper closures, copied verbatim from the
// tuned preview; the exports below carry the types the engine relies on.
// Smoothie mascot — skeleton + keyframe data (Rive-style rig).
//
// Ported from smoothlife-mascot/rive-preview.html, where every pose was tuned
// by eye with the team. Edit the poses there first, then copy the numbers
// here; the handoff spec for a real Rive file lives in
// smoothlife-mascot/rive-handoff/SPEC.md.
//
// Units: pixels on the 1000×1000 artboard (y down), angles in degrees
// (positive = clockwise). Key = [time s, value, easing of the segment that
// arrives at this key]. "sad", "angry" and "love" were taken out on purpose — the
// team wants those moods off the storefront for now.

export type Key = [number, number] | [number, number, string];
export type Anim = { dur: number; loop?: boolean; face?: string; talk?: [number, number]; keys: Record<string, Key[]> };
export type Bone = [name: string, parent: string | null, px: number, py: number];

export const BONES = [
  ["root", null, 500, 930], ["hips", "root", 500, 800], ["legL", "hips", 370, 790], ["legR", "hips", 620, 792],
  ["chest", "hips", 500, 650], ["head", "chest", 500, 575], ["face", "head", 512, 395],
  ["earL", "head", 330, 205], ["earR", "head", 700, 215],
  ["eyeL", "face", 402, 361], ["eyeR", "face", 618, 378], ["mouth", "face", 504, 399],
  ["browL", "face", 395, 281], ["browR", "face", 633, 297],
  ["armL", "chest", 280, 574], ["handL", "armL", 235, 521], ["armR", "chest", 688, 640], ["handR", "armR", 710, 706],
] as Bone[];

export const ARM_DOWN = -122;
export const REST_CH: Record<string, number> = { "armL.rot": ARM_DOWN, "armL.x": 31, "armL.y": 66 };

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export function bezier(x1: number, y1: number, x2: number, y2: number): (x: number) => number {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = (t) => ((ax * t + bx) * t + cx) * t, sy = (t) => ((ay * t + by) * t + cy) * t;
  const dx = (t) => (3 * ax * t + 2 * bx) * t + cx;
  return (x) => {
    let t = x;
    for (let i = 0; i < 6; i++) { const e = sx(t) - x, d = dx(t); if (Math.abs(e) < 1e-4 || Math.abs(d) < 1e-6) break; t -= e / d; }
    return sy(clamp(t, 0, 1));
  };
}
export const EASE: Record<string, (x: number) => number> = {
  io: bezier(0.45, 0, 0.55, 1),      // ออกช้า-เข้าช้า (ค่าเริ่มต้น)
  out: bezier(0.22, 1, 0.36, 1),     // พุ่งออกแล้วชะลอ
  in: bezier(0.55, 0, 1, 0.45),      // เร่งเข้า (เช่น ตกลงพื้น)
  back: bezier(0.34, 1.56, 0.64, 1), // เลยเป้าแล้วกลับ (overshoot)
  soft: bezier(0.37, 0, 0.63, 1),
  lin: (x) => x,
};

// ---------- animations ----------
// key = [เวลา(s), ค่า, easing ของช่วงที่วิ่งเข้าคีย์นี้]
const D = ARM_DOWN; // มุมแขนซ้ายตอนห้อย (ภาพแขนวาดมาท่ายก)
export const ANIMS: Record<string, Anim> = {
  idle: { dur: 4, loop: true, keys: {
    "chest.sy": [[0, 1], [2, 1.022], [4, 1]], "chest.y": [[0, 0], [2, -5], [4, 0]],
    "hips.rot": [[0, 0], [1, 1.1, "soft"], [3, -1.1, "soft"], [4, 0, "soft"]],
    "head.rot": [[0, 0], [1.3, -1.5, "soft"], [3.3, 1.5, "soft"], [4, 0, "soft"]],
    "face.y": [[0, 0], [2.2, 2.5], [4, 0]],
    "armL.rot": [[0, -122], [1.5, -119], [3.5, -124.5], [4, -122]], "handL.rot": [[0, 0], [1.8, 4], [3.8, -3], [4, 0]],
    "armR.rot": [[0, 0], [1.2, -2.5], [3.2, 2.5], [4, 0]],
  } },
  // โบกมือแบบคน: ย่อเตรียม → ยกแขนพุ่งขึ้นเลยเป้านิด → ไหล่นิ่ง โบกที่ข้อมือ (มือตามหลังแขน ~0.06 s)
  // → ตัว/หัวเด้งตามจังหวะโบก → ปล่อยแขนตกลงแล้วแกว่งเบา ๆ ก่อนนิ่ง
  wave: { dur: 2.75, talk: [0.4, 1.7], keys: {
    "root.sy": [[0, 1], [0.1, 0.97, "out"], [0.36, 1.02, "out"], [0.55, 1], [0.7, 0.99], [0.92, 1], [1.14, 0.99], [1.36, 1], [1.58, 0.99], [1.8, 1]],
    "armL.rot": [[0, -123], [0.1, -129, "out"], [0.38, 9, "out"], [0.52, -2], [0.7, 5], [0.92, -4], [1.14, 5], [1.36, -4], [1.58, 4], [1.8, -2], [2.02, 0],
      [2.32, -117, "in"], [2.48, -127, "out"], [2.62, -122], [2.75, -123]],
    "handL.rot": [[0, 0], [0.16, 10], [0.4, -24, "out"], [0.56, 20], [0.77, -28], [0.99, 26], [1.21, -28], [1.43, 24], [1.65, -22], [1.87, 12], [2.07, 0],
      [2.36, 16], [2.55, -6], [2.75, 0]],
    "head.rot": [[0, 0], [0.38, 7, "out"], [0.7, 6], [0.92, 7.5], [1.14, 6], [1.36, 7.5], [1.58, 6], [2.0, 6], [2.45, 0, "soft"]],
    "face.x": [[0, 0], [0.4, -7, "out"], [2.0, -6], [2.45, 0]],
    "face.y": [[0, 0], [0.4, -4], [0.7, -2], [0.92, -5], [1.14, -2], [1.36, -5], [1.58, -2], [2.0, -3], [2.45, 0]],
    "chest.rot": [[0, 0], [0.38, -2.5, "out"], [2.0, -2.2], [2.45, 0]], "hips.rot": [[0, 0], [0.38, 1.5], [2.0, 1.3], [2.45, 0]],
    "armR.rot": [[0, 0], [0.4, 5], [2.0, 4], [2.5, 0]],
    "browL.y": [[0, 0], [0.32, -8, "out"], [1.9, -7], [2.3, 0]], "browR.y": [[0, 0], [0.35, -8, "out"], [1.9, -7], [2.3, 0]],
  } },
  // ---------- ท่าทาง (หลักเดียวกับ wave: เตรียม → พุ่งเลยเป้า → ตามหลัง → คลายตัว) ----------
  nod: { dur: 1.6, keys: {
    "face.y": [[0, 0], [0.12, -6, "out"], [0.36, 16], [0.56, -2], [0.8, 12], [1.0, -1], [1.2, 2], [1.45, 0]],
    "head.rot": [[0, 0], [0.12, -1], [0.38, 2], [0.58, -0.5], [0.82, 1.5], [1.1, 0]],
    "head.sy": [[0, 1], [0.12, 1.01], [0.36, 0.97], [0.5, 1.01], [0.8, 0.975], [1.0, 1.005], [1.2, 1]],
    "chest.rot": [[0, 0], [0.42, 1.6], [0.86, 1.2], [1.35, 0]],
    "root.sy": [[0, 1], [0.38, 0.985], [0.6, 1.003], [0.82, 0.988], [1.05, 1]],
    "armL.rot": [[0, D], [0.42, D + 3], [0.88, D + 2], [1.4, D]], "armR.rot": [[0, 0], [0.42, -3], [0.88, -2], [1.4, 0]],
    "handL.rot": [[0, 0], [0.5, 4], [0.95, -3], [1.4, 0]], "handR.rot": [[0, 0], [0.5, -4], [0.95, 3], [1.4, 0]],
  } },
  shake: { dur: 1.75, keys: {
    "head.rot": [[0, 0], [0.12, 2], [0.32, -4, "out"], [0.54, 4], [0.76, -3.4], [0.98, 2.6], [1.2, -1.4], [1.45, 0]],
    "head.x": [[0, 0], [0.12, 3], [0.32, -10, "out"], [0.54, 9], [0.76, -8], [0.98, 6], [1.2, -3], [1.45, 0]],
    "face.x": [[0, 0], [0.15, 4], [0.35, -12, "out"], [0.57, 11], [0.79, -10], [1.01, 7], [1.23, -3], [1.5, 0]],
    "eyeL.x": [[0, 0], [0.38, -6], [0.6, 6], [0.82, -5], [1.04, 4], [1.3, 0]], "eyeR.x": [[0, 0], [0.38, -6], [0.6, 6], [0.82, -5], [1.04, 4], [1.3, 0]],
    "chest.rot": [[0, 0], [0.34, 1.2], [0.56, -1.2], [0.78, 1], [1.0, -0.6], [1.3, 0]],
    "browL.y": [[0, 0], [0.2, 4], [1.4, 4], [1.65, 0]], "browR.y": [[0, 0], [0.2, 4], [1.4, 4], [1.65, 0]],
    "mouth.sy": [[0, 1], [0.2, 0.75], [1.4, 0.75], [1.65, 1]],
    "armL.rot": [[0, D], [0.35, D + 4], [1.3, D + 3], [1.65, D]], "armR.rot": [[0, 0], [0.35, -4], [1.3, -3], [1.65, 0]],
    "handL.rot": [[0, 0], [0.4, -5], [0.62, 5], [0.84, -4], [1.06, 3], [1.4, 0]], "handR.rot": [[0, 0], [0.4, 5], [0.62, -5], [0.84, 4], [1.06, -3], [1.4, 0]],
  } },
  jump: { dur: 1.55, face: "laugh", keys: {
    "root.sy": [[0, 1], [0.25, 0.86, "out"], [0.34, 1.1, "in"], [0.48, 1.02], [0.62, 1], [0.84, 1.04], [0.9, 0.85, "in"], [1.05, 1.06, "out"], [1.2, 0.97], [1.35, 1.01], [1.5, 1]],
    "root.sx": [[0, 1], [0.25, 1.09, "out"], [0.34, 0.94, "in"], [0.5, 1], [0.9, 1.11, "in"], [1.05, 0.96, "out"], [1.2, 1.02], [1.35, 1]],
    "root.y": [[0, 0], [0.27, 0], [0.58, -180, "out"], [0.88, 0, "in"]],
    "armL.rot": [[0, D], [0.25, D - 12, "out"], [0.45, 20, "out"], [0.7, 14], [0.9, 0], [1.12, D + 22], [1.3, D - 5], [1.5, D]],
    "armR.rot": [[0, 0], [0.25, 12, "out"], [0.45, -130, "out"], [0.7, -124], [0.9, -100], [1.12, -22], [1.3, 5], [1.5, 0]],
    "handL.rot": [[0, 0], [0.3, -12], [0.5, 18], [0.75, -8], [0.95, 10], [1.2, -6], [1.45, 0]],
    "handR.rot": [[0, 0], [0.3, 12], [0.5, -18], [0.75, 8], [0.95, -10], [1.2, 6], [1.45, 0]],
    "legL.y": [[0, 0], [0.3, 0], [0.5, -26, "out"], [0.82, 0, "in"]], "legR.y": [[0, 0], [0.33, 0], [0.53, -27, "out"], [0.85, 0, "in"]],
    "legL.rot": [[0, 0], [0.5, -8], [0.82, 0]], "legR.rot": [[0, 0], [0.53, 8], [0.85, 0]],
    "head.rot": [[0, 0], [0.25, 3], [0.55, -5], [0.92, 5], [1.15, -2], [1.4, 0]],
    "face.y": [[0, 0], [0.25, 8], [0.55, -14, "out"], [0.92, 12], [1.15, -3], [1.4, 0]],
  } },
  talk: { dur: 2.8, talk: [0.2, 2.45], keys: {
    // พูดแบบอธิบาย: มือขวาทำท่าประกอบเป็นจังหวะ, หัวพยักตรงคำเน้น
    "armR.rot": [[0, 0], [0.15, 4], [0.42, -30, "out"], [0.7, -24], [0.95, -34, "out"], [1.25, -22], [1.55, -32, "out"], [1.9, -20], [2.3, -6], [2.6, 0]],
    "handR.rot": [[0, 0], [0.2, 6], [0.5, -14], [0.78, 8], [1.03, -12], [1.33, 8], [1.63, -12], [1.98, 8], [2.4, -3], [2.7, 0]],
    "head.rot": [[0, 0], [0.45, 3], [0.98, -2], [1.58, 3], [2.1, -1], [2.6, 0]],
    "face.y": [[0, 0], [0.4, 0], [0.5, 5], [0.65, 0], [0.95, 0], [1.05, 6], [1.2, 0], [1.55, 0], [1.65, 5], [1.8, 0]],
    "chest.rot": [[0, 0], [0.45, 1.5], [1.0, -1], [1.6, 1.5], [2.3, 0]], "hips.rot": [[0, 0], [0.5, -0.8], [1.05, 0.6], [1.65, -0.8], [2.35, 0]],
    "armL.rot": [[0, D], [0.5, D + 4], [1.6, D + 3], [2.6, D]], "handL.rot": [[0, 0], [0.6, 3], [1.7, -2], [2.6, 0]],
    "browL.y": [[0, 0], [0.45, -5], [0.7, 0], [1.05, -6], [1.3, 0], [1.65, -5], [1.9, 0]],
    "browR.y": [[0, 0], [0.47, -5], [0.72, 0], [1.07, -6], [1.32, 0], [1.67, -5], [1.92, 0]],
  } },
  think: { dur: 3.0, face: "curious", keys: {
    "head.rot": [[0, 0], [0.15, -2], [0.6, 10, "back"], [1.2, 9], [1.8, 11], [2.4, 10], [2.9, 0, "soft"]],
    "face.x": [[0, 0], [0.6, -15, "out"], [2.4, -14], [2.9, 0]], "face.y": [[0, 0], [0.6, -12, "out"], [2.4, -11], [2.9, 0]],
    "hips.rot": [[0, 0], [0.6, 1.8], [2.4, 1.6], [2.9, 0]], "chest.rot": [[0, 0], [0.7, 1.5], [2.4, 1.3], [2.9, 0]],
    "armR.rot": [[0, 0], [0.5, -18, "back"], [2.4, -16], [2.9, 0]], "handR.rot": [[0, 0], [0.6, -10], [2.4, -9], [2.9, 0]],
    "armL.rot": [[0, D], [0.6, D + 5], [2.4, D + 4], [2.9, D]],
    "legR.y": [[0, 0], [1.0, 0], [1.1, -8, "out"], [1.2, 0, "in"], [1.4, 0], [1.5, -8, "out"], [1.6, 0, "in"], [1.8, 0], [1.9, -8, "out"], [2.0, 0, "in"]],
  } },
  dance: { dur: 3.4, keys: (() => {
    const k = { "legL.y": [[0, 0]], "legR.y": [[0, 0]], "hips.rot": [[0, 0]], "head.rot": [[0, 0]], "root.sy": [[0, 1], [0.12, 0.96, "out"]], "root.y": [[0, 0]],
      "armL.rot": [[0, D], [0.12, D - 6]], "armR.rot": [[0, 0], [0.12, 6]], "handL.rot": [[0, 0]], "handR.rot": [[0, 0]], "face.x": [[0, 0]],
      "mouth.sy": [[0, 1], [0.25, 1.2], [3.1, 1.2], [3.4, 1]] };
    for (let i = 0; i < 4; i++) {
      const t = 0.15 + i * 0.75, s = i % 2 ? -1 : 1, leg = i % 2 ? "legR.y" : "legL.y";
      k[leg].push([t + 0.05, 0], [t + 0.22, -28, "out"], [t + 0.4, 0, "in"]);
      k["root.y"].push([t + 0.2, -8, "out"], [t + 0.4, 0, "in"]);
      k["root.sy"].push([t + 0.42, 0.95, "in"], [t + 0.58, 1.02, "out"], [t + 0.72, 1]);
      k["hips.rot"].push([t + 0.38, 3.2 * s]);
      k["head.rot"].push([t + 0.46, -3.6 * s]);           // หัวตามหลังสะโพก ~0.08 s
      k["face.x"].push([t + 0.46, 8 * s]);
      k["armL.rot"].push([t + 0.36, D + 13 + 14 * s]); k["handL.rot"].push([t + 0.44, 14 * s]);
      k["armR.rot"].push([t + 0.36, -13 - 14 * s]); k["handR.rot"].push([t + 0.44, -14 * s]);
    }
    for (const ch of ["hips.rot", "head.rot", "face.x", "handL.rot", "armR.rot", "handR.rot"]) k[ch].push([3.4, 0, "soft"]);
    k["armL.rot"].push([3.4, D, "soft"]); k["legL.y"].push([3.4, 0]); k["legR.y"].push([3.4, 0]); k["root.sy"].push([3.4, 1]); k["root.y"].push([3.4, 0]);
    return k;
  })() },
  // วิ่งอยู่กับที่: ขาสลับเร็ว ตัวลอยทุกก้าว/ยุบตอนลง, แขนแกว่งสวนขา, หัวโยกตามหลัง, ออกตัว-ชะลอ
  run: { dur: 3.3, keys: (() => {
    const k = { "legL.y": [[0, 0]], "legR.y": [[0, 0]], "legL.rot": [[0, 0]], "legR.rot": [[0, 0]],
      "root.y": [[0, 0]], "root.sy": [[0, 1], [0.14, 0.95, "out"]], "hips.rot": [[0, 0]], "head.rot": [[0, 0]],
      "armL.rot": [[0, D], [0.14, D - 6]], "armR.rot": [[0, 0], [0.14, 6]], "handL.rot": [[0, 0]], "handR.rot": [[0, 0]],
      "face.y": [[0, 0], [0.25, 5, "out"], [2.9, 5], [3.25, 0]],
      "browL.y": [[0, 0], [0.25, 3], [2.9, 3], [3.2, 0]], "browR.y": [[0, 0], [0.25, 3], [2.9, 3], [3.2, 0]],
      "mouth.sy": [[0, 1], [0.25, 1.15], [2.9, 1.15], [3.2, 1]] };
    const STEP = 0.3, N = 9;
    for (let i = 0; i < N; i++) {
      const t = 0.22 + i * STEP, s = i % 2 ? -1 : 1;
      const a = i >= N - 2 ? 0.55 : 1;                       // สองก้าวสุดท้ายชะลอ
      const leg = s > 0 ? "legL" : "legR";
      k[leg + ".y"].push([t, 0], [t + 0.1, -34 * a, "out"], [t + 0.22, 0, "in"]);
      k[leg + ".rot"].push([t + 0.1, -7 * s * a], [t + 0.22, 0]);
      k["root.y"].push([t + 0.09, -15 * a, "out"], [t + 0.22, 0, "in"]);
      k["root.sy"].push([t + 0.06, 1.03], [t + 0.24, 1 - 0.05 * a, "in"]);
      k["hips.rot"].push([t + 0.12, 2.2 * s * a]);
      k["head.rot"].push([t + 0.18, -2.4 * s * a]);         // หัวตามหลังสะโพก
      k["armL.rot"].push([t + 0.12, D + 14 - 16 * s * a]);   // แขนสวนขา
      k["armR.rot"].push([t + 0.12, -14 - 16 * s * a]);
      k["handL.rot"].push([t + 0.19, 12 * s * a]); k["handR.rot"].push([t + 0.19, 12 * s * a]);
    }
    const end = 0.22 + N * STEP + 0.05;
    k["root.sy"].push([end + 0.08, 0.96, "in"], [end + 0.22, 1.01, "out"], [3.3, 1]);
    for (const ch of ["hips.rot", "head.rot", "handL.rot", "handR.rot", "armR.rot", "legL.rot", "legR.rot"]) k[ch].push([3.3, 0, "soft"]);
    k["armL.rot"].push([3.3, D, "soft"]); k["legL.y"].push([3.3, 0]); k["legR.y"].push([3.3, 0]); k["root.y"].push([3.3, 0]);
    return k;
  })() },
  // เต้นเฟี้ยว (~5.6 s, 120 BPM = 0.5 s/จังหวะ): groove โยกสะโพก → raise the roof ดันแขนขึ้นฟ้า
  // → ชี้ฟ้าสลับข้างแบบดิสโก้ → ยักไหล่รัว → กระโดดจบท่าชูสองแขน
  party: { dur: 5.6, face: "happy", keys: (() => {
    const k = {}, push = (ch, t, v, e) => (k[ch] = k[ch] || []).push(e ? [t, v, e] : [t, v]);
    const RU = -137;                                   // แขนขวาชูเต็ม (ภาพท่ายก)
    ["root.y", "hips.rot", "hips.x", "head.rot", "face.x", "face.y", "armR.rot", "handL.rot", "handR.rot", "chest.rot", "legL.y", "legR.y"].forEach((c) => push(c, 0, 0));
    push("root.sy", 0, 1); push("armL.rot", 0, D); push("mouth.sy", 0, 1);
    // 1) groove 0–1.5: โยกสะโพกซ้ายขวา ย่อตามจังหวะ หัวพยักนอกจังหวะ แขนแกว่งสบาย ๆ
    for (let i = 0; i < 3; i++) {
      const t = 0.1 + i * 0.5, s = i % 2 ? -1 : 1;
      push("hips.x", t + 0.25, 14 * s, "out"); push("hips.rot", t + 0.25, 4 * s);
      push("root.sy", t + 0.12, 0.95, "in"); push("root.sy", t + 0.3, 1.02, "out");
      push("head.rot", t + 0.32, -4 * s); push("face.y", t + 0.2, 6); push("face.y", t + 0.4, -2);
      push("armL.rot", t + 0.25, D + 18 + 12 * s); push("armR.rot", t + 0.25, -18 + 12 * s);
      push("handL.rot", t + 0.33, 14 * s); push("handR.rot", t + 0.33, 14 * s);
      push("legL.y", t + 0.12, s > 0 ? -16 : 0, "out"); push("legL.y", t + 0.28, 0, "in");
      push("legR.y", t + 0.12, s < 0 ? -16 : 0, "out"); push("legR.y", t + 0.28, 0, "in");
    }
    // 2) raise the roof 1.6–2.8: ดันแขนสองข้างขึ้นฟ้าเป็นจังหวะ ตัวเด้ง
    push("hips.x", 1.6, 0); push("hips.rot", 1.6, 0); push("head.rot", 1.6, 0);
    for (let i = 0; i < 4; i++) {
      const t = 1.6 + i * 0.3;
      push("armL.rot", t, -38); push("armL.rot", t + 0.15, 4, "out");
      push("armR.rot", t, RU + 38); push("armR.rot", t + 0.15, RU, "out");
      push("handL.rot", t + 0.18, -12); push("handR.rot", t + 0.18, 12);
      push("root.sy", t, 0.95, "in"); push("root.sy", t + 0.15, 1.04, "out");
      push("root.y", t + 0.15, -10, "out"); push("root.y", t + 0.3, 0, "in");
      push("face.y", t + 0.18, -8); push("face.y", t + 0.3, 2);
    }
    // 3) ชี้ฟ้าดิสโก้ 2.8–4.0: แขนซ้ายชี้ฟ้า/แขนขวาลงสลับกัน สะโพกเหวี่ยงสวน หัวหันตามมือ
    for (let i = 0; i < 4; i++) {
      const t = 2.85 + i * 0.3, s = i % 2 ? -1 : 1;
      push("armL.rot", t + 0.12, s > 0 ? 10 : D + 25, "out"); push("armR.rot", t + 0.12, s < 0 ? RU - 6 : -25, "out");
      push("handL.rot", t + 0.2, s > 0 ? -16 : 8); push("handR.rot", t + 0.2, s < 0 ? 16 : -8);
      push("hips.x", t + 0.14, -16 * s, "out"); push("hips.rot", t + 0.14, -5 * s);
      push("head.rot", t + 0.18, 6 * s); push("face.x", t + 0.18, -12 * s);
      push("root.sy", t + 0.04, 0.96, "in"); push("root.sy", t + 0.16, 1.02, "out");
      push(s > 0 ? "legR.y" : "legL.y", t + 0.1, -20, "out"); push(s > 0 ? "legR.y" : "legL.y", t + 0.24, 0, "in");
    }
    // 4) ยักไหล่รัว 4.05–4.65: แขนลงข้างตัว ไหล่/อกสั่นเร็ว หัวโยก
    push("armL.rot", 4.05, D + 8); push("armR.rot", 4.05, -8); push("hips.x", 4.05, 0); push("hips.rot", 4.05, 0); push("face.x", 4.05, 0);
    for (let i = 0; i < 6; i++) {
      const t = 4.1 + i * 0.1, s = i % 2 ? -1 : 1;
      push("chest.rot", t, 3.5 * s, "lin"); push("head.rot", t + 0.03, -3 * s, "lin");
      push("armL.rot", t, D + 8 + 7 * s, "lin"); push("armR.rot", t, -8 + 7 * s, "lin");
      push("root.y", t, s > 0 ? -5 : 0, "lin");
    }
    // 5) ไฟนอล 4.7–5.6: ย่อ → กระโดดชูสองแขนค้าง → ลงพื้นเด้ง
    push("chest.rot", 4.7, 0); push("head.rot", 4.7, 0);
    push("root.sy", 4.72, 0.86, "out"); push("root.y", 4.74, 0);
    push("armL.rot", 4.74, D - 10); push("armR.rot", 4.74, 10);
    push("root.y", 4.98, -120, "out"); push("root.sy", 4.82, 1.1, "in"); push("root.sy", 5.0, 1);
    push("armL.rot", 4.95, 16, "back"); push("armR.rot", 4.95, RU - 6, "back");
    push("handL.rot", 5.0, -18); push("handR.rot", 5.0, 18);
    push("legL.y", 4.98, -22, "out"); push("legR.y", 4.98, -22, "out");
    push("face.y", 4.95, -14, "out"); push("mouth.sy", 4.9, 1.3);
    push("root.y", 5.22, 0, "in"); push("legL.y", 5.2, 0, "in"); push("legR.y", 5.2, 0, "in");
    push("root.sy", 5.24, 0.9, "in"); push("root.sy", 5.38, 1.03, "out"); push("root.sy", 5.6, 1);
    push("armL.rot", 5.35, 12); push("armR.rot", 5.35, RU - 2);
    for (const c of ["hips.x", "hips.rot", "face.x", "face.y", "handL.rot", "handR.rot"]) push(c, 5.6, 0, "soft");
    push("mouth.sy", 5.6, 1);
    return k;
  })() },
  // บราซิล (ท่าเต้นบราซิลที่ฮิตใน TikTok ไทย ตามคลิปสอน @luvmelovespringrolls, ช่วงสาธิต 0–8 s) ~6.6 s, 0.4 s/จังหวะ
  // ทั้งท่า: ย่อเข่าเด้งทุกจังหวะ + สะโพกส่ายซ้ายขวาไม่หยุด — ตัวท่าคือแขนที่เปลี่ยนทุก 2–4 จังหวะ:
  // แขนห้อยแกว่ง → มือสองข้างจับข้างหัว → ปัดแขนผ่านอก → มือจับหลังหัว → ย่อส่ายสะโพกเร็ว → ยกมือแบระดับไหล่
  brazil: { dur: 6.6, face: "happy", keys: (() => {
    const k = {}, push = (ch, t, v, e) => (k[ch] = k[ch] || []).push(e ? [t, v, e] : [t, v]);
    const hold = (t) => { for (const ch in k) { const last = k[ch].reduce((a, b) => (b[0] > a[0] ? b : a)); if (last[0] < t) push(ch, t, last[1]); } };
    const RU = -137, HIP_L = D + 26, HIP_R = -26, B = 0.4, T0 = 0.15, N = 15;
    ["root.y", "hips.rot", "hips.x", "head.rot", "face.x", "face.y", "armR.rot", "handL.rot", "handR.rot", "chest.rot", "legL.y", "legR.y"].forEach((c) => push(c, 0, 0));
    push("root.sy", 0, 1); push("armL.rot", 0, D); push("mouth.sy", 0, 1);
    // ฐานทั้งท่า: เด้งเข่า + ส่ายสะโพก + หัวโยกตามหลัง
    for (let i = 0; i < N; i++) {
      const t = T0 + i * B, s = i % 2 ? -1 : 1, deep = i >= 10 && i < 12 ? 0.86 : 0.93;
      push("root.sy", t + 0.1, deep, "in"); push("root.sy", t + 0.26, 1.02, "out");
      push("hips.x", t + 0.16, 16 * s, "out"); push("hips.rot", t + 0.16, 5 * s);
      push("chest.rot", t + 0.2, -2 * s); push("head.rot", t + 0.24, -3 * s); push("face.y", t + 0.12, 4); push("face.y", t + 0.3, -1);
      push(s > 0 ? "legR.y" : "legL.y", t + 0.08, -10, "out"); push(s > 0 ? "legR.y" : "legL.y", t + 0.2, 0, "in");
    }
    const beat = (i) => T0 + i * B;
    // 1) จังหวะ 0–3: แขนห้อยแกว่งสวนสะโพก
    for (let i = 0; i < 4; i++) { const s = i % 2 ? -1 : 1;
      push("armL.rot", beat(i) + 0.18, D + 10 - 12 * s); push("armR.rot", beat(i) + 0.18, -10 - 12 * s);
      push("handL.rot", beat(i) + 0.24, 10 * s); push("handR.rot", beat(i) + 0.24, 10 * s); }
    // 2) จังหวะ 4–5: มือสองข้างจับข้างหัว
    hold(beat(4));
    push("armL.rot", beat(4) + 0.16, 32, "out"); push("armR.rot", beat(4) + 0.16, RU - 32, "out");
    push("handL.rot", beat(4) + 0.2, -18); push("handR.rot", beat(4) + 0.2, 18);
    // 3) จังหวะ 6–8: แขนซ้ายปัดผ่านหน้าอกไปมา มือขวาเท้าสะเอว
    hold(beat(6));
    push("armR.rot", beat(6) + 0.14, HIP_R, "out"); push("handR.rot", beat(6) + 0.14, -18);
    for (let i = 6; i < 9; i++) { const s = i % 2 ? -1 : 1;
      push("armL.rot", beat(i) + 0.16, s > 0 ? -40 : 30, "out"); push("handL.rot", beat(i) + 0.22, 16 * s); }
    // 4) จังหวะ 9: มือขวาจับหลังหัว มือซ้ายเท้าสะเอว เอนตัว
    hold(beat(9));
    push("armL.rot", beat(9) + 0.14, HIP_L, "out"); push("handL.rot", beat(9) + 0.14, 18);
    push("armR.rot", beat(9) + 0.16, RU - 28, "back"); push("handR.rot", beat(9) + 0.2, 24);
    // 5) จังหวะ 10–11: ย่อลึก มือห้อยหน้า ส่ายสะโพกเร็ว (สองเท่า)
    hold(beat(10));
    push("armL.rot", beat(10) + 0.14, D - 14, "out"); push("armR.rot", beat(10) + 0.14, 14, "out");
    push("handL.rot", beat(10) + 0.14, -10); push("handR.rot", beat(10) + 0.14, 10);
    for (let q = 0; q < 4; q++) push("hips.x", beat(10) + 0.1 + q * 0.2, q % 2 ? -18 : 18);
    // 6) จังหวะ 12–14: ยกมือแบระดับไหล่สองข้าง เด้งตามจังหวะ แล้วจบ
    hold(beat(12));
    push("armL.rot", beat(12) + 0.16, -32, "back"); push("armR.rot", beat(12) + 0.16, -90, "back");
    for (let i = 12; i < 15; i++) { const s = i % 2 ? -1 : 1;
      push("handL.rot", beat(i) + 0.2, -14 + 8 * s); push("handR.rot", beat(i) + 0.2, 14 + 8 * s); }
    hold(6.25);
    for (const c of ["hips.x", "hips.rot", "head.rot", "face.x", "face.y", "chest.rot", "handL.rot", "handR.rot", "legL.y", "legR.y"]) push(c, 6.6, 0, "soft");
    push("armL.rot", 6.6, D, "soft"); push("armR.rot", 6.6, 0, "soft"); push("root.sy", 6.6, 1);
    return k;
  })() },
  // ---------- อารมณ์ (สลับเป็นหัวอารมณ์ตลอดท่า) ----------
  happy: { dur: 2.4, face: "happy", keys: {
    "root.y": [[0, 0], [0.16, 0], [0.34, -42, "out"], [0.52, 0, "in"], [0.7, -40, "out"], [0.88, 0, "in"], [1.06, -28, "out"], [1.24, 0, "in"]],
    "root.sy": [[0, 1], [0.14, 0.92, "out"], [0.22, 1.05], [0.52, 0.92, "in"], [0.6, 1.04], [0.88, 0.93, "in"], [0.96, 1.03], [1.24, 0.94, "in"], [1.36, 1.02], [1.5, 1]],
    "armL.rot": [[0, D], [0.12, D - 8], [0.3, 16, "out"], [1.45, 14], [1.8, D + 20, "in"], [1.98, D - 4], [2.2, D]],
    "armR.rot": [[0, 0], [0.12, 8], [0.3, -138, "out"], [1.45, -136], [1.8, -20, "in"], [1.98, 4], [2.2, 0]],
    "handL.rot": [[0, 0], [0.36, 12], [0.56, -8], [0.72, 12], [0.92, -8], [1.08, 10], [1.3, -4], [1.6, 0], [1.88, 10], [2.1, 0]],
    "handR.rot": [[0, 0], [0.36, -12], [0.56, 8], [0.72, -12], [0.92, 8], [1.08, -10], [1.3, 4], [1.6, 0], [1.88, -10], [2.1, 0]],
    "head.rot": [[0, 0], [0.34, -3], [0.7, 3], [1.06, -2], [1.4, 0]], "face.y": [[0, 0], [0.3, -8, "out"], [1.6, -6], [2.0, 0]],
  } },
  laugh: { dur: 2.6, face: "laugh", keys: (() => {
    const k = { "root.sy": [[0, 1], [0.12, 0.97]], "head.rot": [[0, 0], [0.12, 2], [0.3, -5, "out"], [2.0, -4], [2.45, 0]],
      "face.y": [[0, 0], [0.12, 4], [0.3, -12, "out"], [2.0, -10], [2.45, 0]], "chest.rot": [[0, 0]],
      "armL.rot": [[0, D], [0.3, D + 10, "out"], [2.0, D + 8], [2.45, D]], "armR.rot": [[0, 0], [0.3, -10, "out"], [2.0, -8], [2.45, 0]],
      "handL.rot": [[0, 0]], "handR.rot": [[0, 0]] };
    for (let t = 0.3, i = 0; t < 2.0; t += 0.1, i++) {            // หัวเราะเป็นจังหวะ ค่อย ๆ เบาลง
      const a = 1 - (t - 0.3) / 1.9;
      k["root.sy"].push([t, i % 2 ? 1.0 : 1 - 0.04 * a]); k["chest.rot"].push([t, (i % 2 ? 1 : -1) * 1.2 * a]);
      k["handL.rot"].push([t + 0.04, (i % 2 ? 1 : -1) * 6 * a]); k["handR.rot"].push([t + 0.04, (i % 2 ? -1 : 1) * 6 * a]);
    }
    for (const ch of ["root.sy"]) k[ch].push([2.25, 1]);
    for (const ch of ["chest.rot", "handL.rot", "handR.rot"]) k[ch].push([2.25, 0]);
    return k;
  })() },
  surprised: { dur: 2.2, face: "surprised", keys: {
    "root.sy": [[0, 1], [0.06, 0.93, "out"], [0.18, 1.1, "out"], [0.36, 0.97], [0.5, 1.01], [0.65, 1]],
    "root.sx": [[0, 1], [0.06, 1.05], [0.18, 0.94], [0.36, 1.02], [0.5, 1]],
    "root.y": [[0, 0], [0.06, 0], [0.2, -38, "out"], [0.38, 0, "in"]],
    "armL.rot": [[0, D], [0.2, 22, "back"], [1.4, 20], [1.75, D + 15, "in"], [1.95, D - 4], [2.15, D]],
    "armR.rot": [[0, 0], [0.2, -144, "back"], [1.4, -142], [1.75, -15, "in"], [1.95, 4], [2.15, 0]],
    "handL.rot": [[0, 0], [0.24, -14], [0.42, 8], [0.62, -3], [0.8, 0], [1.82, 10], [2.05, 0]],
    "handR.rot": [[0, 0], [0.24, 14], [0.42, -8], [0.62, 3], [0.8, 0], [1.82, -10], [2.05, 0]],
    "face.y": [[0, 0], [0.2, -14, "out"], [1.5, -11], [1.95, 0]], "head.rot": [[0, 0], [0.2, -3], [1.5, -2], [1.95, 0]],
  } },
  curious: { dur: 2.8, face: "curious", keys: {
    "root.sy": [[0, 1], [0.12, 0.98], [0.3, 1.01], [0.45, 1]],
    "head.rot": [[0, 0], [0.12, -2], [0.55, 12, "back"], [1.2, 10], [1.6, 12], [2.25, 11], [2.75, 0, "soft"]],
    "hips.rot": [[0, 0], [0.55, -2], [2.25, -2], [2.75, 0]], "face.x": [[0, 0], [0.55, -14, "out"], [2.25, -13], [2.75, 0]],
    "armR.rot": [[0, 0], [0.5, -14, "back"], [2.25, -12], [2.75, 0]], "handR.rot": [[0, 0], [0.6, -8], [2.25, -7], [2.75, 0]],
    "armL.rot": [[0, D], [0.5, D + 6], [2.25, D + 5], [2.75, D]],
  } },
  worried: { dur: 2.8, face: "worried", keys: (() => {
    // ตัวห่อ แขนหุบเข้า มือกระดุกกระดิก เหลียวซ้ายขวา สั่นเบา ๆ
    const k = { "armL.rot": [[0, D], [0.6, D - 6, "soft"], [2.2, D - 6], [2.7, D]], "armR.rot": [[0, 0], [0.6, 6, "soft"], [2.2, 6], [2.7, 0]],
      "face.x": [[0, 0], [0.5, -14], [0.75, -14], [1.05, 12], [1.35, 12], [1.65, -10], [1.95, -10], [2.35, 0]],
      "head.rot": [[0, 0], [0.5, 2], [1.05, -2], [1.65, 1.5], [2.35, 0]],
      "root.sy": [[0, 1], [0.5, 0.97], [2.2, 0.97], [2.7, 1]], "hips.x": [[0, 0]], "handL.rot": [[0, 0]], "handR.rot": [[0, 0]] };
    for (let t = 0.4, i = 0; t < 2.1; t += 0.06, i++) k["hips.x"].push([t, i % 2 ? 1.6 : -1.6, "lin"]);
    for (let t = 0.5, i = 0; t < 2.1; t += 0.13, i++) { k["handL.rot"].push([t, i % 2 ? 6 : -6]); k["handR.rot"].push([t, i % 2 ? -6 : 6]); }
    k["hips.x"].push([2.2, 0]); k["handL.rot"].push([2.3, 0]); k["handR.rot"].push([2.3, 0]);
    return k;
  })() },
};
// เรียง key + แปลงเป็น channel list
for (const a of Object.values(ANIMS)) for (const ch in a.keys) a.keys[ch].sort((p, q) => p[0] - q[0]);
