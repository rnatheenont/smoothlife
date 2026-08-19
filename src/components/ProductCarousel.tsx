import { Product } from "@/data/types";
import ProductCard from "./ProductCard";
import SectionHeading from "./SectionHeading";
import StaggerGrid from "./StaggerGrid";

export default function ProductCarousel({
  title,
  subtitle,
  href,
  products,
}: {
  title: string;
  subtitle?: string;
  href?: string;
  products: Product[];
}) {
  if (products.length === 0) return null;

  return (
    <div>
      <SectionHeading title={title} subtitle={subtitle} href={href} />
      <StaggerGrid
        className="flex gap-3 md:gap-5 overflow-x-auto snap-x snap-mandatory scrollbar-none pb-1 -mx-4 px-4 md:mx-0 md:px-0"
        stagger={0.06}
      >
        {products.map((p) => (
          <div key={p.slug} className="shrink-0 snap-start w-[45vw] sm:w-56 md:w-64">
            <ProductCard product={p} />
          </div>
        ))}
      </StaggerGrid>
    </div>
  );
}
