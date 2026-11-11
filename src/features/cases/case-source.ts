/**
 * B 통합: 담당 사건 보드·상세가 읽는 사건 요약. 지금은 비식별 합성 견본이고, BE GET /cases·GET /cases/{id}가 생기면
 * ApiClient(src/lib/api/client.ts)로 바꾼다. 운영 배포에서는 견본을 보여 주지 않는다(/dev와 같은 기준).
 */
import type { CaseSummary } from "@/lib/api/types";
import sample from "@/fixtures/case-board.json";

const SAMPLE = sample.cases as CaseSummary[];

/**
 * 화면이 합성 견본을 읽는지(true), BE를 읽는지(false). 운영 배포(VERCEL_ENV=production)는 늘 BE이고 견본을 보여 주지 않는다.
 * 그 밖에서는 견본이 기본이고, 서버 환경변수 OKM_DATA_SOURCE=api면 BE(NEXT_PUBLIC_BACKEND_URL)를 읽는다(.env.example).
 * 서버에서만 부른다 — 브라우저에는 이 값이 없으니 클라이언트 컴포넌트에는 결과를 prop으로 넘긴다.
 */
export function isSampleSource(): boolean {
  if (process.env.VERCEL_ENV === "production") return false;
  return process.env.OKM_DATA_SOURCE !== "api";
}

export async function listCases(): Promise<CaseSummary[]> {
  // TODO: createServerApiClient().listCases()(src/lib/api/server.ts) — 담당자 토큰으로 자기 사건만 받는다.
  return isSampleSource() ? SAMPLE : [];
}

export async function getCaseSummary(caseId: string): Promise<CaseSummary | null> {
  // TODO: createServerApiClient().getCase(caseId) — 새로고침 복구는 이 조회가 맡고 Realtime은 변경 알림만 준다.
  return (await listCases()).find((c) => c.case_id === caseId) ?? null;
}
