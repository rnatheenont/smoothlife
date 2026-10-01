// Depth versions of hero banners.
//
// A campaign creative arrives as one flat picture. When the artwork has also
// been supplied as its separate pieces — the scene behind, the people cut out
// of it, the lettering — those pieces can be hung at different distances and
// the banner stops being a poster and becomes a window. Only worth doing for
// a campaign somebody has prepared the layers for, which is why this is a
// list of named scenes rather than something the carousel does to everything.
//
// The measurements are not guesses. The layers were exported at their own
// crops and scales, so each one's placement was solved against the flat
// artwork in the browser — draw the layers over the original, score the
// difference, and walk the numbers downhill — then checked by eye against it.
// They are fractions of the banner's own width and height, top-left anchored,
// so they hold at any size the banner is drawn.

export type Hero3DLayer = {
  src: string;
  /** Width as a fraction of the banner's width. */
  w: number;
  /** Top-left corner, as fractions of the banner's width and height. */
  x: number;
  y: number;
  /**
   * How far in front of the flat artwork this layer sits, in the scene's own
   * units (the banner is 20 wide). Bigger means nearer the viewer, so it
   * swings further as the camera moves.
   */
  depth: number;
  /**
   * How many times to draw the layer on top of itself. The lettering was cut
   * out of the artwork with soft, half-transparent edges, so drawn once it
   * arrives paler than the same words on the flat banner; each extra pass
   * compounds the alpha and puts the weight back. Checked by fading the
   * scene out over the flat banner underneath and looking for a change.
   */
  boost?: number;
  /**
   * How far below its own bottom edge to carry the layer, as a fraction of its
   * height. The people's picture is cut off at the bottom, which in a flat
   * banner is simply where the banner ends; in a scene that leans, the cut
   * came away from the frame's edge and became a straight line across their
   * waists. This repeats the bottom row of pixels downward so the bodies carry
   * on out of the frame, and adds nothing inside the picture — the artwork
   * keeps the exact size and place it has in the flat banner.
   *
   * Downward only, deliberately. Doing the same at the sides smeared the two
   * outstretched arms, which the edges cut across rather than along, into a
   * pair of flat bars hanging in the snow.
   */
  bleedBottom?: number;
};

export type Hero3DScene = {
  /** Matched against the slide's image URL, so a live banner finds it too. */
  match: RegExp;
  aspect: number;
  /** Drawn first, filling the frame — the only layer allowed to be cropped. */
  background: string;
  layers: Hero3DLayer[];
  /** Flakes drifting between the layers. 0 turns the snow off. */
  snow: number;
};

const WINTER = "/hero/winter-festival";

export const hero3DScenes: Hero3DScene[] = [
  {
    // Dentiste' LIVE "Winter Festival", Smooth Life Tower, 8 Nov 2026.
    // KNP-WEB_4 is the wide desktop crop of it; _5 is the phone one, which
    // this never sees because the scene is desktop-only.
    match: /KNP-WEB/i,
    aspect: 1721 / 914,
    background: `${WINTER}/bg.webp`,
    layers: [
      // Behind the people in the original, and it stays behind them here.
      {
        src: `${WINTER}/title.png`,
        w: 0.453,
        x: 0.276,
        y: 0.012,
        depth: 2.6,
        boost: 2,
      },
      {
        src: `${WINTER}/people.webp`,
        // Re-fitted when the cutout was replaced with one whose arms are whole
        // rather than cut off at the picture's edges. The new file is the same
        // 1721x914 canvas but the figures sit smaller inside it, so the layer
        // is drawn nearly full width and starts just off the left edge. Two
        // independent fits agreed: the whole frame scored against the flat
        // banner, and the faces alone — the one part of the two pictures that
        // is pixel-for-pixel the same.
        w: 0.984,
        x: -0.04,
        y: 0.205,
        depth: 5.2,
        bleedBottom: 0.12,
      },
      // The date sits on their shirts in the original, so it is nearest.
      {
        src: `${WINTER}/date.png`,
        w: 0.262,
        x: 0.362,
        y: 0.806,
        depth: 7.4,
        boost: 3,
      },
    ],
    snow: 320,
  },
];

export function hero3DSceneFor(imageUrl: string): Hero3DScene | null {
  return hero3DScenes.find((s) => s.match.test(imageUrl)) ?? null;
}
