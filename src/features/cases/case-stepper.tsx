/**
 * B 통합: 사건 화면 맨 위의 진행 단계 한 줄 — 담당 사건 보드와 같은 세 단계(접수·판단·검토 보고서, BOARD_COLUMNS)다.
 * 사건 개요·사실 카드·판단·검토 보고서 화면이 같은 자리에 둔다. 지난 단계는 체크(✓)만, 현재는 primary 점, 다음은 테두리 점이고
 * 지난 단계 사이 선은 success다. 모든 단계가 그 단계 화면으로 가는 링크다(stepHref) — 지난 단계는 그때 내용,
 * 아직 오지 않은 단계는 칸을 비운 화면을 보여 준다. 지금 보고 있는 화면의 단계(viewing)는 링크 대신 밑줄로 표시한다.
 * 좁은 화면에서도 세 단계 이름이 한 줄에 들어가고, 넘치면 줄 안에서 가로로 넘긴다.
 */
import Link from "next/link";
import type { CaseSummary } from "@/lib/api/types";
import { BOARD_COLUMNS, type BoardColumnKey, columnIndex, stepHref } from "@/lib/cases/stages";

export function CaseStepper({ summary: c, viewing }: { summary: CaseSummary; viewing?: BoardColumnKey }) {
  const current = columnIndex(c.stage);
  return (
    <nav aria-label="진행 단계" className="mb-5 overflow-x-auto rounded-card border border-line bg-surface px-3 py-1.5 [scrollbar-width:none]">
      <ol className="flex w-max min-w-full items-center gap-1 sm:gap-2">
        {BOARD_COLUMNS.map((column, i) => {
          const state = i < current ? "done" : i === current ? "current" : "next";
          const here = column.key === viewing;
          const last = i === BOARD_COLUMNS.length - 1;
          const text = `text-body break-keep ${state === "current" || here ? "font-semibold text-ink" : state === "done" ? "text-ink" : "text-ink-muted"}`;
          const content = (
            <span className="flex items-center gap-1.5 whitespace-nowrap">
              {state === "done" ? (
                <span aria-hidden className="flex size-5 shrink-0 items-center justify-center text-success">
                  <CheckMark />
                </span>
              ) : (
                <span
                  aria-hidden
                  className={`flex size-5 shrink-0 items-center justify-center rounded-full font-mono text-caption font-semibold tabular-nums ${
                    state === "current" ? "bg-primary text-on-primary" : "border border-line-strong bg-surface text-ink-muted"
                  }`}
                >
                  {i + 1}
                </span>
              )}
              <span className={`${text} ${here ? "underline decoration-primary-strong decoration-2 underline-offset-[6px]" : ""}`}>{column.label}</span>
              {state === "done" && <span className="sr-only">(지난 단계)</span>}
              {state === "next" && <span className="sr-only">(아직 오지 않은 단계)</span>}
            </span>
          );
          return (
            <li key={column.key} className={`flex items-center gap-1 sm:gap-2 ${last ? "" : "flex-1"}`} aria-current={state === "current" ? "step" : undefined}>
              {here ? (
                <span aria-current="page">{content}</span>
              ) : (
                <Link href={stepHref(c, column.key)} className="-mx-1 rounded-control px-1 py-0.5 hover:bg-surface-muted">
                  {content}
                </Link>
              )}
              {!last && <span aria-hidden className={`h-px min-w-2 flex-1 sm:min-w-3 ${i < current ? "bg-success" : "bg-line-strong"}`} />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** 지난 단계 표시 — 동그라미 없이 체크만. 색은 글자 색(text-success)을 따른다. */
function CheckMark() {
  return (
    <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8.5 6.5 12 13 4.5" />
    </svg>
  );
}
