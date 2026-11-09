/**
 * B 통합: 담당 사건 보드·상세가 읽는 사건 요약. 지금은 비식별 합성 견본이고, BE GET /cases·GET /cases/{id}가 생기면
 * ApiClient(src/lib/api/client.ts)로 바꾼다. 운영 배포에서는 견본을 보여 주지 않는다(/dev와 같은 기준).
 */
import type { CaseSummary } from "@/lib/api/types";
import sample from "@/fixtures/case-board.json";

const SAMPLE = sample.cases as CaseSummary[];

export function isSampleSource(): boolean {
  return process.env.VERCEL_ENV !== "production";
}

export async function listCases(): Promise<CaseSummary[]> {
  // TODO: createApiClient().listCases() — 담당자 토큰으로 자기 사건만 받는다.
  return isSampleSource() ? SAMPLE : [];
}

export async function getCaseSummary(caseId: string): Promise<CaseSummary | null> {
  // TODO: createApiClient().getCase(caseId) — 새로고침 복구는 이 조회가 맡고 Realtime은 변경 알림만 준다.
  return (await listCases()).find((c) => c.case_id === caseId) ?? null;
}
