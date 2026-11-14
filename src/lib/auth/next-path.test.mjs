// 로그인 뒤 갈 곳 테스트. Node가 .ts의 타입만 지우고 실행한다.
import assert from "node:assert/strict";
import { test } from "node:test";
import { homePath, safeNext } from "./next-path.ts";

test("역할의 첫 화면 — 관리자는 사건 관제, 그 밖은 담당 사건", () => {
  assert.equal(homePath("admin"), "/admin");
  assert.equal(homePath("adjuster"), "/cases");
  assert.equal(homePath(null), "/cases");
  assert.equal(homePath(undefined), "/cases");
});

test("로그인 뒤 갈 곳은 이 사이트 안 경로면 그대로 둔다", () => {
  assert.equal(safeNext("/admin"), "/admin");
  assert.equal(safeNext("/cases/CASE-1/judgment?tab=facts#fact-card"), "/cases/CASE-1/judgment?tab=facts#fact-card");
  assert.equal(safeNext("/cases?next=//evil.example"), "/cases?next=//evil.example");
});

test("없거나 바깥 주소이거나 로그인 화면이면 첫 화면이다", () => {
  for (const next of [null, undefined, 42, "", "cases", "https://evil.example", "//evil.example", "/\\evil.example", "/\t/evil.example", "/\n/evil.example", "/login", "/login?next=/cases"]) {
    assert.equal(safeNext(next), "/", JSON.stringify(next));
  }
});
