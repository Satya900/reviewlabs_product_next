import { MarketingShell } from "@/components/site-shell";
import { PlatformPixel } from "@/components/platform-pixel";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <MarketingShell>
      <PlatformPixel />
      {children}
    </MarketingShell>
  );
}
