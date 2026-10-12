import { cookies } from "next/headers";
import { supabaseConfigured, supabaseRest, pgValue } from "@/lib/supabase-server";
import { ADMIN_COOKIE, verifyAdminToken } from "@/lib/admin-auth";
import { migrateDoc } from "@/lib/pages/doc";
import { renderSections } from "@/lib/pages/render";
import type { PageKind } from "@/lib/pages/types";
import type { PageRow } from "@/lib/pages/store";

// The draft, drawn exactly the way the live page draws it.
//
// It lives outside /admin so the editor can put it in an iframe without the
// admin sidebar and header coming along — the point of a preview is to see
// the page, not the tool. Being outside /admin also means it is not covered
// by the proxy's gate, so it checks the admin cookie itself, right here. A
// draft is unpublished work; it should be no easier to read than the editor.
//
// isPreview: true, so a section that fails shows a red box explaining itself
// instead of silently vanishing. On the live page it vanishes, because a
// customer should not be shown our plumbing; here, a section that disappears
// while you are editing it is a bug nobody can report.

export const dynamic = "force-dynamic";

export const metadata = {
  title: "ตัวอย่างก่อนเผยแพร่",
  robots: { index: false, follow: false },
};

const KINDS: PageKind[] = ["home", "page", "campaign", "brand"];

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh place-items-center bg-surface-soft p-8 text-center">
      <p className="max-w-sm text-sm text-slate-600">{children}</p>
    </div>
  );
}

export default async function PagePreview(props: { params: Promise<{ kind: string; slug: string }> }) {
  const { kind: rawKind, slug } = await props.params;

  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!verifyAdminToken(token)) return <Notice>ต้องเข้าสู่ระบบแอดมินก่อนจึงจะดูตัวอย่างได้</Notice>;
  if (!supabaseConfigured()) return <Notice>ยังเชื่อมต่อฐานข้อมูลไม่ได้</Notice>;

  const kind = KINDS.find((k) => k === rawKind);
  if (!kind) return <Notice>ไม่รู้จักประเภทเพจนี้</Notice>;

  const [page] = await supabaseRest<PageRow[]>(
    `pages?select=*&kind=eq.${pgValue(kind)}&slug=eq.${pgValue(slug)}&limit=1`
  );
  if (!page) return <Notice>ยังไม่มีเพจนี้ — เปิดในหน้าแก้ไขหนึ่งครั้งเพื่อสร้าง</Notice>;

  const doc = migrateDoc(page.draft_doc);
  if (doc.sections.length === 0) return <Notice>ร่างนี้ยังไม่มี section เลย</Notice>;

  const sections = await renderSections(doc, {
    kind,
    slug,
    now: new Date(),
    isPreview: true,
  });

  // The same canvas the home page paints on, so what is in the frame is what
  // would be on the site.
  return <div className="bg-[#FAFAF8]">{sections}</div>;
}
