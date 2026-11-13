"use client";

/**
 * 공통 틀: 본문 + 오른쪽 접는 패널(검토 보고서의 근거 질의응답). 상태가 있어 controls.tsx(서버에서도 쓰는 컨트롤)와 파일을 나눴다.
 * 데스크톱(lg)에서만 접는다 — 펼치면 패널 왼쪽 가장자리의 손잡이(›)로 접고, 접으면 오른쪽 끝에 아이콘 버튼(icon, 없으면 ‹)만 남아 본문이 넓어진다.
 * 접힌 버튼은 글자 없이 아이콘만 두고 이름은 툴팁(title)과 화면 낭독기용 글자로 준다 — 패널은 기본으로 펼쳐져 있고 담당자가 직접 접었을 때만 보인다.
 * 접어도 패널 내용은 마운트한 채 숨긴다 — 질의응답의 질문·답 같은 화면 상태가 사라지지 않는다.
 * 접힘 여부는 cookieName 쿠키에 남긴다 — 서버가 첫 화면을 같은 모양으로 그리고(defaultOpen) 다른 보고서로 가도 유지된다.
 * 좁은 화면에서는 늘 펼친 채 본문 아래에 둔다. 펼친 패널은 머리글 아래에 붙고 길면 패널 안에서 넘긴다.
 */
import { type ReactNode, useState } from "react";

const ONE_YEAR = 60 * 60 * 24 * 365;

export function SidePanelLayout({
  id,
  label,
  icon,
  main,
  panel,
  defaultOpen = true,
  cookieName,
}: {
  id: string;
  label: string;
  /** 접힌 버튼에 둘 아이콘(장식 — aria-hidden). 색은 글자 색(text-primary-strong)을 따른다 */
  icon?: ReactNode;
  main: ReactNode;
  panel: ReactNode;
  defaultOpen?: boolean;
  cookieName?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = `${id}-panel`;

  function toggle(next: boolean) {
    setOpen(next);
    if (cookieName) document.cookie = `${cookieName}=${next ? "open" : "closed"}; path=/; max-age=${ONE_YEAR}; samesite=lax`;
    // 누른 버튼이 사라지므로 반대쪽 버튼으로 초점을 옮긴다
    requestAnimationFrame(() => document.getElementById(`${id}-${next ? "collapse" : "expand"}`)?.focus());
  }

  return (
    <div className={`grid items-start gap-6 ${open ? "lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]" : "lg:grid-cols-[minmax(0,1fr)_auto]"}`}>
      <div className="min-w-0">{main}</div>
      <aside aria-label={label} className="relative min-w-0 lg:sticky lg:top-6">
        <div id={panelId} className={open ? undefined : "lg:hidden"}>
          <button
            id={`${id}-collapse`}
            type="button"
            aria-expanded="true"
            aria-controls={panelId}
            title={`${label} 접기`}
            onClick={() => toggle(false)}
            className="absolute top-3 -left-3 z-10 hidden size-6 items-center justify-center rounded-full border border-line-strong bg-control text-ink-muted shadow-card transition-colors hover:text-ink lg:flex"
          >
            <Chevron direction="right" />
            <span className="sr-only">{label} 접기</span>
          </button>
          {/* 안쪽 여백(p-2)과 바깥 음수 여백(-m-2)은 넘김 상자가 카드 그림자를 자르지 않게 한다. */}
          <div className="lg:-m-2 lg:max-h-[calc(100dvh-3rem)] lg:overflow-y-auto lg:p-2 lg:[scrollbar-width:thin]">{panel}</div>
        </div>
        <button
          id={`${id}-expand`}
          type="button"
          aria-expanded="false"
          aria-controls={panelId}
          title={`${label} 펼치기`}
          onClick={() => toggle(true)}
          className={`${open ? "hidden" : "hidden lg:flex"} size-10 items-center justify-center rounded-card border border-line-strong bg-control text-primary-strong shadow-card transition-colors hover:bg-surface-muted`}
        >
          {icon ?? <Chevron direction="left" />}
          <span className="sr-only">{label} 펼치기</span>
        </button>
      </aside>
    </div>
  );
}

function Chevron({ direction }: { direction: "left" | "right" }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d={direction === "right" ? "M6 3.5 10.5 8 6 12.5" : "M10 3.5 5.5 8 10 12.5"} />
    </svg>
  );
}
