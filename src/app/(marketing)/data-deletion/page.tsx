import { Clause, LegalPage } from "@/components/legal-page";
import { site } from "@/lib/site";

export const metadata = { title: "Data deletion" };

export default async function DataDeletion({ searchParams }: PageProps<"/data-deletion">) {
  const { code } = await searchParams;
  return (
    <LegalPage title="Data deletion" intro={<>How to delete the data {site.name} holds about you from Instagram and Facebook.</>}>
      {typeof code === "string" && /^[0-9a-f]{16}$/.test(code) && (
        <div className="mt-8 rounded-2xl bg-primary-soft px-5 py-4 text-[16px] text-ink [&_a]:font-semibold [&_a]:text-primary">
          <p>
            We received your deletion request. Your confirmation code is <b>{code}</b>. We delete the data within 30 days and you can ask about it at any time
            by writing to <a href={`mailto:${site.supportEmail}`}>{site.supportEmail}</a> with this code.
          </p>
        </div>
      )}
      <Clause n={1} title="Creators who connected Instagram">
        <p>
          Open AutoDM in your dashboard and click Disconnect. That immediately deletes your Instagram access token, your automations and the record of
          every DM we sent for you. You can also remove {site.name} in Instagram under Settings, then Website permissions, then Apps and websites.
        </p>
      </Clause>
      <Clause n={2} title="People who commented on a creator's post">
        <p>
          If you received an automatic DM, we keep your comment, your Instagram username and whether you opened the link, so the creator can see their results.
          To have this deleted, write to <a href={`mailto:${site.supportEmail}`}>{site.supportEmail}</a> with your Instagram username. We reply within 30 days.
        </p>
      </Clause>
    </LegalPage>
  );
}
