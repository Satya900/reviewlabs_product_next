import Link from "next/link";
import { PageTitle, Panel } from "@/components/ui";
import { CreateCreatorForm } from "../../forms";

export const metadata = { title: "Add a creator" };

export default function NewCreator() {
  return (
    <>
      <div className="space-y-1">
        <Link href="/admin" className="link text-[14px]">← Back to creators</Link>
        <PageTitle sub="Set up an account for someone and share their login details. They can sign in straight away.">Add a creator</PageTitle>
      </div>
      <Panel title="Account details" className="max-w-2xl">
        <CreateCreatorForm />
      </Panel>
    </>
  );
}
