import { Badge, EmptyState, tableClass } from "@/components/ui";
import { formatPaise } from "@/lib/money";
import type { Order } from "@/lib/types";
import type { ReactNode } from "react";

const dateFmt = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });

export function OrdersTable({ orders, actions }: { orders: Order[]; actions?: (order: Order) => ReactNode }) {
  if (!orders.length) return <EmptyState>No orders yet.</EmptyState>;
  return (
    <div className={tableClass.wrap}>
      <table className={`${tableClass.table} min-w-[720px]`}>
        <thead>
          <tr>
            <th className={tableClass.th}>Date</th>
            <th className={tableClass.th}>Buyer</th>
            <th className={tableClass.th}>Product</th>
            <th className={tableClass.th}>Amount</th>
            <th className={tableClass.th}>Status</th>
            {actions && <th className={tableClass.th} />}
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id}>
              <td className={`${tableClass.td} whitespace-nowrap text-body`}>{dateFmt.format(new Date(o.created_at))}</td>
              <td className={tableClass.td}>
                <p className="font-semibold">{o.buyer_name}</p>
                <p className="text-[13px] text-muted">{o.buyer_email}</p>
                <p className="text-[13px] text-muted">{o.buyer_phone}</p>
                {Object.keys(o.form_responses ?? {}).length > 0 && (
                  <details className="mt-1">
                    <summary className="link cursor-pointer text-[13px]">Answers</summary>
                    <dl className="mt-1 space-y-0.5">
                      {Object.entries(o.form_responses).map(([k, v]) => (
                        <div key={k}><dt className="inline font-bold">{k}: </dt><dd className="inline">{v}</dd></div>
                      ))}
                    </dl>
                  </details>
                )}
              </td>
              <td className={tableClass.td}>
                {o.page_title}
                {o.offer_title && <p className="text-[12px] text-primary">+ {o.offer_title} (<span className="num">{formatPaise(o.offer_price_paise)}</span>)</p>}
              </td>
              <td className={`${tableClass.td} whitespace-nowrap`}>
                <span className="num">{formatPaise(o.amount_paise)}</span>
                {o.coupon_code && <p className="text-[12px] text-muted">{o.coupon_code}, <span className="num">−{formatPaise(o.discount_paise)}</span></p>}
              </td>
              <td className={tableClass.td}>
                <Badge status={o.status} />
                {o.razorpay_payment_id && <p className="num mt-1.5 text-[11px] text-muted">{o.razorpay_payment_id}</p>}
              </td>
              {actions && <td className={tableClass.td}>{actions(o)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
