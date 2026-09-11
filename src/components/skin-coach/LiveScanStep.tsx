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

const HOLD_MS = 700; // steady this long before a photo is taken
const FRONT_YAW = 0.08; // how far off straight still counts as straight
const SIDE_YAW_MIN = 0.17; // turned enough to show a cheek
const SIDE_YAW_MAX = 0.42; // past this the far side of the face is lost
const MIN_WIDTH = 0.28; // cheek-to-cheek, as a share of the frame
const MAX_WIDTH = 0.72;
const MIN_LIGHT = 55; // average brightness, 0–255
const MAX_LIGHT = 245;

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
function geometry(lm: NormalizedLandmark[]) {
  // 1 nose tip, 234 / 454 the two sides of the face, 10 top of forehead, 152 chin.
  const nose = lm[1];
  const a = lm[234];
  const b = lm[454];
  const dx = b.x - a.x;
  const width = Math.hypot(dx, b.y - a.y);
  // Signed: positive means the nose has swung toward landmark 454 — the
  // person turned to their own left, showing their right cheek. Independent
  // of whether the preview is mirrored.
  const yaw = (nose.x - (a.x + b.x) / 2) / (dx || 1e-6);
  let roll = (Math.atan2(b.y - a.y, dx) * 180) / Math.PI;
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

  const [phase, setPhase] = useState<Phase>("intro");
  const [hint, setHint] = useState("");
  const [shots, setShots] = useState<Shots>({});
  const [flash, setFlash] = useState(false);
  const [error, setError] = useState<string | null>(notice ?? null);

  function go(next: Phase) {
    phaseRef.current = next;
    setPhase(next);
  }

  function stopCamera() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  // Warm the model up while the intro is being read, so pressing start
  // mostly waits on the camera rather than a 4 MB download.
  useEffect(() => {
    const idle = window.setTimeout(() => void loadLandmarker().catch(() => {}), 300);
    return () => {
      window.clearTimeout(idle);
      stopCamera();
    };
  }, []);

  function finish(final: Shots) {
    stopCamera();
    onComplete(final);
  }

  async function start() {
    go("loading");
    setError(null);
    try {
      const [stream, { landmarker, contours }] = await Promise.all([
        navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 960 } },
          audio: false,
        }),
        loadLandmarker(),
      ]);
      streamRef.current = stream;
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
    let capturing = false;
    let light = 128;
    let lastLightAt = 0;
    let lastHint = "";

    const say = (text: string) => {
      if (text !== lastHint) {
        lastHint = text;
        setHint(text);
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

    const capture = async (key: AngleKey) => {
      capturing = true;
      setFlash(true);
      window.setTimeout(() => setFlash(false), 180);
      const frame = document.createElement("canvas");
      frame.width = video.videoWidth;
      frame.height = video.videoHeight;
      frame.getContext("2d")!.drawImage(video, 0, 0); // un-mirrored: the real face, as the model should see it
      const blob = await new Promise<Blob | null>((resolve) => frame.toBlob(resolve, "image/jpeg", 0.92));
      if (blob) {
        const image = await resizeForUpload(blob);
        shotsRef.current = { ...shotsRef.current, [key]: image };
        setShots(shotsRef.current);
      }
      holdSince = null;
      capturing = false;
    };

    const tick = () => {
      rafRef.current = requestAnimationFrame(tick);
      const phaseNow = phaseRef.current;
      if (video.readyState < 2 || video.currentTime === lastTime || capturing) return;
      if (phaseNow !== "front" && phaseNow !== "sideA" && phaseNow !== "sideB") return;
      lastTime = video.currentTime;

      const now = performance.now();
      const result = landmarker.detectForVideo(video, now);
      const lm = result.faceLandmarks?.[0];

      if (now - lastLightAt > 400) {
        lastLightAt = now;
        probeCtx.drawImage(video, 0, 0, probe.width, probe.height);
        const px = probeCtx.getImageData(0, 0, probe.width, probe.height).data;
        let sum = 0;
        for (let i = 0; i < px.length; i += 4) sum += 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
        light = sum / (px.length / 4);
      }

      let problem: string | null = null;
      let g: ReturnType<typeof geometry> | null = null;
      if (!lm) problem = "มองไม่เห็นใบหน้า ขยับหน้าเข้ามาในกรอบ";
      else {
        g = geometry(lm);
        if (light < MIN_LIGHT) problem = "มืดไป หาที่สว่างขึ้นอีกหน่อย";
        else if (light > MAX_LIGHT) problem = "แสงจ้าไป ขยับออกจากแสงตรงนิดหนึ่ง";
        else if (g.width < MIN_WIDTH) problem = "ขยับเข้าใกล้กล้องอีกนิด";
        else if (g.width > MAX_WIDTH) problem = "ถอยออกจากกล้องนิดหนึ่ง";
        else if (Math.abs(g.roll) > 9) problem = "ตั้งศีรษะให้ตรง ไม่เอียง";
        else if (phaseNow === "front") {
          if (Math.abs(g.cx - 0.5) > 0.13 || Math.abs(g.cy - 0.5) > 0.16) problem = "เลื่อนหน้ามาไว้กลางกรอบ";
          else if (Math.abs(g.yaw) > FRONT_YAW) problem = "หันหน้าตรงเข้ากล้อง";
        } else {
          const turn = Math.abs(g.yaw);
          const wrongWay = phaseNow === "sideB" && Math.sign(g.yaw) === sideASignRef.current;
          if (wrongWay) problem = "หันไปอีกด้านหนึ่ง";
          else if (turn < SIDE_YAW_MIN) problem = phaseNow === "sideA" ? "หันหน้าไปด้านข้างช้าๆ" : "ทีนี้หันไปอีกด้านช้าๆ";
          else if (turn > SIDE_YAW_MAX) problem = "หันกลับมานิดหนึ่ง";
        }
      }

      const ready = !problem;
      draw(lm, ready);
      if (!ready) {
        holdSince = null;
        say(problem!);
        return;
      }
      holdSince ??= now;
      say("ค้างไว้แบบนี้…");
      if (now - holdSince < HOLD_MS) return;

      // Straight on first, then whichever way they turn, then the other way.
      // The cheek is named by the turn: turning to their own left shows the
      // right cheek.
      const sideKey = (yaw: number): AngleKey => (yaw > 0 ? "cheekRight" : "cheek");
      if (phaseNow === "front") {
        void capture("front").then(() => go("sideA"));
      } else if (phaseNow === "sideA") {
        sideASignRef.current = Math.sign(g!.yaw);
        void capture(sideKey(g!.yaw)).then(() => go("sideB"));
      } else {
        void capture(sideKey(g!.yaw)).then(() => finish(shotsRef.current));
      }
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
          ใช้เวลาประมาณ 10 วินาที ระบบจะจับตำแหน่งใบหน้าแล้วถ่ายให้เอง 3 มุม หน้าตรงและแก้มสองข้าง
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
          <Button size="lg" variant="secondary" onClick={onUsePhoto}>
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
          <p className="absolute inset-x-3 bottom-3 rounded-full bg-black/60 px-4 py-2 text-center text-sm font-semibold text-white">
            {hint}
          </p>
        )}
      </div>

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
          onClick={() => {
            stopCamera();
            onUsePhoto();
          }}
          className="text-slate-600 hover:text-brand-ink"
        >
          ถ่ายหรือเลือกรูปเองแทน
        </button>
      </div>
    </section>
  );
}
