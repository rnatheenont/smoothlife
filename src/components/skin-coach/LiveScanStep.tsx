"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { Camera, Check, ImageIcon, Loader2 } from "lucide-react";
import type { FaceLandmarker, NormalizedLandmark } from "@mediapipe/tasks-vision";
import { resizeForUpload, type ResizedImage } from "@/lib/image-utils";
import type { AngleKey } from "@/lib/skin-coach";
import { Button } from "@/components/ui";

// Live camera scan: MediaPipe's face landmarker follows the face in 3D, right
// on the phone, and the page takes each photo itself once the face is placed
// — straight on first, then each cheek as the head turns. Nothing leaves the
// device until the photos go for analysis, same as a picked photo would.
//
// What's drawn over the face is its outline, brows, eyes and lips in a thin
// line: enough to show the phone can see the face and where it's looking,
// without the scanner-grid look the redesign plan steers away from.

type Shots = Partial<Record<AngleKey, ResizedImage>>;
type Phase = "intro" | "loading" | "front" | "sideA" | "sideB" | "error";
type Connection = { start: number; end: number };

// Tuned for "easy" over "perfect": the analysis copes with a slightly turned
// or off-centre face far better than a person copes with a scan that won't
// fire. Anything stricter goes back to the photo picker's single tap.
const HOLD_MS = 1500; // steady this long before a photo is taken, counted down 3-2-1
const SETTLE_MS = 1800; // after each step starts: time to read it and get into place
const GRACE_MS = 250; // a wobble shorter than this doesn't restart the hold
const FRONT_YAW = 0.12; // how far off straight still counts as straight
const SIDE_YAW_MIN = 0.12; // turned enough to show a cheek
const SIDE_YAW_MAX = 0.65; // past this the far side of the face is lost
const MIN_WIDTH = 0.2; // cheek-to-cheek, as a share of the frame
const MAX_WIDTH = 0.85;
const MAX_ROLL = 14; // degrees of head tilt
const MAX_OFFCENTRE = 0.2;
const MIN_LIGHT = 45; // average brightness, 0–255
const MAX_LIGHT = 248;
const SMOOTH = 0.35; // share of each new reading in the running average

export function liveScanSupported() {
  return typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia);
}

// One landmarker per page load, shared by every visit to the step.
let landmarkerPromise: Promise<{ landmarker: FaceLandmarker; contours: Connection[] }> | null = null;
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
      return { landmarker, contours: FaceLandmarker.FACE_LANDMARKS_CONTOURS as Connection[] };
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

const STEPS: { phase: "front" | "sideA" | "sideB"; title: string; sub: string }[] = [
  { phase: "front", title: "มองตรงเข้ากล้อง", sub: "ระบบจะถ่ายให้เองเมื่อหน้าอยู่ในตำแหน่ง" },
  { phase: "sideA", title: "หันหน้าไปด้านข้างช้าๆ", sub: "ให้เห็นแก้มชัด แล้วค้างไว้" },
  { phase: "sideB", title: "ทีนี้หันไปอีกด้าน", sub: "ช้าๆ แล้วค้างไว้เหมือนเดิม" },
];

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
  const sideASignRef = useRef(0);
  // Once the scan has handed its photos on (or been abandoned), a capture
  // still finishing must not hand them on a second time.
  const finishedRef = useRef(false);

  const [phase, setPhase] = useState<Phase>("intro");
  const [hint, setHint] = useState("");
  const [shots, setShots] = useState<Shots>({});
  const [flash, setFlash] = useState(false);
  const [error, setError] = useState<string | null>(notice ?? null);
  const [holdPct, setHoldPct] = useState(0);
  const [faceSeen, setFaceSeen] = useState(false);
  // Set while the camera runs: takes the photo for the current step now,
  // whatever the checks say, as long as a face is in view.
  const shutterRef = useRef<(() => void) | null>(null);

  function go(next: Phase) {
    phaseRef.current = next;
    setPhase(next);
  }

  function stopCamera() {
    shutterRef.current = null;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  // Warm the model up while the intro is being read, so pressing start
  // mostly waits on the camera rather than a 4 MB download.
  useEffect(() => {
    // Skipped on data saver: the model and runtime are several megabytes.
    const saveData = (navigator as { connection?: { saveData?: boolean } }).connection?.saveData;
    const idle = saveData ? undefined : window.setTimeout(() => void loadLandmarker().catch(() => {}), 300);
    return () => {
      window.clearTimeout(idle);
      stopCamera();
    };
  }, []);

  function finish(final: Shots) {
    if (finishedRef.current) return;
    stopCamera();
    if (!final.front) {
      // Nothing usable to analyse: say so here rather than handing on nothing.
      setError("ยังไม่ได้รูปหน้าตรง ลองสแกนอีกครั้ง หรือถ่ายรูปเองแทน");
      go("error");
      return;
    }
    finishedRef.current = true;
    onComplete(final);
  }

  function abandon() {
    finishedRef.current = true;
    stopCamera();
    onUsePhoto();
  }

  async function start() {
    go("loading");
    setError(null);
    finishedRef.current = false;
    shotsRef.current = {};
    setShots({});
    try {
      // The stream is kept the moment it arrives, so if the model then fails
      // to load, stopCamera still has it to switch off.
      const streamPromise = navigator.mediaDevices
        .getUserMedia({ video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false })
        .then((stream) => {
          streamRef.current = stream;
          return stream;
        });
      const [stream, { landmarker, contours }] = await Promise.all([streamPromise, loadLandmarker()]);
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();
      go("front");
      run(landmarker, contours);
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

  function run(landmarker: FaceLandmarker, contours: Connection[]) {
    const video = videoRef.current!;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const probe = document.createElement("canvas");
    probe.width = 32;
    probe.height = 24;
    const probeCtx = probe.getContext("2d", { willReadFrequently: true })!;

    let lastTime = -1;
    let holdSince: number | null = null;
    let badSince: number | null = null;
    let capturing = false;
    let light = 128;
    let lastLightAt = 0;
    let lastHint = "";
    let lastPct = -1;
    let lastSeen = false;
    let avg: ReturnType<typeof geometry> | null = null;
    let latestLm: NormalizedLandmark[] | undefined;
    // No auto-capture until this time: a moment at the start of each step to
    // read what it asks and get into place.
    let settleUntil = performance.now() + SETTLE_MS;

    const say = (text: string) => {
      if (text !== lastHint) {
        lastHint = text;
        setHint(text);
      }
    };
    const showPct = (pct: number) => {
      const stepped = Math.round(pct / 10) * 10;
      if (stepped !== lastPct) {
        lastPct = stepped;
        setHoldPct(stepped);
      }
    };
    const showSeen = (seen: boolean) => {
      if (seen !== lastSeen) {
        lastSeen = seen;
        setFaceSeen(seen);
      }
    };

    const draw = (lm: NormalizedLandmark[] | undefined, ready: boolean) => {
      if (canvas.width !== video.videoWidth) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.lineWidth = Math.max(1.5, canvas.width / 360);
      ctx.lineCap = "round";
      if (!lm) {
        // Where to put the face, until there is one.
        ctx.setLineDash([canvas.width / 60, canvas.width / 60]);
        ctx.strokeStyle = "rgba(255,255,255,0.75)";
        ctx.beginPath();
        ctx.ellipse(canvas.width / 2, canvas.height / 2, canvas.width * 0.22, canvas.height * 0.34, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        return;
      }
      ctx.strokeStyle = ready ? "rgba(0,168,123,0.95)" : "rgba(255,255,255,0.8)";
      ctx.beginPath();
      for (const { start, end } of contours) {
        const p = lm[start];
        const q = lm[end];
        ctx.moveTo(p.x * canvas.width, p.y * canvas.height);
        ctx.lineTo(q.x * canvas.width, q.y * canvas.height);
      }
      ctx.stroke();
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
        say("ถ่ายไม่สำเร็จ ลองค้างไว้อีกครั้ง");
        return false;
      } finally {
        holdSince = null;
        badSince = null;
        avg = null;
        showPct(0);
        settleUntil = performance.now() + SETTLE_MS;
        capturing = false;
      }
    };

    // Straight on first, then whichever way they turn, then the other way.
    // The cheek is named by the turn: turning to their own left shows the
    // right cheek. A turn too small to tell which way (a manual shot) takes
    // whichever cheek is still missing.
    const takeStep = (phaseNow: Phase, yaw: number) => {
      const turned = Math.abs(yaw) >= 0.05;
      const missing: AngleKey = shotsRef.current.cheek ? "cheekRight" : "cheek";
      const sideKey: AngleKey = turned ? (yaw > 0 ? "cheekRight" : "cheek") : missing;
      const after = (next: () => void) => (ok: boolean) => {
        if (ok && !finishedRef.current) next();
      };
      if (phaseNow === "front") {
        void capture("front").then(after(() => go("sideA")));
      } else if (phaseNow === "sideA") {
        sideASignRef.current = turned ? Math.sign(yaw) : sideKey === "cheekRight" ? 1 : -1;
        void capture(sideKey).then(after(() => go("sideB")));
      } else if (phaseNow === "sideB") {
        const key = sideKey in shotsRef.current ? missing : sideKey;
        void capture(key).then(after(() => finish(shotsRef.current)));
      }
    };

    shutterRef.current = () => {
      if (capturing || !latestLm) return;
      takeStep(phaseRef.current, avg?.yaw ?? 0);
    };

    const tick = () => {
      rafRef.current = requestAnimationFrame(tick);
      const phaseNow = phaseRef.current;
      if (video.readyState < 2 || video.currentTime === lastTime || capturing) return;
      if (phaseNow !== "front" && phaseNow !== "sideA" && phaseNow !== "sideB") return;
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
      latestLm = lm;
      showSeen(Boolean(lm));

      if (now - lastLightAt > 400) {
        lastLightAt = now;
        probeCtx.drawImage(video, 0, 0, probe.width, probe.height);
        const px = probeCtx.getImageData(0, 0, probe.width, probe.height).data;
        let sum = 0;
        for (let i = 0; i < px.length; i += 4) sum += 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
        light = sum / (px.length / 4);
      }

      let problem: string | null = null;
      if (!lm) {
        problem = "มองไม่เห็นใบหน้า ขยับหน้าเข้ามาในกรอบ";
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
        if (light < MIN_LIGHT) problem = "มืดไป หาที่สว่างขึ้นอีกหน่อย";
        else if (light > MAX_LIGHT) problem = "แสงจ้าไป ขยับออกจากแสงตรงนิดหนึ่ง";
        else if (a.width < MIN_WIDTH) problem = "ขยับเข้าใกล้กล้องอีกนิด";
        else if (a.width > MAX_WIDTH) problem = "ถอยออกจากกล้องนิดหนึ่ง";
        else if (Math.abs(a.roll) > MAX_ROLL) problem = "ตั้งศีรษะให้ตรง ไม่เอียง";
        else if (phaseNow === "front") {
          if (Math.abs(a.cx - 0.5) > MAX_OFFCENTRE || Math.abs(a.cy - 0.5) > MAX_OFFCENTRE + 0.05) problem = "เลื่อนหน้ามาไว้กลางกรอบ";
          else if (Math.abs(a.yaw) > FRONT_YAW) problem = "หันหน้าตรงเข้ากล้อง";
        } else {
          const turn = Math.abs(a.yaw);
          const wrongWay = phaseNow === "sideB" && turn >= SIDE_YAW_MIN && Math.sign(a.yaw) === sideASignRef.current;
          if (wrongWay) problem = "หันไปอีกด้านหนึ่ง";
          else if (turn < SIDE_YAW_MIN) problem = phaseNow === "sideA" ? "หันหน้าไปด้านข้างอีกนิด" : "ทีนี้หันไปอีกด้าน";
          else if (turn > SIDE_YAW_MAX) problem = "หันกลับมานิดหนึ่ง";
        }
      }

      if (problem) {
        badSince ??= now;
        // Brief misses keep the hold going; a real one resets it.
        if (now - badSince > GRACE_MS || !lm) {
          holdSince = null;
          showPct(0);
          draw(lm, false);
          say(problem);
          return;
        }
      } else {
        badSince = null;
      }
      draw(lm, true);
      if (now < settleUntil) {
        // In place already, but give the step its moment before counting.
        holdSince = null;
        showPct(0);
        say("ดีแล้ว เตรียมค้างไว้…");
        return;
      }
      holdSince ??= now;
      const held = now - holdSince;
      say(`ค้างไว้ ถ่ายใน ${Math.max(1, Math.ceil((HOLD_MS - held) / 500))}…`);
      showPct(Math.min(100, (held / HOLD_MS) * 100));
      if (held < HOLD_MS) return;
      takeStep(phaseNow, avg!.yaw);
    };
    tick();
  }

  const stepIndex = STEPS.findIndex((s) => s.phase === phase);
  const current = stepIndex >= 0 ? STEPS[stepIndex] : null;
  const taken = Object.values(shots).filter(Boolean) as ResizedImage[];

  if (phase === "intro" || phase === "error") {
    return (
      <section>
        <h2 className="text-lg font-bold text-brand-ink md:text-xl">สแกนสดด้วยกล้องหน้า</h2>
        <p className="mt-1 text-sm text-slate-600">
          ใช้เวลาไม่ถึงนาที ระบบจะจับตำแหน่งใบหน้าแล้วนับถอยหลังถ่ายให้เอง 3 มุม หน้าตรงและแก้มสองข้าง
          การจับตำแหน่งทำในเครื่องของคุณ
        </p>
        <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-slate-600 marker:text-brand-800/50">
          <li>หันหน้าเข้าหาแสงสว่าง ไม่ย้อนแสง</li>
          <li>ถอดแว่น เปิดหน้าผาก</li>
          <li>ถือโทรศัพท์ระดับสายตา ห่างประมาณหนึ่งช่วงแขน</li>
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

  return (
    <section>
      <div aria-live="polite">
        <h2 className="text-lg font-bold text-brand-ink md:text-xl">
          {phase === "loading" ? "กำลังเปิดกล้อง…" : current?.title}
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          {phase === "loading" ? "ครั้งแรกอาจใช้เวลาสักครู่" : current?.sub}
        </p>
      </div>

      <div className="relative mx-auto mt-4 aspect-[3/4] w-full max-w-sm overflow-hidden rounded-xl2 bg-slate-900">
        {/* Mirrored so moving left moves left, as in a mirror. The photos
            themselves are taken from the un-mirrored frame. */}
        <video
          ref={videoRef}
          playsInline
          muted
          className="absolute inset-0 h-full w-full -scale-x-100 object-cover"
        />
        <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full -scale-x-100 object-cover" />
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
          <div className="absolute inset-x-3 top-3 overflow-hidden rounded-full bg-black/60 text-center text-sm font-semibold text-white">
            <p className="px-4 py-2">{hint}</p>
            {/* Fills while the face is held in place, so the shot never
                comes as a surprise. */}
            <span
              aria-hidden="true"
              className="absolute bottom-0 left-0 h-0.5 bg-brand-action transition-[width] duration-100"
              style={{ width: `${holdPct}%` }}
            />
          </div>
        )}
        {phase !== "loading" && (
          <button
            type="button"
            onClick={() => shutterRef.current?.()}
            disabled={!faceSeen}
            aria-label="ถ่ายเลย"
            className="absolute bottom-4 left-1/2 grid h-16 w-16 -translate-x-1/2 place-items-center rounded-full border-4 border-white/90 bg-white/25 backdrop-blur transition-opacity disabled:opacity-40"
          >
            <span className="h-11 w-11 rounded-full bg-white" />
          </button>
        )}
      </div>
      <p className="mx-auto mt-2 max-w-sm text-center text-xs text-slate-600">
        ระบบถ่ายให้เองเมื่อพร้อม หรือกดปุ่มกลมเพื่อถ่ายเลย
      </p>

      <ol className="mx-auto mt-4 flex max-w-sm justify-between gap-2" aria-label="มุมที่ถ่าย">
        {STEPS.map((s, i) => {
          const done = i < taken.length;
          return (
            <li key={s.phase} className="flex flex-1 items-center gap-2">
              <span
                className={clsx(
                  "relative h-11 w-11 shrink-0 overflow-hidden rounded-lg",
                  done ? "ring-2 ring-brand-action" : "bg-surface-mist",
                  i === stepIndex && !done && "ring-2 ring-brand-800"
                )}
              >
                {done && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={taken[i].dataUrl} alt="" width={44} height={44} className="h-full w-full object-cover" />
                )}
                {done && (
                  <span className="absolute bottom-0 right-0 grid h-4 w-4 place-items-center rounded-tl bg-brand-action text-white">
                    <Check size={11} aria-hidden="true" />
                  </span>
                )}
              </span>
              <span className={clsx("text-xs", done ? "font-semibold text-brand-800" : "text-slate-600")}>
                {i === 0 ? "หน้าตรง" : `แก้ม ${i}`}
              </span>
            </li>
          );
        })}
      </ol>

      <div className="mt-4 flex justify-center gap-5 text-sm">
        {(phase === "sideA" || phase === "sideB") && (
          <button type="button" onClick={() => finish(shotsRef.current)} className="text-slate-600 hover:text-brand-ink">
            พอแล้ว ใช้ {taken.length} มุมที่ถ่ายไว้
          </button>
        )}
        <button
          type="button"
          onClick={abandon}
          className="text-slate-600 hover:text-brand-ink"
        >
          ถ่ายหรือเลือกรูปเองแทน
        </button>
      </div>
    </section>
  );
}
