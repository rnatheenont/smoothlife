"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { Camera, Check, ImageIcon, Loader2, RotateCcw } from "lucide-react";
import type { FaceLandmarker, NormalizedLandmark } from "@mediapipe/tasks-vision";
import { resizeForUpload, type ResizedImage } from "@/lib/image-utils";
import type { AngleKey } from "@/lib/skin-coach";
import { Button } from "@/components/ui";

// Live camera scan, in the style of a phone's face enrolment (owner's call):
// the camera shows through an oval, ringed with tick marks. The person looks
// straight in and the front photo is taken by itself once the face sits in the
// oval; then they turn their head slowly in a circle, and the ticks on the
// side they're facing turn green until the ring is complete. Along the way the
// cheek photos are taken automatically at a moment the head is turned and
// steady. A review follows, where any photo can be taken again.
//
// MediaPipe's face landmarker does the tracking on the phone; nothing leaves
// the device until the photos go for analysis, same as a picked photo would.

type Shots = Partial<Record<AngleKey, ResizedImage>>;
type Phase = "intro" | "loading" | "front" | "circle" | "side" | "review" | "error";

// Tuned for "easy" over "perfect": the analysis copes with a slightly turned
// or off-centre face far better than a person copes with a scan that won't
// finish.
const FRONT_STEADY_MS = 500; // placed this long before the front photo is taken
const SIDE_STEADY_MS = 220; // turned and still this long before a cheek photo
const FRONT_YAW = 0.12; // how far off straight still counts as straight
const SIDE_YAW_MIN = 0.15; // turned enough to show a cheek
const SIDE_YAW_MAX = 0.6; // past this the far side of the face is lost
const SIDE_MAX_SPEED = 0.9; // yaw change per second; faster than this blurs
const MIN_WIDTH = 0.2; // cheek-to-cheek, as a share of the frame
const MAX_WIDTH = 0.85;
const MAX_ROLL = 14; // degrees of head tilt
const MAX_OFFCENTRE = 0.2;
const MIN_LIGHT = 45; // average brightness, 0–255
const MAX_LIGHT = 248;
const SMOOTH = 0.35; // share of each new reading in the running average

// The ring: how far the head has to turn for a direction to count, measured
// from where it was when the front photo was taken.
const TICKS = 90;
const YAW_REACH = 0.2;
const PITCH_REACH = 0.06;
const REACH = 0.55; // share of the reach that lights a tick
const SPREAD = 2; // ticks lit either side of the heading
const RING_DONE = 0.9; // share of ticks that completes the ring

// Oval geometry in the overlay's own units (a 3:4 box).
const VB_W = 300;
const VB_H = 400;
const OX = 150;
const OY = 182;
const RX = 105;
const RY = 140;

export function liveScanSupported() {
  return typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia);
}

// One landmarker per page load, shared by every visit to the step.
let landmarkerPromise: Promise<FaceLandmarker> | null = null;
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
      try {
        return await FaceLandmarker.createFromOptions(fileset, options("GPU"));
      } catch {
        // Some phones refuse the GPU path; the CPU one is slower but works.
        return await FaceLandmarker.createFromOptions(fileset, options("CPU"));
      }
    })().catch((err) => {
      landmarkerPromise = null;
      throw err;
    });
  }
  return landmarkerPromise;
}

/**
 * Where the face is and which way it's pointing, from the landmarks. Yaw and
 * pitch are the nose tip's offset from the face's middle, measured along the
 * face's own cheek-to-cheek and forehead-to-chin lines — so a tipped head
 * doesn't read as turned. Both carry a personal offset (how someone holds the
 * phone), which is why the ring measures from a baseline.
 */
function geometry(lm: NormalizedLandmark[], aspect: number) {
  // 1 nose tip, 234 / 454 the two sides of the face, 10 top of forehead, 152 chin.
  const nose = lm[1];
  const a = lm[234];
  const b = lm[454];
  const top = lm[10];
  const chin = lm[152];
  // Landmarks are normalised per axis, so on a non-square frame a unit of y
  // isn't a unit of x; `aspect` (height / width) puts both in widths.
  const dx = b.x - a.x;
  const dy = (b.y - a.y) * aspect;
  const width = Math.hypot(dx, dy);
  // Positive: the nose has swung toward landmark 454 — the person turned to
  // their own left, showing their right cheek.
  const nx = nose.x - (a.x + b.x) / 2;
  const ny = (nose.y - (a.y + b.y) / 2) * aspect;
  const yaw = (nx * dx + ny * dy) / (dx * dx + dy * dy || 1e-6);
  // Positive: the nose has moved toward the chin — looking down.
  const vx = chin.x - top.x;
  const vy = (chin.y - top.y) * aspect;
  const mx = nose.x - (top.x + chin.x) / 2;
  const my = (nose.y - (top.y + chin.y) / 2) * aspect;
  const pitch = (mx * vx + my * vy) / (vx * vx + vy * vy || 1e-6);
  let roll = (Math.atan2(dy, dx) * 180) / Math.PI;
  if (Math.abs(roll) > 90) roll -= 180 * Math.sign(roll);
  return { width, yaw, pitch, roll, cx: (a.x + b.x) / 2, cy: (top.y + chin.y) / 2 };
}
type Geo = ReturnType<typeof geometry>;

const SHOT_LABEL: Record<"front" | "cheek" | "cheekRight", string> = {
  front: "หน้าตรง",
  cheek: "แก้มซ้าย",
  cheekRight: "แก้มขวา",
};
const SHOT_ORDER = ["front", "cheek", "cheekRight"] as const;
type ShotKey = (typeof SHOT_ORDER)[number];

// Tick marks around the oval, radiating outward; index 0 points right and
// they run clockwise on screen.
const TICK_LINES = Array.from({ length: TICKS }, (_, i) => {
  const t = (i / TICKS) * Math.PI * 2;
  const px = OX + RX * Math.cos(t);
  const py = OY + RY * Math.sin(t);
  // Outward normal of the ellipse at this point.
  const nxv = Math.cos(t) / RX;
  const nyv = Math.sin(t) / RY;
  const len = Math.hypot(nxv, nyv);
  const ux = nxv / len;
  const uy = nyv / len;
  return { x1: px + ux * 8, y1: py + uy * 8, x2: px + ux * 22, y2: py + uy * 22 };
});

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
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const phaseRef = useRef<Phase>("intro");
  const shotsRef = useRef<Shots>({});
  // Which cheek a retake is for: +1 right, -1 left.
  const sideTargetRef = useRef(1);
  // Set while redoing one photo from the review: after it, back to review.
  const retakingRef = useRef(false);
  // Once the scan has handed its photos on (or been abandoned), a capture
  // still finishing must not hand them on a second time.
  const finishedRef = useRef(false);
  const ticksRef = useRef<Uint8Array>(new Uint8Array(TICKS));

  const [phase, setPhase] = useState<Phase>("intro");
  const [sideTarget, setSideTarget] = useState(1);
  const [hint, setHint] = useState("");
  const [ticks, setTicks] = useState<boolean[]>(() => Array(TICKS).fill(false));
  const [shots, setShots] = useState<Shots>({});
  const [flash, setFlash] = useState(false);
  const [error, setError] = useState<string | null>(notice ?? null);

  function go(next: Phase) {
    phaseRef.current = next;
    setPhase(next);
  }

  function resetRing() {
    ticksRef.current = new Uint8Array(TICKS);
    setTicks(Array(TICKS).fill(false));
  }

  function stopCamera() {
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
    if (key === "front") {
      go("front");
    } else {
      const target = key === "cheekRight" ? 1 : -1;
      sideTargetRef.current = target;
      setSideTarget(target);
      go("side");
    }
    void videoRef.current?.play().catch(() => {});
  }

  /** Start the whole scan again from the review screen. */
  function rescan() {
    retakingRef.current = false;
    shotsRef.current = {};
    setShots({});
    resetRing();
    go("front");
    void videoRef.current?.play().catch(() => {});
  }

  async function start() {
    go("loading");
    setError(null);
    finishedRef.current = false;
    retakingRef.current = false;
    shotsRef.current = {};
    setShots({});
    resetRing();
    try {
      // The stream is kept the moment it arrives, so if the model then fails
      // to load, stopCamera still has it to switch off.
      const streamPromise = navigator.mediaDevices
        .getUserMedia({ video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false })
        .then((stream) => {
          streamRef.current = stream;
          return stream;
        });
      const [stream, landmarker] = await Promise.all([streamPromise, loadLandmarker()]);
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();
      go("front");
      run(landmarker);
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

  function run(landmarker: FaceLandmarker) {
    const video = videoRef.current!;
    const probe = document.createElement("canvas");
    probe.width = 32;
    probe.height = 24;
    const probeCtx = probe.getContext("2d", { willReadFrequently: true })!;

    let lastTime = -1;
    let frontSince: number | null = null;
    let sideSince: number | null = null;
    let capturing = false;
    let light = 128;
    let lastLightAt = 0;
    let lastHint = "";
    let avg: Geo | null = null;
    let lastYaw: { yaw: number; at: number } | null = null;
    let speed = 0;
    // Head direction when the front photo was taken.
    let base = { yaw: 0, pitch: 0 };
    let lastHeading: number | null = null;
    // Set when the ring completes, to hold the full green ring on screen a moment.
    let ringFinished = false;
    let seenPhase: Phase | null = null;

    const say = (text: string) => {
      if (text !== lastHint) {
        lastHint = text;
        setHint(text);
      }
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

    /** Takes the photo for `key`. False if it couldn't. */
    const capture = async (key: AngleKey): Promise<boolean> => {
      capturing = true;
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
        return false;
      } finally {
        frontSince = null;
        sideSince = null;
        capturing = false;
      }
    };

    const toReview = () => {
      if (finishedRef.current) return;
      retakingRef.current = false;
      go("review");
    };

    /** Lights the ticks the head is pointing at; true when the ring is done. */
    const fillRing = (g: Geo) => {
      // Mirrored preview: turning to one's own left moves toward the screen's left.
      const x = -(g.yaw - base.yaw) / YAW_REACH;
      const y = (g.pitch - base.pitch) / PITCH_REACH;
      if (Math.hypot(x, y) < REACH) {
        lastHeading = null;
        return false;
      }
      const heading = ((Math.atan2(y, x) / (Math.PI * 2)) * TICKS + TICKS) % TICKS;
      const ring = ticksRef.current;
      let changed = false;
      const light1 = (i: number) => {
        const k = ((Math.round(i) % TICKS) + TICKS) % TICKS;
        if (!ring[k]) {
          ring[k] = 1;
          changed = true;
        }
      };
      // Fill the gap from the last heading too, so a quick sweep still counts.
      let from = heading;
      if (lastHeading !== null) {
        let d = heading - lastHeading;
        if (d > TICKS / 2) d -= TICKS;
        if (d < -TICKS / 2) d += TICKS;
        if (Math.abs(d) <= TICKS / 6) from = heading - d;
      }
      const lo = Math.min(from, heading) - SPREAD;
      const hi = Math.max(from, heading) + SPREAD;
      for (let i = lo; i <= hi; i++) light1(i);
      lastHeading = heading;
      if (changed) setTicks(Array.from(ring, Boolean));
      return ring.reduce((n, v) => n + v, 0) >= TICKS * RING_DONE;
    };

    const tick = () => {
      rafRef.current = requestAnimationFrame(tick);
      const phaseNow = phaseRef.current;
      if (video.readyState < 2 || video.currentTime === lastTime || capturing) return;
      if (phaseNow !== "front" && phaseNow !== "circle" && phaseNow !== "side") {
        seenPhase = null;
        return;
      }
      if (phaseNow !== seenPhase) {
        // A new step (or a rescan/retake from the review): start its checks fresh.
        seenPhase = phaseNow;
        frontSince = null;
        sideSince = null;
        lastHeading = null;
        ringFinished = false;
      }
      if (ringFinished) return;
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
        probeCtx.drawImage(video, 0, 0, probe.width, probe.height);
        const px = probeCtx.getImageData(0, 0, probe.width, probe.height).data;
        let sum = 0;
        for (let i = 0; i < px.length; i += 4) sum += 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
        light = sum / (px.length / 4);
      }

      if (!lm) {
        avg = null;
        lastYaw = null;
        lastHeading = null;
        frontSince = null;
        sideSince = null;
        say("มองไม่เห็นใบหน้า ขยับหน้าเข้ามาในวงรี");
        return;
      }

      // A running average, so the jitter of a hand-held phone doesn't flip
      // the checks on and off from one frame to the next.
      const g = geometry(lm, video.videoHeight / (video.videoWidth || 1));
      avg = avg
        ? {
            width: avg.width + SMOOTH * (g.width - avg.width),
            yaw: avg.yaw + SMOOTH * (g.yaw - avg.yaw),
            pitch: avg.pitch + SMOOTH * (g.pitch - avg.pitch),
            roll: avg.roll + SMOOTH * (g.roll - avg.roll),
            cx: avg.cx + SMOOTH * (g.cx - avg.cx),
            cy: avg.cy + SMOOTH * (g.cy - avg.cy),
          }
        : g;
      const a = avg;
      if (lastYaw) {
        const dt = (now - lastYaw.at) / 1000;
        if (dt > 0) speed = speed + 0.5 * (Math.abs(a.yaw - lastYaw.yaw) / dt - speed);
      }
      lastYaw = { yaw: a.yaw, at: now };

      let problem: string | null = null;
      if (light < MIN_LIGHT) problem = "มืดไป หาที่สว่างขึ้นอีกหน่อย";
      else if (light > MAX_LIGHT) problem = "แสงจ้าไป ขยับออกจากแสงตรงนิดหนึ่ง";
      else if (a.width < MIN_WIDTH) problem = "ขยับเข้าใกล้กล้องอีกนิด";
      else if (a.width > MAX_WIDTH) problem = "ถอยออกจากกล้องนิดหนึ่ง";

      if (phaseNow === "front") {
        if (!problem) {
          if (Math.abs(a.roll) > MAX_ROLL) problem = "ตั้งศีรษะให้ตรง ไม่เอียง";
          else if (Math.abs(a.cx - 0.5) > MAX_OFFCENTRE || Math.abs(a.cy - 0.5) > MAX_OFFCENTRE + 0.05)
            problem = "เลื่อนหน้ามาไว้กลางวงรี";
          else if (Math.abs(a.yaw) > FRONT_YAW) problem = "หันหน้าตรงเข้ากล้อง";
        }
        if (problem) {
          frontSince = null;
          say(problem);
          return;
        }
        frontSince ??= now;
        say("ดีมาก ค้างไว้แบบนี้…");
        if (now - frontSince < FRONT_STEADY_MS) return;
        const snapshot = { yaw: a.yaw, pitch: a.pitch };
        void capture("front").then((ok) => {
          if (!ok) return say("ถ่ายไม่สำเร็จ ลองมองตรงอีกครั้ง");
          base = snapshot;
          if (retakingRef.current) return toReview();
          lastHeading = null;
          go("circle");
          say("ค่อยๆ หมุนศีรษะเป็นวงกลม ให้ขีดรอบวงเป็นสีเขียวจนครบ");
        });
        return;
      }

      if (problem) {
        sideSince = null;
        say(problem);
        return;
      }

      // Cheek photos: whenever the head is turned far enough, level, upright
      // and moving slowly, take the cheek it shows if it isn't taken yet.
      const turn = Math.abs(a.yaw - base.yaw);
      const facing: 1 | -1 = a.yaw - base.yaw > 0 ? 1 : -1;
      const cheekKey: AngleKey = facing > 0 ? "cheekRight" : "cheek";
      const wantKey: AngleKey | null =
        phaseNow === "side" ? (sideTargetRef.current > 0 ? "cheekRight" : "cheek") : shotsRef.current[cheekKey] ? null : cheekKey;
      const sideOk =
        wantKey === cheekKey &&
        turn >= SIDE_YAW_MIN &&
        turn <= SIDE_YAW_MAX &&
        Math.abs(a.pitch - base.pitch) < PITCH_REACH &&
        Math.abs(a.roll) <= MAX_ROLL &&
        speed < SIDE_MAX_SPEED;
      if (sideOk) sideSince ??= now;
      else sideSince = null;

      if (phaseNow === "side") {
        const label = sideTargetRef.current > 0 ? "แก้มขวา" : "แก้มซ้าย";
        if (sideOk) say("ค้างไว้แบบนี้…");
        else if (turn < SIDE_YAW_MIN || facing !== sideTargetRef.current) say(`หันให้เห็น${label} แล้วค้างไว้`);
        else if (turn > SIDE_YAW_MAX) say("หันกลับมานิดหนึ่ง");
        else say("ค้างไว้นิ่งๆ ครู่หนึ่ง");
      }

      if (sideOk && wantKey && now - (sideSince ?? now) >= SIDE_STEADY_MS) {
        void capture(wantKey).then((ok) => {
          if (ok && phaseRef.current === "side") toReview();
        });
        return;
      }

      if (phaseNow !== "circle") return;
      const ringDone = fillRing(a);
      if (!ringDone) {
        say("ค่อยๆ หมุนศีรษะเป็นวงกลม ให้ขีดรอบวงเป็นสีเขียวจนครบ");
        return;
      }
      const missing = (["cheek", "cheekRight"] as const).find((k) => !shotsRef.current[k]);
      if (missing) {
        say(`เกือบเสร็จแล้ว หันให้เห็น${SHOT_LABEL[missing]}ช้าๆ แล้วค้างไว้`);
        return;
      }
      say("ครบแล้ว");
      ringFinished = true;
      window.setTimeout(toReview, 500);
    };
    tick();
  }

  const taken = SHOT_ORDER.filter((k) => shots[k]);
  const lit = ticks.reduce((n, v) => n + (v ? 1 : 0), 0);

  if (phase === "intro" || phase === "error") {
    return (
      <section>
        <h2 className="text-lg font-bold text-brand-ink md:text-xl">สแกนสดด้วยกล้องหน้า</h2>
        <p className="mt-1 text-sm text-slate-600">
          มองตรงเข้ากล้องแล้วค่อยๆ หมุนศีรษะเป็นวงกลม ระบบจะถ่ายหน้าตรงและแก้มสองข้างให้อัตโนมัติ ตรวจและถ่ายใหม่ได้ก่อนส่ง
          การจับตำแหน่งใบหน้าทำในเครื่องของคุณ
        </p>
        <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-slate-600 marker:text-brand-800/50">
          <li>หันหน้าเข้าหาแสงสว่าง ไม่ย้อนแสง</li>
          <li>ถอดแว่น เปิดหน้าผาก</li>
          <li>ถือโทรศัพท์นิ่งๆ ระดับสายตา ห่างประมาณหนึ่งช่วงแขน แล้วขยับแค่ศีรษะ</li>
        </ul>
        {error && (
          <p role="alert" className="mt-4 rounded-lg bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800">
            {error}
          </p>
        )}
        <div className="mt-5 flex flex-col gap-2.5">
          <Button size="lg" onClick={start}>
            <Camera size={17} aria-hidden="true" /> {phase === "error" ? "ลองเปิดกล้องอีกครั้ง" : "เริ่มสแกนสด"}
          </Button>
          <Button size="lg" variant="secondary" onClick={abandon}>
            <ImageIcon size={17} aria-hidden="true" /> ถ่ายหรือเลือกรูปเองแทน
          </Button>
        </div>
      </section>
    );
  }

  const sideLabel = sideTarget > 0 ? "แก้มขวา" : "แก้มซ้าย";
  const title =
    phase === "loading"
      ? "กำลังเปิดกล้อง…"
      : phase === "review"
      ? "ตรวจรูปก่อนส่ง"
      : phase === "front"
      ? "มองตรงเข้ากล้อง"
      : phase === "side"
      ? `ถ่าย${sideLabel}ใหม่`
      : "หมุนศีรษะช้าๆ ให้ครบวง";
  const sub =
    phase === "loading"
      ? "ครั้งแรกอาจใช้เวลาสักครู่"
      : phase === "review"
      ? "รูปไหนยังไม่ชัด กดถ่ายใหม่ได้ ถ้าโอเคแล้วกดใช้รูปเหล่านี้"
      : phase === "front"
      ? "ให้ใบหน้าอยู่ในวงรี ระบบจะถ่ายให้เอง"
      : phase === "side"
      ? `หันให้เห็น${sideLabel} แล้วค้างไว้ ระบบจะถ่ายให้เอง`
      : "ระบบเก็บรูปแก้มสองข้างให้ระหว่างหมุน";
  const ringGreen = phase === "circle" || phase === "side";

  return (
    <section>
      <div aria-live="polite">
        <h2 className="text-lg font-bold text-brand-ink md:text-xl">{title}</h2>
        <p className="mt-1 text-sm text-slate-600">{sub}</p>
      </div>

      {/* The camera stays mounted through the review so a retake is instant. */}
      <div
        className={clsx(
          "relative mx-auto mt-4 aspect-[3/4] w-full max-w-sm overflow-hidden rounded-xl2 bg-slate-950",
          phase === "review" && "hidden"
        )}
      >
        {/* Mirrored so moving left moves left, as in a mirror. The photos
            themselves are taken from the un-mirrored frame. */}
        <video ref={videoRef} playsInline muted className="absolute inset-0 h-full w-full -scale-x-100 object-cover" />
        <svg
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          preserveAspectRatio="xMidYMid slice"
          className="pointer-events-none absolute inset-0 h-full w-full"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            fill="rgba(2,6,23,0.72)"
            d={`M0 0H${VB_W}V${VB_H}H0Z M${OX - RX} ${OY}a${RX} ${RY} 0 1 0 ${RX * 2} 0a${RX} ${RY} 0 1 0 ${-RX * 2} 0Z`}
          />
          <ellipse
            cx={OX}
            cy={OY}
            rx={RX}
            ry={RY}
            fill="none"
            stroke={flash ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.18)"}
            strokeWidth="1.5"
          />
          {TICK_LINES.map((l, i) => (
            <line
              key={i}
              {...l}
              strokeLinecap="round"
              strokeWidth="2.4"
              className="motion-safe:transition-[stroke] motion-safe:duration-200"
              stroke={ringGreen && ticks[i] ? "#34D27B" : "rgba(255,255,255,0.55)"}
            />
          ))}
        </svg>
        <div
          aria-hidden="true"
          className={clsx("pointer-events-none absolute inset-0 bg-white transition-opacity duration-150", flash ? "opacity-40" : "opacity-0")}
        />
        {phase === "loading" && (
          <div className="absolute inset-0 grid place-items-center">
            <Loader2 size={28} className="animate-spin text-white" aria-hidden="true" />
          </div>
        )}
        {hint && phase !== "loading" && (
          <p className="absolute inset-x-5 bottom-4 text-balance text-center text-[15px] font-semibold leading-snug text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.6)]">
            {hint}
          </p>
        )}
        {phase === "circle" && (
          <span className="sr-only" aria-live="polite">
            {`ครบ ${Math.round((lit / TICKS) * 100)} เปอร์เซ็นต์`}
          </span>
        )}
      </div>

      {phase === "review" ? (
        <div className="mx-auto mt-4 max-w-sm">
          <ul className="grid grid-cols-3 gap-3">
            {SHOT_ORDER.map((key) => {
              const shot = shots[key];
              return (
                <li key={key} className="flex flex-col items-center gap-1.5">
                  <span className="relative block aspect-[3/4] w-full overflow-hidden rounded-xl bg-surface-mist">
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
          <button type="button" onClick={rescan} className="mx-auto mt-3 block text-sm text-slate-600 hover:text-brand-ink">
            สแกนใหม่ทั้งหมด
          </button>
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
