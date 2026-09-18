import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { getProductBySlug } from "@/data/products";
import { subscriptionPlans } from "@/data/subscriptions";
import { subscriptionBillingConfigured } from "@/lib/2c2p";
import { getSetById } from "@/lib/subscription-sets";
import { UUID_RE } from "@/lib/flash-sale";
import SubscriptionSetDetail from "@/components/SubscriptionSetDetail";

// A set the shop assembled in the admin console (as opposed to the three
// written into the catalogue data). Same page, same subscribe flow — what
// differs is that its price is the one an admin set, not the sum of its parts.
export const dynamic = "force-dynamic";

export async function generateMetadata(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const set = UUID_RE.test(id) ? await getSetById(id) : null;
  return { title: set ? `${set.name} | Smoothlife.com` : "Subscription | Smoothlife.com" };
}

export default async function CuratedSetPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const set = UUID_RE.test(id) ? await getSetById(id) : null;
  // Draft, archived, or missing an item that is out of stock: not for sale, so
  // not a page. A bundle is a promise about its contents.
  if (!set || !set.summary.sellable) notFound();

  const products = set.summary.items
    .map((item) => getProductBySlug(item.product_slug))
    .filter((p): p is NonNullable<typeof p> => Boolean(p));
  if (products.length === 0) notFound();

  return (
    <div className="container-page py-8 md:py-10">
      <nav className="mb-4 flex items-center gap-1.5 text-xs text-slate-500">
        <Link href="/subscription" className="hover:text-brand-800">
          Subscription
        </Link>
        <ChevronRight size={12} />
        <span className="font-medium text-slate-600">{set.name}</span>
      </nav>
      <SubscriptionSetDetail
        set={{ slug: set.id, name: set.name, tagline: set.description ?? "", productSlugs: products.map((p) => p.slug) }}
        products={products}
        plans={subscriptionPlans}
        subscriptionBillingEnabled={subscriptionBillingConfigured()}
        curated={{
          id: set.id,
          bundlePrice: set.summary.bundle,
          separately: set.summary.separately,
          savingPercent: set.summary.savingPercent,
          quantities: Object.fromEntries(set.summary.items.map((i) => [i.product_slug, i.quantity])),
        }}
      />
    </div>
  );
}
