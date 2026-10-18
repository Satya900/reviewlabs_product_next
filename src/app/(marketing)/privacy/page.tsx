import { Clause, LegalPage } from "@/components/legal-page";
import { site } from "@/lib/site";

export const metadata = { title: "Privacy policy" };

export default function Privacy() {
  return (
    <LegalPage
      title="Privacy policy"

      intro={<>This policy explains what personal data {site.legalName} collects through {site.name}, why, and what you can do about it. We follow the Digital Personal Data Protection Act, 2023 and the IT Act, 2000.</>}
    >
      <Clause n={1} title="What we collect from buyers">
        <ul>
          <li>Name, email address and phone number you enter at checkout.</li>
          <li>Answers to any extra questions the creator added to the page.</li>
          <li>Order details: product, amount, time, and the payment ID Razorpay gives us.</li>
          <li>Technical data: IP address, browser type, and Meta cookies (_fbp, _fbc) if the creator has set up Meta tracking.</li>
        </ul>
        <p>We never see or store your card number, CVV, UPI PIN or bank login. Razorpay handles those.</p>
      </Clause>
      <Clause n={2} title="What we collect from lead magnet visitors">
        <ul>
          <li>Your name and email address, and your phone number and answers if the creator asks for them.</li>
          <li>If the creator turned on email verification, a one-time code that we store only as a hash. It stops working after 10 minutes and is deleted once used.</li>
          <li>The same technical data as buyers, including Meta cookies if the creator uses Meta tracking.</li>
        </ul>
        <p>The creator receives these details because you asked for their free resource and agreed to receive updates from them.</p>
      </Clause>
      <Clause n={3} title="What we collect from creators">
        <p>Your email address, display name, payout details (UPI ID or bank account and IFSC), and your Meta Pixel settings. Your Meta access token is stored encrypted.</p>
        <p>If you set up a storefront, your handle, photo, bio and social links are shown publicly. If you ask about a custom plan, we keep the details you send us so we can reply.</p>
      </Clause>
      <Clause n={4} title="Why we use it">
        <ul>
          <li>To process your payment and deliver the files you bought.</li>
          <li>To send receipts, download links and verification codes by email.</li>
          <li>To show creators their orders and pay them.</li>
          <li>To handle refunds, support requests and fraud checks.</li>
          <li>To meet legal and tax record-keeping duties.</li>
        </ul>
      </Clause>
      <Clause n={5} title="Who we share it with">
        <ul>
          <li>The creator whose product you bought or whose lead magnet you filled in: your name, email, phone and answers.</li>
          <li>Razorpay, to process payments and refunds.</li>
          <li>Supabase, which hosts our database and file storage.</li>
          <li>Our email provider, to send receipts, download links and verification codes.</li>
          <li>Meta, for our own ads: on our website and when creators sign up or buy a plan, we use the Meta Pixel and send a creator&apos;s email as a one-way hash, plus IP and browser details, so we can measure our ads.</li>
          <li>Meta, only if the creator turned on tracking. We send your email, phone and name as one-way hashes, plus your IP and browser details, so Meta can measure the creator&apos;s ads.</li>
        </ul>
        <p>We do not sell personal data.</p>
      </Clause>
      <Clause n={6} title="How long we keep it">
        <p>We keep order and payment records for 8 years, as Indian tax law requires. Other data is deleted when it is no longer needed, or when you ask us to delete it and the law allows it.</p>
      </Clause>
      <Clause n={7} title="Your rights">
        <p>You can ask to see, correct or delete your personal data, or withdraw consent for tracking, by writing to {site.supportEmail}. We reply within 30 days.</p>
      </Clause>
      <Clause n={8} title="Contact">
        <p>
          Questions or complaints about your data: write to <a href={`mailto:${site.supportEmail}`}>{site.supportEmail}</a>.
          We acknowledge complaints within 48 hours.
        </p>
      </Clause>
    </LegalPage>
  );
}
