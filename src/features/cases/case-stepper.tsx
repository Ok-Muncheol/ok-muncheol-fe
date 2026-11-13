/**
 * B 통합: 사건 화면 머리의 진행 단계 한 줄 — 담당 사건 보드와 같은 세 단계(접수 › 판단 › 검토 보고서, BOARD_COLUMNS)다.
 * 상자 · 번호 원 없이 글자만 둔다.
 * - 지난 단계: 회색 글자 + 작은 체크, 누르면 그 단계 화면(stepHref)
 * - 사건이 지금 있는 단계: 굵은 글자, 누르면 그 단계 화면
 * - 아직 오지 않은 단계: 옅은 회색 글자이고 누를 수 없다 — 빈 화면으로 보내지 않는다
 * 지금 보고 있는 화면의 단계(viewing)는 옥색 굵은 글자(옥색은 「지금 위치」)이고 링크가 아니다. 사건 머리(case-header.tsx)가 쓴다.
 */
import Link from "next/link";
import type { CaseSummary } from "@/lib/api/types";
import { BOARD_COLUMNS, type BoardColumnKey, columnIndex, stepHref } from "@/lib/cases/stages";

export type StepperCase = Pick<CaseSummary, "case_id" | "stage" | "versions">;

export function CaseStepper({ summary: c, viewing }: { summary: StepperCase; viewing?: BoardColumnKey }) {
  const current = columnIndex(c.stage);
  return (
    <nav aria-label="진행 단계">
      <ol className="flex items-center gap-1.5 text-caption">
        {BOARD_COLUMNS.map((column, i) => {
          const state = i < current ? "done" : i === current ? "current" : "next";
          const here = column.key === viewing;
          const tone = here ? "font-semibold text-primary-strong" : state === "current" ? "font-semibold text-ink" : state === "done" ? "text-ink-muted" : "text-ink-faint";
          const content = (
            <span className={`inline-flex items-center gap-1 whitespace-nowrap ${tone}`}>
              {state === "done" && (
                <svg aria-hidden viewBox="0 0 16 16" className="size-3" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="m3.5 8.5 3 3 6-7" />
                </svg>
              )}
              {column.label}
              {state === "done" && <span className="sr-only">(지난 단계)</span>}
              {state === "current" && <span className="sr-only">(진행 중인 단계)</span>}
              {state === "next" && <span className="sr-only">(아직 오지 않은 단계)</span>}
            </span>
          );
          return (
            <li key={column.key} className="flex items-center gap-1.5" aria-current={state === "current" ? "step" : undefined}>
              {i > 0 && (
                <svg aria-hidden viewBox="0 0 16 16" className="size-3 text-ink-faint" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                  <path d="m6 3.5 4.5 4.5L6 12.5" />
                </svg>
              )}
              {here ? (
                <span aria-current="page">{content}</span>
              ) : state === "next" ? (
                content
              ) : (
                <Link href={stepHref(c, column.key)} className="rounded-badge px-0.5 hover:underline hover:underline-offset-4">
                  {content}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
