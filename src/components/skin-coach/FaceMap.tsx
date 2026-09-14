"use client";

import { useEffect, useRef, useState } from "react";
import type { FaceLandmarker, NormalizedLandmark } from "@mediapipe/tasks-vision";
import {
  CONCERN_DEFS,
  CONCERN_KEYS,
  ZONE_POLYGONS,
  type ConcernMetric,
  type ConcernResults,
  type ZoneKey,
} from "@/lib/skin-analysis";

// The front photo with each face area tinted by how much of the selected
// concern the analysis saw there — or, on "all", by the worst concern in
// that area. The areas are traced from face-mesh landmarks found in this
// photo, on the device; nothing about the photo is sent anywhere by this.
//
// It shades whole areas, not individual spots: the analysis rates areas, and
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
  const [landmarks, setLandmarks] = useState<NormalizedLandmark[] | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "none">("loading");

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
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, W, H);
    const unit = W / 360;

    // Rounded outline through the midpoints of each area's ring, so areas
    // read as soft shapes rather than polygons.
    const points = (zone: ZoneKey) =>
      ZONE_POLYGONS[zone].map((i) => landmarks[i]).filter(Boolean).map((p) => ({ x: p.x * W, y: p.y * H }));
    const trace = (pts: { x: number; y: number }[]) => {
      ctx.beginPath();
      const n = pts.length;
      const mid = (a: { x: number; y: number }, b: { x: number; y: number }) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
      const start = mid(pts[n - 1], pts[0]);
      ctx.moveTo(start.x, start.y);
      for (let i = 0; i < n; i++) {
        const m = mid(pts[i], pts[(i + 1) % n]);
        ctx.quadraticCurveTo(pts[i].x, pts[i].y, m.x, m.y);
      }
      ctx.closePath();
    };

    // Per area: which colour and how strong.
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

    // Fill: strongest at the middle of the area, fading toward its edge —
    // a heat patch, not a sticker. Blurred too where the canvas can blur.
    ctx.save();
    if ("filter" in ctx) ctx.filter = `blur(${Math.round(unit * 2.5)}px)`;
    for (const s of shades) {
      if (s.severity < 8) continue; // nothing worth shading
      const pts = points(s.zone);
      if (pts.length < 3) continue;
      const cx = pts.reduce((a, p) => a + p.x, 0) / pts.length;
      const cy = pts.reduce((a, p) => a + p.y, 0) / pts.length;
      const radius = Math.max(...pts.map((p) => Math.hypot(p.x - cx, p.y - cy)));
      const peak = 0.2 + (s.severity / 100) * 0.55;
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
      grad.addColorStop(0, `rgba(${s.rgb},${peak.toFixed(2)})`);
      grad.addColorStop(0.65, `rgba(${s.rgb},${(peak * 0.75).toFixed(2)})`);
      grad.addColorStop(1, `rgba(${s.rgb},${(peak * 0.3).toFixed(2)})`);
      trace(pts);
      ctx.fillStyle = grad;
      ctx.fill();
    }
    ctx.restore();

    // A thin outline for a single concern, so an unshaded area still reads as
    // "looked at, nothing to show". The combined view stays outline-free.
    if (selected !== "all") {
      ctx.save();
      ctx.lineWidth = Math.max(1.2, unit * 0.7);
      for (const s of shades) {
        const pts = points(s.zone);
        if (pts.length < 3) continue;
        trace(pts);
        ctx.strokeStyle = `rgba(${s.rgb},0.85)`;
        ctx.stroke();
      }
      ctx.restore();
    }
  }, [landmarks, concerns, selected]);

  return (
    <div className={className}>
      <div className="relative overflow-hidden rounded-xl2 bg-slate-900">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img ref={imgRef} src={photo} alt="รูปหน้าตรงที่ใช้สแกน" className="block h-auto w-full" />
        <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true" />
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
