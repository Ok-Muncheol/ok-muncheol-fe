/**
 * B 통합: 담당 사건 보드·단계 표시의 순수 규칙. 화면(src/features/cases/)과 테스트(stages.test.mjs)가 같이 쓴다.
 * 런타임 import는 두지 않는다 — Node가 타입만 지우고 그대로 실행한다.
 * 보드 열·단계·배지를 나눈다. 열은 "어디까지 왔나"(단계 묶음), 카드의 단계 이름은 "그 안의 어느 화면인가",
 * 배지는 "거기서 무엇을 기다리나"다.
 */
import type { CaseStage, CaseSummary, JudgmentStatus, TaskStatus } from "../api/types";

export type StageDef = { key: CaseStage; label: string; description: string };

/**
 * README mermaid 흐름의 순서이고 사건 상세의 진행 단계다. 보드 열은 이 단계를 묶은 BOARD_COLUMNS다.
 * 1차 확장(산정·구상 청구 패키지)은 단계로 두지 않는다 — 구상 패키지는 보고서 승인 뒤의 산출물이라
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

export type BoardColumnKey = "intake" | "judgment" | "report";
export type BoardColumnDef = { key: BoardColumnKey; label: string; description: string; stages: readonly CaseStage[] };

/**
 * 담당 사건 보드의 열 — 단계를 담당자 일 기준 세 묶음으로 나눈다. 접수는 배정된 사건이 사실 카드 단계에 들기까지(범위 확인·영상 분석),
 * 판단은 담당자가 사실 카드를 확정하고 판정을 받기까지, 검토 보고서는 승인까지다. 보드는 사건마다 한 줄이고 카드는 그 사건의 열 칸에 놓인다.
 * 카드에는 단계 이름을 붙인다 — 같은 확인 대기라도 사실 카드 확인과 판단의 구분 질문은 할 일이 다르다.
 */
export const BOARD_COLUMNS: readonly BoardColumnDef[] = [
  { key: "intake", label: "접수", description: "범위 확인·영상 분석", stages: ["intake", "analysis"] },
  { key: "judgment", label: "판단", description: "사실 카드 확정·구분 질문·검증", stages: ["facts", "judgment"] },
  { key: "report", label: "검토 보고서", description: "판정·초안·담당자 승인", stages: ["report"] },
];

/** 단계가 놓이는 보드 열. 모든 단계가 열 하나에만 들어가는지는 stages.test.mjs가 본다. */
export function boardColumnOf(stage: CaseStage): BoardColumnDef {
  const column = BOARD_COLUMNS.find((c) => c.stages.includes(stage));
  if (!column) throw new Error(`보드 열이 정해지지 않은 단계: ${stage}`);
  return column;
}

/** 보드 열 순서에서 단계가 놓인 자리(0부터) — 사건 화면 맨 위 진행 단계 한 줄이 지난·현재·다음을 가른다. */
export function columnIndex(stage: CaseStage): number {
  return BOARD_COLUMNS.indexOf(boardColumnOf(stage));
}

/**
 * 진행 단계 한 줄에서 단계를 누르면 가는 화면(지난 단계와 지금 단계만 누를 수 있다).
 * 접수는 접수 화면(영상 · 사건 정보), 판단은 판단 화면(사실 카드를 합쳤다)이다. 검토 보고서는 최신 보고서이고, 아직 없으면 보고서 자리(/reports — 칸을 비운 화면)다.
 */
export function stepHref(c: Pick<CaseSummary, "case_id" | "stage" | "versions">, column: BoardColumnKey): string {
  const base = `/cases/${encodeURIComponent(c.case_id)}`;
  switch (column) {
    case "intake":
      return base;
    case "judgment":
      return `${base}/judgment`;
    case "report":
      return c.versions.report_version === null ? `${base}/reports` : `${base}/reports/${c.versions.report_version}`;
  }
}

/** 보드 카드를 누르면 가는 곳 — 그 사건의 현재 단계 화면. 사실 카드 단계도 판단 화면이다(사실 카드를 합쳤다). */
export function stageHref(c: Pick<CaseSummary, "case_id" | "stage" | "versions">): string {
  const base = `/cases/${encodeURIComponent(c.case_id)}`;
  switch (c.stage) {
    case "facts":
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

/** 보드 열마다 사건 수 — 열 머리에 적는다. */
export function countByColumn(cases: readonly CaseSummary[]): Record<BoardColumnKey, number> {
  const counts = Object.fromEntries(BOARD_COLUMNS.map((col) => [col.key, 0])) as Record<BoardColumnKey, number>;
  for (const c of cases) counts[boardColumnOf(c.stage).key] += 1;
  return counts;
}

/**
 * 보드의 줄 순서 — 사건마다 한 줄이고, 고정한 사건과 나머지로 나눠 둘 다 접수 순(먼저 접수한 사건이 위)이다.
 * 접수 시각은 시간대 표기가 달라도 같은 순서가 되게 시각 값으로 비교한다. 같으면 사건 ID 순이다.
 */
export function listByIntake(cases: readonly CaseSummary[], pinned: readonly string[] = []): { pinned: CaseSummary[]; rest: CaseSummary[] } {
  const pins = new Set(pinned);
  const ordered = [...cases].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at) || a.case_id.localeCompare(b.case_id));
  return { pinned: ordered.filter((c) => pins.has(c.case_id)), rest: ordered.filter((c) => !pins.has(c.case_id)) };
}

/**
 * 보드 한 줄의 지금 상태 — 점과 알약 색을 가른다.
 * 확인 필요(turn) · 승인 대기(approval) · 처리 중(running) · 실패(failed) · 승인 완료(done) · 그 밖(idle).
 * turn과 approval이 담당자 차례다(isTurnTone, 「확인 필요만」이 이 둘을 남긴다).
 */
export type BoardTone = "turn" | "approval" | "running" | "failed" | "done" | "idle";

/** 담당자가 손을 대야 넘어가는 상태 — 「확인 필요만」 거르기 기준이다. */
export function isTurnTone(tone: BoardTone): boolean {
  return tone === "turn" || tone === "approval";
}
/** label은 짧은 상태명이다(「승인 대기」「질문 1건」). */
export type BoardStatus = { label: string; tone: BoardTone };

/**
 * 보드 줄의 지금 단계 칸에 적는 짧은 상태명 — 업무 도구라 문장이 아니라 상태 이름이다.
 * 접수 열은 영상 업로드·분석, 판단 열은 사실 확인·과실 판단, 검토 보고서 열은 승인이다.
 */
export function boardStatus(c: CaseSummary): BoardStatus {
  const t = c.task_status;
  switch (c.stage) {
    case "intake":
      if (t === "failed") return { label: "분석 실패", tone: "failed" };
      return { label: c.input_path === "video" ? "영상 업로드 대기" : "입력 대기", tone: "turn" };
    case "analysis":
      if (t === "failed") return { label: "분석 실패", tone: "failed" };
      return { label: "영상 분석 중", tone: "running" };
    case "facts":
      return { label: "사실 확인 대기", tone: "turn" };
    case "judgment":
      if (t === "failed") return { label: "판단 실패", tone: "failed" };
      if (t === "running" || t === "queued") return { label: "판단 중", tone: "running" };
      if (c.open_questions > 0) return { label: `질문 ${c.open_questions}건`, tone: "turn" };
      if (c.judgment_status === "needs_confirmation") return { label: "추가 확인 필요", tone: "turn" };
      if (c.judgment_status === "deferred") return { label: "판단 보류", tone: "turn" };
      if (t === "waiting_for_confirmation") return { label: "확인 대기", tone: "turn" };
      return { label: "판단 완료", tone: "idle" };
    case "report":
      if (c.approval_status === "approved") return { label: "승인 완료", tone: "done" };
      return { label: "승인 대기", tone: "approval" };
  }
}

export type BoardSort = "assigned" | "recent" | "accident" | "stale";
export const BOARD_SORTS: readonly { key: BoardSort; label: string }[] = [
  { key: "assigned", label: "배정 오래된 순" },
  { key: "recent", label: "배정 최신 순" },
  { key: "accident", label: "사고일 순" },
  { key: "stale", label: "오래 멈춘 순" },
];

/**
 * 보드 보기 — 단계 탭, 정렬, 확인 필요만. 주소(?stage=&sort=&turn=1)에 남는다.
 * 단계 탭의 all(전체)은 진행 중인 사건 전부다. done은 보고서를 승인한 사건만 보는 완료 사건 화면(/done)이고, 승인한 사건은 담당 사건 보드에 보이지 않는다.
 */
export type BoardStage = BoardColumnKey | "all" | "done";
export type BoardView = { stage: BoardStage; sort: BoardSort; turn: boolean };
export const DEFAULT_VIEW: BoardView = { stage: "all", sort: "assigned", turn: false };

type Params = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** 주소 검색어를 보드 보기로 — 모르는 값은 기본값이다. */
export function parseBoardView(params: Params): BoardView {
  const stage = first(params.stage);
  const sort = first(params.sort);
  return {
    stage: stage === "done" || BOARD_COLUMNS.some((c) => c.key === stage) ? (stage as BoardStage) : "all",
    sort: BOARD_SORTS.some((s) => s.key === sort) ? (sort as BoardSort) : "assigned",
    turn: first(params.turn) === "1",
  };
}

/** 보기 일부를 바꾼 주소 — 담당 사건은 /cases, 완료 사건은 /done. 기본값은 주소에서 뺀다. */
export function boardHref(view: BoardView, patch: Partial<BoardView>): string {
  const next = { ...view, ...patch };
  const q = new URLSearchParams();
  if (next.stage !== "all" && next.stage !== "done") q.set("stage", next.stage);
  if (next.sort !== DEFAULT_VIEW.sort) q.set("sort", next.sort);
  if (next.turn) q.set("turn", "1");
  const text = q.toString();
  const base = next.stage === "done" ? "/done" : "/cases";
  return text ? `${base}?${text}` : base;
}

const time = (iso: string) => Date.parse(iso);
const ORDER: Record<BoardSort, (a: CaseSummary, b: CaseSummary) => number> = {
  assigned: (a, b) => time(a.created_at) - time(b.created_at),
  recent: (a, b) => time(b.created_at) - time(a.created_at),
  accident: (a, b) => time(a.accident_date) - time(b.accident_date),
  stale: (a, b) => time(a.updated_at) - time(b.updated_at),
};

/** 보고서를 승인해 끝난 사건 — 완료 사건 화면(/done)에만 보인다. */
export function isDone(c: Pick<CaseSummary, "stage" | "approval_status">): boolean {
  return c.stage === "report" && c.approval_status === "approved";
}

/**
 * 보드에 보일 줄 — 완료한 사건을 떼어 두고, 확인 필요 사건만 거른 뒤 단계 탭으로 거르고, 정렬해서 고정한 사건을 맨 위에 둔다.
 * total · counts · done은 탭에 적는 수다(확인 필요만은 반영하고 단계 탭은 반영하지 않는다). 완료 탭에서는 확인 필요만을 보지 않는다.
 */
export function boardRows(cases: readonly CaseSummary[], view: BoardView, pinned: readonly string[] = []) {
  const pins = new Set(pinned);
  const done = cases.filter(isDone);
  const active = cases.filter((c) => !isDone(c));
  const pool = view.turn ? active.filter((c) => isTurnTone(boardStatus(c).tone)) : active;
  const shown = view.stage === "done" ? done : view.stage === "all" ? pool : pool.filter((c) => boardColumnOf(c.stage).key === view.stage);
  const sorted = [...shown].sort((a, b) => ORDER[view.sort](a, b) || a.case_id.localeCompare(b.case_id));
  return {
    rows: [...sorted.filter((c) => pins.has(c.case_id)), ...sorted.filter((c) => !pins.has(c.case_id))],
    total: pool.length,
    counts: countByColumn(pool),
    done: done.length,
  };
}
