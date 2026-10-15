export type PageStatus = "draft" | "live" | "archived";
export type FieldType = "text" | "textarea" | "number" | "select";
export type OrderStatus = "created" | "attempted" | "paid" | "failed" | "refunded" | "partially_refunded";

export type PaymentPage = {
  id: string;
  creator_id: string;
  slug: string;
  title: string;
  description: string;
  description_html: string;
  is_free: boolean;
  storefront_visible: boolean;
  storefront_position: number;
  support_email: string | null;
  refund_policy: string;
  terms: string;
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
  offer_id: string | null;
  offer_title: string | null;
  offer_price_paise: number;
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
  entry_type: "sale" | "gateway_fee" | "platform_fee" | "refund" | "subscription_fee" | "payout" | "adjustment";
  amount_paise: number;
  description: string | null;
  created_at: string;
};

export type Testimonial = {
  id: string;
  page_id: string;
  name: string;
  comment: string;
  rating: number;
  avatar_url: string | null;
  avatar_face: string;
  position: number;
};

export type Faq = {
  id: string;
  page_id: string;
  question: string;
  answer: string;
  position: number;
};

export type Offer = {
  id: string;
  page_id: string;
  headline: string;
  title: string;
  description: string;
  image_url: string | null;
  price_paise: number;
  compare_at_paise: number | null;
  active: boolean;
};

export type OfferFile = {
  id: string;
  offer_id: string;
  storage_path: string;
  file_name: string;
  size_bytes: number;
  content_type: string | null;
};
