/**
 * B 통합: 담당 사건 보드·상세가 읽는 사건 요약. 지금은 비식별 합성 견본이고, BE GET /cases·GET /cases/{id}가 생기면
 * ApiClient(src/lib/api/client.ts)로 바꾼다. 운영 배포에서는 견본을 보여 주지 않는다(/dev와 같은 기준).
 */
import { redirect } from "next/navigation";
import { ApiRequestError } from "@/lib/api/client";
import { createServerApiClient } from "@/lib/api/server";
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

/**
 * 사건 하나. API 모드는 BE GET /cases/{id}(A, 담당자 토큰 — 남의 사건·없는 사건은 null)를 읽는다. 새로고침 복구는 이 조회가 맡는다.
 * BE 응답에 created_at이 아직 없으면 updated_at으로 채운다.
 */
export async function getCaseSummary(caseId: string): Promise<CaseSummary | null> {
  if (isSampleSource()) return SAMPLE.find((c) => c.case_id === caseId) ?? null;
  try {
    const raw = (await createServerApiClient().getCase(caseId)) as unknown as CaseSummary;
    return { ...raw, created_at: raw.created_at ?? raw.updated_at };
  } catch (error) {
    if (error instanceof ApiRequestError && (error.status === 404 || error.status === 403)) return null;
    // 로그인하지 않았거나 세션이 끝났다 — 오류 화면 대신 로그인 화면으로 보내고, 로그인하면 이 사건으로 돌아온다.
    if (error instanceof ApiRequestError && error.status === 401) redirect(`/login?next=${encodeURIComponent(`/cases/${encodeURIComponent(caseId)}`)}`);
    throw error;
  }
}
