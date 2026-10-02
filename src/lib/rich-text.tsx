import type { ReactNode } from "react";

// A very small amount of formatting, stored as plain text.
//
// The alternative was a WYSIWYG writing HTML into the row, which means
// sanitising it again on the way out and trusting that the sanitiser and the
// renderer agree forever. Product pages are not worth that: what copy here
// actually needs is bold, emphasis, and a list — so those three travel as
// markers in the text and are turned into elements at render time. Nothing is
// ever handed to dangerouslySetInnerHTML, so there is nothing to escape and
// nothing an admin could paste that would run.
//
// Text written before any of this renders exactly as it did: no markers, no
// change.

/** `**bold**` and `*italic*`, left to right, nothing nested. */
function inline(text: string, keyPrefix: string): ReactNode[] {
  const out: ReactNode[] = [];
  const pattern = /\*\*([^*]+)\*\*|\*([^*]+)\*/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let i = 0;
  while ((match = pattern.exec(text))) {
    if (match.index > last) out.push(text.slice(last, match.index));
    if (match[1] !== undefined) {
      out.push(
        <strong key={`${keyPrefix}-b${i}`} className="font-semibold text-brand-ink">
          {match[1]}
        </strong>
      );
    } else {
      out.push(<em key={`${keyPrefix}-i${i}`}>{match[2]}</em>);
    }
    last = pattern.lastIndex;
    i++;
  }
  if (last < text.length) out.push(text.slice(last));
  return out.length ? out : [text];
}

/**
 * The same two markers, for text that is already one line of something else —
 * an item in a bullet list, a name in the ingredients row. No paragraphs, no
 * list: those lines are the list.
 */
export function renderInline(text: string): ReactNode {
  return <>{inline(text, "x")}</>;
}

/**
 * Lines beginning "- " or "• " become a list; everything else stays a
 * paragraph with its line breaks intact, which is how this text has always
 * been shown.
 */
export function renderRichText(text: string): ReactNode {
  if (!text) return null;
  const lines = text.split("\n");
  const chunks: ReactNode[] = [];
  let paragraph: string[] = [];
  let bullets: string[] = [];

  const flushParagraph = () => {
    if (!paragraph.length) return;
    const body = paragraph.join("\n").trim();
    if (body) {
      chunks.push(
        <p key={`p${chunks.length}`} className="whitespace-pre-line">
          {inline(body, `p${chunks.length}`)}
        </p>
      );
    }
    paragraph = [];
  };
  const flushBullets = () => {
    if (!bullets.length) return;
    chunks.push(
      <ul key={`u${chunks.length}`} className="ms-4 list-disc space-y-1">
        {bullets.map((b, i) => (
          <li key={i}>{inline(b, `u${chunks.length}-${i}`)}</li>
        ))}
      </ul>
    );
    bullets = [];
  };

  for (const line of lines) {
    const bullet = /^\s*[-•]\s+(.*)$/.exec(line);
    if (bullet) {
      flushParagraph();
      bullets.push(bullet[1]);
    } else {
      flushBullets();
      paragraph.push(line);
    }
  }
  flushParagraph();
  flushBullets();

  return <div className="space-y-2">{chunks}</div>;
}
