"use client";

import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button, Field, FormMessage, cx, inputClass } from "@/components/ui";
import { bankDetailsError, chequeFileError, isValidIfsc, normalizeIfsc } from "@/lib/bank-details";
import { checkIfsc, saveBankDetails } from "@/app/dashboard/payout-actions";

const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" };

// Bank account for payouts, with a cancelled cheque. Used at signup and in Settings.
export function BankDetailsForm({ creatorId, onSaved, submitLabel = "Save bank details", extraActions }: {
  creatorId: string;
  onSaved: () => void;
  submitLabel?: string;
  extraActions?: React.ReactNode;
}) {
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [confirm, setConfirm] = useState("");
  const [ifsc, setIfsc] = useState("");
  const [bank, setBank] = useState<{ text: string; ok: boolean } | null>(null);
  const [cheque, setCheque] = useState<File | null>(null);
  const [state, setState] = useState<{ error?: string; ok?: string } | null>(null);
  const [pending, start] = useTransition();
  const mismatch = confirm.length > 0 && confirm.replace(/[\s-]/g, "") !== accountNumber.replace(/[\s-]/g, "");

  async function onIfscBlur() {
    const code = normalizeIfsc(ifsc);
    setIfsc(code);
    if (!isValidIfsc(code)) return setBank(code ? { text: "IFSC is 11 characters, like HDFC0001234", ok: false } : null);
    const res = await checkIfsc(code);
    setBank(res.info ? { text: [res.info.bank, res.info.branch, res.info.city].filter(Boolean).join(", "), ok: true } : res.error ? { text: res.error, ok: false } : null);
  }

  function pickCheque(file: File | undefined) {
    if (!file) return;
    const problem = chequeFileError(file);
    setState(problem ? { error: problem } : null);
    setCheque(problem ? null : file);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const problem = bankDetailsError({ accountName, accountNumber, confirmAccountNumber: confirm, ifsc }) ?? (cheque ? chequeFileError(cheque) : "Upload a photo or PDF of a cancelled cheque");
    if (problem) return setState({ error: problem });
    start(async () => {
      setState(null);
      const path = `${creatorId}/cheque/${crypto.randomUUID()}.${EXT[cheque!.type]}`;
      const { error } = await createClient().storage.from("payout-documents").upload(path, cheque!, { contentType: cheque!.type });
      if (error) return setState({ error: `Couldn't upload the cheque: ${error.message}` });
      const res = await saveBankDetails({ accountName, accountNumber, confirmAccountNumber: confirm, ifsc, chequePath: path });
      setState(res);
      if (res?.ok) onSaved();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Field label="Account holder name" hint="Exactly as it appears on your bank account.">
        <input value={accountName} onChange={(e) => setAccountName(e.target.value)} required maxLength={100} autoComplete="name" className={inputClass} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Account number">
          <input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} required inputMode="numeric" autoComplete="off" maxLength={22} className={cx(inputClass, "num")} />
        </Field>
        <Field label="Re-enter account number">
          <input
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            onPaste={(e) => e.preventDefault()}
            required
            inputMode="numeric"
            autoComplete="off"
            maxLength={22}
            aria-invalid={mismatch || undefined}
            className={cx(inputClass, "num", mismatch && "border-down")}
          />
        </Field>
      </div>
      {mismatch && <p className="-mt-2 text-[13px] font-medium text-down">The account numbers don&apos;t match yet.</p>}
      <Field label="IFSC code" hint="11 characters, on your cheque book or passbook.">
        <input value={ifsc} onChange={(e) => { setIfsc(e.target.value.toUpperCase()); setBank(null); }} onBlur={onIfscBlur} required maxLength={11} autoComplete="off" className={cx(inputClass, "num uppercase")} />
      </Field>
      {bank && <p className={cx("-mt-2 text-[13px] font-medium", bank.ok ? "text-up" : "text-down")}>{bank.ok ? `✓ ${bank.text}` : bank.text}</p>}
      <div>
        <p className="mb-2 text-[14px] font-semibold">Cancelled cheque</p>
        <label
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); pickCheque(e.dataTransfer.files[0]); }}
          className="flex cursor-pointer flex-col items-center gap-1 rounded-2xl border-2 border-dashed border-hairline px-5 py-6 text-center transition hover:border-primary/50"
        >
          <span className="text-[15px] font-semibold text-primary">{cheque ? cheque.name : "Upload a photo or PDF"}</span>
          <span className="text-[13px] text-muted">{cheque ? "Click to choose a different file" : "Write “CANCELLED” across a cheque from this account. JPG, PNG or PDF, up to 5 MB."}</span>
          <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="sr-only" onChange={(e) => pickCheque(e.target.files?.[0])} />
        </label>
      </div>
      <FormMessage state={state} />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" loading={pending} disabled={pending}>{pending ? "Saving" : submitLabel}</Button>
        {extraActions}
      </div>
    </form>
  );
}
