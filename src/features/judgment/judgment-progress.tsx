/**
 * B: 판단 그래프 단계 표시 — 대기·진행 중·확인 대기·실패한 실행이 9단계 중 어디에 있는지.
 * 끝난 실행에는 쓰지 않는다(판정이 나면 판정과 그 사유가 보여 준다). 상태는 점 색과 함께 글자로도 적는다.
 */
import type { JudgmentRunView } from "@/lib/api/types";
import { stageSteps, type StepState } from "@/lib/judgment/view";
import { Spinner } from "@/ui/controls";

const MARK: Record<StepState, string> = {
  done: "bg-success-soft text-on-success-soft",
  queued: "border border-line-strong bg-surface text-ink-muted",
  running: "bg-primary text-on-primary",
  waiting: "bg-warning-soft text-on-warning-soft",
  failed: "bg-danger-soft text-on-danger-soft",
  next: "border border-line bg-surface text-ink-faint",
};

const NOW: Partial<Record<StepState, { text: string; className: string }>> = {
  queued: { text: "대기", className: "text-ink-muted" },
  running: { text: "처리 중", className: "text-on-info-soft" },
  waiting: { text: "확인 대기", className: "text-on-warning-soft" },
  failed: { text: "여기서 멈춤", className: "text-on-danger-soft" },
};

export function JudgmentProgress({ run }: { run: Pick<JudgmentRunView, "status" | "stage"> }) {
  return (
    <ol aria-label="판단 단계" className="flex flex-col gap-1">
      {stageSteps(run).map((step, i) => {
        const now = NOW[step.state];
        return (
          <li key={step.key} aria-current={now ? "step" : undefined} className="flex min-h-8 items-center gap-3">
            <span aria-hidden className={`flex size-6 shrink-0 items-center justify-center rounded-full font-mono text-caption font-semibold tabular-nums ${MARK[step.state]}`}>
              {step.state === "done" ? "✓" : step.state === "failed" ? "!" : i + 1}
            </span>
            <span className={`text-body ${now ? "font-semibold text-ink" : step.state === "done" ? "text-ink" : "text-ink-muted"}`}>{step.label}</span>
            {step.state === "done" && <span className="sr-only">끝남</span>}
            {now && (
              <span className={`flex items-center gap-1.5 text-caption font-semibold ${now.className}`}>
                {step.state === "running" && <Spinner />}
                {now.text}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
