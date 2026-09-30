"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import type { Hero3DScene } from "@/data/hero-3d";

// The banner is 20 units across in the scene, and everything else — layer
// sizes, depths, how far the camera is allowed to wander — is written in
// those units, so nothing here depends on the pixel size it ends up drawn at.
const FRAME_W = 20;
const CAMERA_DISTANCE = 20;
const FOV = 30;

// How far the camera slides for a pointer at the very edge of the banner.
// Small on purpose: this is a shop window with a little depth in it, not a
// ride, and the layers are cut-outs whose edges give the game away if they
// travel far.
const POINTER_SWAY_X = 0.62;
const POINTER_SWAY_Y = 0.34;
// The same movement, unattended, so the banner has life in it before anyone
// has touched the mouse — and for the whole of the time nobody does.
const DRIFT_X = 0.26;
const DRIFT_Y = 0.15;

const SNOW_SPAN_Z = [-6, 8] as const;

function snowSprite() {
  const size = 64;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2,
  );
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.35, "rgba(255,255,255,0.85)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export default function HeroScene3D({
  scene,
  active,
  onReady,
}: {
  scene: Hero3DScene;
  active: boolean;
  onReady?: () => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  // `active` changes every eight seconds as the carousel turns; reading it
  // through a ref keeps the whole scene from being torn down and rebuilt each
  // time, which would refetch four textures and drop the frame rate on the
  // slide that is about to be shown.
  const activeRef = useRef(active);
  activeRef.current = active;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: "low-power",
      });
    } catch {
      // No WebGL — the flat banner underneath is already on screen and stays.
      return;
    }
    // Capped at 1.5 rather than the display's own ratio: this is four large
    // textures and a few hundred sprites, and on a 2x screen the extra pixels
    // cost more than they show on artwork this soft.
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setClearAlpha(0);
    host.appendChild(renderer.domElement);
    renderer.domElement.style.cssText =
      "position:absolute;inset:0;width:100%;height:100%;display:block";

    const three = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100);
    camera.position.set(0, 0, CAMERA_DISTANCE);

    const frameH = FRAME_W / scene.aspect;
    const loader = new THREE.TextureLoader();
    const disposables: { dispose(): void }[] = [];
    let disposed = false;

    function makeTexture(src: string) {
      return new Promise<THREE.Texture>((resolve, reject) => {
        loader.load(
          src,
          (tex) => {
            tex.colorSpace = THREE.SRGBColorSpace;
            tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
            tex.minFilter = THREE.LinearMipmapLinearFilter;
            resolve(tex);
          },
          undefined,
          reject,
        );
      });
    }

    // A layer at depth z is scaled and moved by (d - z) / d, which cancels the
    // perspective exactly: it lands on screen the same size and in the same
    // place as it does in the flat artwork, and only *moves* differently when
    // the camera does. Without this, hanging a layer forward would simply
    // enlarge it and the banner would no longer be the banner.
    function place(
      mesh: THREE.Mesh,
      w: number,
      h: number,
      x: number,
      y: number,
      depth: number,
    ) {
      const k = (CAMERA_DISTANCE - depth) / CAMERA_DISTANCE;
      const cx = (x + w / 2 - 0.5) * FRAME_W;
      const cy = (0.5 - (y + h / 2)) * frameH;
      mesh.scale.setScalar(k);
      mesh.position.set(cx * k, cy * k, depth);
    }

    function planeFor(tex: THREE.Texture, widthFraction: number) {
      const img = tex.image as { width: number; height: number };
      const w = widthFraction * FRAME_W;
      const h = (w * img.height) / img.width;
      const geo = new THREE.PlaneGeometry(w, h);
      const mat = new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        // Order is decided by renderOrder, not by depth — the layers overlap
        // by design and z-fighting between two transparent planes would show
        // as the lettering flickering through the people.
        depthTest: false,
        depthWrite: false,
      });
      disposables.push(geo, mat);
      if (!disposables.includes(tex)) disposables.push(tex);
      return { mesh: new THREE.Mesh(geo, mat), heightFraction: h / frameH };
    }

    function buildSnow(
      count: number,
      zFrom: number,
      zTo: number,
      renderOrder: number,
    ) {
      const positions = new Float32Array(count * 3);
      const speeds = new Float32Array(count);
      const phases = new Float32Array(count);
      for (let i = 0; i < count; i++) {
        positions[i * 3] = (Math.random() - 0.5) * FRAME_W * 1.5;
        positions[i * 3 + 1] = (Math.random() - 0.5) * frameH * 1.6;
        positions[i * 3 + 2] = zFrom + Math.random() * (zTo - zFrom);
        speeds[i] = 0.35 + Math.random() * 0.9;
        phases[i] = Math.random() * Math.PI * 2;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      const mat = new THREE.PointsMaterial({
        size: 0.17,
        map: snowSprite(),
        transparent: true,
        opacity: 0.8,
        depthTest: false,
        depthWrite: false,
        sizeAttenuation: true,
      });
      disposables.push(geo, mat, mat.map!);
      const points = new THREE.Points(geo, mat);
      points.renderOrder = renderOrder;
      return { points, positions, speeds, phases, count };
    }

    const pointer = { x: 0, y: 0 };
    const eased = { x: 0, y: 0 };
    function onPointerMove(e: PointerEvent) {
      const r = host!.getBoundingClientRect();
      pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      pointer.y = ((e.clientY - r.top) / r.height) * 2 - 1;
    }
    function onPointerLeave() {
      pointer.x = 0;
      pointer.y = 0;
    }

    function resize() {
      const r = host!.getBoundingClientRect();
      if (!r.width || !r.height) return;
      renderer.setSize(r.width, r.height, false);
      camera.aspect = r.width / r.height;
      // Cover, the same as the flat banner's object-cover: zoom until the
      // artwork fills the frame in both directions, whichever runs out first.
      const visibleH = 2 * CAMERA_DISTANCE * Math.tan((FOV * Math.PI) / 360);
      const visibleW = visibleH * camera.aspect;
      camera.zoom = Math.max(visibleH / frameH, visibleW / FRAME_W);
      camera.updateProjectionMatrix();
    }

    let ro: ResizeObserver | undefined;

    (async () => {
      try {
        const bgTex = await makeTexture(scene.background);
        if (disposed) return;
        const bg = planeFor(bgTex, 1);
        // The background is the one layer that may be cropped, and it has to
        // be: it is the only thing behind the camera's wandering, so it is
        // grown enough that a sway never reaches its edge.
        bg.mesh.scale.multiplyScalar(1.1);
        bg.mesh.position.set(0, 0, 0);
        bg.mesh.renderOrder = 0;
        three.add(bg.mesh);

        const snowBack = scene.snow
          ? buildSnow(Math.round(scene.snow * 0.65), SNOW_SPAN_Z[0], 1, 1)
          : null;
        if (snowBack) three.add(snowBack.points);

        const layerMeshes = await Promise.all(
          scene.layers.map(async (layer, i) => {
            const tex = await makeTexture(layer.src);
            const copies: THREE.Mesh[] = [];
            for (let pass = 0; pass < (layer.boost ?? 1); pass++) {
              const { mesh, heightFraction } = planeFor(tex, layer.w);
              place(
                mesh,
                layer.w,
                heightFraction,
                layer.x,
                layer.y,
                layer.depth,
              );
              mesh.renderOrder = 2 + i;
              copies.push(mesh);
            }
            return copies;
          }),
        );
        if (disposed) return;
        layerMeshes.flat().forEach((m) => three.add(m));

        const snowFront = scene.snow
          ? buildSnow(
              Math.round(scene.snow * 0.35),
              5,
              SNOW_SPAN_Z[1],
              2 + scene.layers.length,
            )
          : null;
        if (snowFront) three.add(snowFront.points);

        resize();
        ro = new ResizeObserver(resize);
        ro.observe(host!);
        host!.addEventListener("pointermove", onPointerMove);
        host!.addEventListener("pointerleave", onPointerLeave);

        const stillPlease = window.matchMedia(
          "(prefers-reduced-motion: reduce)",
        );
        const start = performance.now();
        let last = start;

        renderer.setAnimationLoop((now) => {
          const dt = Math.min((now - last) / 1000, 0.05);
          last = now;
          // Off-screen slides are not drawn at all: the carousel keeps five of
          // them stacked, and a scene that kept rendering behind four opaque
          // images would be a GPU bill for nothing.
          if (!activeRef.current || document.hidden) return;

          if (stillPlease.matches) {
            camera.position.x = 0;
            camera.position.y = 0;
          } else {
            const t = (now - start) / 1000;
            const targetX =
              pointer.x * POINTER_SWAY_X + Math.sin(t * 0.21) * DRIFT_X;
            const targetY =
              -pointer.y * POINTER_SWAY_Y + Math.sin(t * 0.17 + 1.3) * DRIFT_Y;
            eased.x += (targetX - eased.x) * Math.min(dt * 2.6, 1);
            eased.y += (targetY - eased.y) * Math.min(dt * 2.6, 1);
            camera.position.x = eased.x;
            camera.position.y = eased.y;

            for (const field of [snowBack, snowFront]) {
              if (!field) continue;
              const p = field.positions;
              for (let i = 0; i < field.count; i++) {
                p[i * 3 + 1] -= field.speeds[i] * dt;
                p[i * 3] += Math.sin(t * 0.7 + field.phases[i]) * dt * 0.22;
                if (p[i * 3 + 1] < -frameH * 0.85) {
                  p[i * 3 + 1] = frameH * 0.85;
                  p[i * 3] = (Math.random() - 0.5) * FRAME_W * 1.5;
                }
              }
              field.points.geometry.attributes.position.needsUpdate = true;
            }
          }

          renderer.render(three, camera);
        });

        setReady(true);
        onReady?.();
      } catch {
        // A texture that will not load leaves the flat banner in place.
      }
    })();

    return () => {
      disposed = true;
      renderer.setAnimationLoop(null);
      ro?.disconnect();
      host.removeEventListener("pointermove", onPointerMove);
      host.removeEventListener("pointerleave", onPointerLeave);
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    };
    // Rebuilt only for a different scene — see activeRef above.
  }, [scene, onReady]);

  return (
    <div
      ref={hostRef}
      aria-hidden
      className="absolute inset-0 transition-opacity duration-700"
      style={{ opacity: ready ? 1 : 0 }}
    />
  );
}
