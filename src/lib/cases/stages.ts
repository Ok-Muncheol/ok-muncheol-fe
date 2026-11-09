/**
 * B 통합: 담당 사건 보드·단계 표시의 순수 규칙. 화면(src/features/cases/)과 테스트(stages.test.mjs)가 같이 쓴다.
 * 런타임 import는 두지 않는다 — Node가 타입만 지우고 그대로 실행한다.
 * 열(단계)과 배지(상태)를 분리한다: 열은 "어디까지 왔나", 배지는 "거기서 무엇을 기다리나"다.
 */
import type { CaseStage, CaseSummary, JudgmentStatus, TaskStatus } from "../api/types";

export type StageDef = { key: CaseStage; label: string; description: string };

/**
 * README mermaid 흐름의 순서. 1차 확장(산정·구상 청구 패키지)은 열로 두지 않는다 — 구상 패키지는 보고서 승인 뒤의 산출물이라
 * 검토 보고서 상세(ClaimPackagePanel)에서 내려받고, 보드에서는 승인 카드의 배지로만 알린다.
 */
export const STAGES: readonly StageDef[] = [
  { key: "intake", label: "접수", description: "사건 생성·범위 확인" },
  { key: "analysis", label: "영상 분석", description: "업로드·분석 진행" },
  { key: "facts", label: "사실 카드", description: "근거 프레임 확인·수정·확정" },
  { key: "judgment", label: "판단", description: "도표 검색·구분 질문·검증" },
  { key: "report", label: "검토 보고서", description: "판정·초안·담당자 승인" },
];

export function stageIndex(stage: CaseStage): number {
  return STAGES.findIndex((s) => s.key === stage);
}

/** 사건에 보이는 단계 — 영상 없는 사건은 영상 분석을 건너뛴다. */
export function visibleStages(c: Pick<CaseSummary, "input_path">): readonly StageDef[] {
  return c.input_path === "video" ? STAGES : STAGES.filter((s) => s.key !== "analysis");
}

/** 보드 카드를 누르면 가는 곳 — 그 사건의 현재 단계 화면. */
export function stageHref(c: Pick<CaseSummary, "case_id" | "stage" | "versions">): string {
  const base = `/cases/${encodeURIComponent(c.case_id)}`;
  switch (c.stage) {
    case "facts":
      return `${base}/facts`;
    case "judgment":
      return `${base}/judgment`;
    case "report":
      return c.versions.report_version === null ? base : `${base}/reports/${c.versions.report_version}`;
    default:
      return base;
  }
}

export type CurrentStatus =
  | { kind: "task"; status: TaskStatus }
  | { kind: "judgment"; status: JudgmentStatus }
  | { kind: "approval"; status: "draft" | "approved" }
  | { kind: "none" };

/** 카드에 붙일 상태 하나 — 보고서 단계는 승인 여부, 판단 이후는 판정, 그 전은 작업 진행. */
export function currentStatus(c: CaseSummary): CurrentStatus {
  if (c.stage === "report" && c.approval_status) return { kind: "approval", status: c.approval_status };
  if (c.task_status && c.task_status !== "completed") return { kind: "task", status: c.task_status };
  if (c.judgment_status) return { kind: "judgment", status: c.judgment_status };
  if (c.task_status) return { kind: "task", status: c.task_status };
  return { kind: "none" };
}

/** 담당자가 손대야 다음으로 가는 사건 — 확인 대기·추가 확인·보류·답하지 않은 질문·승인 전 초안. 실패는 따로 센다. */
export function needsAttention(c: CaseSummary): boolean {
  if (c.open_questions > 0) return true;
  if (c.task_status === "waiting_for_confirmation") return true;
  if (c.judgment_status === "needs_confirmation" || c.judgment_status === "deferred") return true;
  return c.stage === "report" && c.approval_status === "draft";
}

export type BoardSummary = { total: number; attention: number; running: number; failed: number; approved: number };

/** 보드 위 요약 수치. 건수라서 FE에서 센다(과실·금액은 BE 값만 그린다는 원칙과 무관). */
export function summarizeBoard(cases: readonly CaseSummary[]): BoardSummary {
  return {
    total: cases.length,
    attention: cases.filter(needsAttention).length,
    running: cases.filter((c) => c.task_status === "running" || c.task_status === "queued").length,
    failed: cases.filter((c) => c.task_status === "failed").length,
    approved: cases.filter((c) => c.approval_status === "approved").length,
  };
}

/** 열별로 나눈다. 열 안에서는 손댈 사건이 먼저, 그다음 최근 변경 순이다. */
export function groupByStage(cases: readonly CaseSummary[]): Record<CaseStage, CaseSummary[]> {
  const groups = Object.fromEntries(STAGES.map((s) => [s.key, [] as CaseSummary[]])) as Record<CaseStage, CaseSummary[]>;
  for (const c of cases) groups[c.stage].push(c);
  for (const key of Object.keys(groups) as CaseStage[]) {
    groups[key].sort((a, b) => {
      const byAttention = Number(needsAttention(b)) - Number(needsAttention(a));
      return byAttention !== 0 ? byAttention : b.updated_at.localeCompare(a.updated_at);
    });
  }
  return groups;
}
