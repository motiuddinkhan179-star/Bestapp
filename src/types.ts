export interface User {
  id: number;
  name: string;
  mobile: string;
  email?: string;
  role: 'customer' | 'seller' | 'admin';
  lat?: number;
  lng?: number;
  sellerInfo?: Seller;
}

export interface Seller {
  id: number;
  user_id: number;
  shop_name: string;
  bank_details?: string;
  upi_id?: string;
  approved: number;
}

export interface Product {
  id: number;
  seller_id: number;
  name: string;
  description: string;
  price: number;
  image_url: string;
  category: string;
  status: string;
  shop_name?: string;
}

export interface Order {
  id: number;
  customer_id: number;
  seller_id: number;
  total_amount: number;
  platform_fee: number;
  status: 'pending' | 'accepted' | 'out_for_delivery' | 'delivered' | 'rejected';
  lat?: number;
  lng?: number;
  created_at: string;
}

export interface CartItem extends Product {
  quantity: number;
}
