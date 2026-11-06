"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/*
 * 앱 틀 — 위 머리글(제품명 · 주 메뉴 · 담당자)과 본문. 데스크톱 업무 화면이 먼저라 사이드바 대신
 * 56px 머리글 한 줄로 두고, 본문은 가운데 최대 1280px이다. 로그인 화면은 머리글 없이 본문만 쓴다.
 * 담당자 이름 · 로그아웃은 인증이 붙으면 오른쪽 자리에 넣는다(src/lib/supabase/README.md).
 */

const NAV: { href: string; label: string; devOnly?: boolean }[] = [
  { href: "/cases", label: "담당 사건" },
  { href: "/cases/new", label: "사건 접수" },
  { href: "/dev", label: "개발 미리보기", devOnly: true },
];

const BARE_PATHS = ["/login"];

export function AppShell({ children, showDev }: { children: ReactNode; showDev: boolean }) {
  const pathname = usePathname();
  if (BARE_PATHS.includes(pathname)) return <>{children}</>;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 border-b border-line bg-surface">
        <div className="mx-auto flex h-14 w-full max-w-[1280px] items-center gap-6 px-6">
          <Link href="/" className="flex items-center gap-2 text-heading font-bold text-ink">
            <span aria-hidden className="flex size-7 items-center justify-center rounded-control bg-primary text-caption text-on-primary">
              OK
            </span>
            OK문철
          </Link>
          <nav aria-label="주 메뉴" className="flex h-full items-stretch gap-1">
            {NAV.filter((item) => !item.devOnly || showDev).map((item) => {
              const current = item.href === "/cases" ? pathname === "/cases" || /^\/cases\/(?!new)/.test(pathname) : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={current ? "page" : undefined}
                  className={`flex items-center border-b-2 px-3 text-body font-semibold ${
                    current ? "border-primary text-ink" : "border-transparent text-ink-muted hover:text-ink"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto text-caption text-ink-muted">담당자</div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1280px] flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
