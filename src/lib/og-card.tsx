import { ImageResponse } from "next/og";

// The default card a shared link shows when nobody has attached a picture of
// their own.
//
// A product photo and a brand logo are square, and the card a link preview
// draws is 1.91:1 — hand either one over as it is and the apps crop a third
// of it away, usually the top and bottom. Some brand logos are also smaller
// than the 600px those apps want for a large card.
//
// So the square picture is placed on a 1200x630 card rather than stretched
// into one: centred, contained, never cropped, on plain white. Nothing else
// on the card — no panel, no shadow, no wording. The words belong to the
// preview, which prints the title and description beside this picture; the
// card's one job is to show the thing.
//
// A picture attached in SEO หน้าเว็บ skips all of this and is used as it is:
// somebody chose it, including its shape.

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";

/** As tall as 1200x630 allows with a little air, so the picture is the card
 *  rather than a stamp in the middle of one. */
const PICTURE = 570;

export async function ogCard({ image }: { image?: string }) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#FFFFFF",
        }}
      >
        {image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt=""
            width={PICTURE}
            height={PICTURE}
            style={{ objectFit: "contain" }}
          />
        )}
      </div>
    ),
    OG_SIZE
  );
}
