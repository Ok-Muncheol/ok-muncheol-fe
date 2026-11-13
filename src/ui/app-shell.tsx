"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/*
 * 앱 틀 — 데스크톱(lg 이상)은 왼쪽 얇은 메뉴(제품명 · 주 메뉴 · 아래 담당자)와 오른쪽 본문이다. 위에 붙는 머리글이 없어서
 * 본문 안 sticky 요소는 lg에서 top-0(또는 작은 여백)에 붙는다. 좁은 화면은 같은 메뉴를 위 56px 머리글 한 줄로 둔다(그때 sticky는 top-14).
 * 담당자 이름을 누르면 내 정보(/profile)로 간다. 로그인 전에는 개발 배포에서 합성 견본 이름을, 운영에서는
 * "보상 담당자"를 보인다(src/features/profile/profile-source.ts). 로그아웃 버튼은 내 정보에 있다. 로그인 화면은 틀 없이 본문만 쓴다.
 */

/**
 * 주 메뉴. 「사건 접수」 탭은 두지 않는다 — 현업에서는 사건이 담당자에게 배정된 뒤 워크플로우가 시작되므로
 * 보상 담당자가 사건을 만들지 않는다. 접수 화면(/cases/new, 정지원)은 경로로만 남는다.
 */
const NAV: { href: string; label: string; icon: ReactNode; devOnly?: boolean }[] = [
  { href: "/cases", label: "담당 사건", icon: <path d="M3 5.5h14M3 10h14M3 14.5h9" /> },
  { href: "/done", label: "완료 사건", icon: <path d="m4 10.5 4 4 8-9" /> },
  { href: "/dev", label: "개발 미리보기", icon: <path d="m7 6-4 4 4 4M13 6l4 4-4 4" />, devOnly: true },
];

const BARE_PATHS = ["/login"];

export function AppShell({ children, showDev, accountName }: { children: ReactNode; showDev: boolean; accountName: string | null }) {
  const pathname = usePathname();
  if (BARE_PATHS.includes(pathname)) return <>{children}</>;
  const onProfile = pathname === "/profile";
  const items = NAV.filter((item) => !item.devOnly || showDev);
  // 하위 경로도 그 메뉴다 — /cases/[id]/… 는 담당 사건, /dev/corpora는 개발 미리보기.
  const isCurrent = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const name = accountName ?? "보상 담당자";

  return (
    <div className="min-h-dvh lg:pl-60">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-line bg-surface px-3 py-5 lg:flex">
        <Brand className="px-3" />
        <nav aria-label="주 메뉴" className="mt-8 flex flex-col gap-0.5">
          {items.map((item) => {
            const current = isCurrent(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={current ? "page" : undefined}
                className={`flex h-9 items-center gap-2.5 rounded-control px-3 text-body transition-colors ${
                  current ? "bg-primary-soft font-semibold text-on-primary-soft" : "text-ink-muted hover:bg-surface-muted hover:text-ink"
                }`}
              >
                <svg aria-hidden viewBox="0 0 20 20" className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                  {item.icon}
                </svg>
                {item.label}
              </Link>
            );
          })}
        </nav>
        <Link
          href="/profile"
          aria-current={onProfile ? "page" : undefined}
          className={`mt-auto flex items-center gap-2.5 rounded-control px-3 py-2 transition-colors ${onProfile ? "bg-primary-soft" : "hover:bg-surface-muted"}`}
        >
          <span aria-hidden className="flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-muted text-caption font-semibold text-ink-muted">
            {name.slice(0, 1)}
          </span>
          <span className="min-w-0">
            <span className="sr-only">내 정보: </span>
            <span className="block truncate text-body font-semibold text-ink">{name}</span>
            <span className="block text-caption text-ink-muted">보상 담당자</span>
          </span>
        </Link>
      </aside>

      {/* 좁은 화면 — 같은 메뉴를 위 한 줄로 */}
      <header className="sticky top-0 z-20 flex h-14 items-center gap-4 border-b border-line bg-surface px-4 lg:hidden">
        <Brand />
        <nav aria-label="주 메뉴" className="flex h-full min-w-0 items-stretch gap-1 overflow-x-auto">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isCurrent(item.href) ? "page" : undefined}
              className={`flex items-center border-b-2 px-2 text-body font-semibold whitespace-nowrap ${
                isCurrent(item.href) ? "border-primary-strong text-ink" : "border-transparent text-ink-muted"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <Link href="/profile" className="ml-auto text-caption font-semibold whitespace-nowrap text-ink-muted">
          <span className="sr-only">내 정보: </span>
          {name}
        </Link>
      </header>

      <main className="mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-6 lg:px-10 lg:py-10">{children}</main>
    </div>
  );
}

function Brand({ className = "" }: { className?: string }) {
  return (
    <Link href="/" className={`flex items-center gap-2 text-heading font-bold tracking-tight text-ink ${className}`}>
      <span aria-hidden className="flex size-7 items-center justify-center rounded-control bg-primary text-caption font-bold text-on-primary">
        OK
      </span>
      OK문철
    </Link>
  );
}
