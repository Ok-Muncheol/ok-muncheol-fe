/**
 * B: 판단 화면의 순수 규칙 — 판단 그래프 단계 표시, 검증 3겹의 층별 상태, 구분 질문 답변 모양, 판정 근거, 당사자 역할.
 * 화면(src/features/judgment/)과 테스트(view.test.mjs)가 같이 쓴다. 런타임 import는 두지 않는다.
 * 판정·도표·과실은 BE 값을 그대로 그린다 — 여기서는 어느 단계·검증이 어디까지 갔는지만 고른다.
 */
import type {
  ConfirmationQuestion,
  EvidenceHit,
  JudgmentResult,
  JudgmentRunView,
  JudgmentStage,
  JudgmentStatus,
  PartyMapping,
  QuestionAnswer,
  QuestionView,
  RebuttalKind,
  TaskStatus,
  ValidationCheck,
} from "../api/types";

/* ---------- 판단 그래프 단계 ---------- */

/** BE app/workflow/graph.py STAGES 순서. 이름은 BE README 「선행 MVP 처리 흐름」 상자 글자를 줄였다. */
export const JUDGMENT_STAGES: readonly { key: JudgmentStage; label: string }[] = [
  { key: "require_confirmed_card", label: "확정 카드 확인" },
  { key: "check_chart_scope", label: "범위 확인" },
  { key: "retrieve_chart_candidates", label: "도표 후보 검색" },
  { key: "ask_or_resume", label: "구분 칸 확인" },
  { key: "select_chart_and_modifiers", label: "도표·수정요소 선택" },
  { key: "check_evidence", label: "근거 체크" },
  { key: "review_rebuttal", label: "반박 검토" },
  { key: "calculate_and_validate_fault", label: "과실 계산·검증" },
  { key: "build_judgment_result", label: "판정 정리" },
];

export function stageLabel(stage: JudgmentStage): string {
  return JUDGMENT_STAGES.find((s) => s.key === stage)?.label ?? stage;
}

export type StepState = "done" | "queued" | "running" | "waiting" | "failed" | "next";
export type Step = { key: JudgmentStage; label: string; state: StepState };

const HERE: Record<TaskStatus, StepState> = {
  queued: "queued",
  running: "running",
  waiting_for_confirmation: "waiting",
  failed: "failed",
  completed: "done",
};

/**
 * 실행 중인 판단의 단계별 상태 — stage 앞은 끝남, stage는 지금(대기·처리 중·확인 대기·실패), 뒤는 아직이다.
 * 끝난(completed) 실행은 판정이 어느 단계에서 났는지 stage만으로 알 수 없어 화면에 그리지 않는다. 판정과 그 사유가 대신한다.
 */
export function stageSteps(run: Pick<JudgmentRunView, "status" | "stage">): Step[] {
  const at = JUDGMENT_STAGES.findIndex((s) => s.key === run.stage);
  return JUDGMENT_STAGES.map((s, i) => ({ ...s, state: i < at ? "done" : i === at ? HERE[run.status] : "next" }));
}

/** 머리글 배지 하나 — 끝난 실행은 판정, 그 전은 작업 진행이다. ‘작업 완료’와 판정을 섞지 않는다. */
export function runBadgeStatus(run: Pick<JudgmentRunView, "status" | "result">): JudgmentStatus | TaskStatus {
  return run.status === "completed" && run.result ? run.result.status : run.status;
}

/** 판단에 쓴 카드보다 새 카드가 있는지 — 구분 질문에 답하면 새 카드가 생기고, 그 카드를 확정한 뒤 다시 판단한다. */
export function isStaleInput(run: Pick<JudgmentRunView, "fact_card_version">, latestCardVersion: number): boolean {
  return latestCardVersion > run.fact_card_version;
}

/* ---------- 검증 3겹 ---------- */

export type CheckState = "passed" | "failed" | "not_run";
type LayerKey = ValidationCheck["layer"];
export type Layer = {
  key: LayerKey;
  label: string;
  description: string;
  /** 마지막 시도 기준. 결과에 없는 층은 not_run이다. */
  state: CheckState;
  /** 마지막 시도가 반박 성립(실패)일 때만 */
  rebuttalKind: RebuttalKind | null;
  /** 시도 순서대로 — 0은 첫 도표, 1은 반박 뒤 차순위 도표(BE validation_checks.attempt) */
  attempts: ValidationCheck[];
};

export const VALIDATION_LAYERS: readonly Pick<Layer, "key" | "label" | "description">[] = [
  { key: "evidence", label: "근거 체크", description: "도표·수정요소·인용 ID가 실제로 있고 사고 일자의 적용판·원문 페이지와 맞는지 본다." },
  { key: "rebuttal", label: "반박 검토", description: "불명 조건·선택/제외 이유·차순위 도표로 이 판단을 반박해 본다." },
  { key: "numerical", label: "코드 계산 검증", description: "DB 수치·가감 부호·중복/배타·A+B=100을 코드로 다시 계산한다." },
];

export const ATTEMPT_LABELS = ["첫 도표", "차순위 도표"] as const;

export const REBUTTAL_KIND_LABELS: Record<RebuttalKind, string> = {
  wrong_chart: "도표 오선택",
  missing_fact: "사실 부족",
  contradiction: "근거·카드 모순",
};

/**
 * 검증 3겹의 층마다 상태 하나. 같은 층이 두 번 있으면(반박 뒤 차순위 도표로 다시 판단) 마지막 시도가 상태를 정하고
 * 시도는 순서대로 모두 남긴다. 결과에 없는 층은 그 앞에서 판정이 나 실행하지 않은 층이다.
 */
export function validationLayers(checks: readonly ValidationCheck[]): Layer[] {
  return VALIDATION_LAYERS.map((layer) => {
    const attempts = checks.filter((c) => c.layer === layer.key);
    const last = attempts.at(-1);
    return {
      ...layer,
      state: last === undefined ? "not_run" : last.passed ? "passed" : "failed",
      rebuttalKind: last !== undefined && !last.passed ? (last.rebuttal_kind ?? null) : null,
      attempts,
    };
  });
}

/* ---------- 구분 질문 ---------- */

/** 보기 대신 ‘확인 불가’를 고른 표시. BE 보기 값과 겹치지 않는 이름이다. */
export const UNKNOWN_CHOICE = "__unknown__";

/**
 * 고른 보기를 BE QuestionAnswer로 바꾼다. ‘확인 불가’면 value를 비우고 unknown을 켠다(judgment_answers의 unknown = (value is null) 제약).
 * expected_card_version은 질문을 받은 카드 버전이다 — 그 사이 카드가 바뀌었으면 BE가 409로 거절한다.
 */
export function answerFor(question: Pick<ConfirmationQuestion, "question_id">, choice: string, expectedCardVersion: number): QuestionAnswer {
  const unknown = choice === UNKNOWN_CHOICE;
  return { question_id: question.question_id, expected_card_version: expectedCardVersion, value: unknown ? null : choice, unknown };
}

/**
 * 답할 구분 질문 — 확인 대기(waiting_for_confirmation) 실행의 questions. 끝났거나 실패한 실행의 질문은
 * BE가 question_closed로 거절하므로 답변 폼을 열지 않는다.
 */
export function answerableQuestions(run: Pick<JudgmentRunView, "status" | "questions">): QuestionView[] {
  return run.status === "waiting_for_confirmation" ? run.questions : [];
}

/**
 * 확인할 칸 — 완료 + 추가 확인 필요(needs_confirmation) 판정이 묻는 칸. 판단 그래프가 다 끝난 뒤 낸 것이라 답변 경로로
 * 답하지 않는다(BE에 질문 행이 없다). 사실 카드에서 고쳐 다시 확정한 뒤 판단을 다시 요청한다.
 */
export function fieldsToCheck(run: Pick<JudgmentRunView, "result">): ConfirmationQuestion[] {
  return run.result?.status === "needs_confirmation" ? run.result.questions : [];
}

/**
 * 확인 대기 실행이 기다리는 것. 안 답한 질문이 있으면 "answers", 다 답했고 값 답변이 있으면 "card_update"
 * (값을 사실 카드에 반영·재확정해 새 카드 버전으로 판단을 다시 요청한다 — BE next_action update_fact_card),
 * 모두 ‘확인 불가’면 BE가 같은 실행을 재개하므로 null이다.
 */
export function waitingFor(questions: readonly QuestionView[]): "answers" | "card_update" | null {
  if (questions.some((q) => q.answer === null)) return "answers";
  return questions.some((q) => q.answer !== null && !q.answer.unknown) ? "card_update" : null;
}

/** 값으로 답한 칸과 값 — 사실 카드에 반영할 것(BE field_values와 같은 모양). ‘확인 불가’ 답은 넣지 않는다. */
export function answeredValues(questions: readonly QuestionView[]): Record<string, string> {
  const values: Record<string, string> = {};
  for (const q of questions) if (q.answer?.value != null && !q.answer.unknown) values[q.field_key] = q.answer.value;
  return values;
}

/* ---------- 판정 근거 ---------- */

/** 판단 화면에서 판정 근거로 이동하는 앵커 */
export const JUDGMENT_EVIDENCE_ID = "judgment-evidence";

/**
 * 판정 근거 — BE result.evidence는 판정이 고른 도표 후보의 원문 근거다(graph.py _result).
 * 도표를 고르지 못한 판정(보류, 도표를 고르기 전에 멈춘 추가 확인)은 null — 근거 칸을 그리지 않고
 * 판정 카드의 적용 도표 "미확정"과 사유가 대신한다. 근거 패널의 "근거를 찾지 못했다" 안내가 그 경우엔 사실과 다르다.
 */
export function judgmentEvidence(result: Pick<JudgmentResult, "chart_id" | "evidence">): EvidenceHit[] | null {
  return result.chart_id ? result.evidence : null;
}

/**
 * 근거 패널의 선택 표시(evidence-panel EvidenceDecision 모양). 판정 근거는 모두 고른 도표의 근거라 '판단에 사용'이다.
 * BE는 근거마다의 이유를 주지 않으므로 이유 칸에는 BE 값(판정 도표 ID)만 적는다.
 */
export function evidenceDecisions(
  hits: readonly EvidenceHit[],
  chartId: string,
): Record<string, { status: "selected"; reason: string }> {
  return Object.fromEntries(hits.map((hit) => [hit.chunk.chunk_id, { status: "selected", reason: `판정 도표 ${chartId}의 근거` }]));
}

/* ---------- 당사자 ---------- */

/**
 * 도표 A·B가 가입자·촬영 차량 중 누구인지 — 같은 당사자라고 가정하지 않고 카드의 매핑 ID로만 맞춘다.
 * null이면 아직 매핑하지 않았고, 빈 배열이면 둘 다 아닌 당사자(상대)다.
 */
export function partyRoles(mapping: PartyMapping, party: "A" | "B"): string[] | null {
  const id = party === "A" ? mapping.chart_party_A_id : mapping.chart_party_B_id;
  if (id === null) return null;
  return [...(id === mapping.insured_party_id ? ["가입자"] : []), ...(id === mapping.video_ego_party_id ? ["촬영 차량"] : [])];
}
