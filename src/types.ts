export interface User {
  id: string;
  name: string;
  mobile: string;
  email?: string;
  role: 'customer' | 'seller' | 'admin';
  lat?: number;
  lng?: number;
  sellerInfo?: Seller;
}

export interface Seller {
  id: string;
  user_id: string;
  shop_name: string;
  bank_details?: string;
  upi_id?: string;
  approved: boolean;
}

export interface Product {
  id: string;
  seller_id: string;
  name: string;
  description: string;
  price: number;
  image_url: string;
  category: string;
  status: string;
  shop_name?: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  price: number;
  name?: string;
  image_url?: string;
}

export interface Order {
  id: string;
  customer_id: string;
  seller_id: string;
  total_amount: number;
  platform_fee: number;
  status: 'pending' | 'accepted' | 'out_for_delivery' | 'delivered' | 'rejected';
  lat?: number;
  lng?: number;
  created_at: string;
  items?: OrderItem[];
}

export interface CartItem extends Product {
  quantity: number;
}
