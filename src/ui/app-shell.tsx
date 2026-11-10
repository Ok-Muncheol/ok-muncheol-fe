"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/*
 * 앱 틀 — 위 머리글(제품명 · 주 메뉴 · 담당자)과 본문. 데스크톱 업무 화면이 먼저라 사이드바 대신
 * 56px 머리글 한 줄로 두고, 본문은 가운데 최대 1280px이다. 로그인 화면은 머리글 없이 본문만 쓴다.
 * 오른쪽은 담당자 이름이고 누르면 내 정보(/profile)로 간다. 로그인 전에는 개발 배포에서 합성 견본 이름을, 운영에서는
 * "보상 담당자"를 보인다(src/features/profile/profile-source.ts). 로그아웃 버튼은 내 정보에 있다.
 */

const NAV: { href: string; label: string; devOnly?: boolean }[] = [
  { href: "/cases", label: "담당 사건" },
  { href: "/cases/new", label: "사건 접수" },
  { href: "/dev", label: "개발 미리보기", devOnly: true },
];

const BARE_PATHS = ["/login"];

export function AppShell({ children, showDev, accountName }: { children: ReactNode; showDev: boolean; accountName: string | null }) {
  const pathname = usePathname();
  if (BARE_PATHS.includes(pathname)) return <>{children}</>;
  const onProfile = pathname === "/profile";

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
                    current ? "border-primary-strong text-ink" : "border-transparent text-ink-muted hover:text-ink"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <Link
            href="/profile"
            aria-current={onProfile ? "page" : undefined}
            className={`ml-auto flex h-full items-center border-b-2 px-3 text-caption font-semibold whitespace-nowrap ${
              onProfile ? "border-primary-strong text-ink" : "border-transparent text-ink-muted hover:text-ink"
            }`}
          >
            <span className="sr-only">내 정보: </span>
            {accountName ?? "보상 담당자"}
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1280px] flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
