/**
 * B 통합: BE HTTP 클라이언트. 메서드는 BE app/api/routes.py 경로와 1:1(17개)이다. BE tests/api/test_app.py가 경로 수를 대조한다.
 *
 * - 주소: NEXT_PUBLIC_BACKEND_URL(끝에 / 없이). 비우면 로컬 BE(LOCAL_BACKEND_URL)를 쓴다(.env.example).
 * - 인증: getAccessToken이 준 Supabase 세션 토큰을 Authorization: Bearer로 보낸다. 담당자(actor_id)는 BE가 토큰에서만 정한다.
 *   화면은 세션 토큰을 붙이는 createServerApiClient()(server.ts)·createBrowserApiClient()(browser.ts)를 쓴다. 로그인하지 않으면
 *   토큰 없이 보내므로 로컬 BE 개발 인증(APP_ENV=local·DEV_ACTOR_ID)에서만 통하고 그 밖에서는 401이다.
 * - 오류: BE는 모든 오류를 {error: ApiError}로 돌려준다(BE app/api/errors.py). 그 응답과 연결 실패, ApiError 모양이 아닌 응답을
 *   모두 ApiRequestError로 던진다. 버전 충돌(409 version_conflict)은 isVersionConflict로 가려 최신 값을 다시 조회하게 한다.
 * - 중복 요청: 판단·영상 분석 접수는 부르는 쪽이 newIdempotencyKey()로 키를 만들고, 같은 접수를 다시 보낼 때 같은 키를 쓴다.
 *   이 클라이언트는 자동으로 다시 보내지 않는다 — 새로고침·재접속은 상태 조회로 복원한다(TEAM.md 원칙).
 * - 캐시: 담당자별·버전별 값이라 서버 컴포넌트에서도 캐시하지 않는다(no-store). 옵션이 없으면 Next가 빌드 때 한 번만 부를 수 있다.
 * 런타임 import는 두지 않는다 — 테스트(client.test.mjs)가 Node로 이 파일을 바로 읽는다.
 */
import type {
  AgreedFaultInput, AnswerResult, ApiError, CaseFacts, CaseSummary, ClaimResult, ConfirmResult, CounterpartyInfo,
  EvidenceView, FactCard, FactPatch, JudgmentRunView, JudgmentTaskView, QaAnswer, QuestionAnswer, ReviewReport, UploadKind, UploadTicket,
} from "./types";

export interface ApiClient {
  /** GET /cases — 로그인한 담당자에게 배정된 사건 요약 목록(최근 바뀐 순). 없으면 [] */
  listCases(): Promise<CaseSummary[]>;
  createCase(payload: Record<string, unknown>): Promise<Record<string, unknown>>;
  /**
   * POST /cases/{id}/uploads — 견적서(estimate, application/pdf)·영상(video, mp4·mov·avi·webm·mkv) 업로드 서명 URL.
   * kind가 다르면 422 invalid_request, 형식이 kind와 안 맞으면 422 invalid_upload_type. BE 경로 본문 연결 전에는 501.
   * 받은 upload_url에 파일을 PUT하고(키 없이 Content-Type만) storage_path를 uploadEstimate·startAnalysis에 넘긴다. 파일 하나 50MB까지
   */
  requestUpload(caseId: string, kind: UploadKind, contentType: string): Promise<UploadTicket>;
  /** POST /cases/{id}/analysis — 202. idempotencyKey는 newIdempotencyKey()로 만들고 같은 접수를 다시 보낼 때 그대로 쓴다 */
  startAnalysis(caseId: string, storagePath: string, idempotencyKey: string): Promise<Record<string, unknown>>;
  getCase(caseId: string): Promise<Record<string, unknown>>;
  getFactCard(caseId: string): Promise<FactCard>;
  /** GET /cases/{id}/evidence — 근거 사진 · 미리보기 영상 서명 URL(1시간). 담당자 본인 사건만, 카드가 없으면 빈 목록 */
  getEvidence(caseId: string): Promise<EvidenceView>;
  patchFactCard(caseId: string, patch: FactPatch): Promise<FactCard>;
  confirmFactCard(caseId: string, expectedVersion: number): Promise<FactCard>;
  /** POST /cases/{id}/judgments — 202. 판단을 끝까지 실행한 뒤의 상태(완료·질문 대기·실패). idempotencyKey는 startAnalysis와 같다 */
  startJudgment(caseId: string, cardVersion: number, idempotencyKey: string): Promise<JudgmentTaskView>;
  /** GET /cases/{id}/judgment — 최신 판단 실행·판정·구분 질문과 답. 판단 전이면 null(404가 아니다) */
  getJudgment(caseId: string): Promise<JudgmentRunView | null>;
  answerQuestion(caseId: string, answer: QuestionAnswer): Promise<AnswerResult>;
  /** POST /cases/{id}/qa — 근거 질의응답·what-if(1~2000자). 판정이 난 판단이 없으면 409 judgment_required. 수십 초 걸릴 수 있다 */
  askQuestion(caseId: string, text: string): Promise<QaAnswer>;
  getReport(caseId: string, version: number): Promise<ReviewReport>;
  /** POST …/reports/{version}/confirm — 담당자 확인 완료 1회, 조건이 맞으면 구상 청구서까지 만든다 */
  confirmReport(caseId: string, version: number, counterparty?: CounterpartyInfo | null): Promise<ConfirmResult>;
  /** GET …/reports/{version}/claim — 그 보고서 버전으로 만든 청구서. 없으면 404 */
  getClaim(caseId: string, version: number): Promise<ClaimResult>;
  /** POST /cases/{id}/documents — 서류·면책 체크 추가 → 재산정한 새 보고서(추가 확인·보류 사건이면 null) */
  addDocuments(caseId: string, documents: Record<string, unknown>[], caseFacts?: CaseFacts): Promise<ReviewReport | null>;
  /** POST /cases/{id}/estimates — requestUpload(kind=estimate)로 올린 견적서 PDF의 storage_path. BE가 Storage에서 받아 자동 추출·재산정한다 */
  uploadEstimate(caseId: string, storagePath: string, partyId: string): Promise<ReviewReport | null>;
  /** PATCH /cases/{id}/agreed-fault — 협의 과실 입력·해제 → 새 보고서(다시 확인 완료 필요) */
  setAgreedFault(caseId: string, input: AgreedFaultInput): Promise<ReviewReport>;
}

export type ApiClientOptions = {
  /** BE 주소. 기본은 NEXT_PUBLIC_BACKEND_URL, 그것도 비면 LOCAL_BACKEND_URL */
  baseUrl?: string;
  /** Supabase 세션 access token. 로그인 연결 전이거나 세션이 없으면 null이고, 그때는 Authorization 없이 보낸다 */
  getAccessToken?: () => Promise<string | null> | string | null;
  /** 테스트에서 바꿔 끼우는 fetch */
  fetch?: (url: string, init: RequestInit) => Promise<Response>;
};

/** NEXT_PUBLIC_BACKEND_URL이 비었을 때 쓰는 로컬 BE 주소 */
export const LOCAL_BACKEND_URL = "http://127.0.0.1:8000";

/** BE 오류 응답과 연결 실패. status는 HTTP 상태이고, 응답을 받지 못한 연결 실패는 0이다. 화면은 message를 그대로 보여 준다. */
export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: string;
  readonly retryable: boolean;

  constructor(status: number, error: ApiError) {
    super(error.message);
    this.name = "ApiRequestError";
    this.status = status;
    this.code = error.code;
    this.retryable = error.retryable;
  }
}

/** 다른 버전이 먼저 저장됐다(409 version_conflict). 덮어쓰지 말고 최신 값을 다시 조회해 담당자에게 보여 준다. */
export function isVersionConflict(error: unknown): error is ApiRequestError {
  return error instanceof ApiRequestError && error.code === "version_conflict";
}

/** 화면에 보일 오류 하나로(ApiError 모양). ApiRequestError가 아닌 예외는 내부 메시지를 싣지 않는다. */
export function asApiError(error: unknown): ApiError {
  if (error instanceof ApiRequestError) return { code: error.code, message: error.message, retryable: error.retryable };
  return {
    code: "client_error",
    message: "요청을 처리하지 못했습니다. 화면을 새로 고친 뒤 다시 시도하세요.",
    retryable: true,
  };
}

/** 판단·영상 분석 접수의 Idempotency-Key(BE는 8~128자). 담당자 동작 한 번에 하나를 만들고 그 동작을 다시 보낼 때 그대로 쓴다. */
export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}

type Method = "GET" | "POST" | "PATCH";
type Payload = { body?: unknown; idempotencyKey?: string };

/** 경로 조각(사건·질문 ID, 버전). /·? 같은 글자가 경로를 바꾸지 못하게 인코딩한다. */
const seg = (value: string | number) => encodeURIComponent(String(value));

export function createApiClient(options: ApiClientOptions = {}): ApiClient {
  // process.env.NEXT_PUBLIC_…는 이 모양 그대로 써야 Next가 빌드 때 브라우저 번들에 값을 넣는다
  const baseUrl = (options.baseUrl || process.env.NEXT_PUBLIC_BACKEND_URL || LOCAL_BACKEND_URL).replace(/\/+$/, "");
  const getAccessToken = options.getAccessToken ?? (() => null);
  const send = options.fetch ?? ((url: string, init: RequestInit) => fetch(url, init));

  async function request<T>(method: Method, path: string, { body, idempotencyKey }: Payload = {}): Promise<T> {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
    const token = await getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;

    let response: Response;
    try {
      response = await send(baseUrl + path, {
        method, headers, cache: "no-store",
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new ApiRequestError(0, {
        code: "network_error",
        message: "BE에 연결하지 못했습니다. 네트워크와 BE 주소를 확인하고 다시 시도하세요.",
        retryable: true,
      });
    }
    if (!response.ok) throw await errorFrom(response);
    try {
      return (await response.json()) as T;
    } catch {
      // 요청은 처리됐을 수 있다. 같은 요청을 다시 보내지 말고 상태를 다시 조회한다
      throw new ApiRequestError(response.status, {
        code: "invalid_response",
        message: "BE 응답을 읽지 못했습니다. 상태를 다시 조회해 결과를 확인하세요.",
        retryable: false,
      });
    }
  }

  const caseUrl = (caseId: string) => `/cases/${seg(caseId)}`;
  const reportUrl = (caseId: string, version: number) => `${caseUrl(caseId)}/reports/${seg(version)}`;

  return {
    listCases: () => request("GET", "/cases"),
    createCase: (payload) => request("POST", "/cases", { body: payload }),
    requestUpload: (caseId, kind, contentType) =>
      request("POST", `${caseUrl(caseId)}/uploads`, { body: { kind, content_type: contentType } }),
    startAnalysis: (caseId, storagePath, idempotencyKey) =>
      request("POST", `${caseUrl(caseId)}/analysis`, { body: { storage_path: storagePath }, idempotencyKey }),
    getCase: (caseId) => request("GET", caseUrl(caseId)),
    getFactCard: (caseId) => request("GET", `${caseUrl(caseId)}/fact-card`),
    getEvidence: (caseId) => request("GET", `${caseUrl(caseId)}/evidence`),
    patchFactCard: (caseId, patch) => request("PATCH", `${caseUrl(caseId)}/fact-card`, { body: patch }),
    confirmFactCard: (caseId, expectedVersion) =>
      request("POST", `${caseUrl(caseId)}/fact-card/confirm`, { body: { expected_version: expectedVersion } }),
    startJudgment: (caseId, cardVersion, idempotencyKey) =>
      request("POST", `${caseUrl(caseId)}/judgments`, { body: { card_version: cardVersion }, idempotencyKey }),
    getJudgment: (caseId) => request("GET", `${caseUrl(caseId)}/judgment`),
    // BE는 경로의 질문 ID를 기준으로 본문 question_id와 다르면 거절한다 — 둘을 같은 값에서 만든다
    answerQuestion: (caseId, answer) =>
      request("POST", `${caseUrl(caseId)}/questions/${seg(answer.question_id)}/answer`, { body: answer }),
    askQuestion: (caseId, text) => request("POST", `${caseUrl(caseId)}/qa`, { body: { text } }),
    getReport: (caseId, version) => request("GET", reportUrl(caseId, version)),
    confirmReport: (caseId, version, counterparty = null) =>
      request("POST", `${reportUrl(caseId, version)}/confirm`, { body: { counterparty } }),
    getClaim: (caseId, version) => request("GET", `${reportUrl(caseId, version)}/claim`),
    addDocuments: (caseId, documents, caseFacts) =>
      request("POST", `${caseUrl(caseId)}/documents`, { body: { documents, case_facts: caseFacts ?? null } }),
    uploadEstimate: (caseId, storagePath, partyId) =>
      request("POST", `${caseUrl(caseId)}/estimates`, { body: { storage_path: storagePath, party_id: partyId } }),
    setAgreedFault: (caseId, input) => request("PATCH", `${caseUrl(caseId)}/agreed-fault`, { body: input }),
  };
}

/** 오류 응답 → ApiRequestError. BE 앞단(Vercel·프록시)이 낸 오류는 ApiError 모양이 아니라 HTTP 상태로 코드를 만든다. */
async function errorFrom(response: Response): Promise<ApiRequestError> {
  const body: unknown = await response.json().catch(() => null);
  const error = (body as { error?: Partial<ApiError> } | null)?.error;
  if (error && typeof error.code === "string" && typeof error.message === "string") {
    return new ApiRequestError(response.status, {
      code: error.code, message: error.message, retryable: error.retryable === true,
    });
  }
  const retryable = response.status >= 500;
  return new ApiRequestError(response.status, {
    code: `http_${response.status}`,
    message: `BE 요청이 실패했습니다(HTTP ${response.status}).${retryable ? " 잠시 후 다시 시도하세요." : ""}`,
    retryable,
  });
}
