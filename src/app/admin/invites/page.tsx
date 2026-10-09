import { createAdminClient } from "@/lib/supabase/admin";
import { PageTitle, Panel, tableClass } from "@/components/ui";
import { InviteForm, RemoveInviteButton } from "./invite-forms";

const dateFmt = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" });

export default async function AdminInvites() {
  const db = createAdminClient();
  const [{ data: invites }, { data: profiles }] = await Promise.all([
    db.from("creator_invites").select("email, note, created_at").order("created_at", { ascending: false }),
    db.from("profiles").select("email"),
  ]);
  const joined = new Set((profiles ?? []).map((p) => p.email.toLowerCase()));

  return (
    <>
      <PageTitle sub="Only invited emails can create a creator account. Add someone here, then tell them to log in at /login.">
        Invites
      </PageTitle>
      <Panel title="Invite a creator">
        <InviteForm />
      </Panel>
      <div className={tableClass.wrap}>
        <table className={`${tableClass.table} min-w-[560px]`}>
          <thead>
            <tr>
              <th className={tableClass.th}>Email</th>
              <th className={tableClass.th}>Note</th>
              <th className={tableClass.th}>Invited</th>
              <th className={tableClass.th}>Status</th>
              <th className={tableClass.th} />
            </tr>
          </thead>
          <tbody>
            {(invites ?? []).map((i) => (
              <tr key={i.email}>
                <td className={tableClass.td}>{i.email}</td>
                <td className={tableClass.td}>{i.note}</td>
                <td className={`${tableClass.td} whitespace-nowrap`}>{dateFmt.format(new Date(i.created_at))}</td>
                <td className={tableClass.td}>{joined.has(i.email) ? "Joined" : "Not joined yet"}</td>
                <td className={tableClass.td}>{!joined.has(i.email) && <RemoveInviteButton email={i.email} />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
