import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { subscriptionSets, subscriptionSetProducts, subscriptionPlans } from "@/data/subscriptions";
import { twoC2PConfigured } from "@/lib/2c2p";
import SubscriptionSetDetail from "@/components/SubscriptionSetDetail";

export function generateStaticParams() {
  return subscriptionSets.map((s) => ({ slug: s.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }) {
  const set = subscriptionSets.find((s) => s.slug === params.slug);
  return { title: set ? `${set.name} | Smoothlife.com` : "Subscription | Smoothlife.com" };
}

export default function SubscriptionSetPage({ params }: { params: { slug: string } }) {
  const set = subscriptionSets.find((s) => s.slug === params.slug);
  if (!set) notFound();
  const products = subscriptionSetProducts(set);
  if (products.length === 0) notFound();

  return (
    <div className="container-page py-8 md:py-10">
      <nav className="mb-4 flex items-center gap-1.5 text-xs text-slate-400">
        <Link href="/subscription" className="hover:text-brand-emerald">
          Subscription
        </Link>
        <ChevronRight size={12} />
        <span className="text-slate-600 font-medium">{set.name}</span>
      </nav>
      <SubscriptionSetDetail set={set} products={products} plans={subscriptionPlans} subscriptionBillingEnabled={twoC2PConfigured()} />
    </div>
  );
}
