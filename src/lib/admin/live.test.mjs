// 사건 관제 새 접수 알림 규칙 테스트. Node가 .ts의 타입만 지우고 실행한다.
import assert from "node:assert/strict";
import { test } from "node:test";
import { RIPPLE_MS, freshRipples, listChanged } from "./live.ts";

const NOW = Date.parse("2026-11-17T10:00:00+09:00");
const intake = (id, secondsAgo, region = "서울") => ({
  intake_id: id,
  region,
  received_at: new Date(NOW - secondsAgo * 1000).toISOString(),
});

test("처음 보는 접수 가운데 접수 시각부터 10초 안인 것만 물결이 된다", () => {
  const ripples = freshRipples([intake("a", 2), intake("b", 9), intake("c", 11), intake("d", 1, null)], new Set(), NOW);
  assert.deepEqual(
    ripples.map(({ id, until }) => [id, until - NOW]),
    [
      ["a", RIPPLE_MS - 2000],
      ["b", RIPPLE_MS - 9000],
    ],
  ); // c는 이미 지났고, d는 지역을 몰라 띄울 곳이 없다
  assert.ok(ripples.every((ripple) => ripple.from === NOW));
});

test("지난번에 읽은 접수는 다시 물결이 되지 않는다. 시계 차이로 접수 시각이 조금 뒤여도 띄운다", () => {
  assert.deepEqual(freshRipples([intake("a", 2)], new Set(["a"]), NOW), []);
  assert.deepEqual(
    freshRipples([intake("e", -1, "제주")], new Set(), NOW).map(({ id, region }) => [id, region]),
    [["e", "제주"]],
  );
});

test("최근 접수 목록이 바뀌면(새 접수, 지워진 시연 접수) 다시 그린다", () => {
  assert.equal(listChanged(["b", "a"], ["b", "a"]), false);
  assert.equal(listChanged(["b", "a"], ["c", "b", "a"]), true);
  assert.equal(listChanged(["c", "b", "a"], ["b", "a"]), true);
  assert.equal(listChanged(["b", "a"], ["c", "b"]), true);
});
