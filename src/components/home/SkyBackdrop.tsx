// The painted scene behind a seasonal hero sky: a soft 3D diorama made to
// match the mascot (Figma AI, smoothlife-mascot/hero-sky/), with the middle
// left as open sky for the headline and the ask box. The seasonal sky
// components lay their animation — bats, snow, fireworks — over it.
//
// A picture rather than a drawing because the drawn skylines read flat next
// to a 3D mascot. Still small: ~45 KB, and a ~20 KB crop for phones, where
// the band is narrow and only the scene's left-of-centre would show anyway.
// Not under /mascot/, so the service worker does not keep an old copy.

export default function SkyBackdrop({ name, position = "50% 62%" }: { name: string; position?: string }) {
  return (
    <picture className="absolute inset-0 -z-20 block">
      <source media="(max-width: 767px)" srcSet={`/hero-sky/${name}-sm.webp`} />
      <img
        src={`/hero-sky/${name}.webp`}
        alt=""
        aria-hidden="true"
        decoding="async"
        className="h-full w-full object-cover"
        style={{ objectPosition: position }}
      />
    </picture>
  );
}
