// The skin-check tab's icon, with the scanner actually scanning.
//
// Drawn here rather than taken from lucide because the point of this one is
// the movement: a line sweeping down the face is what a phone does when it
// reads one, and it is the only thing in the bar that tells you this tab
// does something to you rather than taking you somewhere. The frame and the
// face keep lucide's ScanFace geometry so it still reads as one set with
// the four icons beside it.
//
// Props match lucide's so it drops straight into the same tab list.

export default function ScanFaceIcon({
  size = 21,
  strokeWidth = 1.9,
  className,
}: {
  size?: number;
  strokeWidth?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {/* The four corners of the frame it is reading you through. */}
      <path d="M3 7V5a2 2 0 0 1 2-2h2" />
      <path d="M17 3h2a2 2 0 0 1 2 2v2" />
      <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
      <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
      {/* Eyes and mouth. */}
      <path d="M9 9h.01" />
      <path d="M15 9h.01" />
      <path d="M8.5 14.4s1.2 1.4 3.5 1.4 3.5-1.4 3.5-1.4" />
      {/* The sweep. Thinner than everything else so that at 21px it reads as
          a beam passing over the face and not as another feature of it; the
          keyframes fade it out at both ends of the travel so it appears to
          enter and leave the frame rather than bouncing off the edges.
          Reduced motion stops it — globals.css pins every animation to one
          0.01ms pass, which leaves this resting mid-face at full opacity. */}
      <path
        d="M6.6 12h10.8"
        strokeWidth={Math.max(1.3, strokeWidth - 0.5)}
        className="animate-scanSweep"
      />
    </svg>
  );
}
