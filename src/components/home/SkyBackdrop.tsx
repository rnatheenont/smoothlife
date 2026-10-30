// The painted scene behind a seasonal hero sky: a soft 3D diorama made to
// match the mascot (Figma AI, smoothlife-mascot/hero-sky/), with the middle
// left as open sky for the headline and the ask box. The seasonal sky
// components lay their animation — bats, snow, fireworks — over it.
//
// The band's shape runs from ~1.4:1 on a phone to ~6.4:1 on a 2560px screen,
// so there are two cuts (build_sizes.py), each cropped by object-cover:
//   phones (<768)  <name>-sm.webp    a 1.4:1 crop around the scene
//   768 and up     <name>-wide.webp  5:1 — the painting with its edges
//                                    continued outwards, the scene a quarter
//                                    in from the left. Anchored at 28% across,
//                                    so on a tablet the crop eats the empty
//                                    right side, not the scene, and the scene
//                                    stays left of the headline and ask box.
// ~20–70 KB each, one per visit. Not under /mascot/, so the service worker
// does not keep an old copy.

export default function SkyBackdrop({ name, position = "28% 45%" }: { name: string; position?: string }) {
  return (
    <picture className="absolute inset-0 -z-20 block">
      <source media="(max-width: 767px)" srcSet={`/hero-sky/${name}-sm.webp`} />
      <img
        src={`/hero-sky/${name}-wide.webp`}
        alt=""
        aria-hidden="true"
        // the band is the top of the home page: fetch it first, so the
        // painting arrives with the page rather than seconds after it
        fetchPriority="high"
        className="h-full w-full object-cover"
        style={{ objectPosition: position }}
      />
    </picture>
  );
}
