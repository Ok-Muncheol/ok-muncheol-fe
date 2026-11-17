/**
 * B 통합: 사건 관제의 새 접수 알림 규칙. 화면이 몇 초마다 최근 접수를 읽어(src/features/admin/live-arrivals.tsx)
 * 목록이 바뀌면 다시 그리고, 새로 들어온 접수는 그 지역 지도에 물결을 접수 시각부터 RIPPLE_MS 동안 띄운다.
 * 시연 접수(BE scripts/demo_intake.py — 10초 뒤 나타나 1분 뒤 지워진다)도 같은 길로 보인다.
 * 런타임 import는 두지 않는다 — 테스트(live.test.mjs)가 Node로 이 파일을 바로 읽는다.
 */
import type { IntakeView } from "../api/types";

/** 최근 접수를 다시 읽는 간격 — 물결은 길어야 이만큼 늦게 뜬다 */
export const POLL_MS = 3_000;
/** 한 번에 읽는 최근 접수 수(최근 접수 순) */
export const POLL_LIMIT = 10;
/** 접수 시각부터 물결을 띄우는 시간 */
export const RIPPLE_MS = 10_000;

/** 띄울 물결 하나 — from은 화면이 이 접수를 처음 본 시각, until은 접수 시각 + RIPPLE_MS */
export type Ripple = { id: string; region: string; from: number; until: number };

type Arrival = Pick<IntakeView, "intake_id" | "region" | "received_at">;

/**
 * 지난번에 읽은 목록(seen)에 없던 접수 가운데 아직 물결 시간 안인 것. 지역을 모르는 접수는 지도에 띄울 곳이 없어 뺀다.
 * 접수 시각이 지금보다 조금 뒤여도(브라우저와 서버의 시계 차이) 띄운다 — BE는 접수 시각이 온 건만 돌려준다.
 */
export function freshRipples(intakes: readonly Arrival[], seen: ReadonlySet<string>, now: number): Ripple[] {
  return intakes.flatMap(({ intake_id, region, received_at }) => {
    const until = Date.parse(received_at) + RIPPLE_MS;
    return !seen.has(intake_id) && region && now < until ? [{ id: intake_id, region, from: now, until }] : [];
  });
}

/** 최근 접수 목록이 바뀌었나 — 새로 들어오거나 빠진(1분 뒤 지워진 시연 접수) 건이 있으면 화면을 다시 그린다 */
export function listChanged(before: readonly string[], after: readonly string[]): boolean {
  return before.length !== after.length || before.some((id, index) => id !== after[index]);
}
