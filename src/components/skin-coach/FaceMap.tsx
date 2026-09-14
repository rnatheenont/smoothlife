"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { FaceLandmarker, NormalizedLandmark } from "@mediapipe/tasks-vision";
import {
  CONCERN_DEFS,
  CONCERN_KEYS,
  ZONE_POLYGONS,
  concernScore,
  skinHealth,
  type ConcernMetric,
  type ConcernResults,
  type ZoneKey,
} from "@/lib/skin-analysis";

// The front photo with each face area lit by how much of the selected concern
// the analysis saw there — or, on "all", by the worst concern in that area.
// The areas are traced from face-mesh landmarks found in this photo, on the
// device; nothing about the photo is sent anywhere by this.
//
// The look follows the owner's reference: a soft glow that sits on the skin,
// brightest where the concern is strongest, with no outlines — and a slider
// to compare the plain photo ("ภาพจริง") with what the analysis saw.
//
// It lights whole areas, not individual spots: the analysis rates areas, and
// dotting in blemishes it never located would be decoration posing as data.

let imageLandmarker: Promise<FaceLandmarker> | null = null;
function loadImageLandmarker() {
  if (!imageLandmarker) {
    imageLandmarker = (async () => {
      const { FaceLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
      const fileset = await FilesetResolver.forVisionTasks("/mediapipe/wasm");
      return FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: "/models/face_landmarker.task", delegate: "CPU" },
        runningMode: "IMAGE",
        numFaces: 1,
      });
    })().catch((err) => {
      imageLandmarker = null;
      throw err;
    });
  }
  return imageLandmarker;
}

function hexToRgb(hex: string) {
  const n = parseInt(hex.replace("#", ""), 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}

// Worst-first colour for the combined view: amber → orange → red.
function heatColor(severity: number) {
  if (severity >= 60) return "239,68,68";
  if (severity >= 35) return "249,115,22";
  return "245,158,11";
}

type Pt = { x: number; y: number };

/**
 * Paints the glow for `selected` onto `ctx` (W×H, the photo's size). Blur is
 * made by drawing small and scaling up, because Safari's canvas has no blur
 * filter — which is what left hard-edged shapes on iPhones.
 */
export function paintSkinGlow(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  landmarks: NormalizedLandmark[],
  concerns: ConcernResults,
  selected: ConcernMetric | "all"
) {
  ctx.clearRect(0, 0, W, H);

  const shades: { zone: ZoneKey; rgb: string; severity: number }[] = [];
  if (selected === "all") {
    const worst = new Map<ZoneKey, number>();
    for (const key of CONCERN_KEYS) {
      for (const [zone, sev] of Object.entries(concerns[key].zones) as [ZoneKey, number][]) {
        worst.set(zone, Math.max(worst.get(zone) ?? 0, sev));
      }
    }
    worst.forEach((severity, zone) => shades.push({ zone, rgb: heatColor(severity), severity }));
  } else {
    const def = CONCERN_DEFS[selected];
    const rgb = hexToRgb(def.color);
    for (const zone of def.zones) shades.push({ zone, rgb, severity: concerns[selected].zones[zone] ?? 0 });
  }

  // Small canvas: an eighth of the photo, so scaling it back up softens every
  // edge by several pixels.
  const DOWN = 8;
  const sw = Math.max(1, Math.ceil(W / DOWN));
  const sh = Math.max(1, Math.ceil(H / DOWN));
  const small = document.createElement("canvas");
  small.width = sw;
  small.height = sh;
  const sctx = small.getContext("2d")!;
  const sx = sw / W;
  const sy = sh / H;

  const trace = (pts: Pt[]) => {
    sctx.beginPath();
    const n = pts.length;
    const mid = (a: Pt, b: Pt) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
    const start = mid(pts[n - 1], pts[0]);
    sctx.moveTo(start.x, start.y);
    for (let i = 0; i < n; i++) {
      const m = mid(pts[i], pts[(i + 1) % n]);
      sctx.quadraticCurveTo(pts[i].x, pts[i].y, m.x, m.y);
    }
    sctx.closePath();
  };

  for (const s of shades) {
    if (s.severity < 6) continue; // nothing worth lighting
    const pts = ZONE_POLYGONS[s.zone]
      .map((i) => landmarks[i])
      .filter(Boolean)
      .map((p) => ({ x: p.x * W * sx, y: p.y * H * sy }));
    if (pts.length < 3) continue;
    const cx = pts.reduce((a, p) => a + p.x, 0) / pts.length;
    const cy = pts.reduce((a, p) => a + p.y, 0) / pts.length;
    const radius = Math.max(...pts.map((p) => Math.hypot(p.x - cx, p.y - cy)));
    // Stronger concern, brighter and fuller glow.
    const peak = Math.min(1, 0.35 + (s.severity / 100) * 0.9);
    const grad = sctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 1.15);
    grad.addColorStop(0, `rgba(${s.rgb},${peak.toFixed(2)})`);
    grad.addColorStop(0.5, `rgba(${s.rgb},${(peak * 0.75).toFixed(2)})`);
    grad.addColorStop(1, `rgba(${s.rgb},0.05)`);
    trace(pts);
    sctx.fillStyle = grad;
    sctx.fill();
  }

  // Twice down, then up: a smooth, wide falloff.
  const tiny = document.createElement("canvas");
  tiny.width = Math.max(1, Math.ceil(sw / 2));
  tiny.height = Math.max(1, Math.ceil(sh / 2));
  const tctx = tiny.getContext("2d")!;
  tctx.imageSmoothingEnabled = true;
  tctx.drawImage(small, 0, 0, tiny.width, tiny.height);

  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(small, 0, 0, W, H);
  ctx.globalAlpha = 0.9;
  ctx.drawImage(tiny, 0, 0, W, H);
  ctx.restore();
}

export default function FaceMap({
  photo,
  concerns,
  selected,
  className,
}: {
  photo: string;
  concerns: ConcernResults;
  selected: ConcernMetric | "all";
  className?: string;
}) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sheenRef = useRef<HTMLCanvasElement | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const [landmarks, setLandmarks] = useState<NormalizedLandmark[] | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "none">("loading");
  // Where the divider sits, 0–100 from the left: left of it the plain photo,
  // right of it the glow.
  const [split, setSplit] = useState(22);

  // Find the face in the photo once.
  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    (async () => {
      try {
        const img = imgRef.current;
        if (!img) return;
        if (!img.complete) await img.decode().catch(() => {});
        const landmarker = await loadImageLandmarker();
        const lm = landmarker.detect(img).faceLandmarks?.[0];
        if (cancelled) return;
        setLandmarks(lm ?? null);
        setStatus(lm ? "ready" : "none");
      } catch {
        if (!cancelled) setStatus("none");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [photo]);

  // Redraw whenever the concern changes.
  useEffect(() => {
    const img = imgRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas || !landmarks) return;
    const W = img.naturalWidth;
    const H = img.naturalHeight;
    if (!W || !H) return;
    canvas.width = W;
    canvas.height = H;
    paintSkinGlow(canvas.getContext("2d")!, W, H, landmarks, concerns, selected);
    const sheen = sheenRef.current;
    if (sheen) {
      sheen.width = W;
      sheen.height = H;
      sheen.getContext("2d")!.drawImage(canvas, 0, 0);
    }
  }, [landmarks, concerns, selected]);

  function dragTo(e: ReactPointerEvent) {
    const box = boxRef.current?.getBoundingClientRect();
    if (!box?.width) return;
    setSplit(Math.max(0, Math.min(100, ((e.clientX - box.left) / box.width) * 100)));
  }

  const score = selected === "all" ? skinHealth(concerns) : concernScore(concerns[selected].severity);
  const label = selected === "all" ? "สุขภาพผิวโดยรวม" : CONCERN_DEFS[selected].label;
  const ready = status === "ready";

  return (
    <div className={className}>
      <div ref={boxRef} className="relative select-none overflow-hidden rounded-xl2 bg-slate-900">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img ref={imgRef} src={photo} alt="รูปหน้าตรงที่ใช้สแกน" className="block h-auto w-full" draggable={false} />
        {/* The glow, shown right of the divider: "overlay" tints the skin
            with the colour while keeping its texture, and a faint "screen"
            copy adds the sheen, so it reads as light on the skin rather
            than paint over it. */}
        <canvas
          ref={canvasRef}
          className="pointer-events-none absolute inset-0 h-full w-full mix-blend-overlay"
          style={{ clipPath: `inset(0 0 0 ${split}%)` }}
          aria-hidden="true"
        />
        <canvas
          ref={sheenRef}
          className="pointer-events-none absolute inset-0 h-full w-full opacity-35 mix-blend-screen"
          style={{ clipPath: `inset(0 0 0 ${split}%)` }}
          aria-hidden="true"
        />

        {ready && (
          <>
            <div className="absolute left-3 top-3 rounded-xl bg-white/90 px-3 py-2 shadow-sm backdrop-blur" aria-live="polite">
              <p className="text-[11px] text-slate-600">{label}</p>
              <p className="text-lg font-bold leading-tight text-brand-ink tabular-nums">
                {score}
                <span className="text-xs font-medium text-slate-500"> /100</span>
              </p>
            </div>

            {/* Divider and handle. */}
            <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-white/90" style={{ left: `${split}%` }} aria-hidden="true" />
            <div
              role="presentation"
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                dragTo(e);
              }}
              onPointerMove={(e) => {
                if (e.currentTarget.hasPointerCapture(e.pointerId)) dragTo(e);
              }}
              className="absolute top-1/2 grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize touch-none place-items-center rounded-full bg-white text-slate-800 shadow-md"
              style={{ left: `${split}%` }}
            >
              <svg width="18" height="12" viewBox="0 0 18 12" aria-hidden="true">
                <path d="M6 1 1 6l5 5M12 1l5 5-5 5" fill="currentColor" stroke="currentColor" strokeLinejoin="round" />
              </svg>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(split)}
              onChange={(e) => setSplit(Number(e.target.value))}
              aria-label="เลื่อนเทียบภาพจริงกับสิ่งที่ AI เห็น"
              className="sr-only"
            />

            <span className="pointer-events-none absolute bottom-3 left-3 rounded-lg bg-black/45 px-2.5 py-1 text-xs font-semibold text-white">
              ภาพจริง
            </span>
            <span className="pointer-events-none absolute bottom-3 right-3 rounded-lg bg-black/45 px-2.5 py-1 text-xs font-semibold text-white">
              สิ่งที่ AI เห็น
            </span>
          </>
        )}

        {status === "loading" && (
          <p className="absolute inset-x-3 bottom-3 rounded-full bg-black/55 px-3 py-1.5 text-center text-xs text-white">
            กำลังวาดแผนที่ผิว…
          </p>
        )}
        {status === "none" && (
          <p className="absolute inset-x-3 bottom-3 rounded-full bg-black/55 px-3 py-1.5 text-center text-xs text-white">
            หาตำแหน่งใบหน้าในรูปนี้ไม่เจอ แสดงเฉพาะคะแนน
          </p>
        )}
      </div>
    </div>
  );
}
