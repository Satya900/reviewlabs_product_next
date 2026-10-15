"use client";

import { useActionState, useState, useTransition } from "react";
import { addField, deleteField } from "../../actions";
import { Button, FormMessage, inputClass } from "@/components/ui";
import type { FieldType, PageField } from "@/lib/types";

export function FieldsEditor({ pageId, fields }: { pageId: string; fields: PageField[] }) {
  const [state, action, pending] = useActionState(addField, null);
  const [type, setType] = useState<FieldType>("text");
  const [deleting, startDelete] = useTransition();

  return (
    <div className="space-y-4">
      {fields.length > 0 && (
        <ul className="divide-y divide-hairline-soft rounded-2xl bg-surface-soft text-[14px]">
          {fields.map((f) => (
            <li key={f.id} className="flex items-center justify-between gap-2 px-4 py-3">
              <span className="min-w-0 truncate">
                {f.label} <span className="text-muted">({f.field_type}{f.required ? ", required" : ""})</span>
              </span>
              <button
                type="button"
                disabled={deleting}
                onClick={() => startDelete(() => deleteField(f.id, pageId))}
                className="link shrink-0 text-[14px]"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      <form action={action} className="space-y-2">
        <input type="hidden" name="page_id" value={pageId} />
        <input name="label" placeholder="Question, for example: Instagram handle" required className={inputClass} />
        <div className="flex gap-2">
          <select name="field_type" value={type} onChange={(e) => setType(e.target.value as FieldType)} className={inputClass}>
            <option value="text">Short text</option>
            <option value="textarea">Long text</option>
            <option value="number">Number</option>
            <option value="select">Dropdown</option>
          </select>
          <label className="flex shrink-0 items-center gap-2 text-[14px] font-medium"><input type="checkbox" name="required" className="size-4 accent-primary" /> Required</label>
        </div>
        {type === "select" && <input name="options" placeholder="Options, comma separated" className={inputClass} />}
        <Button loading={pending} type="submit" variant="secondary" disabled={pending}>{pending ? "Adding" : "Add question"}</Button>
        <FormMessage state={state} />
      </form>
    </div>
  );
}
