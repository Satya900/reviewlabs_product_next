import { Clause, LegalPage } from "@/components/legal-page";
import { formatPaise } from "@/lib/money";
import { site } from "@/lib/site";

export const metadata = { title: "Refund policy" };

export default function RefundPolicy() {
  return (
    <LegalPage
      title="Refund and cancellation policy"

      intro="Products sold on this site are digital files delivered instantly, so we cannot take them back once they are downloaded. We still refund you when something has gone wrong on our side or the creator's."
    >
      <Clause n={1} title="When you get a refund">
        <ul>
          <li>You were charged but did not receive the file, and we cannot deliver it within 48 hours of you contacting us.</li>
          <li>The file is corrupted or will not open, and the creator cannot send a working copy.</li>
          <li>You received a different product from the one described on the page.</li>
          <li>You were charged more than once for the same order.</li>
        </ul>
      </Clause>
      <Clause n={2} title="When we cannot refund">
        <ul>
          <li>You changed your mind after the file was delivered.</li>
          <li>You bought the wrong product by mistake and have already downloaded it.</li>
          <li>The content did not meet personal expectations that the product page did not promise.</li>
        </ul>
      </Clause>
      <Clause n={3} title="How to ask">
        <p>
          Email <a href={`mailto:${site.supportEmail}`}>{site.supportEmail}</a> within {site.refundWindowDays} days of purchase.
          Include your order ID from the receipt email and a short description of the problem. We reply within one working day.
        </p>
      </Clause>
      <Clause n={4} title="How refunds are paid">
        <p>
          Approved refunds go back to the original payment method through Razorpay. Banks usually take 5 to 7 working days
          to show the money. A full refund ends your access to the files.
        </p>
      </Clause>
      <Clause n={5} title="Orders cannot be cancelled">
        <p>Delivery is instant, so there is no window to cancel an order before it is fulfilled. Use the refund process above instead.</p>
      </Clause>
      <Clause n={6} title="Creator subscription">
        <p>
          Creator plan payments ({formatPaise(site.creatorPlanPaise)} monthly or {formatPaise(site.creatorYearlyPaise)} yearly) are not
          refundable for a period that has started. Creators can cancel any time and won&apos;t be charged for the next period.
          The lifetime plan ({formatPaise(site.creatorLifetimePaise)}, one-time) starts as soon as it is paid and is not refundable,
          except for a duplicate or mistaken charge.
          Individual product pages may carry the seller&apos;s own refund policy, which applies to purchases on that page.
          Free downloads from lead magnets involve no payment, so there is nothing to refund.
        </p>
      </Clause>
    </LegalPage>
  );
}
