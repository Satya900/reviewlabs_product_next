"use client";

import { usePathname } from "next/navigation";
import { TopNav } from "@/components/top-nav";

// The home page opens on a dark hero, so its nav sits on dark too.
export function NavTheme() {
  return <TopNav dark={usePathname() === "/"} />;
}
