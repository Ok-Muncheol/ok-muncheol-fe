/**
 * B 통합·각 담당 연결: 인터페이스 초안. 요청/인증/오류 처리는 미구현.
 * 메서드는 BE app/api/routes.py 경로와 1:1(16개)이다. BE tests/api/test_app.py가 경로 수를 대조한다.
 */
import type {
  AgreedFaultInput, AnswerResult, CaseFacts, ClaimResult, ConfirmResult, CounterpartyInfo,
  FactCard, FactPatch, QuestionAnswer, ReviewReport, TaskView,
} from "./types";

export interface ApiClient {
  createCase(payload: Record<string, unknown>): Promise<Record<string, unknown>>;
  requestUpload(caseId: string): Promise<Record<string, unknown>>;
  startAnalysis(caseId: string, storagePath: string, idempotencyKey: string): Promise<Record<string, unknown>>;
  getCase(caseId: string): Promise<Record<string, unknown>>;
  getFactCard(caseId: string): Promise<FactCard>;
  patchFactCard(caseId: string, patch: FactPatch): Promise<FactCard>;
  confirmFactCard(caseId: string, expectedVersion: number): Promise<FactCard>;
  /** POST /cases/{id}/judgments — 202. 판단을 끝까지 실행한 뒤의 상태(완료·질문 대기·실패) */
  startJudgment(caseId: string, cardVersion: number, idempotencyKey: string): Promise<TaskView>;
  answerQuestion(caseId: string, answer: QuestionAnswer): Promise<AnswerResult>;
  askQuestion(caseId: string, text: string): Promise<Record<string, unknown>>;
  getReport(caseId: string, version: number): Promise<ReviewReport>;
  /** POST …/reports/{version}/confirm — 담당자 확인 완료 1회, 조건이 맞으면 구상 청구서까지 만든다 */
  confirmReport(caseId: string, version: number, counterparty?: CounterpartyInfo | null): Promise<ConfirmResult>;
  /** GET …/reports/{version}/claim — 그 보고서 버전으로 만든 청구서. 없으면 404 */
  getClaim(caseId: string, version: number): Promise<ClaimResult>;
  /** POST /cases/{id}/documents — 서류·면책 체크 추가 → 재산정한 새 보고서(추가 확인·보류 사건이면 null) */
  addDocuments(caseId: string, documents: Record<string, unknown>[], caseFacts?: CaseFacts): Promise<ReviewReport | null>;
  /** POST /cases/{id}/estimates — 서명 URL로 Storage에 올린 견적서 PDF 경로. BE 연결 전에는 501 */
  uploadEstimate(caseId: string, storagePath: string, partyId: string): Promise<ReviewReport | null>;
  /** PATCH /cases/{id}/agreed-fault — 협의 과실 입력·해제 → 새 보고서(다시 확인 완료 필요) */
  setAgreedFault(caseId: string, input: AgreedFaultInput): Promise<ReviewReport>;
}

export function createApiClient(): ApiClient {
  // TODO: 인증 토큰·HTTP·버전 충돌·중복 요청·상태 재조회. actor_id를 브라우저가 결정하지 않는다.
  throw new Error("B: API 클라이언트 미구현");
}
