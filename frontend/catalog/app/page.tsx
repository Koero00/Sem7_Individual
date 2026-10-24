import { CatalogStore } from "@/components/catalog-store";
import { loadCatalog } from "@/lib/gateway";

export const dynamic = "force-dynamic";

export default async function CatalogPage() {
  try {
    const data = await loadCatalog();
    return <CatalogStore initialData={data} initialError={null} />;
  } catch {
    return <CatalogStore initialData={{ products: [], inventory: [] }} initialError="We couldn’t load the catalog. Check that the backend is running, then try again." />;
  }
}
