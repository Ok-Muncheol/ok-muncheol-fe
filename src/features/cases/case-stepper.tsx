/**
 * B 통합: 사건 상세 머리의 단계 표시. 지난 단계는 success 점, 현재는 primary 면, 다음은 line 점.
 * 지난·현재 단계는 그 화면으로 가는 링크다. 영상 없는 사건은 영상 분석 칸이 없다.
 */
import Link from "next/link";
import type { CaseSummary } from "@/lib/api/types";
import { stageHref, stageIndex, visibleStages } from "@/lib/cases/stages";

export function CaseStepper({ summary: c }: { summary: CaseSummary }) {
  const current = stageIndex(c.stage);
  return (
    <ol className="flex flex-wrap gap-x-2 gap-y-3" aria-label="진행 단계">
      {visibleStages(c).map((stage, i, all) => {
        const idx = stageIndex(stage.key);
        const state = idx < current ? "done" : idx === current ? "current" : "next";
        const dot =
          state === "done"
            ? "bg-success text-on-primary"
            : state === "current"
              ? "bg-primary text-on-primary"
              : "border border-line-strong bg-surface text-ink-muted";
        const label = (
          <span className="flex items-center gap-2">
            <span aria-hidden className={`flex size-6 shrink-0 items-center justify-center rounded-full font-mono text-caption font-semibold tabular-nums ${dot}`}>
              {state === "done" ? "✓" : i + 1}
            </span>
            <span className={`text-body ${state === "current" ? "font-semibold text-ink" : state === "done" ? "text-ink" : "text-ink-muted"}`}>
              {stage.label}
            </span>
          </span>
        );
        return (
          <li key={stage.key} className="flex items-center gap-2" aria-current={state === "current" ? "step" : undefined}>
            {state === "next" ? (
              label
            ) : (
              <Link href={stageHref({ ...c, stage: stage.key })} className="rounded-control px-1 -mx-1 hover:bg-surface-muted">
                {label}
              </Link>
            )}
            {i < all.length - 1 && <span aria-hidden className="h-px w-6 bg-line-strong" />}
          </li>
        );
      })}
    </ol>
  );
}
