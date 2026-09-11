import Image from "next/image";
import clsx from "clsx";

// The owner's wordmark artwork (440×68, transparent). It replaces the typed
// "Smoothlife.com" that painted the brand gradient into Noto Sans Thai — the
// real lockup has its own letterforms and its own green/blue split.
const WIDTH = 440;
const HEIGHT = 68;

export default function BrandLogo({ className, priority = false }: { className?: string; priority?: boolean }) {
  return (
    <Image
      src="/brand/smoothlife-wordmark.png"
      alt="Smoothlife.com"
      width={WIDTH}
      height={HEIGHT}
      priority={priority}
      translate="no"
      // Height drives the size; width follows the artwork's ratio.
      className={clsx("block w-auto", className)}
    />
  );
}
