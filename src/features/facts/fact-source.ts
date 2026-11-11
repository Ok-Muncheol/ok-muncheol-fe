/**
 * A·B: 사실 카드 조회. 판단 화면(사실 카드 화면을 합쳤다)이 카드·당사자 매핑·근거 프레임을 그릴 때 쓴다.
 * 지금은 비식별 합성 견본이고 운영 배포에서는 비어 있다 — 사실 카드 단계의 확정 전 카드는 src/fixtures/fact-cards.json,
 * 판단 단계의 확정 카드는 src/fixtures/judgment.json에 있다. BE GET /cases/{id}/fact-card에 연결하면 여기만 바꾼다.
 */
import { isSampleSource } from "@/features/cases/case-source";
import drafts from "@/fixtures/fact-cards.json";
import judged from "@/fixtures/judgment.json";
import type { FactCard } from "@/lib/api/types";

// 카드마다 칸 구성이 달라 TS가 JSON을 칸별 합집합으로 추론한다(없는 칸은 undefined). 견본 모양은 src/fixtures/*.test.mjs가 본다.
const CARDS = [...drafts.fact_cards, ...judged.fact_cards] as unknown as FactCard[];

/** 사건의 최신 사실 카드. 없으면 아직 카드가 만들어지지 않았거나(접수·영상 분석 단계) 조회 연결 전이다. */
export async function getFactCard(caseId: string): Promise<FactCard | null> {
  // TODO(A): createServerApiClient().getFactCard(caseId)(src/lib/api/server.ts) — 새로고침·재접속 복구는 이 조회가 맡는다.
  return isSampleSource() ? (CARDS.find((c) => c.case_id === caseId) ?? null) : null;
}
