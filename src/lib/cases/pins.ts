/**
 * B 통합: 사건 고정의 순수 규칙. 화면(src/features/cases/)과 테스트(pins.test.mjs)가 같이 쓴다. 런타임 import는 두지 않는다.
 * 고정한 사건 ID는 담당자 브라우저의 쿠키(PIN_COOKIE)에 고정한 순서대로 둔다 — 서버가 첫 화면부터 같은 순서로 그린다.
 * 고정을 BE에 저장하게 되면 읽고 쓰는 곳(pin-source.ts·pin-actions.ts)만 바꾼다.
 */

export const PIN_COOKIE = "okm-pinned-cases";

/** 쿠키가 커지지 않게 둔 상한. 넘치면 가장 먼저 고정한 사건부터 푼다 */
export const PIN_LIMIT = 20;

/** 사건 ID 모양 — BE UUID와 합성 견본 ID(SYN-2026-0101). 그 밖의 값은 쿠키에 넣지 않는다 */
const CASE_ID = /^[A-Za-z0-9_-]{1,64}$/;

export function isCaseId(value: unknown): value is string {
  return typeof value === "string" && CASE_ID.test(value);
}

/** 쿠키 값 → 고정한 사건 ID(고정한 순서). 모르는 모양·겹친 ID는 버린다 */
export function parsePinned(raw: string | undefined): string[] {
  if (!raw) return [];
  return [...new Set(raw.split(",").filter(isCaseId))].slice(-PIN_LIMIT);
}

export function serializePinned(ids: readonly string[]): string {
  return ids.join(",");
}

/** 고정했으면 풀고, 아니면 끝에 더한다 */
export function togglePinned(ids: readonly string[], caseId: string): string[] {
  if (ids.includes(caseId)) return ids.filter((id) => id !== caseId);
  return [...ids, caseId].slice(-PIN_LIMIT);
}
