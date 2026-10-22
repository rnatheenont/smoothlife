"use client";

// Smoothie, animated — the full-body mascot in the lab coat, on WebGL.
//
// Shows the still picture first (and keeps it if WebGL is missing or fails),
// starts the rig only once the spot is on screen, pauses while it is off
// screen or the tab is hidden, and calms down for people who ask for reduced
// motion. See smoothie-engine.ts for how the rig itself works.

import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { SMOOTHIE_ACTIONS, SmoothieEngine, VIEW_BUST, VIEW_FULL, mascotAsset, type View } from "./smoothie-engine";

export type SmoothieRigHandle = {
  play: (action: string) => void;
  /** True while a gesture or mood is running (the idle sway does not count). */
  readonly playing: boolean;
};

type Props = {
  ref?: Ref<SmoothieRigHandle>;
  className?: string;
  /** "full" = whole body (default); "bust" = head and shoulders, for small round spots. */
  framing?: "full" | "bust";
  /** Played once, shortly after the rig appears. Skipped under reduced motion. */
  greet?: string | null;
  /** Gestures to pick from every `idleEvery` seconds, so a mascot left alone still does something. */
  idleActions?: string[];
  idleEvery?: number;
  /** Turn head and eyes towards the pointer anywhere on the page. */
  followPointer?: boolean;
  /** Clicking the mascot plays a random gesture. Off when the mascot sits inside a button. */
  playOnClick?: boolean;
  /** Soft shadow under the feet that shrinks when it jumps. */
  shadow?: boolean;
  alt?: string;
};

const STILL = mascotAsset("still.webp");

function stillStyle(v: View): React.CSSProperties {
  const w = v.x1 - v.x0, h = v.y1 - v.y0;
  return {
    position: "absolute",
    left: `${(-v.x0 / w) * 100}%`,
    top: `${(-v.y0 / h) * 100}%`,
    width: `${(1000 / w) * 100}%`,
    height: `${(1000 / h) * 100}%`,
    maxWidth: "none",
  };
}

export default function SmoothieRig({
  ref,
  className,
  framing = "full",
  greet = "wave",
  idleActions,
  idleEvery = 9,
  followPointer = true,
  playOnClick = true,
  shadow = false,
  alt = "",
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const shadowRef = useRef<HTMLSpanElement>(null);
  const engineRef = useRef<SmoothieEngine | null>(null);
  const [ready, setReady] = useState(false);
  const view = framing === "bust" ? VIEW_BUST : VIEW_FULL;

  useImperativeHandle(ref, () => ({
    play: (a: string) => engineRef.current?.play(a),
    get playing() { return !!engineRef.current?.playing; },
  }), []);

  useEffect(() => {
    const wrap = wrapRef.current, canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let engine: SmoothieEngine | null = null;
    let raf = 0, last = 0, visible = false, disposed = false;
    let greetTimer: ReturnType<typeof setTimeout> | undefined;
    let idleTimer: ReturnType<typeof setInterval> | undefined;

    const loop = (now: number) => {
      if (!engine || disposed) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const r = canvas.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
      try {
        engine.render(dt, Math.round(r.width * dpr), Math.round(r.height * dpr));
      } catch (err) {
        console.warn("[smoothie] rig stopped, showing the still picture:", err);
        mark(`stopped: ${(err as Error)?.message ?? err}`);
        stop(); setReady(false); return;
      }
      raf = requestAnimationFrame(loop);
    };
    const start = () => {
      if (!engine || raf || !visible || document.hidden) return;
      last = performance.now();
      raf = requestAnimationFrame(loop);
    };
    const stop = () => { cancelAnimationFrame(raf); raf = 0; };

    const mark = (state: string) => wrap.setAttribute("data-rig", state);
    const boot = async () => {
      mark("loading");
      try {
        engine = new SmoothieEngine(canvas, {
          view,
          reducedMotion: reduce,
          onGround: shadow ? (s, o) => {
            const el = shadowRef.current;
            if (el) { el.style.transform = `translateX(-50%) scale(${s})`; el.style.opacity = String(o); }
          } : undefined,
        });
        await engine.load();
      } catch (err) {
        console.warn("[smoothie] rig could not start, showing the still picture:", err);
        mark(`error: ${(err as Error)?.message ?? err}`);
        engine?.destroy(); engine = null; return; // the still picture stays
      }
      if (disposed) { engine.destroy(); return; }
      engineRef.current = engine;
      setReady(true);
      mark("ready");
      start();
      if (!reduce && greet) greetTimer = setTimeout(() => engine?.play(greet), 600);
      if (!reduce && idleActions?.length) {
        idleTimer = setInterval(() => {
          if (visible && !engine?.playing) engine?.play(idleActions[(Math.random() * idleActions.length) | 0]);
        }, idleEvery * 1000);
      }
    };

    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible && !engine && !disposed) void boot();
      if (visible) start(); else stop();
    });
    io.observe(wrap);
    const onVis = () => (document.hidden ? stop() : start());
    document.addEventListener("visibilitychange", onVis);
    const onLost = (e: Event) => { e.preventDefault(); console.warn("[smoothie] webgl context lost"); stop(); setReady(false); };
    canvas.addEventListener("webglcontextlost", onLost);
    const onMove = (e: PointerEvent) => {
      if (!engine) return;
      const r = wrap.getBoundingClientRect();
      engine.lookAtPoint(
        (e.clientX - (r.left + r.width / 2)) / Math.max(r.width * 0.9, 200),
        (e.clientY - (r.top + r.height * 0.4)) / Math.max(r.height * 0.9, 200),
      );
    };
    if (followPointer) window.addEventListener("pointermove", onMove, { passive: true });

    return () => {
      disposed = true;
      stop(); io.disconnect();
      clearTimeout(greetTimer); clearInterval(idleTimer);
      document.removeEventListener("visibilitychange", onVis);
      canvas.removeEventListener("webglcontextlost", onLost);
      window.removeEventListener("pointermove", onMove);
      engine?.destroy(); engineRef.current = null;
    };
    // The rig is built once per mount; changing these props later is not supported.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={wrapRef}
      className={`${/\b(absolute|fixed)\b/.test(className ?? "") ? "" : "relative "}overflow-hidden ${className ?? ""}`}
      role={alt ? "img" : undefined}
      aria-label={alt || undefined}
      aria-hidden={alt ? undefined : true}
      onClick={playOnClick ? () => engineRef.current?.play(SMOOTHIE_ACTIONS[(Math.random() * SMOOTHIE_ACTIONS.length) | 0]) : undefined}
    >
      {shadow && (
        <span
          ref={shadowRef}
          className="pointer-events-none absolute left-1/2 h-[5%] w-[42%] rounded-[50%] bg-[radial-gradient(closest-side,rgba(15,60,50,0.22),transparent)]"
          style={{ top: `${((930 - view.y0) / (view.y1 - view.y0)) * 100 - 2.5}%`, transform: "translateX(-50%)" }}
        />
      )}
      {/* eslint-disable-next-line @next/next/no-img-element -- positioned to the rig's own framing, not a layout image */}
      <img
        src={STILL}
        alt=""
        draggable={false}
        style={{ ...stillStyle(view), opacity: ready ? 0 : 1, transition: "opacity .2s" }}
        className="pointer-events-none select-none"
      />
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full"
        style={{ opacity: ready ? 1 : 0, transition: "opacity .2s", cursor: playOnClick ? "pointer" : undefined }}
      />
    </div>
  );
}
