import { revalidateTag } from "next/cache";
import { after } from "next/server";
import { pingFaqChanged } from "@/lib/indexnow";

/**
 * One answer changed. Everything that needs to hear about it, in one call.
 *
 * Seven admin routes can change what the FAQ says — editing an answer,
 * publishing a draft, answering a gap, answering a product question,
 * importing a batch, rolling one back, re-seeding. Each of them used to
 * remember to clear the public cache on its own, and now each of them also
 * has to tell Bing. Seven places that must each remember two things is how
 * one of them quietly stops doing one of them: this session has already
 * spent an afternoon on a product page and an admin preview that drifted
 * apart for exactly that reason.
 *
 * Slugs go to IndexNow whatever state the answer is now in. "This URL
 * changed" is true of an answer that was just taken down as much as one just
 * published, and submitting the removed one is how it leaves the index in
 * days instead of waiting for a recrawl to find the 404.
 *
 * The ping runs through `after()`, so the admin's save returns without
 * waiting on it, and it cannot fail the save.
 */
export function faqChanged(slugs: (string | null | undefined)[] = []): void {
  revalidateTag("kb-public", { expire: 0 });
  for (const slug of slugs) {
    if (slug) revalidateTag(`kb-public:${slug}`, { expire: 0 });
  }
  after(() => pingFaqChanged(slugs));
}

/**
 * The knowledge base changed, but nothing a reader can see did — a draft was
 * written, or a gap was filed against an answer that already existed.
 *
 * Clears the cache and tells no search engine, which is the whole point of
 * having a second name for it: submitting /faq every time somebody saves a
 * draft would teach IndexNow that our submissions do not mean anything, and
 * the quota is per host.
 */
export function kbDraftChanged(): void {
  revalidateTag("kb-public", { expire: 0 });
}
