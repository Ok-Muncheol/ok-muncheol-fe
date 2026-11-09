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
export type ValidationCheck = {
  layer: "evidence" | "rebuttal" | "numerical"; passed: boolean; reasons: string[];
};
export type JudgmentResult = {
  versions: VersionRef; status: JudgmentStatus; chart_id: string | null; edition: string | null;
  fault_A: number | null; fault_B: number | null; calculation_log: string[];
  evidence: EvidenceHit[]; checks: ValidationCheck[]; questions: ConfirmationQuestion[]; reasons: string[];
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
