"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { BankDetailsForm } from "@/components/bank-details-form";

export function PayoutSetup({ creatorId }: { creatorId: string }) {
  const router = useRouter();
  const [confirmSkip, setConfirmSkip] = useState(false);
  const toDashboard = () => router.push("/dashboard?welcome=1");

  return (
    <>
      <BankDetailsForm
        creatorId={creatorId}
        onSaved={toDashboard}
        submitLabel="Save and continue"
        extraActions={<Button type="button" variant="secondary" onClick={() => setConfirmSkip(true)}>Skip for now</Button>}
      />
      {confirmSkip && <SkipDialog onNo={() => setConfirmSkip(false)} onYes={toDashboard} />}
    </>
  );
}

function SkipDialog({ onNo, onYes }: { onNo: () => void; onYes: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onNo();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onNo]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-dark/50 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={onNo}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="skip-title"
        aria-describedby="skip-body"
        className="w-full max-w-md rounded-t-3xl bg-canvas p-6 shadow-float sm:rounded-3xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 id="skip-title" className="text-[20px] font-semibold">Skip adding bank details?</h2>
        <div id="skip-body" className="mt-3 space-y-3 text-[15px] text-body">
          <p>If you skip this, you can&apos;t request payouts.</p>
          <p className="text-[14px]"><span className="font-semibold text-down">*</span> You can add your bank details later in Settings.</p>
          <p className="font-medium text-ink">Are you sure you want to continue without adding them?</p>
        </div>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onNo} autoFocus>No, add them now</Button>
          <Button type="button" onClick={onYes}>Yes, skip</Button>
        </div>
      </div>
    </div>
  );
}
