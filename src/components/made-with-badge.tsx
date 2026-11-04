import Link from "next/link";
import { LogoMark } from "@/components/logo-mark";

// Shown on Creator-plan pages; Pro removes it.
export function MadeWithBadge() {
  return (
    <div className="flex justify-center pb-10 pt-4">
      <Link href="/?ref=badge" className="flex w-fit items-center gap-2 rounded-full bg-canvas px-4 py-2 text-[13px] font-medium text-body shadow-soft ring-1 ring-hairline">
        <LogoMark className="size-5" />
        Made with Reviewlabs
      </Link>
    </div>
  );
}
