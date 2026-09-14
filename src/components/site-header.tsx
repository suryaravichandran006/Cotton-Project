"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { SITE } from "@/lib/config";

const NAV = [
  { href: "/", label: "Overview" },
  { href: "/progress", label: "Progress" },
  { href: "/architecture", label: "Architecture" },
  { href: "/datasets", label: "Data & Method" },
  { href: "/results", label: "Results" },
  { href: "/analyze", label: "Final Stage", wip: true },
] as const;

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-3", className)}>
      <span className="grid h-9 w-9 place-items-center rounded-full border border-accent/20 bg-accent-soft">
        <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden className="text-accent">
          <circle cx="9" cy="10" r="4.1" fill="currentColor" opacity="0.16" />
          <circle cx="15" cy="10" r="4.1" fill="currentColor" opacity="0.16" />
          <circle cx="12" cy="14" r="4.2" fill="currentColor" opacity="0.22" />
          <path d="M12 18.4c-.15-4.55-.08-8.1 0-11.4M12 15.8c-2.15-1.85-3.55-3.9-4.2-6.15M12 15.8c2.15-1.85 3.55-3.9 4.2-6.15" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" fill="none" />
        </svg>
      </span>
      <span>
        <span className="block text-base font-semibold leading-none tracking-[-0.02em] text-ink">{SITE.name}</span>
        <span className="mt-1 hidden text-[10px] font-medium tracking-wide text-ink-muted sm:block">Progressive cotton vision research</span>
      </span>
    </span>
  );
}

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isActive = (href: string) => href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-surface/95 backdrop-blur-xl">
      <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" aria-label={`${SITE.name} home`}><Logo /></Link>
        <nav aria-label="Primary" className="hidden items-center gap-0.5 lg:flex">
          {NAV.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[13px] font-medium transition xl:px-3.5 xl:text-sm",
                  active ? "bg-accent text-white" : "text-ink-soft hover:bg-surface-muted hover:text-ink",
                )}
              >
                {item.label}
                {"wip" in item && item.wip ? (
                  <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide", active ? "bg-white/15 text-white" : "bg-gold-soft text-gold-strong")}>WIP</span>
                ) : null}
              </Link>
            );
          })}
        </nav>
        <button
          type="button"
          className="grid h-10 w-10 place-items-center rounded-full border border-line bg-surface text-ink lg:hidden"
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open ? (
        <nav id="mobile-nav" aria-label="Mobile" className="border-t border-line bg-surface px-4 py-4 lg:hidden">
          <div className="grid gap-1">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center justify-between rounded-xl px-4 py-3 text-sm font-medium",
                  isActive(item.href) ? "bg-accent text-white" : "text-ink-soft hover:bg-surface-muted",
                )}
              >
                {item.label}
                {"wip" in item && item.wip ? <span className="rounded-full bg-gold-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gold-strong">WIP</span> : null}
              </Link>
            ))}
          </div>
        </nav>
      ) : null}
    </header>
  );
}
