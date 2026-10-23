"use client";

import { useState } from "react";
import { cx } from "@/components/ui";

// How to save a Superprofile page as .html, per browser. Used on the public
// /import guide and in the dashboard importer, so both always say the same thing.
// "Complete" saves keep the price bar the page fills in after it loads; Safari's
// "Page Source" doesn't, so Safari users type the price after importing.
const BROWSERS = [
  {
    key: "chrome",
    label: "Chrome or Edge",
    steps: [
      <>Open your product page on superprofile.bio (the link looks like <span className="num">superprofile.bio/vp/your-product</span>) and wait until the price and buy button show.</>,
      <>Press <b>Ctrl+S</b> (<b>Cmd+S</b> on a Mac). Or use the browser menu: <b>⋮ → Cast, save and share → Save page as…</b> in Chrome, <b>⋯ → More tools → Save page as</b> in Edge.</>,
      <>Under <b>Save as type</b> (<b>Format</b> on a Mac), choose <b>Webpage, Complete</b>, then click <b>Save</b>.</>,
      <>You&apos;ll get a <span className="num">.html</span> file and a folder with the same name. Upload only the <span className="num">.html</span> file.</>,
    ],
  },
  {
    key: "firefox",
    label: "Firefox",
    steps: [
      <>Open your product page on superprofile.bio and wait until the price and buy button show.</>,
      <>Press <b>Ctrl+S</b> (<b>Cmd+S</b> on a Mac), or open the menu <b>☰</b> and choose <b>Save page as…</b>.</>,
      <>Under <b>Save as type</b>, choose <b>Web Page, complete</b>, then click <b>Save</b>.</>,
      <>Upload the <span className="num">.html</span> file it saves. You can ignore the folder next to it.</>,
    ],
  },
  {
    key: "safari",
    label: "Safari",
    steps: [
      <>Open your product page on superprofile.bio and wait for it to load.</>,
      <>In the menu bar choose <b>File → Save As…</b></>,
      <>Set <b>Format</b> to <b>Page Source</b>, not Web Archive, then click <b>Save</b>.</>,
      <>Upload the <span className="num">.html</span> file. Safari saves the page before Superprofile shows the price, so you&apos;ll type the price in the editor after importing.</>,
    ],
  },
] as const;

export function SaveSteps({ className }: { className?: string }) {
  const [browser, setBrowser] = useState<(typeof BROWSERS)[number]["key"]>("chrome");
  const current = BROWSERS.find((b) => b.key === browser)!;
  return (
    <div className={cx("space-y-4", className)}>
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Your browser">
        {BROWSERS.map((b) => (
          <button
            key={b.key}
            type="button"
            role="tab"
            aria-selected={browser === b.key}
            onClick={() => setBrowser(b.key)}
            className={cx(
              "rounded-full px-4 py-1.5 text-[14px] font-semibold transition",
              browser === b.key ? "bg-ink text-white" : "bg-surface-strong text-body hover:text-ink",
            )}
          >
            {b.label}
          </button>
        ))}
      </div>
      <ol className="space-y-2.5 text-[15px] text-body" role="tabpanel">
        {current.steps.map((s, i) => (
          <li key={i} className="flex gap-3">
            <span className="num mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-[12px] font-semibold text-primary">{i + 1}</span>
            <span className="min-w-0">{s}</span>
          </li>
        ))}
      </ol>
      <p className="text-[13px] text-muted">
        On a phone? Phone browsers can&apos;t save the page in a way that keeps your product details, so please use a laptop or desktop for this step.
      </p>
    </div>
  );
}
