import Link from "next/link";
import { Clause, LegalPage } from "@/components/legal-page";
import { site } from "@/lib/site";

export const metadata = { title: "Delivery policy" };

export default function DeliveryPolicy() {
  return (
    <LegalPage
      title="Shipping and delivery policy"

      intro="Everything sold on this site is a digital download. Nothing is shipped, and there are no delivery charges."
    >
      <Clause n={1} title="How you receive your purchase">
        <p>
          After Razorpay confirms your payment, the thank-you page shows a download button and we email the same download
          links to the address you entered at checkout. If the files are small enough (up to 10 MB in total), they are
          attached to the email as well. This usually takes less than a minute.
        </p>
      </Clause>
      <Clause n={2} title="How long you have access">
        <p>
          Access does not expire. Use the link whenever you need the files again. To stop links being shared publicly,
          each link allows a limited number of downloads. If you reach the limit, request a fresh link on the download page.
        </p>
      </Clause>
      <Clause n={3} title="If the email does not arrive">
        <ul>
          <li>Check your spam and promotions folders for an email from {site.name}.</li>
          <li>Open any old download link, or the download page, and enter your email to get your links again.</li>
          <li>Still nothing after an hour? Write to <a href={`mailto:${site.supportEmail}`}>{site.supportEmail}</a> with your payment ID.</li>
        </ul>
      </Clause>
      <Clause n={4} title="Free downloads">
        <p>
          Free files from a creator&apos;s lead magnet are delivered the same way: a download button right after you submit the
          form, and an email with the links. These links do not expire.
        </p>
      </Clause>
      <Clause n={5} title="Delivery problems">
        <p>
          If we cannot deliver your file, you are covered by our <Link href="/refund-policy">refund policy</Link>.
        </p>
      </Clause>
    </LegalPage>
  );
}
