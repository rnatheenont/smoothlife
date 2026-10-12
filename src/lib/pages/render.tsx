import { Fragment } from "react";
import { isVisible, migrateDoc, MAX_SECTIONS, type SectionInstance } from "./doc";
import { SECTION_REGISTRY } from "@/sections/registry";
import type { AnySectionDefinition, RenderCtx } from "./types";
import SectionBoundary from "./SectionBoundary";
import SectionClicks from "@/components/pages/SectionClicks";

// Turning a stored document into a page, without ever returning nothing.
//
// The rule this file exists to keep: one bad section costs you that section.
// Not the page. A document is written by people through a form, read back
// months later by code that has moved on, and rendered against a catalogue
// where products get deleted — so every step here assumes its input is wrong
// and decides what to drop rather than what to throw.

type Skip = { id: string; type: string; reason: "unknown_type" | "invalid_settings" | "threw" };

function reportSkip(skip: Skip, ctx: RenderCtx) {
  // Production stays quiet in the page and loud in the log: a customer should
  // not be shown our plumbing, and we should not find out from the customer.
  console.error(`[pages] skipped section ${skip.id} (${skip.type}) on ${ctx.kind}/${ctx.slug}: ${skip.reason}`);
}

function PreviewSkip({ skip, label }: { skip: Skip; label: string }) {
  const why =
    skip.reason === "unknown_type"
      ? "ไม่รู้จักชนิดของ section นี้ — อาจถูกเลิกใช้ไปแล้ว"
      : skip.reason === "invalid_settings"
        ? "การตั้งค่าของ section นี้ไม่ครบหรือผิดรูปแบบ"
        : "section นี้ทำงานผิดพลาดตอนแสดงผล";
  return (
    <div className="container-page my-4">
      <div className="rounded-xl2 border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
        <p className="font-semibold">section นี้ไม่ถูกแสดงบนหน้าจริง</p>
        <p className="mt-1">
          {label} · {why}
        </p>
      </div>
    </div>
  );
}

/**
 * Loads one section's data, turning a failure into "no data".
 *
 * This is the only part of a server section that can genuinely be caught.
 * React does not run a component when its JSX is constructed, so wrapping
 * `<Component />` in a try/catch catches nothing at all — the component runs
 * afterwards, outside the block, and anything it throws reaches the route.
 * Keeping the fetching in `load` is what makes the net real: the fetch is
 * awaited here, inside the try, and a section whose data could not be read
 * draws without it instead of taking the page down.
 */
async function loadSafely(def: AnySectionDefinition, settings: unknown, raw: SectionInstance, ctx: RenderCtx) {
  if (!def.load) return { ok: true as const, data: undefined };
  try {
    return { ok: true as const, data: await def.load(settings, ctx) };
  } catch (err) {
    const skip: Skip = { id: raw.id, type: raw.type, reason: "threw" };
    reportSkip(skip, ctx);
    console.error(err);
    return { ok: false as const, data: undefined };
  }
}

/**
 * The whole page.
 *
 * Returns an array of elements rather than a wrapper, so the page that calls
 * it keeps control of its own background and padding — the home page paints
 * one canvas behind everything (see app/page.tsx) and a wrapper here would
 * put a box in the middle of it.
 */
export async function renderSections(doc: unknown, ctx: RenderCtx) {
  const page = migrateDoc(doc);

  const visible = page.sections
    .filter((s) => isVisible(s.common, ctx.now, ctx.phase))
    // Dropped rather than refused: a document that grew past the budget
    // should render the page someone meant, shortened, not nothing at all.
    .slice(0, MAX_SECTIONS);

  const drawn = await Promise.all(
    visible.map(async (raw, index) => {
      const def = SECTION_REGISTRY[raw.type] as AnySectionDefinition | undefined;
      if (!def) {
        const skip: Skip = { id: raw.id, type: raw.type, reason: "unknown_type" };
        reportSkip(skip, ctx);
        return ctx.isPreview ? <PreviewSkip key={raw.id} skip={skip} label={raw.type} /> : null;
      }

      const upgraded = def.migrate ? def.migrate(raw.settings, raw.v ?? def.version) : raw.settings;
      const parsed = def.schema.safeParse(upgraded);
      if (!parsed.success) {
        const skip: Skip = { id: raw.id, type: raw.type, reason: "invalid_settings" };
        reportSkip(skip, ctx);
        return ctx.isPreview ? <PreviewSkip key={raw.id} skip={skip} label={def.label} /> : null;
      }

      const loaded = await loadSafely(def, parsed.data, raw, ctx);
      if (!loaded.ok && ctx.isPreview) {
        return <PreviewSkip key={raw.id} skip={{ id: raw.id, type: raw.type, reason: "threw" }} label={def.label} />;
      }

      const Component = def.Component;
      return (
        <Fragment key={raw.id}>
          {/* The section's own anchor, so anything on the page can jump to it
              by the id the editor shows — the campaign jump tabs are built on
              this. A zero-height element rather than a wrapper around the
              section: a wrapper would change what counts as the first child
              of every section on the site, and nothing here is worth that.

              scroll-margin-top keeps the jumped-to heading out from under the
              sticky header (--app-header-h, set by Header on every resize)
              and from under a sticky jump bar if the page has one. Written as
              a style rather than an arbitrary Tailwind value because a calc()
              with a custom property inside a class name is exactly the sort
              of thing that silently compiles to nothing. */}
          <span
            id={raw.id}
            // Read by SectionClicks to tell which section a press belongs to.
            data-section-anchor={raw.id}
            aria-hidden="true"
            className="block"
            style={{ scrollMarginTop: "calc(var(--app-header-h, 0px) + 72px)" }}
          />
          <SectionBoundary id={raw.id} label={def.label} isPreview={ctx.isPreview}>
            <Component settings={parsed.data} data={loaded.data} common={raw.common} index={index} ctx={ctx} />
          </SectionBoundary>
        </Fragment>
      );
    })
  );

  // The click counter rides along with the sections rather than being added
  // by each page, so every page built from a document is measured and none
  // of them has to remember to ask. Never in the editor's preview: an admin
  // clicking through their own draft is not a customer pressing anything.
  return ctx.isPreview
    ? drawn
    : [<SectionClicks key="section-clicks" kind={ctx.kind} slug={ctx.slug} />, ...drawn];
}
