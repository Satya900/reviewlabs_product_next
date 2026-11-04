import Link from "next/link";
import { requirePlan } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { Badge, EmptyState, Notice, PageTitle, Panel, Stat, buttonClass, tableClass } from "@/components/ui";
import { AccessRequestForm, AutomationToggle, DisconnectButton, SyncNowButton } from "./autodm-controls";
import { autodmAccess } from "@/lib/autodm-access";
import { hasProPlan } from "@/lib/plans";
import { UpgradeCard } from "@/components/upgrade-card";

export const metadata = { title: "AutoDM" };

const dateFmt = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });

const connectMessages: Record<string, { tone: "good" | "bad" | "info"; text: string }> = {
  connected: { tone: "good", text: "Instagram connected. Create your first automation below." },
  disconnected: { tone: "info", text: "Instagram disconnected. Your automations and their history were deleted." },
  cancelled: { tone: "info", text: "Instagram wasn't connected: the login was cancelled." },
  expired: { tone: "bad", text: "That login link expired. Click Connect Instagram again." },
  no_account: { tone: "bad", text: "No Instagram account was shared. Connect again and tick your Instagram professional account." },
  taken: { tone: "bad", text: "That Instagram account is already connected to another Reviewlabs account." },
  failed: { tone: "bad", text: "Instagram didn't let us connect. Please try again in a minute." },
  unavailable: { tone: "info", text: "AutoDM isn't switched on yet. Check back soon." },
  early: { tone: "info", text: "AutoDM is in early access. Request access below and we'll invite you." },
};

function since(days: number) {
  return new Date(Date.now() - days * 864e5).toISOString();
}

export default async function AutoDmPage({ searchParams }: PageProps<"/dashboard/autodm">) {
  const profile = await requirePlan();
  const { ig, saved } = await searchParams;
  const supabase = await createClient();
  const [{ data: account }, { data: automations }, { data: events }] = await Promise.all([
    supabase.from("instagram_accounts").select("username, name, profile_picture_url, status, last_error, subscribed_at, last_synced_at").eq("creator_id", profile.id).maybeSingle(),
    supabase.from("dm_automations").select("id, name, active, post_scope, media_ids, match_mode, keywords, link_kind").eq("creator_id", profile.id).order("created_at", { ascending: false }),
    supabase
      .from("dm_events")
      .select("id, automation_id, commenter_username, comment_text, status, error, clicks, created_at")
      .eq("creator_id", profile.id)
      .gte("created_at", since(30))
      .order("created_at", { ascending: false })
      .limit(2000),
  ]);
  const message = typeof ig === "string" ? connectMessages[ig] : null;
  const pro = hasProPlan(profile);
  const access = await autodmAccess(profile);

  const all = events ?? [];
  const sent = all.filter((e) => e.status === "sent");
  const clicked = sent.filter((e) => e.clicks > 0).length;
  const perAutomation = new Map<string, { sent: number; clicked: number }>();
  for (const e of sent) {
    if (!e.automation_id) continue;
    const s = perAutomation.get(e.automation_id) ?? { sent: 0, clicked: 0 };
    s.sent++;
    if (e.clicks > 0) s.clicked++;
    perAutomation.set(e.automation_id, s);
  }
  const automationName = new Map((automations ?? []).map((a) => [a.id, a.name]));

  return (
    <>
      <PageTitle sub="When someone comments a keyword on your post or reel, they get a DM with your link, automatically.">AutoDM</PageTitle>
      {message && <Notice tone={message.tone}>{message.text}</Notice>}
      {saved && <Notice tone="good">Automation saved.</Notice>}
      {!pro && (
        <>
          <UpgradeCard feature="autodm" />
          {account && <Notice tone="warn">Your automations are paused and no DMs are being sent. They start again as soon as you&apos;re on Pro.</Notice>}
        </>
      )}

      {!pro && !account ? null : !account && !access.canConnect ? (
        <Panel title="AutoDM is in early access">
          <div className="space-y-4 text-[15px] text-body">
            <p>While Meta reviews Reviewlabs for public use, Instagram only lets accounts we invite connect. It takes one extra step and is usually done within one working day.</p>
            {access.request?.status === "pending" ? (
              <Notice tone="info">
                <b>Request received for @{access.request.ig_username}.</b> We&apos;ll add your Facebook account ({access.request.facebook}) as a tester and email you when it&apos;s ready.
              </Notice>
            ) : access.request?.status === "declined" ? (
              <Notice tone="warn">We couldn&apos;t invite that account. Check your details and send them again, or write to us.</Notice>
            ) : null}
            <AccessRequestForm initial={access.request ? { ig: access.request.ig_username, facebook: access.request.facebook } : undefined} />
          </div>
        </Panel>
      ) : !account ? (
        <Panel title="Connect your Instagram">
          <div className="grid gap-6 md:grid-cols-[1fr_auto] md:items-center">
            <div className="space-y-3 text-[15px] text-body">
              {!access.open && access.request?.status === "invited" && (
                <Notice tone="good">
                  <b>You&apos;re invited.</b> First accept the invite from Meta: open <a href="https://developers.facebook.com/requests/" target="_blank" rel="noreferrer" className="link">developers.facebook.com/requests</a> while logged in to the Facebook account you gave us, and accept the Reviewlabs tester request. Then click Connect Instagram.
                </Notice>
              )}
              <p>Connect the Instagram account you post from. You&apos;ll log in with Instagram or Facebook and choose the account.</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>It must be a professional account (Creator or Business). You can switch for free in Instagram settings.</li>
                <li>We only read comments on your posts and send the DMs you set up. We never post for you.</li>
                <li>You can disconnect at any time, which deletes everything here.</li>
              </ul>
            </div>
            {env.autodmEnabled() ? (
              <a href="/api/instagram/connect" className={buttonClass.primary}>Connect Instagram</a>
            ) : (
              <span className={buttonClass.secondary}>Coming soon</span>
            )}
          </div>
        </Panel>
      ) : (
        <>
          <Panel title="Instagram account" aside={<DisconnectButton />}>
            <div className="flex flex-wrap items-center gap-4">
              {account.profile_picture_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={account.profile_picture_url} alt="" className="size-14 rounded-full object-cover" />
              ) : (
                <div className="size-14 rounded-full bg-surface-strong" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-[17px] font-semibold">@{account.username ?? "instagram"}</p>
                <p className="text-[13px] text-muted">
                  {account.status === "active" ? "Connected" : "Needs reconnecting"}
                  {account.last_synced_at && ` · last checked ${dateFmt.format(new Date(account.last_synced_at))}`}
                </p>
              </div>
              <SyncNowButton />
            </div>
            {account.status === "error" && (
              <div className="mt-4">
                <Notice tone="bad">
                  Instagram stopped accepting our connection ({account.last_error}). <a href="/api/instagram/connect" className="link">Reconnect Instagram</a> to keep sending DMs.
                </Notice>
              </div>
            )}
          </Panel>

          <div className="grid gap-4 sm:grid-cols-3">
            <Stat label="DMs sent" value={sent.length.toLocaleString("en-IN")} sub="Last 30 days" />
            <Stat label="Link clicks" value={clicked.toLocaleString("en-IN")} sub="People who opened your link" />
            <Stat label="Click rate" value={sent.length ? `${Math.round((clicked / sent.length) * 100)}%` : "–"} sub="Clicks per DM sent" />
          </div>

          <Panel title="Automations" aside={<Link href="/dashboard/autodm/new" className={buttonClass.primary}>New automation</Link>}>
            {!automations?.length ? (
              <EmptyState>No automations yet. Create one: pick a post, a keyword like &quot;PDF&quot;, and the DM to send.</EmptyState>
            ) : (
              <ul className="divide-y divide-hairline-soft">
                {automations.map((a) => {
                  const s = perAutomation.get(a.id) ?? { sent: 0, clicked: 0 };
                  return (
                    <li key={a.id} className="flex flex-wrap items-center gap-4 py-4">
                      <div className="min-w-0 flex-1">
                        <Link href={`/dashboard/autodm/${a.id}`} className="text-[16px] font-semibold hover:text-primary">{a.name}</Link>
                        <p className="mt-0.5 text-[13px] text-muted">
                          {a.match_mode === "any" ? "Any comment" : `Keywords: ${a.keywords.join(", ")}`} ·{" "}
                          {a.post_scope === "all" ? "any post or reel" : `${a.media_ids.length} post${a.media_ids.length === 1 ? "" : "s"}`}
                        </p>
                      </div>
                      <p className="num text-[14px] text-body">{s.sent} sent · {s.clicked} clicked</p>
                      <AutomationToggle id={a.id} active={a.active} />
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          <Panel title="Recent activity">
            {!all.length ? (
              <EmptyState>Nothing yet. When someone comments one of your keywords, it shows up here.</EmptyState>
            ) : (
              <div className={tableClass.wrap}>
                <table className={`${tableClass.table} min-w-[680px]`}>
                  <thead>
                    <tr>
                      <th className={tableClass.th}>When</th>
                      <th className={tableClass.th}>Who</th>
                      <th className={tableClass.th}>Comment</th>
                      <th className={tableClass.th}>Automation</th>
                      <th className={tableClass.th}>DM</th>
                    </tr>
                  </thead>
                  <tbody>
                    {all.slice(0, 25).map((e) => (
                      <tr key={e.id}>
                        <td className={`${tableClass.td} whitespace-nowrap text-muted`}>{dateFmt.format(new Date(e.created_at))}</td>
                        <td className={tableClass.td}>{e.commenter_username ? `@${e.commenter_username}` : "–"}</td>
                        <td className={`${tableClass.td} max-w-[260px] truncate`} title={e.comment_text ?? ""}>{e.comment_text}</td>
                        <td className={tableClass.td}>{(e.automation_id && automationName.get(e.automation_id)) || "–"}</td>
                        <td className={tableClass.td} title={e.error ?? ""}>
                          <Badge status={e.status === "sent" ? "paid" : e.status === "failed" ? "failed" : "pending"} label={e.status === "sent" && e.clicks > 0 ? "sent · clicked" : e.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </>
      )}
    </>
  );
}
