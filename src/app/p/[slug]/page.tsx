import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { publishedDoc } from "@/lib/pages/store";
import { renderSections } from "@/lib/pages/render";
import { pageTitleOf } from "@/lib/pages/store";
import { ogImages, withSeoOverride } from "@/lib/seo-overrides";
import { DEFAULT_LOCALE } from "@/lib/i18n/localized";

// Pages the team builds themselves — /p/about-us, /p/skin-care-guide.
//
// Unlike the home page there is no document built into the code to fall back
// on: a page nobody has published is a page that does not exist, and saying
// so is more honest than showing an empty shell at a URL someone shared.

export const revalidate = 1800;

export async function generateMetadata(props: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await props.params;
  const title = (await pageTitleOf("page", slug)) ?? "Smoothlife.com";
  // Same override table as every other page type, so whoever writes the
  // titles has one place to do it rather than one per feature.
  const seo = await withSeoOverride("page", slug, { title: `${title} | Smoothlife.com` });
  return {
    title: seo.title,
    description: seo.description,
    alternates: { canonical: `/p/${slug}` },
    openGraph: { title: seo.title, description: seo.description, ...ogImages(seo.image) },
  };
}

export default async function BuiltPage(props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params;
  const doc = await publishedDoc("page", slug);
  if (!doc) notFound();

  const sections = await renderSections(doc, {
    kind: "page",
    slug,
    now: new Date(),
        locale: DEFAULT_LOCALE,
    isPreview: false,
  });

  return <div className="bg-[#FAFAF8]">{sections}</div>;
}
