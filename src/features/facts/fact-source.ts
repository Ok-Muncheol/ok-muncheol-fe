/**
 * A·B: 사실 카드 조회. 사건 작업 화면(/cases/[id]/judgment)이 쓴다.
 * 견본 모드는 비식별 합성 견본 — 사실 카드 단계의 확정 전 카드는 src/fixtures/fact-cards.json, 판단 단계의 확정 카드는 src/fixtures/judgment.json.
 * API 모드는 BE GET /cases/{id}/fact-card(담당자 토큰). 카드가 아직 없거나(404) 남의 사건(403)이면 null이다. 새로고침 복구는 이 조회가 맡는다.
 */
import { isSampleSource } from "@/features/cases/case-source";
import drafts from "@/fixtures/fact-cards.json";
import judged from "@/fixtures/judgment.json";
import { redirect } from "next/navigation";
import { ApiRequestError } from "@/lib/api/client";
import { createServerApiClient } from "@/lib/api/server";
import type { EvidenceView, FactCard } from "@/lib/api/types";

// 카드마다 칸 구성이 달라 TS가 JSON을 칸별 합집합으로 추론한다(없는 칸은 undefined). 견본 모양은 src/fixtures/*.test.mjs가 본다.
const CARDS = [...drafts.fact_cards, ...judged.fact_cards] as unknown as FactCard[];

/** 사건의 최신 사실 카드. 없으면 아직 카드가 만들어지지 않았다(접수·영상 분석 단계). */
export async function getFactCard(caseId: string): Promise<FactCard | null> {
  if (isSampleSource()) return CARDS.find((c) => c.case_id === caseId) ?? null;
  try {
    return await createServerApiClient().getFactCard(caseId);
  } catch (error) {
    if (error instanceof ApiRequestError && (error.status === 404 || error.status === 403)) return null;
    // 로그인하지 않았거나 세션이 끝났다 — 로그인 화면으로 보내고, 로그인하면 이 사건의 판단 화면으로 돌아온다.
    if (error instanceof ApiRequestError && error.status === 401) redirect(`/login?next=${encodeURIComponent(`/cases/${encodeURIComponent(caseId)}/judgment`)}`);
    throw error;
  }
}

/**
 * 근거 사진 · 미리보기 영상 보기 주소(BE GET /cases/{id}/evidence). 주소가 1시간 뒤 만료되므로 화면을 열 때마다 새로 읽는다.
 * 견본 모드는 파일이 없어 null이다. 못 읽으면(권한 · 연결 · BE 오류) 화면을 막지 않고 null — 영상 · 사진 자리만 비운다.
 */
export async function getEvidence(caseId: string): Promise<EvidenceView | null> {
  if (isSampleSource()) return null;
  try {
    return await createServerApiClient().getEvidence(caseId);
  } catch (error) {
    if (error instanceof ApiRequestError) return null;
    throw error;
  }
}
