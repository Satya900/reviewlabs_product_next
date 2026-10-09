import { cx } from "@/components/ui";

// Reviewlabs mark: a file with a check, meaning "your file, delivered".
// Source artwork: src/assets/logo-mark.svg (favicons are generated from it).
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" className={cx("shrink-0", className)} aria-hidden>
      <circle cx="32" cy="32" r="32" fill="#0052FF" />
      <path d="M22.5 15H36.2L45 23.8V46.5A2.5 2.5 0 0 1 42.5 49H22.5A2.5 2.5 0 0 1 20 46.5V17.5A2.5 2.5 0 0 1 22.5 15Z" fill="#FFFFFF" />
      <path d="M36.2 15V21.3A2.5 2.5 0 0 0 38.7 23.8H45Z" fill="#B8CCFF" />
      <path d="M26 35.5L30.6 40L39.5 31" stroke="#0052FF" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
