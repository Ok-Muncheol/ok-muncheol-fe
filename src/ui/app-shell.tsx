"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { setSidebarClosed } from "./sidebar";

/*
 * 앱 틀 — 데스크톱(lg 이상)은 왼쪽 얇은 메뉴(제품명 · 주 메뉴 · 아래 담당자)와 오른쪽 본문이다. 위에 붙는 머리글이 없어서
 * 본문 안 sticky 요소는 lg에서 top-0(또는 작은 여백)에 붙는다. 좁은 화면은 같은 메뉴를 위 56px 머리글 한 줄로 둔다(그때 sticky는 top-14).
 * 담당자 이름을 누르면 내 정보(/profile)로 간다. 로그인 전(accountName null)에는 그 자리가 로그인 버튼이다(지금 화면으로 돌아오게 ?next=). 로그인 전에는 개발 배포에서 합성 견본 이름을, 운영에서는
 * "보상 담당자"를 보인다(src/features/profile/profile-source.ts). 로그아웃 버튼은 내 정보에 있다. 로그인 화면은 틀 없이 본문만 쓴다.
 *
 * 왼쪽 메뉴는 접을 수 있다(CureAgent 앱 틀을 따랐다). 접으면 아이콘만 남는 56px 줄이 되고, 메뉴 이름은 아이콘에 마우스를 올리거나
 * 키보드 초점이 가면 옆에 뜬다. 접힘은 담당자 화면 습관이라 이 브라우저에만 남긴다(localStorage).
 * 상태는 React state가 아니라 <html data-sidebar="closed">이고 화면은 CSS(in-data-[sidebar=closed])로 바뀐다 —
 * layout.tsx가 넣는 SIDEBAR_SCRIPT(src/ui/sidebar.ts)가 첫 그림 전에 속성을 붙이므로 접어 둔 담당자에게 펼침→접힘이 번쩍이지 않고, 서버 렌더도 그대로다.
 */

/** 접힌 줄에서 메뉴 이름 — 아이콘 오른쪽에 뜨는 말풍선이 된다(마우스 올림·키보드 초점). 펼치면 그냥 글자다. */
const RAIL_LABEL =
  "whitespace-nowrap in-data-[sidebar=closed]:pointer-events-none in-data-[sidebar=closed]:absolute in-data-[sidebar=closed]:top-1/2 in-data-[sidebar=closed]:left-full in-data-[sidebar=closed]:z-40 in-data-[sidebar=closed]:ml-2 in-data-[sidebar=closed]:hidden in-data-[sidebar=closed]:-translate-y-1/2 in-data-[sidebar=closed]:rounded-control in-data-[sidebar=closed]:bg-ink in-data-[sidebar=closed]:px-2 in-data-[sidebar=closed]:py-1 in-data-[sidebar=closed]:text-caption in-data-[sidebar=closed]:font-semibold in-data-[sidebar=closed]:text-surface in-data-[sidebar=closed]:shadow-card in-data-[sidebar=closed]:group-hover:block in-data-[sidebar=closed]:group-focus-visible:block";
/** 접힌 줄에서 메뉴 한 칸 — 가운데 정렬한 정사각 아이콘 단추가 된다. */
const RAIL_ITEM = "in-data-[sidebar=closed]:mx-auto in-data-[sidebar=closed]:w-9 in-data-[sidebar=closed]:justify-center in-data-[sidebar=closed]:px-0";

function PanelIcon() {
  return (
    <svg aria-hidden viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="14" height="12" rx="2" />
      <path d="M8 4v12" />
    </svg>
  );
}

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
    <div className="min-h-dvh transition-[padding] duration-200 motion-reduce:transition-none lg:pl-60 lg:in-data-[sidebar=closed]:pl-14 print:pl-0!">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 print:hidden! flex-col border-r border-line bg-surface px-3 py-5 transition-[width] duration-200 motion-reduce:transition-none lg:flex in-data-[sidebar=closed]:w-14 in-data-[sidebar=closed]:px-2.5">
        {/* 위 한 줄 — 펼침은 제품명과 접기 단추, 접힘은 펼치기 단추만 */}
        <div className="flex h-8 items-center justify-between gap-2 pl-3 in-data-[sidebar=closed]:hidden">
          <Brand />
          <button
            type="button"
            onClick={() => setSidebarClosed(true)}
            aria-label="메뉴 접기"
            title="메뉴 접기"
            className="flex size-8 items-center justify-center rounded-control text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink"
          >
            <PanelIcon />
          </button>
        </div>
        <div className="hidden h-8 items-center justify-center in-data-[sidebar=closed]:flex">
          <button
            type="button"
            onClick={() => setSidebarClosed(false)}
            aria-label="메뉴 펼치기"
            title="메뉴 펼치기"
            className="flex size-9 items-center justify-center rounded-control text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink"
          >
            <PanelIcon />
          </button>
        </div>
        <nav aria-label="주 메뉴" className="mt-8 flex flex-col gap-0.5">
          {items.map((item) => {
            const current = isCurrent(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={current ? "page" : undefined}
                className={`group relative flex h-9 items-center gap-2.5 rounded-control px-3 text-body transition-colors ${RAIL_ITEM} ${
                  current ? "bg-primary-soft font-semibold text-on-primary-soft" : "text-ink-muted hover:bg-surface-muted hover:text-ink"
                }`}
              >
                <svg aria-hidden viewBox="0 0 20 20" className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                  {item.icon}
                </svg>
                <span className={RAIL_LABEL}>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        {/* 로그인 전(담당자 이름 없음)이면 담당자 자리가 로그인 버튼이다. */}
        {accountName === null ? (
          <Link
            href={`/login?next=${encodeURIComponent(pathname)}`}
            className={`group relative mt-auto flex h-10 items-center justify-center gap-2 rounded-control bg-primary text-body font-semibold text-on-primary transition-colors hover:bg-primary-hover ${RAIL_ITEM}`}
          >
            <svg aria-hidden viewBox="0 0 20 20" className="hidden size-4 shrink-0 in-data-[sidebar=closed]:block" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4h4a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-4M8 6.5 11.5 10 8 13.5M11.5 10H3" />
            </svg>
            <span className={RAIL_LABEL}>로그인</span>
          </Link>
        ) : (
          <Link
            href="/profile"
            aria-current={onProfile ? "page" : undefined}
            className={`group relative mt-auto flex items-center gap-2.5 rounded-control px-3 py-2 transition-colors in-data-[sidebar=closed]:py-1 ${RAIL_ITEM} ${onProfile ? "bg-primary-soft" : "hover:bg-surface-muted"}`}
          >
            <span aria-hidden className="flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-muted text-caption font-semibold text-ink-muted">
              {name.slice(0, 1)}
            </span>
            <span className={`min-w-0 ${RAIL_LABEL}`}>
              <span className="sr-only">내 정보: </span>
              <span className="block truncate text-body font-semibold text-ink in-data-[sidebar=closed]:text-caption in-data-[sidebar=closed]:text-surface">{name}</span>
              <span className="block text-caption text-ink-muted in-data-[sidebar=closed]:hidden">보상 담당자</span>
            </span>
          </Link>
        )}
      </aside>

      {/* 좁은 화면 — 같은 메뉴를 위 한 줄로 */}
      <header className="sticky top-0 z-20 flex h-14 items-center gap-4 border-b border-line bg-surface px-4 lg:hidden print:hidden">
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
        {accountName === null ? (
          <Link href={`/login?next=${encodeURIComponent(pathname)}`} className="ml-auto text-caption font-semibold whitespace-nowrap text-primary-strong">
            로그인
          </Link>
        ) : (
          <Link href="/profile" className="ml-auto text-caption font-semibold whitespace-nowrap text-ink-muted">
            <span className="sr-only">내 정보: </span>
            {name}
          </Link>
        )}
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
