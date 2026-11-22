export interface Product {
  id: string;
  name: string;
  description: string;
  imageUrl: string | null;
  imageGallery: string[] | null;
  price: string;
  stock: number;
  active: boolean;
  shop: { id: string; name: string; active: boolean; shippingFee: string };
}
