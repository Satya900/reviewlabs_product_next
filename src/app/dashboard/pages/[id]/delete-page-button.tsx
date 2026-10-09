"use client";

import { useTransition } from "react";
import { deletePage } from "../../actions";
import { Button } from "@/components/ui";

export function DeletePageButton({ pageId }: { pageId: string }) {
  const [pending, start] = useTransition();
  return (
    <div className="space-y-2">
      <p className="text-[13px]">Pages that already have orders are archived instead, so your records stay intact.</p>
      <Button
        variant="danger"
        disabled={pending}
        onClick={() => {
          if (confirm("Delete this page? This cannot be undone.")) start(() => deletePage(pageId));
        }}
      >
        {pending ? "Deleting" : "Delete page"}
      </Button>
    </div>
  );
}
