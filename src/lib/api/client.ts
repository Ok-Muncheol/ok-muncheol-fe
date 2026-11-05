/** D 통합·각 담당 연결: 인터페이스 초안. 요청/인증/오류 처리는 미구현. */
import type {
  CalculationResult, FactCard, FactPatch, QuestionAnswer, ReviewReport,
} from "./types";

export interface ApiClient {
  createCase(payload: Record<string, unknown>): Promise<Record<string, unknown>>;
  requestUpload(caseId: string): Promise<Record<string, unknown>>;
  startAnalysis(caseId: string, storagePath: string, idempotencyKey: string): Promise<Record<string, unknown>>;
  getCase(caseId: string): Promise<Record<string, unknown>>;
  getFactCard(caseId: string): Promise<FactCard>;
  patchFactCard(caseId: string, patch: FactPatch): Promise<FactCard>;
  confirmFactCard(caseId: string, expectedVersion: number): Promise<FactCard>;
  startJudgment(caseId: string, cardVersion: number, idempotencyKey: string): Promise<Record<string, unknown>>;
  answerQuestion(caseId: string, answer: QuestionAnswer): Promise<Record<string, unknown>>;
  askQuestion(caseId: string, text: string): Promise<Record<string, unknown>>;
  getReport(caseId: string, version: number): Promise<ReviewReport>;
  approveReport(caseId: string, version: number): Promise<ReviewReport>;
  calculatePayment(caseId: string, reportVersion: number): Promise<CalculationResult>;
  exportClaim(caseId: string, reportVersion: number): Promise<Record<string, unknown>>;
}

export function createApiClient(): ApiClient {
  // TODO: 인증 토큰·HTTP·버전 충돌·중복 요청·상태 재조회. actor_id를 브라우저가 결정하지 않는다.
  throw new Error("D: API 클라이언트 미구현");
}
