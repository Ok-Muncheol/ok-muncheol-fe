/**
 * B: 판단 화면이 읽는 판단 실행. 견본 모드는 비식별 합성 견본(src/fixtures/judgment.json), API 모드는 BE 판단 조회
 * (GET /cases/{id}/judgment)다 — 고르는 기준은 isSampleSource(src/features/cases/case-source.ts).
 * 새로고침·재접속 복원은 이 조회가 맡고 Realtime(judgment_runs 변경)은 알림만 준다. 사실 카드는 src/features/facts/fact-source.ts에서 읽는다.
 */
import { isSampleSource } from "@/features/cases/case-source";
import sample from "@/fixtures/judgment.json";
import { ApiRequestError, asApiError } from "@/lib/api/client";
import { createServerApiClient } from "@/lib/api/server";
import type { ApiError, JudgmentRunView } from "@/lib/api/types";

const RUNS = sample.runs as JudgmentRunView[];

/** 판단 조회 결과. run과 error가 모두 null이면 아직 판단을 시작하지 않은 사건이다. */
export type JudgmentLoad = { run: JudgmentRunView | null; error: ApiError | null };

/**
 * 사건의 최신 판단 실행. BE가 거절하거나 연결이 안 되면(인증·권한·연결·BE 오류) 던지지 않고 error로 돌려준다 — 화면이 이유를 보여 준다.
 * 그 밖의 예외는 코드 오류라 그대로 던진다.
 */
export async function getLatestJudgmentRun(caseId: string): Promise<JudgmentLoad> {
  if (isSampleSource()) return { run: RUNS.find((r) => r.case_id === caseId) ?? null, error: null };
  try {
    return { run: await createServerApiClient().getJudgment(caseId), error: null };
  } catch (error) {
    if (error instanceof ApiRequestError) return { run: null, error: asApiError(error) };
    throw error;
  }
}
