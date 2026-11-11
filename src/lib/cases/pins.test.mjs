// 사건 고정 규칙 테스트. Node가 .ts의 타입만 지우고 실행한다(런타임 import 없음).
import assert from "node:assert/strict";
import { test } from "node:test";
import { PIN_LIMIT, isCaseId, parsePinned, serializePinned, togglePinned } from "./pins.ts";

test("사건 ID는 UUID와 합성 견본 모양만 받는다", () => {
  assert.equal(isCaseId("SYN-2026-0101"), true);
  assert.equal(isCaseId("6f1c2a9e-0b7d-4c1e-9a55-2d4b8e3f7a10"), true);
  assert.equal(isCaseId(""), false);
  assert.equal(isCaseId("a,b"), false, "쉼표는 구분자라 안 된다");
  assert.equal(isCaseId("x".repeat(65)), false);
  assert.equal(isCaseId(null), false);
});

test("쿠키 값은 고정한 순서를 지키고 모르는 값·겹친 ID를 버린다", () => {
  assert.deepEqual(parsePinned(undefined), []);
  assert.deepEqual(parsePinned(""), []);
  assert.deepEqual(parsePinned("SYN-2,SYN-1,SYN-2,bad id,"), ["SYN-2", "SYN-1"]);
  assert.equal(serializePinned(["SYN-2", "SYN-1"]), "SYN-2,SYN-1");
  assert.deepEqual(parsePinned(serializePinned(["A", "B"])), ["A", "B"]);
});

test("고정은 끝에 더하고 다시 누르면 풀린다. 상한을 넘으면 가장 먼저 고정한 사건부터 푼다", () => {
  assert.deepEqual(togglePinned(["A"], "B"), ["A", "B"]);
  assert.deepEqual(togglePinned(["A", "B"], "A"), ["B"]);
  const full = Array.from({ length: PIN_LIMIT }, (_, i) => `C${i}`);
  const next = togglePinned(full, "NEW");
  assert.equal(next.length, PIN_LIMIT);
  assert.equal(next[0], "C1");
  assert.equal(next.at(-1), "NEW");
  assert.equal(parsePinned(serializePinned([...full, "X"])).length, PIN_LIMIT);
});
