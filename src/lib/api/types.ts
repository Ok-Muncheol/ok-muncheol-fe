/** BE app/schemas 대응 수동 초안. 런타임 검증·OpenAPI 생성물이 아니다. */
export type TaskStatus = "queued" | "running" | "waiting_for_confirmation" | "completed" | "failed";
export type JudgmentStatus = "draft_ready" | "needs_confirmation" | "deferred";
export type Corpus = "fault_standards" | "dispute_cases" | "policy_terms";
export type VersionRef = {
  case_id: string; fact_card_version: number;
  judgment_version: number | null; report_version: number | null;
};
export type TaskView = {
  task_id: string; case_id: string; stage: string; status: TaskStatus; input_version: number;
};
export type ApiError = { code: string; message: string; retryable: boolean };
/** 사건이 지금 어느 단계에 있는지 — README 「범위와 사용자 흐름」 순서. 영상 없는 사건은 analysis를 건너뛴다. */
export type CaseStage = "intake" | "analysis" | "facts" | "judgment" | "report";
/**
 * 담당 사건 보드 한 칸(GET /cases 응답 초안). BE 계약 확정 전 FE 제안이라 같은 이름으로 BE에 맞춘다.
 * 단계(stage)와 그 단계 안의 상태는 분리한다 — 같은 warning이라도 사실 카드의 확인 대기와 판단의 추가 확인은 할 일이 다르다.
 */
export type CaseSummary = {
  case_id: string; accident_date: string; input_path: "video" | "manual";
  stage: CaseStage;
  task_status: TaskStatus | null;
  judgment_status: JudgmentStatus | null;
  approval_status: "draft" | "approved" | null;
  open_questions: number;
  versions: VersionRef; updated_at: string;
};
export type FactField = {
  value: string | number | boolean | null; model_value: string | number | boolean | null;
  source: "vision" | "manual" | "statement"; model_confidence: number | null;
  verification_status: "unverified" | "needs_review" | "human_confirmed";
  evidence_frame_ids: string[]; source_document_ids: string[];
};
export type PartyMapping = {
  video_ego_party_id: string | null; insured_party_id: string | null;
  chart_party_A_id: string | null; chart_party_B_id: string | null;
};
export type FactCard = {
  case_id: string; version: number; accident_date: string;
  fields: Record<string, FactField>; party_mapping: PartyMapping;
  evidence_frames: { frame_id: string; timestamp_ms: number; storage_path: string }[];
  status: "draft" | "confirmed"; confirmed_by: string | null; confirmed_at: string | null;
};
export type FactPatch = {
  expected_version: number; fields: Record<string, FactField>; party_mapping: PartyMapping; reason: string;
};
export type SourceDocument = {
  document_id: string; corpus: Corpus; source_uri: string; edition: string;
  effective_from: string; effective_to: string | null; content_hash: string; parser_version: string;
};
export type SearchChunk = {
  chunk_id: string; parent_id: string; document: SourceDocument;
  page_start: number; page_end: number; text: string; metadata: Record<string, unknown>;
};
export type SearchRequest = {
  corpus: Corpus; text: string; accident_date: string; filters: Record<string, unknown>; top_k: number;
};
export type EvidenceHit = { chunk: SearchChunk; score: number; retrieval_version: string };
export type ConfirmationQuestion = {
  question_id: string; field_key: string; text: string; options: string[]; allow_unknown: boolean;
};
export type QuestionAnswer = {
  question_id: string; expected_card_version: number; value: string | null; unknown: boolean;
};
export type RebuttalKind = "wrong_chart" | "missing_fact" | "contradiction";
export type ValidationCheck = {
  layer: "evidence" | "rebuttal" | "numerical"; passed: boolean; reasons: string[];
  /** layer가 rebuttal이고 실패한 경우에만 온다. wrong_chart만 차순위 도표 재실행 대상 */
  rebuttal_kind?: RebuttalKind | null;
};
/** 보고서 5번 수정요소 판정. 가감치가 있는 요소만 온다. reason은 판정 이유다. */
export type ModifierDecision = {
  modifier_id: string; name: string; applies_to: "A" | "B"; delta: number;
  decision: "적용" | "미적용" | "불명"; evidence_fields: string[]; reason?: string;
};
/** 보고서 3번 차순위 후보: 고르지 않은 도표와 이유 */
export type ChartAlternative = { chart_id: string; reason: string };
export type JudgmentResult = {
  versions: VersionRef; status: JudgmentStatus; chart_id: string | null; edition: string | null;
  fault_A: number | null; fault_B: number | null; calculation_log: string[];
  evidence: EvidenceHit[]; checks: ValidationCheck[]; questions: ConfirmationQuestion[]; reasons: string[];
  /** 보고서 3·4·5번용. 판단 그래프가 채우고, 도표를 고르지 못한 보류면 null·빈 목록. 예전 결과에는 없을 수 있다 */
  base_fault_A?: number | null; modifiers?: ModifierDecision[]; alternatives?: ChartAlternative[];
};
/** 판단 그래프 단계 — BE app/workflow/graph.py STAGES와 같은 이름·순서(judgment_runs.stage 값). */
export type JudgmentStage =
  | "require_confirmed_card" | "check_chart_scope" | "retrieve_chart_candidates" | "ask_or_resume"
  | "select_chart_and_modifiers" | "check_evidence" | "review_rebuttal"
  | "calculate_and_validate_fault" | "build_judgment_result";
/**
 * 판단 실행 1건 — 판단 화면이 읽는 모양(BE judgment_runs 행, supabase/migrations/20261109163901_judgment_runs.sql).
 * BE 조회 계약 확정 전 FE 제안이라 같은 이름으로 BE에 맞춘다. 작업 진행(status)과 판정(result.status)을 분리한다.
 * stage는 지금 단계(대기·처리 중·확인 대기·실패면 멈춘 곳)다. result는 completed일 때만, error는 failed일 때만 온다.
 */
export type JudgmentRun = {
  case_id: string; fact_card_version: number; criteria_version: string; rule_version: string;
  status: TaskStatus; stage: JudgmentStage; rebuttal_retry_count: number;
  result: JudgmentResult | null; error: ApiError | null; updated_at: string;
};
/**
 * 질문 응답(POST …/questions/{question_id}/answer) 결과. 판단 접수(POST …/judgments)는 TaskView만 돌려준다.
 * BE docs/contracts/README.md 「판단 접수·질문 응답」. next_action이 update_fact_card면 값 답변을 카드에
 * 반영·재확정한 뒤 새 카드 버전으로 판단을 다시 요청한다(field_values가 칸별 답). null이면 같은 실행이 끝났다.
 */
export type JudgmentNextAction = "answer_remaining" | "update_fact_card" | null;
export type AnswerResult = TaskView & {
  pending_question_ids: string[]; next_action: JudgmentNextAction; field_values: Record<string, string>;
};
export type CalculationResult = {
  versions: VersionRef; status: "estimated" | "needs_documents" | "confirmed"; currency: "KRW";
  recognized_damage: number | null; insurance_payment: number | null; deductible: number | null;
  rule_version: string; source_document_ids: string[]; reasons: string[];
};
export type RecoveryAmounts = {
  planned: number | null; claimed: number | null; recovered: number | null;
  customer_deductible_review: number | null;
};
export type ReviewReport = {
  versions: VersionRef; judgment: JudgmentResult; sections: Record<string, unknown>[];
  calculation: CalculationResult | null; recovery: RecoveryAmounts | null;
  approval_status: "draft" | "approved"; approved_by: string | null; approved_at: string | null;
};
/** D 보고서 경로(BE docs/d-claims-reports.md 「HTTP 경로」)의 요청·응답. BE app/schemas/reports.py 대응. */
export type CounterpartyInfo = { vehicle_no: string; insurer: string; claim_no: string | null };
export type ClaimRow = {
  claim_no: string; insured_party_id: string | null; coverage: string; insurance_payment: number;
  counterparty_fault: number; planned_share: number; evidence_count: number;
};
export type ClaimAmounts = {
  planned: number | null; claimed: number | null; recovered: number | null;
  agreed_counterparty_fault?: number | null; fault_change_reason?: string | null;
};
export type ClaimPackage = {
  case_id: string; package_version: number; created_at: string; report_version: number;
  counterparty: CounterpartyInfo | null; counterparty_fault: number; fault_change_reason: string | null;
  rows: ClaimRow[]; amounts: ClaimAmounts; basis: Record<string, unknown>;
  evidence: Record<string, unknown>[]; missing_evidence: string[];
  confirmed_by: string; confirmed_at: string; idempotency_key: string;
  rule_version: string; rule_notice: string | null; assumptions: string[];
};
/** 확인 완료 응답. 청구서를 못 만들면 package·html은 null이고, 사유는 claim_blocked_reasons를 목록으로 보여 준다. */
export type ConfirmResult = {
  report: ReviewReport; package: ClaimPackage | null; html: string | null;
  claim_blocked_reason: string | null; claim_blocked_reasons: string[];
};
export type ClaimResult = { package: ClaimPackage; html: string };
/** 면책 체크. 키는 무면허·음주·고의만, null은 미입력으로 되돌림. 아무것도 고르지 않으면 보내지 않는다. */
export type CaseFacts = Partial<Record<"무면허" | "음주" | "고의", boolean | null>>;
/** 협의 과실 입력·해제. 이유는 필수다(clear=true면 판단 과실로 되돌림). */
export type AgreedFaultInput = {
  agreed_counterparty_fault?: number | null; fault_change_reason?: string | null; clear?: boolean;
};
