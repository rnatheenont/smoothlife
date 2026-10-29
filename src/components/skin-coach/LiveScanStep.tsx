"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import Image from "next/image";
import { Camera, Check, ImageIcon, Loader2, RotateCcw } from "lucide-react";
import { CameraIcon, ArrowRightIcon, ImageIcon as PictureIcon, LockIcon } from "./icons";
import { SCAN_STEPS } from "./Stepper";
import type { FaceLandmarker, NormalizedLandmark } from "@mediapipe/tasks-vision";
import { resizeForUpload, type ResizedImage } from "@/lib/image-utils";
import type { AngleKey } from "@/lib/skin-coach";
import { Button } from "@/components/ui";

// Live camera scan: MediaPipe's face landmarker follows the face in 3D, right
// on the phone. The outline turns green when the face is placed for the
// current shot — straight on, then each cheek as the head turns — and only
// then does the shutter work; the person takes each photo themselves, and can
// retake any of them before sending. Nothing leaves the device until the
// photos go for analysis, same as a picked photo would.
//
// What's drawn (owner's reference): the camera inside a circle with a glowing
// ring and the rest dimmed, and over the face a fine mesh that follows its
// shape. Points are smoothed across frames so the mesh holds still, and
// "ready" fades it from white to a soft-glowing mint.

type Shots = Partial<Record<AngleKey, ResizedImage>>;
type Phase = "intro" | "loading" | "front" | "side" | "review" | "error";

// Tuned for "easy" over "perfect": the analysis copes with a slightly turned
// or off-centre face far better than a person copes with a shutter that
// won't unlock.
const STEADY_MS = 250; // placed this long before the mesh goes green
const GRACE_MS = 300; // a wobble shorter than this doesn't turn it white again
const FRONT_YAW = 0.12; // how far off straight still counts as straight
const SIDE_YAW_MIN = 0.12; // turned enough to show a cheek
const SIDE_YAW_MAX = 0.65; // past this the far side of the face is lost
// The circle the face goes in, as shares of the camera box (3:4).
const CIRCLE_X = 0.5;
const CIRCLE_Y = 0.45;
const CIRCLE_R = 0.42; // of the box width
const MIN_WIDTH = 0.3; // cheek-to-cheek, as a share of the box width
const MAX_WIDTH = 0.62; // wider and the forehead or chin leaves the circle
const MAX_ROLL = 14; // degrees of head tilt
const MAX_OFFCENTRE = 0.12; // face centre from the circle centre, as a share of the box
// Brightness of the face itself (0–255), not the whole frame: a bright face
// against a dark room read as "too dark" before, and a dim face against a
// window read as fine — and dim photos are the ones that score differently
// from one shot to the next.
const MIN_LIGHT = 60;
// One side of the face this much darker than the other (as a share of the
// brighter side) gets a tip to face the light. Advice only — it never stops
// the shutter.
const UNEVEN_LIGHT = 0.35;
const MAX_LIGHT = 248;
const SMOOTH = 0.35; // share of each new reading in the running average

export function liveScanSupported() {
  return typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia);
}

// One landmarker per page load, shared by every visit to the step.
type Mesh = { start: number; end: number }[];
let landmarkerPromise: Promise<{ landmarker: FaceLandmarker; mesh: Mesh }> | null = null;
function loadLandmarker() {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const { FaceLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
      const fileset = await FilesetResolver.forVisionTasks("/mediapipe/wasm");
      const options = (delegate: "GPU" | "CPU") => ({
        baseOptions: { modelAssetPath: "/models/face_landmarker.task", delegate },
        runningMode: "VIDEO" as const,
        numFaces: 1,
      });
      let landmarker: FaceLandmarker;
      try {
        landmarker = await FaceLandmarker.createFromOptions(fileset, options("GPU"));
      } catch {
        // Some phones refuse the GPU path; the CPU one is slower but works.
        landmarker = await FaceLandmarker.createFromOptions(fileset, options("CPU"));
      }
      return { landmarker, mesh: FaceLandmarker.FACE_LANDMARKS_TESSELATION as Mesh };
    })().catch((err) => {
      landmarkerPromise = null;
      throw err;
    });
  }
  return landmarkerPromise;
}

/**
 * Where the face is and which way it's pointing, from the landmarks. Up/down
 * tilt is deliberately not judged: a straight-on photo only needs the face
 * turned neither left nor right nor tipped sideways, and a strict pitch gate
 * mostly stops people who hold the phone a little low.
 */
function geometry(lm: NormalizedLandmark[], aspect: number) {
  // 1 nose tip, 234 / 454 the two sides of the face, 10 top of forehead, 152 chin.
  const nose = lm[1];
  const a = lm[234];
  const b = lm[454];
  // Landmarks are normalised per axis, so on a non-square frame a unit of y
  // isn't a unit of x; `aspect` (height / width) puts both in widths.
  const dx = b.x - a.x;
  const dy = (b.y - a.y) * aspect;
  const width = Math.hypot(dx, dy);
  // Signed: positive means the nose has swung toward landmark 454 — the
  // person turned to their own left, showing their right cheek. Independent
  // of whether the preview is mirrored.
  // The nose's offset from the face's midpoint, measured along the
  // cheek-to-cheek line rather than the screen's x-axis — so a head that is
  // tipped a little doesn't read as turned, which made "look straight at the
  // camera" impossible to satisfy for anyone holding their head at an angle.
  const nx = nose.x - (a.x + b.x) / 2;
  const ny = (nose.y - (a.y + b.y) / 2) * aspect;
  const yaw = (nx * dx + ny * dy) / (dx * dx + dy * dy || 1e-6);
  let roll = (Math.atan2(dy, dx) * 180) / Math.PI;
  if (Math.abs(roll) > 90) roll -= 180 * Math.sign(roll);
  return { width, yaw, roll, cx: (a.x + b.x) / 2, cy: (lm[10].y + lm[152].y) / 2 };
}

const SHOT_LABEL: Record<"front" | "cheek" | "cheekRight", string> = {
  front: "หน้าตรง",
  cheek: "แก้มซ้าย",
  cheekRight: "แก้มขวา",
};
const SHOT_ORDER = ["front", "cheek", "cheekRight"] as const;
type ShotKey = (typeof SHOT_ORDER)[number];

export default function LiveScanStep({
  notice,
  onComplete,
  onUsePhoto,
}: {
  /** Why they're back here — e.g. the last photos didn't show a face clearly. */
  notice?: string | null;
  onComplete: (shots: Shots) => void;
  onUsePhoto: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const phaseRef = useRef<Phase>("intro");
  const shotsRef = useRef<Shots>({});
  // Which way the current side shot must face: 0 either way (the first
  // cheek), +1 the right cheek, -1 the left cheek.
  const sideTargetRef = useRef(0);
  // Set while redoing one photo from the review: after it, back to review.
  const retakingRef = useRef(false);
  // Once the scan has handed its photos on (or been abandoned), a capture
  // still finishing must not hand them on a second time.
  const finishedRef = useRef(false);
  // Set while the camera runs: takes the photo for the current step — only
  // when the face is placed (the outline is green).
  const shutterRef = useRef<(() => void) | null>(null);

  const [phase, setPhase] = useState<Phase>("intro");
  const [sideTarget, setSideTarget] = useState(0);
  const [retaking, setRetaking] = useState(false);
  const [hint, setHint] = useState("");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [shots, setShots] = useState<Shots>({});
  const [flash, setFlash] = useState(false);
  const [error, setError] = useState<string | null>(notice ?? null);

  function go(next: Phase) {
    phaseRef.current = next;
    setPhase(next);
  }

  function aimSide(target: number) {
    sideTargetRef.current = target;
    setSideTarget(target);
  }

  function stopCamera() {
    shutterRef.current = null;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  // Warm the model up while the intro is being read, so pressing start
  // mostly waits on the camera rather than a download. Skipped on data saver.
  useEffect(() => {
    const saveData = (navigator as { connection?: { saveData?: boolean } }).connection?.saveData;
    const idle = saveData ? undefined : window.setTimeout(() => void loadLandmarker().catch(() => {}), 300);
    return () => {
      window.clearTimeout(idle);
      stopCamera();
    };
  }, []);

  function finish() {
    if (finishedRef.current) return;
    const final = shotsRef.current;
    if (!final.front) {
      setError("ยังไม่ได้รูปหน้าตรง ลองสแกนอีกครั้ง หรือถ่ายรูปเองแทน");
      stopCamera();
      go("error");
      return;
    }
    finishedRef.current = true;
    stopCamera();
    onComplete(final);
  }

  function abandon() {
    finishedRef.current = true;
    stopCamera();
    onUsePhoto();
  }

  /** Redo one photo from the review screen. */
  function retake(key: ShotKey) {
    retakingRef.current = true;
    setRetaking(true);
    if (key === "front") {
      go("front");
    } else {
      aimSide(key === "cheekRight" ? 1 : -1);
      go("side");
    }
    void videoRef.current?.play().catch(() => {});
  }

  async function start() {
    go("loading");
    setError(null);
    finishedRef.current = false;
    retakingRef.current = false;
    setRetaking(false);
    shotsRef.current = {};
    setShots({});
    aimSide(0);
    try {
      // The stream is kept the moment it arrives, so if the model then fails
      // to load, stopCamera still has it to switch off.
      const streamPromise = navigator.mediaDevices
        .getUserMedia({ video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false })
        .then((stream) => {
          streamRef.current = stream;
          return stream;
        });
      const [stream, { landmarker, mesh }] = await Promise.all([streamPromise, loadLandmarker()]);
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();
      go("front");
      run(landmarker, mesh);
    } catch (err) {
      stopCamera();
      const name = (err as { name?: string })?.name;
      setError(
        name === "NotAllowedError"
          ? "ยังไม่ได้อนุญาตให้ใช้กล้อง กดอนุญาตในหน้าต่างที่เด้งขึ้น หรือเปิดสิทธิ์กล้องให้เว็บนี้ในการตั้งค่าเบราว์เซอร์"
          : name === "NotFoundError"
          ? "ไม่พบกล้องหน้าในเครื่องนี้"
          : "เปิดสแกนสดไม่สำเร็จในเครื่องนี้ ถ่ายหรือเลือกรูปเองแทนได้เลย"
      );
      go("error");
    }
  }

  function run(landmarker: FaceLandmarker, mesh: Mesh) {
    const video = videoRef.current!;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const probe = document.createElement("canvas");
    probe.width = 64;
    probe.height = 48;
    const probeCtx = probe.getContext("2d", { willReadFrequently: true })!;

    let lastTime = -1;
    let goodSince: number | null = null;
    let badSince: number | null = null;
    let isReady = false;
    let capturing = false;
    let light = 128;
    let uneven = false;
    let lastLightAt = 0;
    let lastHint = "";
    let avg: ReturnType<typeof geometry> | null = null;

    const say = (text: string) => {
      if (text !== lastHint) {
        lastHint = text;
        setHint(text);
      }
    };
    const markReady = (value: boolean) => {
      if (value !== isReady) {
        isReady = value;
        setReady(value);
      }
    };

    // The video is cropped to cover its 3:4 box, so a share of the video frame
    // isn't a share of what's on screen. This maps between the two.
    const boxMap = () => {
      const W = video.videoWidth || 1;
      const H = video.videoHeight || 1;
      const box = canvas.getBoundingClientRect();
      const bw = box.width || W;
      const bh = box.height || H;
      const scale = Math.max(bw / W, bh / H);
      return { W, H, bw, bh, scale, ox: (bw - W * scale) / 2, oy: (bh - H * scale) / 2 };
    };

    // Smoothed landmark positions (x, y per point), so the line doesn't shimmer.
    let smooth: Float32Array | null = null;
    // 0 = white, 1 = mint; eased toward the target each frame.
    let tone = 0;
    let lastDrawAt = 0;

    const draw = (lm: NormalizedLandmark[] | undefined, green: boolean) => {
      if (canvas.width !== video.videoWidth) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }
      const W = canvas.width;
      const H = canvas.height;
      const now = performance.now();
      const dt = lastDrawAt ? Math.min(100, now - lastDrawAt) : 16;
      lastDrawAt = now;
      // Canvas pixels per CSS pixel on screen, so line widths read the same on
      // every phone.
      const map = boxMap();
      const px = 1 / map.scale;
      ctx.clearRect(0, 0, W, H);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      if (!lm) {
        smooth = null;
        tone = 0;
        return; // the circle on screen shows where the face goes
      }

      if (!smooth || smooth.length !== lm.length * 2) {
        smooth = new Float32Array(lm.length * 2);
        lm.forEach((p, i) => {
          smooth![i * 2] = p.x * W;
          smooth![i * 2 + 1] = p.y * H;
        });
      } else {
        const k = 0.55;
        for (let i = 0; i < lm.length; i++) {
          smooth[i * 2] += k * (lm[i].x * W - smooth[i * 2]);
          smooth[i * 2 + 1] += k * (lm[i].y * H - smooth[i * 2 + 1]);
        }
      }
      const pts = smooth;

      tone += ((green ? 1 : 0) - tone) * Math.min(1, dt / 160);

      // White (255,255,255) to mint (52,211,153).
      const mix = (from: number, to: number) => Math.round(from + (to - from) * tone);
      const rgb = `${mix(255, 52)},${mix(255, 211)},${mix(255, 153)}`;

      const x = (i: number) => pts[i * 2];
      const y = (i: number) => pts[i * 2 + 1];

      // Fine mesh over the whole face, kept inside the circle.
      ctx.save();
      ctx.beginPath();
      ctx.arc(
        (CIRCLE_X * map.bw - map.ox) / map.scale,
        (CIRCLE_Y * map.bh - map.oy) / map.scale,
        (CIRCLE_R * map.bw) / map.scale,
        0,
        Math.PI * 2
      );
      ctx.clip();
      ctx.beginPath();
      for (const { start, end } of mesh) {
        ctx.moveTo(x(start), y(start));
        ctx.lineTo(x(end), y(end));
      }
      // Hairline: the mesh should read as a fine net over the skin, not cover it.
      ctx.lineWidth = 0.35 * px;
      ctx.strokeStyle = `rgba(${rgb},${0.5 + 0.15 * tone})`;
      ctx.shadowColor = `rgba(52,211,153,${0.35 * tone})`;
      ctx.shadowBlur = 2 * px * tone;
      ctx.stroke();
      ctx.restore();
    };

    const grabFrame = async (): Promise<Blob | null> => {
      const frame = document.createElement("canvas");
      frame.width = video.videoWidth;
      frame.height = video.videoHeight;
      frame.getContext("2d")!.drawImage(video, 0, 0); // un-mirrored: the real face, as the model should see it
      const blob = await new Promise<Blob | null>((resolve) => frame.toBlob(resolve, "image/jpeg", 0.92));
      if (blob) return blob;
      // Some browsers hand back null under memory pressure; the data URL route
      // usually still works.
      try {
        return await (await fetch(frame.toDataURL("image/jpeg", 0.92))).blob();
      } catch {
        return null;
      }
    };

    /** Takes the photo for `key`. False (and a message) if it couldn't. */
    const capture = async (key: AngleKey): Promise<boolean> => {
      capturing = true;
      setBusy(true);
      setFlash(true);
      window.setTimeout(() => setFlash(false), 180);
      try {
        const blob = await grabFrame();
        if (!blob) throw new Error("no frame");
        const image = await resizeForUpload(blob);
        shotsRef.current = { ...shotsRef.current, [key]: image };
        setShots(shotsRef.current);
        return true;
      } catch {
        say("ถ่ายไม่สำเร็จ ลองกดอีกครั้ง");
        return false;
      } finally {
        goodSince = null;
        badSince = null;
        avg = null;
        markReady(false);
        capturing = false;
        setBusy(false);
      }
    };

    // What comes after a photo: straight on, then whichever cheek they turn
    // to first, then the other; a retake goes straight back to the review.
    const advance = (took: AngleKey) => {
      if (finishedRef.current) return;
      if (retakingRef.current) {
        retakingRef.current = false;
        setRetaking(false);
        go("review");
        return;
      }
      if (took === "front") {
        aimSide(0);
        go("side");
        return;
      }
      const other: AngleKey = took === "cheek" ? "cheekRight" : "cheek";
      if (!shotsRef.current[other]) {
        aimSide(other === "cheekRight" ? 1 : -1);
        go("side");
      } else {
        go("review");
      }
    };

    shutterRef.current = () => {
      if (capturing || !isReady) return;
      const phaseNow = phaseRef.current;
      const key: AngleKey =
        phaseNow === "front" ? "front" : (avg?.yaw ?? 0) > 0 ? "cheekRight" : "cheek";
      void capture(key).then((ok) => ok && advance(key));
    };

    const tick = () => {
      rafRef.current = requestAnimationFrame(tick);
      const phaseNow = phaseRef.current;
      if (video.readyState < 2 || video.currentTime === lastTime || capturing) return;
      if (phaseNow !== "front" && phaseNow !== "side") return;
      lastTime = video.currentTime;

      const now = performance.now();
      let lm: NormalizedLandmark[] | undefined;
      try {
        lm = landmarker.detectForVideo(video, now).faceLandmarks?.[0];
      } catch {
        // A tracker that throws once will throw every frame: stop and offer photos.
        stopCamera();
        setError("การสแกนสดขัดข้องในเครื่องนี้ ถ่ายหรือเลือกรูปเองแทนได้เลย");
        go("error");
        return;
      }

      if (now - lastLightAt > 400) {
        lastLightAt = now;
        const PW = probe.width;
        const PH = probe.height;
        probeCtx.drawImage(video, 0, 0, PW, PH);
        const px = probeCtx.getImageData(0, 0, PW, PH).data;
        const luma = (i: number) => 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
        // The face box from its sides, forehead and chin; the whole frame
        // when there is no face yet.
        const box = lm
          ? {
              x0: Math.floor(Math.min(lm[234].x, lm[454].x) * PW),
              x1: Math.ceil(Math.max(lm[234].x, lm[454].x) * PW),
              y0: Math.floor(lm[10].y * PH),
              y1: Math.ceil(lm[152].y * PH),
            }
          : { x0: 0, x1: PW, y0: 0, y1: PH };
        const x0 = Math.max(0, box.x0), x1 = Math.min(PW, box.x1);
        const y0 = Math.max(0, box.y0), y1 = Math.min(PH, box.y1);
        const mid = (x0 + x1) / 2;
        let sum = 0, n = 0, left = 0, nl = 0, right = 0, nr = 0;
        for (let y = y0; y < y1; y++) {
          for (let x = x0; x < x1; x++) {
            const v = luma((y * PW + x) * 4);
            sum += v;
            n++;
            if (x < mid) (left += v), nl++;
            else (right += v), nr++;
          }
        }
        if (n > 0) light = sum / n;
        const l = nl ? left / nl : 0;
        const r = nr ? right / nr : 0;
        uneven = Boolean(lm) && Math.max(l, r) > 0 && Math.abs(l - r) / Math.max(l, r) > UNEVEN_LIGHT;
      }

      let problem: string | null = null;
      if (!lm) {
        problem = "มองไม่เห็นใบหน้า ขยับหน้าเข้ามาในวงกลม";
        avg = null;
      } else {
        // A running average, so the jitter of a hand-held phone doesn't flip
        // the checks on and off from one frame to the next.
        const g = geometry(lm, video.videoHeight / (video.videoWidth || 1));
        avg = avg
          ? {
              width: avg.width + SMOOTH * (g.width - avg.width),
              yaw: avg.yaw + SMOOTH * (g.yaw - avg.yaw),
              roll: avg.roll + SMOOTH * (g.roll - avg.roll),
              cx: avg.cx + SMOOTH * (g.cx - avg.cx),
              cy: avg.cy + SMOOTH * (g.cy - avg.cy),
            }
          : g;
        const a = avg;
        // Size and position as they look on screen, against the circle.
        const m = boxMap();
        const boxWidth = (a.width * m.W * m.scale) / m.bw;
        const boxX = (a.cx * m.W * m.scale + m.ox) / m.bw;
        const boxY = (a.cy * m.H * m.scale + m.oy) / m.bh;
        if (light < MIN_LIGHT) problem = "มืดไป หาที่สว่างขึ้นอีกหน่อย";
        else if (light > MAX_LIGHT) problem = "แสงจ้าไป ขยับออกจากแสงตรงนิดหนึ่ง";
        else if (boxWidth < MIN_WIDTH) problem = "ขยับเข้าใกล้กล้องอีกนิด";
        else if (boxWidth > MAX_WIDTH) problem = "ถอยออกจากกล้องนิดหนึ่ง";
        else if (Math.abs(a.roll) > MAX_ROLL) problem = "ตั้งศีรษะให้ตรง ไม่เอียง";
        else if (phaseNow === "front") {
          if (Math.abs(boxX - CIRCLE_X) > MAX_OFFCENTRE || Math.abs(boxY - CIRCLE_Y) > MAX_OFFCENTRE) problem = "เลื่อนหน้ามาไว้กลางวงกลม";
          else if (Math.abs(a.yaw) > FRONT_YAW) problem = "หันหน้าตรงเข้ากล้อง";
        } else {
          const target = sideTargetRef.current;
          const turn = Math.abs(a.yaw);
          const facing = Math.sign(a.yaw);
          const wantLabel = target > 0 ? "แก้มขวา" : "แก้มซ้าย";
          if (turn < SIDE_YAW_MIN) problem = target === 0 ? "หันหน้าไปด้านข้างช้าๆ ให้เห็นแก้ม" : `หันให้เห็น${wantLabel}อีกนิด`;
          else if (target !== 0 && facing !== target) problem = `หันไปอีกด้าน ให้เห็น${wantLabel}`;
          else if (turn > SIDE_YAW_MAX) problem = "หันกลับมานิดหนึ่ง";
        }
      }

      if (problem) {
        goodSince = null;
        badSince ??= now;
        // Brief misses keep it green; a real one turns it back to white.
        if (!isReady || now - badSince > GRACE_MS || !lm) {
          markReady(false);
          draw(lm, false);
          say(problem);
          return;
        }
        draw(lm, true);
        return;
      }
      badSince = null;
      goodSince ??= now;
      const green = now - goodSince >= STEADY_MS;
      markReady(green);
      draw(lm, green);
      say(
        green
          ? uneven
            ? "พร้อมแล้ว กดถ่ายได้ · แสงสองข้างหน้าไม่เท่ากัน หันเข้าหาแสงจะแม่นขึ้น"
            : "พร้อมแล้ว กดปุ่มถ่ายได้เลย"
          : "ค้างไว้แบบนี้…"
      );
    };
    tick();
  }

  const taken = SHOT_ORDER.filter((k) => shots[k]);

  // The opening card, laid out to TOP's mockup.
  //
  // The phone is a CSS frame around a cut-out portrait, not a screenshot of
  // one — the kit's README asks for it that way, and it means the brackets,
  // the shutter and the bezel stay sharp on any screen and can be restyled
  // without going back to a design tool.
  //
  // The step chip and the four-segment bar are inside the card, as in the
  // artwork, and they are the page's real stepper rather than a drawing of
  // one: this is step one of ถ่ายรูป → เพิ่มมุม → คำถาม → ผลลัพธ์.
  //
  // The four tips that used to be a bulleted list are still all four, but
  // only the one that actually ruins a scan — the light — is said beside the
  // phone. The rest sit under the buttons: nobody reads a checklist before
  // pressing a button they have already decided to press, and the scan
  // coaches the framing live once it is open.
  if (phase === "intro" || phase === "error") {
    return (
      // A little room above it — the hero's sky runs to the window's edges,
      // so a card flush against it reads as a second band stuck to the
      // first. Only a little: three separate paddings were stacking here
      // (the sky's own, the page's top, and this margin) and together they
      // left a gap wider than the card's own padding.
      <section className="mt-3.5 rounded-[22px] bg-[linear-gradient(135deg,#f2faf7_0%,#ffffff_52%,#edf7fc_100%)] p-3 shadow-product md:mt-6 md:p-7">
        {/* Two columns at every width, phone left, because that is what the
            artwork does — and the artwork is a phone screen, so this is not
            a desktop arrangement being forced onto a small one. Stacking it
            below md was my own addition and it pushed the buttons a screen
            and a half down. */}
        <div className="flex flex-row items-center gap-3 md:gap-8">
          {/* 34% of the card's inside, which lands on 0.29 of the page —
              measured off the artwork, where the phone is 249px wide on an
              851px canvas. */}
          <div className="relative w-[34%] max-w-[190px] shrink-0">
            {/* Beside the phone where there is room, above it where there is
                not: on a 375px screen a note floated over the phone's corner
                lands on the face it is telling you how to photograph. */}
            <p className="mb-1 flex items-end gap-0.5 text-[10px] font-bold leading-tight text-brand-800 md:absolute md:-left-8 md:top-5 md:z-10 md:mb-0 md:max-w-[6.5rem] md:-rotate-6 md:text-[11px]">
              ถ่ายหน้าตรงในที่แสงสว่าง
              <svg viewBox="0 0 40 30" aria-hidden className="h-5 w-8 shrink-0 text-brand-teal md:mt-0.5">
                <path d="M2 2c10 2 18 9 24 20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                <path d="M20 22l7 1 -2-7" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </p>

            {/* The phone. A rounded black shell, a notch, and the screen. */}
            {/* 1.93 tall for its width: 249 x 478 on the artwork's 851px
                canvas, measured off the pixels rather than guessed. An
                earlier pass put it at 1.63 on an eyeballed reading of the
                same picture and made the phone visibly squat — the right
                answer was always to keep it tall and make it narrower. */}
            <div className="relative aspect-[249/478] w-full rounded-[22px] bg-[#1b1f24] p-[4px] shadow-[0_14px_26px_-14px_rgba(16,35,28,0.45)] md:rounded-[26px] md:p-[5px]">
              <div className="relative h-full w-full overflow-hidden rounded-[18px] bg-[linear-gradient(180deg,#fbfdfd_0%,#eef8f5_100%)] md:rounded-[22px]">
                <span aria-hidden className="absolute left-1/2 top-1.5 z-20 h-1.5 w-12 -translate-x-1/2 rounded-full bg-[#1b1f24]/85" />
                <Image
                  src="/skin-coach/scan-woman.webp"
                  alt="ตัวอย่างหน้าจอตอนสแกน"
                  width={560}
                  height={672}
                  sizes="(max-width: 768px) 30vw, 190px"
                  // The bottom three quarters of the screen, filled and
                  // cropped. Two attempts either side of this: at her own
                  // proportions she is 183x219 in a 391-tall screen and the
                  // top half is empty, and filling the whole screen crops
                  // her to a pair of eyes, because the screen is twice as
                  // tall as she is wide. Three quarters of the height is a
                  // mild side crop — face and a little shoulder, with room
                  // above, which is where the artwork has her.
                  // Scaled so the face sits inside the brackets rather than
                  // under them: the frame is inset 15% / 20%, and at 82% of
                  // the screen height her head came out well short of it.
                  //
                  // Sized by height with the width left to follow, centred
                  // by transform. Giving it inset-x and a width at the same
                  // time over-constrained the box and the picture vanished
                  // altogether.
                  // Bigger than the screen and hanging below it, so the
                  // face fills the frame rather than sitting inside it with
                  // room to spare. The overflow is neck and shoulders, which
                  // the screen clips; her head stays whole.
                  className="absolute bottom-[-5%] left-1/2 h-[105%] w-auto max-w-none -translate-x-1/2 object-cover object-top"
                />
                {/* The four corner brackets. Four corners, each two borders.
                    This was one bordered box clipped to its corners with a
                    twenty-four-point polygon, which is cleverer and drew a
                    cross: the percentages in a clip-path are of the box, so
                    the arms came out at different lengths horizontally and
                    vertically and the short sides met in the middle. */}
                <span aria-hidden className="pointer-events-none absolute inset-x-[15%] inset-y-[20%]">
                  <i className="absolute left-0 top-0 size-6 rounded-tl-[5px] border-l-[2.5px] border-t-[2.5px] border-white" />
                  <i className="absolute right-0 top-0 size-6 rounded-tr-[5px] border-r-[2.5px] border-t-[2.5px] border-white" />
                  <i className="absolute bottom-0 left-0 size-6 rounded-bl-[5px] border-b-[2.5px] border-l-[2.5px] border-white" />
                  <i className="absolute bottom-0 right-0 size-6 rounded-br-[5px] border-b-[2.5px] border-r-[2.5px] border-white" />
                </span>
                <span
                  aria-hidden
                  className="absolute bottom-[7%] left-1/2 grid size-11 -translate-x-1/2 place-items-center rounded-full bg-[#bfe9dc]/85 text-brand-800 backdrop-blur-sm"
                >
                  <CameraIcon size={20} />
                </span>
              </div>
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <p className="inline-flex rounded-full bg-white px-3 py-1 text-[11px] font-bold text-brand-ink shadow-product">
              ขั้นตอนที่ 1 จาก {SCAN_STEPS.length}
            </p>
            <ol className="mt-2 grid grid-cols-4 gap-1.5" aria-hidden>
              {SCAN_STEPS.map((label, i) => (
                <li key={label} className={clsx("h-1.5 rounded-full", i === 0 ? "bg-brand-action" : "bg-surface-line")} />
              ))}
            </ol>

            <h2 className="mt-2.5 text-[17px] font-bold text-brand-ink md:text-2xl">สแกนหน้าด้วยกล้อง</h2>
            <p className="mt-1.5 text-[12.5px] leading-snug text-slate-500 md:text-[15px] md:leading-relaxed">
              ถ่าย 3 มุม หน้าตรงและแก้มสองข้าง เมื่อพร้อมแล้วกดถ่ายเอง หรือให้คนอื่นถ่ายให้ก็ได้
            </p>

            {error && (
              <p role="alert" className="mt-4 rounded-lg bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800">
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={start}
              // 13px and a tighter gutter below md. The artwork is drawn at
              // roughly twice a phone's width, so its text column is 460px
              // and these labels sit on one line; the same proportions on a
              // real 390px phone leave 188px, and at 15px both buttons broke
              // into two lines. Shrinking the type keeps the arrangement the
              // artwork has, which is what was asked for, rather than moving
              // the buttons somewhere it does not put them.
              className="group mt-3 flex min-h-11 w-full items-center justify-center gap-1.5 rounded-full bg-brand-gradient px-3 text-[13px] font-bold text-white shadow-product transition-[filter] hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-800 focus-visible:ring-offset-2 md:mt-5 md:min-h-13 md:gap-2.5 md:px-6 md:text-[15px]"
            >
              <CameraIcon size={16} className="shrink-0 md:hidden" />
              <CameraIcon size={19} className="hidden shrink-0 md:block" />
              <span className="whitespace-nowrap">
                {phase === "error" ? "ลองเปิดกล้องอีกครั้ง" : "เริ่มสแกนผิว"}
              </span>
              <span className="grid size-5 shrink-0 place-items-center rounded-full bg-white/25 transition-transform group-hover:translate-x-0.5 md:size-6">
                <ArrowRightIcon size={13} />
              </span>
            </button>

            <button
              type="button"
              onClick={abandon}
              className="mt-1.5 flex min-h-11 w-full items-center justify-center gap-1.5 rounded-full border border-surface-line bg-white px-3 text-[13px] font-bold text-brand-ink transition-colors hover:border-brand-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-800 focus-visible:ring-offset-2 md:mt-2.5 md:min-h-13 md:gap-2.5 md:px-6 md:text-[15px]"
            >
              <PictureIcon size={16} className="shrink-0 md:hidden" />
              <PictureIcon size={18} className="hidden shrink-0 md:block" />
              <span className="whitespace-nowrap">อัปโหลดรูปจากแกลเลอรี</span>
            </button>

            <p className="mt-2 flex items-center justify-center gap-1.5 text-[10.5px] text-slate-400">
              <span className="shrink-0">
                <LockIcon size={12} />
              </span>
              รูปของคุณจะถูกเก็บเป็นความลับ
            </p>
          </div>
        </div>
      </section>
    );
  }

  const title =
    phase === "loading"
      ? "กำลังเปิดกล้อง…"
      : phase === "review"
      ? "ตรวจรูปก่อนส่ง"
      : phase === "front"
      ? retaking
        ? "ถ่ายหน้าตรงใหม่"
        : "มองตรงเข้ากล้อง"
      : sideTarget === 0
      ? "หันหน้าไปด้านข้างช้าๆ"
      : retaking
      ? `ถ่าย${sideTarget > 0 ? "แก้มขวา" : "แก้มซ้าย"}ใหม่`
      : "ทีนี้หันไปอีกด้าน";
  const sub =
    phase === "loading"
      ? "ครั้งแรกอาจใช้เวลาสักครู่"
      : phase === "review"
      ? "รูปไหนยังไม่ชัด กดถ่ายใหม่ได้ ถ้าโอเคแล้วกดใช้รูปเหล่านี้"
      : "รอให้เส้นรอบหน้าเป็นสีเขียว แล้วกดปุ่มกลมเพื่อถ่าย";

  return (
    <section>
      <div aria-live="polite">
        <h2 className="text-lg font-bold text-brand-ink md:text-xl">{title}</h2>
        <p className="mt-1 text-sm text-slate-600">{sub}</p>
      </div>

      {/* The camera stays mounted through the review so a retake is instant. */}
      <div
        className={clsx(
          "relative mx-auto mt-4 aspect-3/4 w-full max-w-sm overflow-hidden rounded-xl2 bg-slate-900",
          phase === "review" && "hidden"
        )}
      >
        {/* Mirrored so moving left moves left, as in a mirror. The photos
            themselves are taken from the un-mirrored frame. */}
        <video ref={videoRef} playsInline muted className="absolute inset-0 h-full w-full -scale-x-100 object-cover" />
        <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full -scale-x-100 object-cover" />
        {/* The circle the face goes in: the rest of the picture dimmed, a
            glowing ring — white-blue while placing, mint once ready. */}
        {phase !== "loading" && (
          <svg viewBox="0 0 300 400" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
            <path
              fillRule="evenodd"
              fill="rgba(2,6,23,0.62)"
              d={`M0 0H300V400H0Z M${300 * CIRCLE_X - 300 * CIRCLE_R} ${400 * CIRCLE_Y}a${300 * CIRCLE_R} ${300 * CIRCLE_R} 0 1 0 ${600 * CIRCLE_R} 0a${300 * CIRCLE_R} ${300 * CIRCLE_R} 0 1 0 ${-600 * CIRCLE_R} 0Z`}
            />
            <circle
              cx={300 * CIRCLE_X}
              cy={400 * CIRCLE_Y}
              r={300 * CIRCLE_R}
              fill="none"
              strokeWidth="2.5"
              className="transition-[stroke,filter] duration-200"
              stroke={ready ? "#34D399" : "rgba(235,248,255,0.95)"}
              style={{
                filter: ready
                  ? "drop-shadow(0 0 5px rgba(52,211,153,0.9))"
                  : "drop-shadow(0 0 5px rgba(125,211,252,0.85))",
              }}
            />
          </svg>
        )}
        <div
          aria-hidden="true"
          className={clsx("pointer-events-none absolute inset-0 bg-white transition-opacity duration-150", flash ? "opacity-70" : "opacity-0")}
        />
        {phase === "loading" && (
          <div className="absolute inset-0 grid place-items-center">
            <Loader2 size={28} className="animate-spin text-white" aria-hidden="true" />
          </div>
        )}
        {hint && phase !== "loading" && (
          <p
            className={clsx(
              "absolute inset-x-4 top-3 text-balance text-center text-[15px] font-semibold tracking-wide [text-shadow:0_1px_4px_rgba(0,0,0,0.7)]",
              ready ? "text-emerald-300" : "text-white"
            )}
          >
            {hint}
          </p>
        )}
        {phase !== "loading" && (
          <button
            type="button"
            onClick={() => shutterRef.current?.()}
            disabled={!ready || busy}
            aria-label={ready ? "ถ่ายรูป" : "ถ่ายรูป (รอเส้นสีเขียวก่อน)"}
            className={clsx(
              "absolute bottom-4 left-1/2 grid h-18 w-18 -translate-x-1/2 place-items-center rounded-full border-4 transition-colors",
              ready && !busy ? "border-brand-action bg-white/30" : "border-white/60 bg-white/10"
            )}
          >
            <span className={clsx("h-12 w-12 rounded-full transition-colors", ready && !busy ? "bg-white" : "bg-white/40")} />
          </button>
        )}
      </div>

      {phase === "review" ? (
        <div className="mx-auto mt-4 max-w-sm">
          <ul className="grid grid-cols-3 gap-3">
            {SHOT_ORDER.map((key) => {
              const shot = shots[key];
              return (
                <li key={key} className="flex flex-col items-center gap-1.5">
                  <span className="relative block aspect-3/4 w-full overflow-hidden rounded-xl bg-surface-mist">
                    {shot && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={shot.dataUrl} alt={SHOT_LABEL[key]} className="h-full w-full object-cover" />
                    )}
                  </span>
                  <span className="text-xs font-semibold text-brand-ink">{SHOT_LABEL[key]}</span>
                  <button
                    type="button"
                    onClick={() => retake(key)}
                    className="flex items-center gap-1 rounded-full border border-surface-line px-3 py-1.5 text-xs font-semibold text-brand-800 hover:bg-surface-mist"
                  >
                    <RotateCcw size={12} aria-hidden="true" /> {shot ? "ถ่ายใหม่" : "ถ่าย"}
                  </button>
                </li>
              );
            })}
          </ul>
          <Button size="lg" fullWidth className="mt-5" onClick={finish} disabled={!shots.front}>
            ใช้รูปเหล่านี้ ({taken.length} มุม)
          </Button>
        </div>
      ) : (
        <ol className="mx-auto mt-4 flex max-w-sm justify-between gap-2" aria-label="มุมที่ถ่าย">
          {SHOT_ORDER.map((key) => {
            const shot = shots[key];
            return (
              <li key={key} className="flex flex-1 items-center gap-2">
                <span className={clsx("relative h-11 w-11 shrink-0 overflow-hidden rounded-lg", shot ? "ring-2 ring-brand-action" : "bg-surface-mist")}>
                  {shot && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={shot.dataUrl} alt="" width={44} height={44} className="h-full w-full object-cover" />
                  )}
                  {shot && (
                    <span className="absolute bottom-0 right-0 grid h-4 w-4 place-items-center rounded-tl bg-brand-action text-white">
                      <Check size={11} aria-hidden="true" />
                    </span>
                  )}
                </span>
                <span className={clsx("text-xs", shot ? "font-semibold text-brand-800" : "text-slate-600")}>{SHOT_LABEL[key]}</span>
              </li>
            );
          })}
        </ol>
      )}

      {phase !== "review" && phase !== "loading" && (
        <div className="mt-4 flex justify-center gap-5 text-sm">
          {shots.front && (
            <button type="button" onClick={() => go("review")} className="text-slate-600 hover:text-brand-ink">
              ดูรูปที่ถ่ายแล้ว ({taken.length} มุม)
            </button>
          )}
          <button type="button" onClick={abandon} className="text-slate-600 hover:text-brand-ink">
            ถ่ายหรือเลือกรูปเองแทน
          </button>
        </div>
      )}
    </section>
  );
}
