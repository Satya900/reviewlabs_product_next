import Link from "next/link";
import { Clause, LegalPage } from "@/components/legal-page";
import { formatPaise } from "@/lib/money";
import { site } from "@/lib/site";

export const metadata = { title: "Terms of use" };

export default function Terms() {
  return (
    <LegalPage
      title="Terms of use"

      intro={<>These terms cover anyone who visits {site.name}, buys a product through a payment page, or sells as a creator. By using the site you agree to them.</>}
    >
      <Clause n={1} title="Who we are">
        <p>
          {site.name} is a product of {site.legalName}, founded by {site.founder}. We provide software that lets independent creators sell
          digital products, such as ebooks and templates, through payment pages.
        </p>
      </Clause>
      <Clause n={2} title="Buying a product">
        <p>
          Each product is created and owned by the creator named on its page. The creator is responsible for what the
          product contains. We collect the payment through Razorpay, deliver the file to you, and handle support for
          payment and delivery problems.
        </p>
        <p>
          When you buy, you get a personal licence to download and use the files. You may not resell, share publicly or
          redistribute them unless the creator says otherwise on the page.
        </p>
        <p>
          Refunds follow our <Link href="/refund-policy">refund policy</Link>. Delivery follows our{" "}
          <Link href="/delivery-policy">delivery policy</Link>.
        </p>
      </Clause>
      <Clause n={3} title="Creator accounts">
        <ul>
          <li>Anyone can create an account after verifying their email. You must be at least 18 and able to enter a contract under Indian law.</li>
          <li>You must own, or have permission to sell, everything you upload.</li>
          <li>Product titles, descriptions and prices must be accurate. Do not promise results you cannot back up.</li>
          <li>Keep your login email secure. You are responsible for activity on your account.</li>
        </ul>
      </Clause>
      <Clause n={4} title="Fees and payouts for creators">
        <ul>
          <li>Plans: Free (one product page), Creator ({formatPaise(site.creatorPlanPaise)} per month or {formatPaise(site.creatorYearlyPaise)} per year, billed through Razorpay as a recurring payment you can cancel any time) and custom plans agreed with us in writing. First-time monthly subscribers may be offered an introductory price for the first month, shown before payment.</li>
          <li>Every sale carries one all-inclusive fee that covers the payment gateway charge: 6% on Free and 4% on Creator, unless a custom plan sets a different rate. The fee rate is the one in effect when the sale is made.</li>
          <li>If a Creator subscription ends or a renewal fails, your account moves to Free: your oldest live page stays live and other pages become drafts.</li>
          <li>Refunds and chargebacks are deducted from your balance. The fee on a refunded sale is not returned, because the payment gateway keeps its charge too.</li>
          <li>You may add your own support email, refund policy and terms to your product pages. They apply between you and your buyers, alongside these terms.</li>
          <li>We pay your balance to the UPI ID or bank account in your settings. You are responsible for any tax due on your income.</li>
          <li>We may hold a payout while we look into a dispute, a chargeback or a suspected breach of these terms.</li>
        </ul>
      </Clause>
      <Clause n={5} title="Content you may not sell">
        <p>
          No pirated or copied material, adult content, content that promotes violence or hate, fake documents, malware,
          get-rich-quick or gambling schemes, or anything illegal in India. We may remove a page or close an account that
          breaks this rule, and refund affected buyers from the creator&apos;s balance.
        </p>
      </Clause>
      <Clause n={6} title="Our liability">
        <p>
          We work to keep the service running and your data safe, but we provide it as is. To the extent the law allows,
          our total liability for any claim is limited to the amount you paid us in the three months before the claim.
          We are not liable for the content of creators&apos; products.
        </p>
      </Clause>
      <Clause n={7} title="Ending your account">
        <p>
          Creators can close their account at any time by writing to us. We pay out any remaining positive balance after
          the refund window for recent sales has passed. Buyers keep access to files they have already bought.
        </p>
      </Clause>
      <Clause n={8} title="Changes and governing law">
        <p>
          We may update these terms and will change the date at the top when we do. These terms are governed by the laws
          of India.
        </p>
      </Clause>
      <Clause n={9} title="Contact">
        <p>
          Questions about these terms: <a href={`mailto:${site.supportEmail}`}>{site.supportEmail}</a>.
        </p>
      </Clause>
    </LegalPage>
  );
}
