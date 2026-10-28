"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { Entrant, Winner } from "@/lib/lucky-draw";
import {
  WINTER,
  auroraRibbons,
  mountainRange,
  pineForest,
  skyBackdrop,
  snowGround,
  snowfall,
  stepSnowfall,
  type Snowfall,
} from "./winter";
import { ACCENT, WEDGES, WHEEL_RADIUS, glowTexture, makeWheelCanvas, paintWheel } from "./wheel";

// The machine the names come out of: a wheel, under a pointer, in the
// campaign's winter night.
//
// The winner is already decided before it starts turning — the draw is a
// pure function and runs in a fifth of a millisecond — so everything here is
// about the three seconds between knowing and being told. The other eleven
// wedges carry real names from the room, because a wheel of strangers going
// past is what makes the one under the pointer mean anything.
//
// Deliberately not react-three-fiber: one scene, one lifetime, no React
// state inside the frame loop. The whole thing is built once in an effect
// and torn down with it; the only thing that crosses the boundary afterwards
// is "spin to this person", which arrives as a prop change.

const SPIN_MS = 3400;
const REVEAL_MS = 1500;
const TURNS = 5;
/** The whole machine sits low, so the pointer has sky above it rather than
 *  the top edge of the frame. */
const WHEEL_Y = -0.5;

type Phase = "idle" | "spinning" | "reveal";

type Scene = {
  renderer: THREE.WebGLRenderer;
  camera: THREE.PerspectiveCamera;
  scene: THREE.Scene;
  wheel: THREE.Group;
  face: THREE.Mesh;
  canvas: HTMLCanvasElement;
  texture: THREE.CanvasTexture;
  pointer: THREE.Mesh;
  stars: THREE.Points;
  snow: Snowfall;
  aurora: THREE.Group;
  glow: THREE.Sprite;
  flash: THREE.Sprite;
  confetti: THREE.Points;
  /** Points.material is typed as one-or-many; this is the one. */
  confettiMat: THREE.PointsMaterial;
  confettiVel: Float32Array;
  confettiLife: { t: number };
  phase: Phase;
  spinStart: number;
  spinFrom: number;
  spinTo: number;
  rot: number;
  revealAt: number;
  landedOnce: boolean;
  onLanded: (() => void) | null;
  raf: number;
  reduced: boolean;
};

function shuffled<T>(list: T[]): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export default function LuckyDrawStage({
  pool,
  target,
  onLanded,
  className,
}: {
  /** Everyone still in the room — the names the wheel is filled with. */
  pool: Entrant[];
  /** Spin to this person. A new object starts a spin; null leaves it idle. */
  target: Winner | null;
  onLanded: () => void;
  className?: string;
}) {
  const host = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<Scene | null>(null);
  const poolRef = useRef(pool);
  const landedRef = useRef(onLanded);
  // Kept current without re-running the scene: the renderer is built once
  // for the life of the component, and these two are read from inside the
  // frame loop. Declared above the scene so that on mount it runs first and
  // the loop never reads an empty room.
  useEffect(() => {
    poolRef.current = pool;
    landedRef.current = onLanded;
  });

  useEffect(() => {
    const mount = host.current;
    if (!mount) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.setClearColor(WINTER.skyTop, 1);
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    // Fogged in the sky's own colour and only from well behind the wheel, so
    // the treeline recedes without the wheel picking up a haze.
    scene.fog = new THREE.Fog(new THREE.Color(WINTER.skyMid).getHex(), 24, 54);

    // The night, back to front: sky, aurora, ridge, snow, trees.
    const aurora = auroraRibbons();
    scene.add(skyBackdrop(), aurora, mountainRange(), snowGround(), pineForest());
    const snow = snowfall(reduced ? 160 : 700);

    const camera = new THREE.PerspectiveCamera(42, mount.clientWidth / mount.clientHeight, 0.1, 120);
    camera.position.set(0, 0, 11.6);
    camera.lookAt(0, 0, 0);

    // --- the wheel ------------------------------------------------------
    const wheel = new THREE.Group();
    const canvas = makeWheelCanvas();
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const face = new THREE.Mesh(
      new THREE.CircleGeometry(WHEEL_RADIUS, 96),
      new THREE.MeshStandardMaterial({
        map: texture,
        roughness: 0.46,
        metalness: 0.12,
        emissiveMap: texture,
        emissive: new THREE.Color(0x3a3570),
        emissiveIntensity: 0.5,
      }),
    );
    wheel.add(face);

    // The rim. Polished ice rather than gold: the campaign's winter, and a
    // warm metal in this sky reads as a prop from another set.
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(WHEEL_RADIUS + 0.09, 0.17, 20, 110),
      new THREE.MeshStandardMaterial({
        color: 0xe6edf8,
        roughness: 0.18,
        metalness: 1,
        emissive: new THREE.Color(0x1b2140),
      }),
    );
    wheel.add(rim);
    wheel.position.y = WHEEL_Y;
    scene.add(wheel);

    // The pointer does not turn with the wheel — it is the thing the wheel
    // is measured against.
    const pointer = new THREE.Mesh(
      // Three sides, so it reads as a triangle from the front rather than
      // as a little gem.
      new THREE.ConeGeometry(0.55, 1.25, 3),
      new THREE.MeshStandardMaterial({
        color: 0xfff6e2,
        roughness: 0.3,
        metalness: 0.5,
        // Lit from inside as well as from the spotlights: it sits above the
        // rim, outside the pool of light the wheel is in, and without this
        // it reads as a dark sliver against the sky.
        emissive: new THREE.Color(0xc9a24e),
        emissiveIntensity: 0.85,
      }),
    );
    // A cone's apex is +y, and this one has to point down into the wheel.
    pointer.rotation.z = Math.PI;
    pointer.position.set(0, WHEEL_Y + WHEEL_RADIUS + 0.2, 0.6);
    scene.add(pointer);

    // --- light ----------------------------------------------------------
    scene.add(new THREE.AmbientLight(0x8a93c8, 0.85));
    // Moonlight from the left, aurora from the upper right — the two light
    // sources the artwork already has.
    const key = new THREE.SpotLight(0xdfe7ff, 190, 30, 0.6, 0.6, 1.6);
    key.position.set(-6, 6.5, 8);
    const fill = new THREE.SpotLight(0x7ff0d0, 110, 30, 0.6, 0.6, 1.6);
    fill.position.set(7, 5.5, 5.5);
    const rimLight = new THREE.DirectionalLight(0xffffff, 0.45);
    rimLight.position.set(0, 0, 8);
    scene.add(key, key.target, fill, fill.target, rimLight);

    // --- glow, flash, stars, confetti ------------------------------------
    const glow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTexture(WINTER.glow),
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        opacity: 0.4,
        transparent: true,
      }),
    );
    glow.scale.set(13, 13, 1);
    glow.position.set(0, WHEEL_Y, -2.2);
    scene.add(glow);

    const flash = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTexture("#ffffff"),
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        opacity: 0,
        transparent: true,
      }),
    );
    flash.scale.set(17, 17, 1);
    flash.position.set(0, 0, 2.6);
    scene.add(flash);

    const starCount = reduced ? 300 : 1400;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const r = 18 + Math.random() * 14;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      starPos[i * 3 + 2] = r * Math.cos(phi) - 6;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
    const stars = new THREE.Points(
      starGeo,
      new THREE.PointsMaterial({ color: 0x9fb4ff, size: 0.09, sizeAttenuation: true, transparent: true, opacity: 0.75 }),
    );
    scene.add(stars, snow.points);

    const confCount = reduced ? 0 : 420;
    const confPos = new Float32Array(Math.max(1, confCount) * 3);
    const confettiVel = new Float32Array(Math.max(1, confCount) * 3);
    const confColors = new Float32Array(Math.max(1, confCount) * 3);
    const confGeo = new THREE.BufferGeometry();
    confGeo.setAttribute("position", new THREE.BufferAttribute(confPos, 3));
    confGeo.setAttribute("color", new THREE.BufferAttribute(confColors, 3));
    const confettiMat = new THREE.PointsMaterial({
      size: 0.17,
      vertexColors: true,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const confetti = new THREE.Points(confGeo, confettiMat);
    scene.add(confetti);

    const s: Scene = {
      renderer,
      camera,
      scene,
      wheel,
      face,
      canvas,
      texture,
      pointer,
      stars,
      snow,
      aurora,
      glow,
      flash,
      confetti,
      confettiMat,
      confettiVel,
      confettiLife: { t: 1 },
      phase: "idle",
      spinStart: 0,
      spinFrom: 0,
      spinTo: 0,
      rot: 0,
      revealAt: 0,
      landedOnce: false,
      onLanded: null,
      raf: 0,
      reduced,
    };
    sceneRef.current = s;

    // Names only once the Thai font is actually there — painted before it
    // loads, the face is drawn in the fallback and stays that way until
    // something else repaints it.
    const paintIdle = () => {
      const people = poolRef.current;
      if (!people.length) return;
      const picks = shuffled(people);
      paintWheel(
        s.canvas,
        Array.from({ length: WEDGES }, (_, i) => picks[i % picks.length].name ?? "(ไม่มีชื่อ)"),
        -1,
      );
      s.texture.needsUpdate = true;
    };
    void (document.fonts?.ready ?? Promise.resolve()).then(paintIdle);
    paintIdle();

    const onResize = () => {
      if (!mount.clientWidth) return;
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    const observer = new ResizeObserver(onResize);
    observer.observe(mount);

    let last = performance.now();
    const tick = (now: number) => {
      s.raf = requestAnimationFrame(tick);
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      s.stars.rotation.y += dt * 0.012;
      s.stars.rotation.x += dt * 0.004;
      stepSnowfall(s.snow, dt, now);
      // The aurora breathes rather than loops: three ribbons on different
      // periods never line up, so it does not read as an animation.
      s.aurora.children.forEach((ribbon, i) => {
        const mat = (ribbon as THREE.Mesh).material as THREE.MeshBasicMaterial;
        mat.opacity = 0.3 + Math.sin(now / (3400 + i * 900) + i) * 0.16;
        ribbon.position.x += Math.sin(now / (6000 + i * 1500)) * dt * 0.6;
      });

      if (s.phase !== "spinning" && s.landedOnce) {
        // Held on the winner, with just enough movement to look alive. It
        // used to go back to drifting a second and a half after landing,
        // which turned the name that had just been drawn away from the
        // pointer while everyone was still reading it.
        s.rot = s.spinTo + Math.sin(now / 1500) * 0.006;
        if (s.phase === "reveal" && now - s.revealAt > REVEAL_MS) s.phase = "idle";
      } else if (s.phase === "idle") {
        // Before the first name: turning, because a stopped machine looks
        // broken.
        s.rot -= dt * 0.12;
      } else if (s.phase === "spinning") {
        const t = Math.min((now - s.spinStart) / (s.reduced ? 900 : SPIN_MS), 1);
        // Quint ease-out: still flying at the half-way mark, then the last
        // wedge takes almost a second. The slow landing is the whole trick —
        // it is what makes a name arriving feel decided rather than merely
        // displayed.
        const e = 1 - Math.pow(1 - t, 5);
        s.rot = s.spinFrom + (s.spinTo - s.spinFrom) * e;
        if (t >= 1) {
          s.rot = s.spinTo;
          s.phase = "reveal";
          s.landedOnce = true;
          s.revealAt = now;
          s.flash.material.opacity = 0.85;
          if (confCount > 0) {
            const pos = s.confetti.geometry.getAttribute("position") as THREE.BufferAttribute;
            const col = s.confetti.geometry.getAttribute("color") as THREE.BufferAttribute;
            // Snow thrown up, not party confetti: white, ice and the
            // aurora's own green.
            const white = new THREE.Color(0xffffff);
            const ice = new THREE.Color(0xc9dbff);
            const mint = new THREE.Color(0x9ff0dc);
            for (let i = 0; i < confCount; i++) {
              pos.setXYZ(i, (Math.random() - 0.5) * 1.6, WHEEL_Y + WHEEL_RADIUS * 0.6, 2.6);
              const speed = 3.5 + Math.random() * 7;
              const a = Math.random() * Math.PI * 2;
              const up = 0.35 + Math.random() * 0.9;
              s.confettiVel[i * 3] = Math.cos(a) * speed;
              s.confettiVel[i * 3 + 1] = Math.sin(a) * speed * 0.8 + up * 4;
              s.confettiVel[i * 3 + 2] = (Math.random() - 0.3) * 3;
              const c = i % 3 === 0 ? white : i % 3 === 1 ? ice : mint;
              col.setXYZ(i, c.r, c.g, c.b);
            }
            pos.needsUpdate = true;
            col.needsUpdate = true;
            s.confettiMat.opacity = 1;
            s.confettiLife.t = 0;
          }
          s.onLanded?.();
          s.onLanded = null;
        }
      }

      s.wheel.rotation.z = s.rot;

      // Flash and glow fall off on their own clock, so they keep burning
      // after the phase has moved on rather than being cut at a boundary.
      if (s.flash.material.opacity > 0) {
        s.flash.material.opacity = Math.max(0, s.flash.material.opacity - dt * 1.9);
      }
      const pulse = s.phase === "reveal" ? 0.75 : 0.4;
      s.glow.material.opacity += (pulse - s.glow.material.opacity) * Math.min(1, dt * 4);
      const breathe = 13 + Math.sin(now / 900) * 0.4 + (s.phase === "reveal" ? 2.4 : 0);
      s.glow.scale.set(breathe, breathe, 1);

      if (confCount > 0 && s.confettiLife.t < 1) {
        s.confettiLife.t += dt / 2.4;
        const pos = s.confetti.geometry.getAttribute("position") as THREE.BufferAttribute;
        const arr = pos.array as Float32Array;
        for (let i = 0; i < confCount; i++) {
          s.confettiVel[i * 3 + 1] -= dt * 9.5;
          arr[i * 3] += s.confettiVel[i * 3] * dt;
          arr[i * 3 + 1] += s.confettiVel[i * 3 + 1] * dt;
          arr[i * 3 + 2] += s.confettiVel[i * 3 + 2] * dt;
        }
        pos.needsUpdate = true;
        s.confettiMat.opacity = Math.max(0, 1 - s.confettiLife.t);
      }

      // The camera leans in while a name is landing and settles back after.
      const want = s.phase === "idle" ? 11.6 : 10.8;
      s.camera.position.z += (want - s.camera.position.z) * Math.min(1, dt * 2.2);
      s.camera.lookAt(0, 0, 0);

      s.renderer.render(s.scene, s.camera);
    };
    s.raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(s.raf);
      observer.disconnect();
      renderer.dispose();
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.Points || obj instanceof THREE.Sprite) {
          obj.geometry?.dispose?.();
          const m = obj.material as THREE.Material | THREE.Material[];
          (Array.isArray(m) ? m : [m]).forEach((mat) => mat.dispose());
        }
      });
      s.texture.dispose();
      renderer.domElement.remove();
      sceneRef.current = null;
    };
  }, []);

  // A new target means: fill the wheel with strangers, put this person on
  // the wedge at twelve o'clock, and turn until twelve o'clock comes round.
  useEffect(() => {
    const s = sceneRef.current;
    if (!s || !target) return;

    const others = shuffled(pool.filter((p) => p.userId !== target.userId));
    const names = Array.from({ length: WEDGES }, (_, i) =>
      i === 0
        ? target.name ?? "(ไม่มีชื่อ)"
        : others[(i - 1) % Math.max(1, others.length)]?.name ?? "(ไม่มีชื่อ)",
    );
    paintWheel(s.canvas, names, 0);
    s.texture.needsUpdate = true;
    (s.face.material as THREE.MeshStandardMaterial).emissive.set(ACCENT);

    // Clockwise, always, and never backwards to land: a wheel that creeps
    // the short way round to its answer reads as rigged. Wedge zero is at
    // twelve o'clock on the face, so the target is a whole number of turns
    // from zero, taken the long way from wherever it is now.
    const current = s.rot;
    const full = Math.PI * 2;
    const back = ((current % full) + full) % full;
    s.spinFrom = current;
    s.spinTo = current - back - full * TURNS;
    s.spinStart = performance.now();
    s.phase = "spinning";
    s.onLanded = () => landedRef.current();
  }, [target, pool]);

  return <div ref={host} className={className} aria-hidden />;
}
