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
/** 업로드 파일 종류. 형식은 BE가 검사한다 — estimate는 application/pdf, video는 mp4·mov·avi·webm·mkv, medical_document(대인 증빙 — 진단서·진료비 영수증)는 application/pdf·image/jpeg(아니면 422 invalid_upload_type). */
export type UploadKind = "estimate" | "video" | "medical_document";
/** POST /cases/{id}/uploads 응답(BE UploadTicket). upload_url에 키 없이 파일 본문과 Content-Type만 넣어 PUT하고, storage_path를 /estimates·/analysis에 보낸다. */
/**
 * GET /cases/{id}/evidence — 최신 카드 근거 사진과 최신 완료 분석의 H.264 미리보기 영상을 보기용 서명 URL(expires_in초, 1시간)로 준다.
 * 파일이 없으면 url · preview_url이 null이다. 주소가 만료되므로 화면을 열 때마다 새로 읽는다(BE #170).
 */
export type EvidenceView = {
  frames: { frame_id: string; timestamp_ms: number; url: string | null }[];
  preview_url: string | null;
  expires_in: number;
};
export type UploadTicket = {
  /** 버킷 포함: case-files/{case_id}/estimates/{uuid}.pdf · case-files/{case_id}/videos/{uuid}.{확장자} */
  storage_path: string;
  /** Supabase 서명 업로드 URL(절대 주소). 한 번만 쓸 수 있고 expires_in초(7200) 동안 유효하다 */
  upload_url: string;
  expires_in: number;
};
/** 사건이 지금 어느 단계에 있는지 — README 「범위와 사용자 흐름」 순서. 영상 없는 사건은 analysis를 건너뛴다. */
export type CaseStage = "intake" | "analysis" | "facts" | "judgment" | "report";
/**
 * 담당 사건 보드 한 칸(GET /cases 응답 초안). BE 계약 확정 전 FE 제안이라 같은 이름으로 BE에 맞춘다.
 * 단계(stage)와 그 단계 안의 상태는 분리한다 — 같은 warning이라도 사실 카드의 확인 대기와 판단의 추가 확인은 할 일이 다르다.
 * created_at은 접수 시각(BE cases.created_at)이고 사건 목록을 접수 순으로 늘어놓는 기준이다.
 */
export type CaseSummary = {
  case_id: string; accident_date: string; created_at: string; input_path: "video" | "manual";
  stage: CaseStage;
  task_status: TaskStatus | null;
  judgment_status: JudgmentStatus | null;
  approval_status: "draft" | "approved" | null;
  open_questions: number;
  versions: VersionRef; updated_at: string;
  /** 최신 영상 분석 작업(A). 실패하면 error에 이유가 있다. BE가 싣기 전에는 없다 */
  analysis?: { status: TaskStatus; error: ApiError | null } | null;
};
export type FactField = {
  value: string | number | boolean | null; model_value: string | number | boolean | null;
  source: "vision" | "manual" | "statement"; model_confidence: number | null;
  verification_status: "unverified" | "needs_review" | "human_confirmed";
  evidence_frame_ids: string[]; source_document_ids: string[];
  /** 영상 분석 칸만(카드 v1 6절): 모델별 의견·내부 값·칸별 평가 정확도(eval.accuracy). 담당자가 고쳐도 바뀌지 않는다 */
  vision_detail?: Record<string, unknown>;
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
  /** 카드 v1 1절: 당사자 목록(P1 촬영 차량, P2 상대 차량). 예전 카드에는 없다 */
  parties?: { party_id: string; role: string; track_id: number | null }[];
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
/** 구분 질문에 단 답(BE AnswerView). 값 답변은 사실 카드 수정·재확정으로 새 카드 버전이 생겨야 판단에 쓰인다. */
export type AnswerView = {
  value: string | null; unknown: boolean; expected_card_version: number;
  /** 답을 반영해 생긴 카드 버전. 그 버전의 판단 접수가 이 실행을 대체할 때 채운다 */
  resulting_card_version: number | null; answered_at: string;
};
/** 판단 조회의 구분 질문과 답(BE QuestionView). 아직 안 답했으면 answer가 null이다. */
export type QuestionView = ConfirmationQuestion & { answer: AnswerView | null };
/**
 * 판단 조회(GET /cases/{id}/judgment) — 사건의 최신 판단 실행(BE JudgmentRunView, judgment_runs 행 + 질문). 판단 전이면 null.
 * 작업 진행(status)과 판정(result.status)을 분리한다. stage는 지금 단계(대기·처리 중·확인 대기·실패면 멈춘 곳)다.
 * result는 completed일 때만, error는 failed일 때만 온다. 확인 대기(waiting_for_confirmation)면 result가 비고
 * 답할 질문은 questions에 있다 — 완료 + 추가 확인 필요의 result.questions는 답변 경로로 답하지 않는 확인할 칸이다.
 */
export type JudgmentRunView = {
  task_id: string; case_id: string; judgment_version: number; fact_card_version: number;
  criteria_version: string; rule_version: string; status: TaskStatus; stage: JudgmentStage;
  rebuttal_retry_count: number; result: JudgmentResult | null; error: ApiError | null;
  /** 판정이 났으면 그 판단으로 만든 보고서의 최신 버전. 못 만들었으면 null */
  report_version: number | null;
  questions: QuestionView[]; updated_at: string;
};
/**
 * 판단 접수(POST …/judgments) 응답. BE docs/contracts/README.md 「판단 접수·질문 응답」.
 * 판정이 나면 BE가 보고서를 만들고 report_version을 준다(질문 대기·실패면 null). 보고서를 못 만들면 판단은
 * completed로 남고 report_error가 온다 — 같은 카드 버전으로 판단 접수를 새 키로 다시 보내면 보고서만 다시 만든다.
 */
export type JudgmentTaskView = TaskView & { report_version?: number | null; report_error?: ApiError | null };
/**
 * 질문 응답(POST …/questions/{question_id}/answer) 결과 = 판단 접수 응답 + 아래 필드. next_action이
 * update_fact_card면 값 답변을 카드에 반영·재확정한 뒤 새 카드 버전으로 판단을 다시 요청한다(field_values가
 * 칸별 답). null이면 같은 실행이 끝났다.
 */
export type JudgmentNextAction = "answer_remaining" | "update_fact_card" | null;
export type AnswerResult = JudgmentTaskView & {
  pending_question_ids: string[]; next_action: JudgmentNextAction; field_values: Record<string, string>;
};
/**
 * 근거 질의응답(POST /cases/{id}/qa) 응답 — BE app/schemas/judgment.py QaAnswer, docs/contracts/README.md 「근거 질의응답」.
 * 최신 판정(judgment_version)을 근거로 답한다. 판정이 난 판단이 없으면 409 judgment_required.
 * 답 본문의 [E1] 표시는 citations의 ref다(도구가 돌려준 근거만). 가정 결과(what-if)는 hypotheticals에만 있고
 * 공식 판단·보고서는 바뀌지 않는다. 가정 실행을 했으면 fact_change_hint가 공식 반영 경로를 알린다. 질문·답은 저장하지 않는다.
 */
/**
 * 인용 근거를 돌려준 도구 — official 공식 판단 로그 / search 결정례·약관 검색 / hypothesis 가정 실행(공식 판정의 근거가 아니다).
 * 공식 판단 로그가 돌려준 근거이기도 하면 official이다(BE app/schemas/judgment.py CitationSource).
 */
export type QaCitationSource = "official" | "search" | "hypothesis";
export type QaCitation = {
  ref: string; chunk_id: string; parent_id: string; corpus: Corpus; edition: string;
  page_start: number; page_end: number; excerpt: string;
  /** BE #94부터 온다. 그 전 응답에는 없다 */
  source?: QaCitationSource;
};
/** simulate 가정 실행 한 번. completed면 가정 판정, waiting_for_confirmation면 확인할 칸(open_fields)이 남아 멈춤, failed면 error */
export type QaHypothesis = {
  changes: Record<string, string>; status: "completed" | "waiting_for_confirmation" | "failed";
  judgment_status: JudgmentStatus | null; chart_id: string | null; fault_A: number | null; fault_B: number | null;
  reasons: string[]; open_fields: string[]; error: ApiError | null;
};
export type QaToolCall = { name: string; ok: boolean };
export type QaAnswer = {
  case_id: string; judgment_version: number; answer: string; citations: QaCitation[];
  hypotheticals: QaHypothesis[]; tool_calls: QaToolCall[]; fact_change_hint: string | null;
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
  /** BE 보고서에 함께 오는 값(assembler) — 만든 시각, 그때의 당사자 매핑(도표 A/B 이름). 예전 보고서에는 없을 수 있다 */
  created_at?: string; party_mapping?: PartyMapping;
};
/** 보고서 항목 하나(BE ReportSection) — 1~9번. 비어 있으면 empty_reason에 이유가 있다. body 키는 BE app/reports/assembler.py 그대로다 */
export type ReportSection = {
  no: number; title: string; state: "filled" | "empty"; body: Record<string, unknown>;
  evidence_ids: string[]; empty_reason: string | null;
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
