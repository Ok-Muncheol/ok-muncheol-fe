/**
 * B: 판단 화면이 읽는 판단 실행. 지금은 비식별 합성 견본(src/fixtures/judgment.json)이고 운영 배포에서는 비어 있다.
 * 판단 조회 계약(GET /cases/{id}의 판단 상태, 또는 judgment_runs 읽기)이 생기면 여기만 바꾼다. 사실 카드는 src/features/facts/fact-source.ts에서 읽는다.
 */
import { isSampleSource } from "@/features/cases/case-source";
import sample from "@/fixtures/judgment.json";
import type { JudgmentRun } from "@/lib/api/types";

const RUNS = sample.runs as JudgmentRun[];

/** 사건의 최근 판단 실행. 없으면 아직 판단을 시작하지 않은 사건이다. */
export async function getLatestJudgmentRun(caseId: string): Promise<JudgmentRun | null> {
  // TODO: 판단 상태 조회 — 새로고침·재접속 복구는 이 조회가 맡고 Realtime(judgment_runs 변경)은 알림만 준다.
  return isSampleSource() ? (RUNS.find((r) => r.case_id === caseId) ?? null) : null;
}
