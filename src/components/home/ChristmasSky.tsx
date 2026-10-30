import SkyBackdrop from "@/components/home/SkyBackdrop";

// The hero band's Christmas dress: a painted snowy night (the tree, presents,
// a cottage — see SkyBackdrop) with snow falling over it.
// Decoration only: aria-hidden, pointer-events-none, transforms and opacity.

// Flakes as [left %, top % of their half-track, px]. Two halves stacked in a
// 200%-tall track moving down exactly one half, so the fall never restarts.
const FLAKES: [number, number, number][] = [
  [4, 12, 4], [11, 61, 3], [17, 33, 5], [24, 80, 3], [29, 8, 4], [36, 47, 3], [42, 71, 5],
  [48, 22, 3], [55, 56, 4], [61, 4, 3], [66, 38, 5], [72, 77, 3], [78, 18, 4], [84, 52, 3],
  [90, 30, 5], [95, 68, 3], [8, 90, 3], [52, 92, 4], [70, 95, 3], [33, 97, 4],
];

export default function ChristmasSky() {
  return (
    <span aria-hidden="true" className="pointer-events-none absolute inset-0 -z-20 overflow-hidden">
      <SkyBackdrop name="christmas" />
      <span
        className="absolute inset-x-0 top-0 block h-[200%] motion-safe:animate-snowfall"
        style={{ animationDuration: "22s" }}
      >
        {[0, 1].map((half) => (
          <span key={half} className="relative block h-1/2">
            {FLAKES.map(([left, top, size]) => (
              <span
                key={`${left}-${top}`}
                className="absolute rounded-full bg-white"
                style={{ left: `${left}%`, top: `${top}%`, width: size, height: size, opacity: 0.55 + (size - 3) * 0.15 }}
              />
            ))}
          </span>
        ))}
      </span>
    </span>
  );
}
