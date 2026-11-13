/**
 * B 통합: 담당 사건 보드. 사건마다 한 줄이고, 줄은 접수 → 판단 → 검토 보고서 세 열을 지나는 진행 선이다.
 * 점은 칸 가운데다. 지나온 열은 채운 점과 실선(글 없음), 지금 열은 색 점과 짧은 상태 알약(「질문 1건」), 남은 열은 빈 점과 점선이다.
 * 위아래로 훑으면 사건들이 어디까지 왔는지, 옆으로 읽으면 한 사건이 어디서 멈췄는지 보인다(상태 문구는 src/lib/cases/stages.ts boardStatus).
 * 점 색은 뜻으로 고른다 — 확인 필요 warning · 승인 대기 primary · 실패 danger · 승인 완료 success, 나머지는 회색이다. 처리 중은 도는 표시다.
 * 보고서를 승인한 사건은 완료 탭에만 보인다.
 * 위 도구 줄의 단계 탭 · 확인 필요만 · 정렬로 거르고 줄 세운다(src/lib/cases/stages.ts boardRows). 고정한 사건은 묶음 표시 없이 맨 위에 둔다(고정은 담당자 브라우저 쿠키 — src/lib/cases/pins.ts).
 * 서버 컴포넌트다 — 고정 버튼만 클라이언트(pin-button.tsx)이고 폼으로 Server Action(pin-actions.ts)을 부른다.
 * pinned를 넘기지 않으면 고정 버튼 없이 그린다(/dev 미리보기).
 */
import Link from "next/link";
import type { ReactNode } from "react";
import { StatusLabel } from "@/components/status-label";
import type { CaseSummary } from "@/lib/api/types";
import { caseTitle } from "@/lib/cases/intake";
import {
  BOARD_COLUMNS,
  BOARD_SORTS,
  type BoardColumnKey,
  type BoardStage,
  type BoardTone,
  type BoardView,
  DEFAULT_VIEW,
  boardHref,
  boardRows,
  boardStatus,
  columnIndex,
  currentStatus,
  stageHref,
} from "@/lib/cases/stages";
import { Badge, Spinner } from "@/ui/controls";
import { togglePin } from "./pin-actions";
import { PinButton } from "./pin-button";
import { SortMenu } from "./sort-menu";

const dayParts = new Intl.DateTimeFormat("en-US", {
  month: "numeric",
  day: "numeric",
  timeZone: "Asia/Seoul",
});
/** 배정일 — "11.9"처럼 짧게. */
function shortDay(iso: string): string {
  const parts = dayParts.formatToParts(new Date(iso));
  return `${parts.find((p) => p.type === "month")?.value}.${parts.find((p) => p.type === "day")?.value}`;
}

// 마지막 열(검토 보고서)은 좁게 — 점이 칸 가운데라 넓으면 오른쪽이 빈다.
const GRID = "grid grid-cols-[15rem_repeat(2,minmax(10rem,1fr))_minmax(9rem,0.7fr)]";

/**
 * view는 /cases 주소에서 읽은 보기(단계 탭 · 정렬 · 확인 필요만)다. 넘기지 않으면 기본 보기이고 탭·정렬을 그리지 않는다(/dev 미리보기).
 * aside는 도구 줄 오른쪽에 둔다(/cases의 견본 배지).
 */
export function CaseBoard({ cases, pinned, view, aside }: { cases: readonly CaseSummary[]; pinned?: readonly string[]; view?: BoardView; aside?: ReactNode }) {
  const { rows, total, counts } = boardRows(cases, view ?? DEFAULT_VIEW, pinned ?? []);
  const pins = new Set(pinned ?? []);

  return (
    <div className="flex flex-col gap-3">
      {view && <Toolbar view={view} total={total} counts={counts} aside={aside} />}

      <div className="overflow-x-auto rounded-card border border-line bg-surface lg:overflow-visible">
        <div className="min-w-[48rem]">
          <div className={`${GRID} rounded-t-card border-b border-line bg-surface text-caption text-ink-muted lg:sticky lg:top-0 lg:z-20`} aria-hidden>
            <span className="px-5 py-2.5">사건</span>
            {/* 단계 이름은 점(칸 가운데)에서 시작한다 */}
            {BOARD_COLUMNS.map((col) => (
              <span key={col.key} className="py-2.5 pl-[calc(50%-0.375rem)]">
                {col.label}
              </span>
            ))}
          </div>

          {rows.length === 0 ? (
            <p className="px-5 py-12 text-center text-caption text-ink-faint">
              {cases.length === 0 ? "배정된 사건이 없어요" : view?.stage === "done" ? "아직 완료한 사건이 없어요" : "조건에 맞는 사건이 없어요"}
            </p>
          ) : (
            // 고정한 사건은 묶음 표시 없이 맨 위에 둔다 — 핀 색으로만 구분한다.
            <ul aria-label="담당 사건" className="divide-y divide-line">
              {rows.map((c) => (
                <CaseRow key={c.case_id} summary={c} pinned={pinned === undefined ? null : pins.has(c.case_id)} />
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

/** 도구 줄 — 왼쪽은 단계 탭(건수가 곧 요약), 오른쪽은 확인 필요만 · 정렬. */
/** 완료 사건 화면(view.stage가 done)에서는 단계 탭과 확인 필요만 없이 정렬만 둔다. */
function Toolbar({ view, total, counts, aside }: { view: BoardView; total: number; counts: Record<BoardColumnKey, number>; aside?: ReactNode }) {
  const tabs: { key: BoardStage; label: string; count: number }[] = [
    { key: "all", label: "전체", count: total },
    ...BOARD_COLUMNS.map((col) => ({
      key: col.key,
      label: col.label,
      count: counts[col.key],
    })),
  ];
  const sort = BOARD_SORTS.find((s) => s.key === view.sort) ?? BOARD_SORTS[0];
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      {view.stage === "done" ? (
        <span />
      ) : (
        <nav aria-label="단계" className="flex flex-wrap items-center gap-1">
          {tabs.map((tab) => {
            const active = view.stage === tab.key;
            return (
              <Link
                key={tab.key}
                href={boardHref(view, { stage: tab.key })}
                scroll={false}
                aria-current={active ? "page" : undefined}
                className={`inline-flex h-8 items-center gap-2 rounded-control px-3 text-body transition-colors ${
                  active ? "bg-surface font-semibold text-ink shadow-card ring-1 ring-line" : "text-ink-muted hover:bg-surface-muted hover:text-ink"
                }`}
              >
                {tab.label}
                <span className={`text-caption tabular-nums ${active ? "text-ink-muted" : "text-ink-faint"}`}>{tab.count}</span>
              </Link>
            );
          })}
        </nav>
      )}
      <div className="flex items-center gap-1">
        {aside}
        {view.stage !== "done" && (
          <Link
            href={boardHref(view, { turn: !view.turn })}
            scroll={false}
            role="checkbox"
            aria-checked={view.turn}
            className="inline-flex h-8 items-center gap-2 rounded-control px-2.5 text-caption text-ink-muted hover:bg-surface-muted hover:text-ink"
          >
            <span
              aria-hidden
              className={`flex size-3.5 items-center justify-center rounded-[4px] border ${view.turn ? "border-primary-strong bg-primary-strong text-on-primary" : "border-line-strong bg-surface"}`}
            >
              {view.turn && (
                <svg viewBox="0 0 16 16" className="size-3" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="m3.5 8.5 3 3 6-7" />
                </svg>
              )}
            </span>
            확인 필요만
          </Link>
        )}
        <SortMenu
          current={sort.label}
          options={BOARD_SORTS.map((s) => ({
            label: s.label,
            href: boardHref(view, { sort: s.key }),
            active: s.key === view.sort,
          }))}
        />
      </div>
    </div>
  );
}

/** 한 줄 — 왼쪽은 사건(고정 · 사고 날짜 이름 · 사건번호 · 배정일), 오른쪽은 세 열의 진행 선. */
function CaseRow({ summary: c, pinned }: { summary: CaseSummary; pinned: boolean | null }) {
  const current = columnIndex(c.stage);
  const status = boardStatus(c);
  const href = stageHref(c);
  return (
    <li className={`relative ${GRID} items-stretch transition-colors hover:bg-surface-muted`}>
      <div className="flex items-start gap-1 py-3 pr-3 pl-3">
        {pinned !== null && (
          <form action={togglePin} className="relative z-10 -mt-0.5">
            <input type="hidden" name="case_id" value={c.case_id} />
            <PinButton caseId={c.case_id} pinned={pinned} />
          </form>
        )}
        <div className={`min-w-0 ${pinned === null ? "pl-2" : ""}`}>
          {/* 줄 전체가 이 링크다(after가 줄을 덮는다 — 진행 선 칸도 relative라 z로 그 위에 둔다). 고정 버튼(z-10)만 그 위에 있다. */}
          <Link href={href} className="leading-6 font-semibold break-keep text-ink after:absolute after:inset-0 after:z-[5] after:content-['']">
            {caseTitle(c.accident_date)}
          </Link>
          <p className="text-caption text-ink-muted">
            <span className="font-mono tabular-nums">{c.case_id}</span> · <time dateTime={c.created_at}>{shortDay(c.created_at)}</time> 배정
          </p>
        </div>
      </div>
      {BOARD_COLUMNS.map((col, i) => (
        // 점은 칸 가운데다. 선은 칸마다 반씩 — 왼쪽 반은 앞 단계에서 오는 선, 오른쪽 반은 다음 단계로 가는 선이다.
        <div key={col.key} className="relative">
          {i > 0 && <Segment className="right-1/2 left-0" solid={i <= current} />}
          {i < BOARD_COLUMNS.length - 1 && <Segment className="right-0 left-1/2" solid={i < current} />}
          <span aria-hidden className="absolute top-1/2 left-1/2 flex w-3 -translate-x-1/2 -translate-y-1/2 justify-center">
            <Node place={i < current ? "past" : i === current ? "now" : "next"} tone={status.tone} />
          </span>
          {/* 상태명은 점 바로 옆 알약이다 — 알약 바탕이 뒤의 점선을 가린다. */}
          {i === current && (
            <span className={`absolute top-1/2 left-[calc(50%+0.625rem)] inline-flex h-6 -translate-y-1/2 items-center rounded-full px-2.5 text-caption font-semibold whitespace-nowrap ${PILL[status.tone]}`}>
              {status.label}
            </span>
          )}
        </div>
      ))}
    </li>
  );
}

function Segment({ className, solid }: { className: string; solid: boolean }) {
  return <span aria-hidden className={`absolute top-1/2 ${className} ${solid ? "h-px -translate-y-1/2 bg-line-strong" : "border-t border-dashed border-line-strong"}`} />;
}

const NOW_DOT: Record<BoardTone, string> = {
  turn: "bg-warning ring-warning-soft",
  approval: "bg-primary-strong ring-primary-soft",
  running: "",
  failed: "bg-danger ring-danger-soft",
  done: "bg-success ring-success-soft",
  idle: "bg-ink-muted ring-surface-muted",
};

function Node({ place, tone }: { place: "past" | "now" | "next"; tone: BoardTone }) {
  if (place === "past") return <span className="block size-2 rounded-full bg-line-strong" />;
  if (place === "next") return <span className="block size-2 rounded-full border border-line-strong bg-surface" />;
  if (tone === "running") return <Spinner className="h-3.5! w-3.5! rounded-full bg-surface" />;
  return <span className={`block size-2.5 rounded-full ring-4 ${NOW_DOT[tone]}`} />;
}

/**
 * 상태 알약 — 주황은 확인 필요, 진한 옥색은 마지막 승인 차례, 옅은 옥색(검토 보고서 열 머리 색)은 처리 중,
 * 빨강은 실패, 초록은 승인 완료, 회색은 그 밖(판단 완료처럼 다음 단계로 넘길 일만 남은 상태)이다.
 */
const PILL: Record<BoardTone, string> = {
  turn: "bg-warning-soft text-on-warning-soft",
  approval: "bg-primary text-on-primary",
  running: "bg-stage-report text-on-primary-soft",
  failed: "bg-danger-soft text-on-danger-soft",
  done: "bg-success-soft text-on-success-soft",
  idle: "bg-surface-muted text-ink-muted",
};

/** 상태 한 가지 — 작업·판정은 StatusLabel, 승인은 보고서 배지, 아직 없으면 초안. 사건 개요 · 보고서 화면이 쓴다. */
export function CaseStatusBadge({ status }: { status: ReturnType<typeof currentStatus> }) {
  switch (status.kind) {
    case "task":
    case "judgment":
      return <StatusLabel status={status.status} />;
    case "approval":
      return status.status === "approved" ? (
        <Badge tone="success" dot>
          승인
        </Badge>
      ) : (
        <Badge tone="neutral" dot>
          승인 대기
        </Badge>
      );
    default:
      return (
        <Badge tone="neutral" dot>
          초안
        </Badge>
      );
  }
}
