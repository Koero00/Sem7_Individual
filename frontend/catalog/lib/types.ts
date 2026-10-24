export type Product = {
  id: string;
  name: string;
  description: string;
  price: number;
  image_url: string | null;
};

export type InventoryItem = { product_id: string; quantity: number };
export type OrderItem = { product_id: string; quantity: number };
export type OrderRequest = { customer_id: string; items: OrderItem[] };
export type Order = OrderRequest & {
  id: string;
  status: "pending" | "confirmed" | "rejected";
  rejection_reason: string | null;
  rejection_details: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};
export type Cart = Record<string, number>;
export type Category = "phones" | "laptops" | "mice" | "other";
export type CatalogData = { products: Product[]; inventory: InventoryItem[] };
