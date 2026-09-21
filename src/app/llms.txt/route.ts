import { categories, concerns } from "@/data/categories";
import { brands } from "@/data/brands";
import { getPublicQuestions } from "@/lib/kb-public";
import { SITE_URL } from "@/lib/site-url";

// llms.txt (llmstxt.org): the same idea as robots.txt/sitemap.xml, but
// written for something that reads prose instead of crawling links — a
// short, curated map of the shop so an AI answering a question about us can
// get oriented in one fetch instead of piecing it together from HTML across
// a dozen pages. Regenerated per request from the same data the rest of the
// site renders from, so it can never drift out of date the way a hand-typed
// file would.
export const revalidate = 900;

function section(title: string, lines: string[]): string {
  if (lines.length === 0) return "";
  return `\n## ${title}\n${lines.join("\n")}\n`;
}

export async function GET() {
  const questions = await getPublicQuestions().catch(() => []);

  const body =
    `# Smoothlife.com\n\n` +
    `> ศูนย์รวมสินค้าสุขภาพและความงาม Smooth E, Dentiste และแบรนด์พันธมิตร ` +
    `ส่งฟรีทั่วประเทศไทย ของแท้จากผู้จัดจำหน่ายโดยตรง\n` +
    section(
      "หมวดหมู่สินค้า",
      categories.map((c) => `- [${c.nameTh}](${SITE_URL}/shop/${c.slug})`)
    ) +
    section(
      "ปัญหาผิวที่ตอบโจทย์",
      concerns.map((c) => `- [${c.nameTh}](${SITE_URL}/concern/${c.slug}): ${c.description}`)
    ) +
    section(
      "แบรนด์",
      brands.map((b) => `- [${b.name}](${SITE_URL}/brands/${b.slug}): ${b.tagline}`)
    ) +
    // Newest first, capped: this is a pointer for a model to fetch from, not
    // the answers themselves — the full, current list is always the live
    // page, never worth re-shipping wholesale into a static-feeling file.
    section(
      "คำถามที่พบบ่อย (ตอบโดยทีมงานจริง ไม่ใช่เนื้อหาการตลาด)",
      questions.slice(0, 30).map((q) => `- [${q.title}](${SITE_URL}/knowledge/questions/${encodeURIComponent(q.public_slug)})`)
    ) +
    section("ข้อมูลเพิ่มเติม", [
      `- [คำถามที่พบบ่อยทั้งหมด](${SITE_URL}/knowledge/questions)`,
      `- [บทความความรู้ผิวและสุขภาพ](${SITE_URL}/knowledge)`,
      `- [Sitemap](${SITE_URL}/sitemap.xml)`,
    ]);

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
