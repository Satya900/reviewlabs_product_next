export type PageStatus = "draft" | "live" | "archived";
export type FieldType = "text" | "textarea" | "number" | "select";
export type OrderStatus = "created" | "attempted" | "paid" | "failed" | "refunded" | "partially_refunded";

export type PaymentPage = {
  id: string;
  creator_id: string;
  slug: string;
  title: string;
  description: string;
  cover_image_url: string | null;
  amount_paise: number;
  currency: "INR";
  button_label: string;
  thank_you_message: string;
  status: PageStatus;
  created_at: string;
  updated_at: string;
};

export type PageField = {
  id: string;
  page_id: string;
  label: string;
  field_type: FieldType;
  required: boolean;
  options: string[];
  position: number;
};

export type PageFile = {
  id: string;
  page_id: string;
  storage_path: string;
  file_name: string;
  size_bytes: number;
  content_type: string | null;
};

export type Tracking = {
  fbp?: string;
  fbc?: string;
  client_ip?: string;
  user_agent?: string;
  source_url?: string;
};

export type Order = {
  id: string;
  page_id: string;
  creator_id: string;
  page_title: string;
  buyer_name: string;
  buyer_email: string;
  buyer_phone: string;
  form_responses: Record<string, string>;
  amount_paise: number;
  list_price_paise: number | null;
  discount_paise: number;
  coupon_code: string | null;
  currency: string;
  status: OrderStatus;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  tracking: Tracking;
  receipt_sent_at: string | null;
  paid_at: string | null;
  created_at: string;
};

export type LedgerEntry = {
  id: string;
  creator_id: string;
  order_id: string | null;
  payout_id: string | null;
  entry_type: "sale" | "gateway_fee" | "refund" | "subscription_fee" | "payout" | "adjustment";
  amount_paise: number;
  description: string | null;
  created_at: string;
};
