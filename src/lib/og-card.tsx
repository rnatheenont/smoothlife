import { ImageResponse } from "next/og";

// The picture a shared link shows, built around a picture the shop already
// has.
//
// A product photo and a brand logo are both square, and the card a link
// preview draws is 1.91:1 — hand either one over as it is and LINE and
// Facebook cut a third of it away, usually the top and bottom. Some brand
// logos are also smaller than the 600px those apps want for a large card, so
// they quietly fall back to a thumbnail beside the text.
//
// So the square picture is placed on a 1200x630 card rather than stretched
// into one: contained, never cropped, on the shop's own background. Every
// page gets a card of the right shape and size without anyone uploading
// anything.
//
// No Thai on the card on purpose. Satori draws text with the fonts it is
// handed, and shipping a Thai font to every one of these would be a megabyte
// per render for words the preview already shows as the title underneath.
// The picture carries the card; the words beside it are the og:title.

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";

/** Latin only — see above. A Thai brand name simply leaves the line off. */
function latinOnly(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed && /^[\x20-\x7E\u00C0-\u024F\u2018\u2019]+$/.test(trimmed) ? trimmed : null;
}

export async function ogCard({ image, label }: { image?: string; label?: string }) {
  const caption = latinOnly(label);
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #F2FAF7 0%, #FFFFFF 55%, #EEF7FB 100%)",
          position: "relative",
        }}
      >
        {image && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 470,
              height: 470,
              borderRadius: 36,
              background: "#FFFFFF",
              boxShadow: "0 24px 60px rgba(15, 23, 42, 0.12)",
              overflow: "hidden",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image} alt="" width={430} height={430} style={{ objectFit: "contain" }} />
          </div>
        )}

        {caption && (
          <div
            style={{
              marginTop: 28,
              fontSize: 34,
              fontWeight: 700,
              color: "#15202b",
              letterSpacing: "-0.5px",
            }}
          >
            {caption}
          </div>
        )}

        <div
          style={{
            position: "absolute",
            left: 56,
            bottom: 44,
            display: "flex",
            alignItems: "center",
            fontSize: 24,
            fontWeight: 700,
            color: "#05755f",
          }}
        >
          smoothlife.com
        </div>
      </div>
    ),
    OG_SIZE
  );
}
