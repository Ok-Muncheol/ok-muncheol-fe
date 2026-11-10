/**
 * B: 판단 화면의 순수 규칙 — 판단 그래프 단계 표시, 검증 3겹의 층별 상태, 구분 질문 답변 모양, 당사자 역할.
 * 화면(src/features/judgment/)과 테스트(view.test.mjs)가 같이 쓴다. 런타임 import는 두지 않는다.
 * 판정·도표·과실은 BE 값을 그대로 그린다 — 여기서는 어느 단계·검증이 어디까지 갔는지만 고른다.
 */
import type {
  ConfirmationQuestion,
  JudgmentRun,
  JudgmentStage,
  JudgmentStatus,
  PartyMapping,
  QuestionAnswer,
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
export function stageSteps(run: Pick<JudgmentRun, "status" | "stage">): Step[] {
  const at = JUDGMENT_STAGES.findIndex((s) => s.key === run.stage);
  return JUDGMENT_STAGES.map((s, i) => ({ ...s, state: i < at ? "done" : i === at ? HERE[run.status] : "next" }));
}

/** 머리글 배지 하나 — 끝난 실행은 판정, 그 전은 작업 진행이다. ‘작업 완료’와 판정을 섞지 않는다. */
export function runBadgeStatus(run: Pick<JudgmentRun, "status" | "result">): JudgmentStatus | TaskStatus {
  return run.status === "completed" && run.result ? run.result.status : run.status;
}

/** 판단에 쓴 카드보다 새 카드가 있는지 — 구분 질문에 답하면 새 카드가 생기고, 그 카드를 확정한 뒤 다시 판단한다. */
export function isStaleInput(run: Pick<JudgmentRun, "fact_card_version">, latestCardVersion: number): boolean {
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
