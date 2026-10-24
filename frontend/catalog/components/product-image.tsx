"use client";

import { useState } from "react";
import { categoryFor } from "@/lib/catalog";
import type { Product } from "@/lib/types";

export function ProductImage({ product }: { product: Product }) {
  const [failed, setFailed] = useState(false);
  const fallback = { phones: "phone", laptops: "laptop", mice: "mouse", other: "product" }[categoryFor(product)];
  const source = product.image_url && /^(https?:\/\/|\/(?!\/))/.test(product.image_url) && !failed
    ? product.image_url : `/products/${fallback}.svg`;
  // Product URLs are supplied by Catalog; a regular img supports arbitrary hosts
  // without routing untrusted URLs through Next's server image optimizer.
  // eslint-disable-next-line @next/next/no-img-element
  return <img className="product-art" src={source} alt="" width={80} height={80} onError={() => setFailed(true)} />;
}
