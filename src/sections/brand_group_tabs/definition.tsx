import { z } from "zod";
import type { SectionDefinition } from "@/lib/pages/types";

// Retired. The chips this drew are now the tabs inside "สินค้าแยกตามประเภท".
//
// Kept rather than deleted, and deliberately so. Three brand pages already
// hold one of these (dentiste, janeke, smooth-e), and this system has no
// migration step on purpose — a migrate() that rewrites documents runs on
// every render forever, because nothing writes the new shape back, and that
// has already cost this shop an outage once. Deleting the type instead would
// make those three documents carry a section the registry does not know,
// which renders as a red "section ถูกเลิกใช้" box in the editor's preview:
// alarming, on a page where nothing is actually wrong.
//
// So it stays, draws nothing, and cannot be added to anything new:
// enabledOn is empty, which is what takes it out of the editor's library
// (see sectionsFor). A page that still lists it loses nothing by keeping it
// and nothing by removing it — the team can delete it whenever they next
// open that page.

const schema = z.object({});

function Component() {
  return null;
}

export const brandGroupTabs: SectionDefinition<typeof schema> = {
  type: "brand_group_tabs",
  version: 1,
  label: "ปุ่มลัดประเภทสินค้า (เลิกใช้แล้ว)",
  description: "ย้ายไปเป็นแท็บใน “สินค้าแยกตามประเภท” แล้ว — ลบออกจากหน้านี้ได้เลย",
  category: "brand",
  schema,
  defaults: {},
  fields: [],
  // Empty on purpose: the editor offers a section only for the kinds listed
  // here, so this one is offered nowhere while the instances that exist go
  // on rendering (as nothing).
  enabledOn: [],
  maxPerPage: 1,
  Component,
};
