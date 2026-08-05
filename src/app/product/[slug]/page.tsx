import { notFound } from "next/navigation";
import { getProductBySlug, getRelatedProducts, products } from "@/data/products";
import { generateReviews } from "@/data/reviews";
import ProductDetailInteractive from "@/components/ProductDetailInteractive";
import ProductCard from "@/components/ProductCard";
import SectionHeading from "@/components/SectionHeading";

export function generateStaticParams() {
  return products.map((p) => ({ slug: p.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }) {
  const product = getProductBySlug(params.slug);
  return { title: product ? `${product.name} | Smoothlife.com` : "Product | Smoothlife.com" };
}

export default function ProductPage({ params }: { params: { slug: string } }) {
  const product = getProductBySlug(params.slug);
  if (!product) notFound();

  const related = getRelatedProducts(product, 4);
  const reviews = generateReviews(product.name.length, 4);

  return (
    <div className="container-page py-8 md:py-10">
      <ProductDetailInteractive product={product} related={related} reviews={reviews} />

      {related.length > 0 && (
        <div className="mt-16">
          <SectionHeading title="สินค้าที่เกี่ยวข้อง" subtitle="You may also like" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-5">
            {related.map((p) => (
              <ProductCard key={p.slug} product={p} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
