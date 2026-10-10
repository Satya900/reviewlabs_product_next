"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { cx } from "@/components/ui";

const WIDTH = { desktop: 1180, mobile: 390 } as const;

// Renders children at a real device width, scaled down to fit the pane, so the
// preview shows exactly the layout a buyer would get on that device.
export function PreviewFrame({ url, children }: { url: string; children: ReactNode }) {
  const [device, setDevice] = useState<"desktop" | "mobile">("mobile");
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [height, setHeight] = useState(600);

  useLayoutEffect(() => {
    const measure = () => {
      if (!outer.current || !inner.current) return;
      const available = outer.current.clientWidth;
      const s = Math.min(1, available / WIDTH[device]);
      setScale(s);
      setHeight(inner.current.scrollHeight * s);
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (outer.current) ro.observe(outer.current);
    if (inner.current) ro.observe(inner.current);
    return () => ro.disconnect();
  }, [device]);

  return (
    <div className="overflow-hidden rounded-3xl border border-hairline bg-canvas">
      <div className="flex items-center justify-between gap-3 border-b border-hairline px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex gap-1.5" aria-hidden>
            <span className="size-2.5 rounded-full bg-surface-strong" />
            <span className="size-2.5 rounded-full bg-surface-strong" />
            <span className="size-2.5 rounded-full bg-surface-strong" />
          </span>
          <span className="num truncate rounded-full bg-surface-soft px-3 py-1 text-[12px] text-muted">{url}</span>
        </div>
        <div className="flex shrink-0 rounded-full bg-surface-strong p-1" role="tablist" aria-label="Preview device">
          {(["mobile", "desktop"] as const).map((d) => (
            <button
              key={d}
              type="button"
              role="tab"
              aria-selected={device === d}
              onClick={() => setDevice(d)}
              className={cx("rounded-full px-3 py-1 text-[12px] font-semibold capitalize", device === d ? "bg-canvas text-ink shadow-soft" : "text-body")}
            >
              {d}
            </button>
          ))}
        </div>
      </div>
      <div ref={outer} className="bg-surface-soft">
        <div className={cx("mx-auto overflow-hidden", device === "mobile" && "max-w-[390px]")} style={{ height }}>
          <div
            ref={inner}
            className="origin-top-left px-5 py-8"
            style={{ width: WIDTH[device], transform: `scale(${scale})` }}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
