/**
 * B: 판단 화면이 읽는 판단 실행·사실 카드. 지금은 비식별 합성 견본(src/fixtures/judgment.json)이고 운영 배포에서는 비어 있다.
 * 판단 조회 계약(GET /cases/{id}의 판단 상태, 또는 judgment_runs 읽기)과 GET /cases/{id}/fact-card가 생기면 여기만 바꾼다.
 */
import { isSampleSource } from "@/features/cases/case-source";
import sample from "@/fixtures/judgment.json";
import type { FactCard, JudgmentRun } from "@/lib/api/types";

const RUNS = sample.runs as JudgmentRun[];
// 카드마다 칸 구성이 달라 TS가 JSON을 칸별 합집합으로 추론한다(없는 칸은 undefined). 견본 모양은 src/fixtures/judgment.test.mjs가 본다.
const CARDS = sample.fact_cards as unknown as FactCard[];

/** 사건의 최근 판단 실행. 없으면 아직 판단을 시작하지 않은 사건이다. */
export async function getLatestJudgmentRun(caseId: string): Promise<JudgmentRun | null> {
  // TODO: 판단 상태 조회 — 새로고침·재접속 복구는 이 조회가 맡고 Realtime(judgment_runs 변경)은 알림만 준다.
  return isSampleSource() ? (RUNS.find((r) => r.case_id === caseId) ?? null) : null;
}

/** 사건의 최신 사실 카드. 사실 카드 화면(정지원)이 같은 조회를 만들면 그쪽을 쓴다. */
export async function getFactCard(caseId: string): Promise<FactCard | null> {
  // TODO: createApiClient().getFactCard(caseId)
  return isSampleSource() ? (CARDS.find((c) => c.case_id === caseId) ?? null) : null;
}
