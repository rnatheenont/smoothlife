import * as THREE from "three";

// The room the drum stands in: a winter night, after the campaign's own key
// art — snow under a violet sky, pines at both edges, mountains on the
// horizon and an aurora coming in from the top right.
//
// Built rather than photographed. A backdrop image would be one flat plane
// however good it looked, and the trees have to be in front of the sky,
// behind the drum, and lit by the same lights as everything else for the
// scene to read as a place. It also costs nothing to download.

/**
 * The campaign's own artwork, if somebody has put it there.
 *
 * Drop the key visual at this path and it replaces the painted scenery
 * outright — sky, ridge, snow and trees all come from the picture, and the
 * built ones switch off rather than being drawn on top of it. Leave it out
 * and the scene paints itself, so the page never depends on a file being
 * present.
 */
export const BACKDROP_IMAGE = "/lucky-draw/winter-night.jpg";

export const WINTER = {
  skyTop: "#070b24",
  skyMid: "#241a4e",
  skyLow: "#6e4172",
  horizon: "#e9bcd4",
  aurora: "#86f0d2",
  snow: "#eaf0ff",
  pine: "#0d1630",
  /** The one colour anything on the drum is allowed to be. */
  accent: "#dbe4ff",
  glow: "#b9a8ff",
};

function canvasTexture(w: number, h: number, draw: (c: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  draw(canvas.getContext("2d")!);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** How big the backdrop is cut, in scene units. Wider than the frame at
 *  this distance, so whatever is on it is cropped rather than letterboxed. */
const SKY_W = 110;
const SKY_H = 62;

/** The sky itself: one unlit plane a long way back, and the only thing in
 *  the scene that is allowed to be bright without a light on it. */
export function skyBackdrop(): THREE.Mesh {
  const tex = canvasTexture(16, 512, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, 512);
    g.addColorStop(0, WINTER.skyTop);
    g.addColorStop(0.5, WINTER.skyMid);
    g.addColorStop(0.76, WINTER.skyLow);
    g.addColorStop(0.88, WINTER.horizon);
    g.addColorStop(1, "#f6e6ee");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 16, 512);
  });
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(SKY_W, SKY_H),
    new THREE.MeshBasicMaterial({ map: tex, fog: false, depthWrite: false }),
  );
  mesh.position.set(0, 2, -42);
  return mesh;
}

/** Light coming in over the right shoulder, the way it does in the artwork. */
export function auroraRibbons(): THREE.Group {
  const tex = canvasTexture(256, 256, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, "#ffffff00");
    g.addColorStop(0.35, `${WINTER.aurora}88`);
    g.addColorStop(0.6, "#bfe9ff55");
    g.addColorStop(1, "#ffffff00");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
    // Feathered at both ends so the ribbon has no edge to give it away.
    const fade = ctx.createLinearGradient(0, 0, 256, 0);
    fade.addColorStop(0, "#00000000");
    fade.addColorStop(0.5, "#000000ff");
    fade.addColorStop(1, "#00000000");
    ctx.globalCompositeOperation = "destination-in";
    ctx.fillStyle = fade;
    ctx.fillRect(0, 0, 256, 256);
  });

  const group = new THREE.Group();
  const sizes: [number, number, number, number, number][] = [
    // width, height, x, y, tilt
    [22, 30, 10, 7, -0.5],
    [15, 24, 14.5, 3.5, -0.38],
    [26, 20, 5, 11, -0.62],
  ];
  for (const [w, h, x, y, tilt] of sizes) {
    const ribbon = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        opacity: 0.45,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
      }),
    );
    ribbon.position.set(x, y, -36);
    ribbon.rotation.z = tilt;
    group.add(ribbon);
  }
  return group;
}

/** The far ridge. Drawn once into a texture, because a silhouette is a
 *  shape and not a surface — nothing is ever lit by what it is made of. */
export function mountainRange(): THREE.Mesh {
  const tex = canvasTexture(1024, 256, (ctx) => {
    ctx.clearRect(0, 0, 1024, 256);
    const peaks = (base: number, height: number, step: number, color: string, snow: boolean) => {
      ctx.beginPath();
      ctx.moveTo(0, 256);
      let x = 0;
      let up = true;
      let y = base;
      while (x < 1024) {
        const dx = step * (0.6 + Math.random() * 0.8);
        y = up ? base - height * (0.55 + Math.random() * 0.45) : base - height * 0.12 * Math.random();
        x += dx;
        ctx.lineTo(x, y);
        up = !up;
      }
      ctx.lineTo(1024, 256);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
      if (snow) {
        // A wash of light down the upper half, which is all a snow line is
        // at this distance.
        const g = ctx.createLinearGradient(0, base - height, 0, base);
        // Was near-white, which turned the ridge into a row of paper
        // triangles standing between the trees. A snow line thirty units
        // away is a suggestion, not a highlight.
        g.addColorStop(0, "#ffffff55");
        g.addColorStop(1, "#ffffff00");
        ctx.globalCompositeOperation = "source-atop";
        ctx.fillStyle = g;
        ctx.fillRect(0, base - height, 1024, height);
        ctx.globalCompositeOperation = "source-over";
      }
    };
    peaks(232, 104, 120, "#3b3163", true);
    peaks(246, 64, 165, "#282150", false);
  });

  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(90, 22),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, fog: false }),
  );
  mesh.position.set(0, -3.4, -36);
  return mesh;
}

/** The ground: snow catching the sky's own colour, fading out before it
 *  reaches an edge it would have to explain. */
export function snowGround(): THREE.Mesh {
  const tex = canvasTexture(64, 256, (ctx) => {
    // Top of the texture is the far edge, which has to vanish into the
    // horizon rather than stop on a line.
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, "#b9c9f500");
    g.addColorStop(0.12, "#c6d4f8aa");
    g.addColorStop(0.45, "#e7eeffff");
    g.addColorStop(1, "#f4f7ffff");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 256);
  });
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(140, 80),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, fog: false }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(0, -7.4, -14);
  return mesh;
}

function pine(height: number): THREE.Group {
  const tree = new THREE.Group();
  // Unlit, and no snow on the branches. These are a silhouette against the
  // sky: lighting them turned every tree into a grey pyramid, because the
  // spotlights are aimed at the drum and barely reach this far, and the pale
  // cones meant as snow read as holes punched through each tier.
  const dark = new THREE.MeshBasicMaterial({ color: WINTER.pine, fog: true });

  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(height * 0.025, height * 0.04, height * 0.2, 5), dark);
  trunk.position.y = height * 0.1;
  tree.add(trunk);

  const tiers = 4;
  for (let i = 0; i < tiers; i++) {
    const t = i / tiers;
    const r = height * (0.27 - t * 0.155);
    const h = height * 0.33;
    const y = height * (0.18 + t * 0.63);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(r, h, 7), dark);
    cone.position.y = y;
    tree.add(cone);
  }
  return tree;
}

/**
 * The treeline. Heavy at both edges and sparse across the back, which is
 * how the artwork is composed: the trees are a frame around the thing you
 * are meant to be looking at, not scenery to be toured.
 */
export function pineForest(): THREE.Group {
  const forest = new THREE.Group();
  const place = (x: number, z: number, h: number) => {
    const tree = pine(h);
    tree.position.set(x, -7.4, z);
    tree.rotation.y = Math.random() * Math.PI;
    forest.add(tree);
  };
  // Further out and further back than the first attempt, which put two of
  // them in front of the drum.
  const edge = [
    [-19, -20, 15], [-15.5, -26, 12], [-24, -16, 17], [-13, -31, 9],
    [19.5, -21, 14.5], [16, -27, 11], [24.5, -17, 16.5], [13.5, -32, 8.5],
  ] as const;
  for (const [x, z, h] of edge) place(x, z, h);
  for (let i = 0; i < 16; i++) {
    const x = -30 + i * 3.9 + (Math.random() - 0.5) * 1.6;
    if (Math.abs(x) < 7) continue;
    place(x, -34 - Math.random() * 4, 4 + Math.random() * 2.5);
  }
  return forest;
}

export type Snowfall = { points: THREE.Points; drift: Float32Array };

/** Falling snow, wrapped: a flake that reaches the bottom goes back to the
 *  top rather than the field being refilled. */
export function snowfall(count: number): Snowfall {
  const pos = new Float32Array(count * 3);
  const drift = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 46;
    pos[i * 3 + 1] = Math.random() * 26 - 10;
    pos[i * 3 + 2] = -24 + Math.random() * 30;
    drift[i * 3] = (Math.random() - 0.5) * 0.35;
    drift[i * 3 + 1] = -(0.5 + Math.random() * 1.3);
    drift[i * 3 + 2] = Math.random() * Math.PI * 2;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const points = new THREE.Points(
    geo,
    new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.14,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      fog: false,
    }),
  );
  return { points, drift };
}

export function stepSnowfall(snow: Snowfall, dt: number, now: number) {
  const attr = snow.points.geometry.getAttribute("position") as THREE.BufferAttribute;
  const arr = attr.array as Float32Array;
  for (let i = 0; i < arr.length / 3; i++) {
    arr[i * 3] += (snow.drift[i * 3] + Math.sin(now / 1400 + snow.drift[i * 3 + 2]) * 0.25) * dt;
    arr[i * 3 + 1] += snow.drift[i * 3 + 1] * dt;
    if (arr[i * 3 + 1] < -10) {
      arr[i * 3 + 1] = 16;
      arr[i * 3] = (Math.random() - 0.5) * 46;
    }
  }
  attr.needsUpdate = true;
}

/**
 * The whole night, assembled.
 *
 * One call rather than five, because the pieces have to know about each
 * other: if the artwork loads, everything that was standing in for it has to
 * go, and that is not a decision the stage should be making.
 */
export function winterNight(): { group: THREE.Group; aurora: THREE.Group } {
  const sky = skyBackdrop();
  const aurora = auroraRibbons();
  const ridge = mountainRange();
  const ground = snowGround();
  const trees = pineForest();
  const group = new THREE.Group();
  group.add(sky, aurora, ridge, ground, trees);

  new THREE.TextureLoader().load(
    BACKDROP_IMAGE,
    (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      const mat = sky.material as THREE.MeshBasicMaterial;
      mat.map = tex;
      mat.needsUpdate = true;
      // The plane was cut for the painted sky's proportions. Squeezed to
      // the picture's instead, so the artwork is not stretched to fit a
      // shape that was never about it.
      const image = tex.image as { width: number; height: number } | undefined;
      if (image?.width && image.height) {
        sky.scale.y = SKY_W / (image.width / image.height) / SKY_H;
      }
      // The picture already has all of this in it.
      for (const built of [aurora, ridge, ground, trees]) built.visible = false;
    },
    undefined,
    // No file is the normal case, not an error worth a console line.
    () => {},
  );

  return { group, aurora };
}
