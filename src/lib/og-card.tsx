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
// into one: as tall as the card allows, contained, never cropped, on the
// shop's own background. Every page gets a card of the right shape and size
// without anyone uploading anything.
//
// No Thai on the card on purpose. Satori draws text with the fonts it is
// handed, and shipping a Thai font to every one of these would be a megabyte
// per render for words the preview already shows as the title underneath.
// The picture carries the card; the words beside it are the og:title.

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";

/** As tall as 1200x630 allows with a hair of margin, so the picture is the
 *  card rather than a stamp in the middle of one. */
const PICTURE = 586;

/** Latin only — see above. A Thai brand name simply leaves the line off. */
function latinOnly(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed && /^[\x20-\x7EÀ-ɏ‘’]+$/.test(trimmed) ? trimmed : null;
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
              width: PICTURE,
              height: PICTURE,
              borderRadius: 32,
              background: "#FFFFFF",
              boxShadow: "0 20px 50px rgba(15, 23, 42, 0.10)",
              overflow: "hidden",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image}
              alt=""
              width={PICTURE}
              height={PICTURE}
              style={{ objectFit: "contain" }}
            />
          </div>
        )}

        {/* In the gutter beside the picture rather than under it: the picture
            uses the full height of the card now, and the sides are what is
            left over. */}
        <div
          style={{
            position: "absolute",
            left: 54,
            top: 0,
            bottom: 0,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            maxWidth: 240,
          }}
        >
          {caption && (
            <div style={{ fontSize: 30, fontWeight: 700, color: "#15202b", lineHeight: 1.2 }}>
              {caption}
            </div>
          )}
          <div style={{ marginTop: 10, fontSize: 21, fontWeight: 700, color: "#05755f" }}>
            smoothlife.com
          </div>
        </div>
      </div>
    ),
    OG_SIZE
  );
}
