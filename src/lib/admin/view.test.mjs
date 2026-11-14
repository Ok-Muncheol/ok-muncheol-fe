// 사건 관제 표시 규칙 테스트. Node가 .ts의 타입만 지우고 실행한다.
import assert from "node:assert/strict";
import { test } from "node:test";
import { adminHref, assignable, intakeFilter, needsInjuryAdjuster, parseAdminView, shortTime, staffName } from "./view.ts";

const ID = "11111111-1111-4111-8111-111111111111";
const member = (over) => ({
  user_id: ID, email: "kim@example.com", name: "김대물", staff_role: "adjuster", coverage: "property",
  region: "서울", auto_assign: true, cases: { open: 3, closed: 0 }, ...over,
});

test("주소 검색어를 화면 보기로 읽는다 — 처음에는 진행 중, 모르는 값은 버린다", () => {
  assert.deepEqual(parseAdminView({}), { state: "open", region: "", assignee: "", before: "" });
  assert.deepEqual(parseAdminView({ state: "", region: "부산", assignee: ID }), { state: "", region: "부산", assignee: ID, before: "" });
  assert.deepEqual(parseAdminView({ state: "done", region: "한양", assignee: "x", before: "어제" }), { state: "", region: "", assignee: "", before: "" });
  assert.equal(parseAdminView({ state: ["closed", "open"] }).state, "closed");
});

test("화면 보기를 BE 목록 조건과 주소로 바꾼다", () => {
  const view = parseAdminView({ state: "unassigned", region: "서울", before: "2026-11-14T10:00:00+09:00" });
  assert.deepEqual(intakeFilter(view, 50), { state: "unassigned", region: "서울", assignee_id: undefined, before: "2026-11-14T10:00:00+09:00", limit: 50 });
  // 탭·거르기를 바꾸면 쪽은 처음으로 돌아간다
  assert.equal(adminHref(view, { state: "open" }), `/admin?state=open&region=${encodeURIComponent("서울")}`);
  assert.equal(adminHref(view, { region: "" }), "/admin?state=unassigned");
  assert.match(adminHref(view, { before: "2026-11-13T09:00:00+09:00" }), /before=2026-11-13/);
  assert.equal(adminHref(parseAdminView({ state: "" })), "/admin?state=");
});

test("시각은 BE가 준 한국 시간 글자를 그대로 자른다", () => {
  assert.equal(shortTime("2026-11-04T08:05:00+09:00"), "11.4 08:05");
  assert.equal(shortTime(null), "");
  assert.equal(shortTime("어제"), "");
});

test("담당자 이름 — 이름, 이메일 앞부분, ID 앞 8자 순", () => {
  assert.equal(staffName(member(), ID), "김대물");
  assert.equal(staffName(member({ name: null }), ID), "kim");
  assert.equal(staffName(member({ name: null, email: null }), ID), "11111111");
  assert.equal(staffName(undefined, ID), "11111111"); // 담당자 목록에 없는 계정
  assert.equal(staffName(undefined, null), "");
});

test("줄 수 있는 담당자 — 같은 분야만, 같은 지역이 먼저, 업무량이 적은 순, 지금 담당자는 뺀다", () => {
  const staff = [
    member({ user_id: "a", name: "가", region: "부산", cases: { open: 0, closed: 0 } }),
    member({ user_id: "b", name: "나", region: "서울", cases: { open: 5, closed: 0 } }),
    member({ user_id: "c", name: "다", region: "서울", cases: { open: 1, closed: 0 } }),
    member({ user_id: "d", name: "라", coverage: "injury" }),
    member({ user_id: "e", name: "마", staff_role: "admin", coverage: null }),
    member({ user_id: "f", name: "바", region: "서울", cases: { open: 0, closed: 0 } }),
  ];
  assert.deepEqual(assignable(staff, "property", { region: "서울" }, "f").map((m) => m.user_id), ["c", "b", "a"]);
  assert.deepEqual(assignable(staff, "injury", { region: "서울" }, null).map((m) => m.user_id), ["d"]);
});

test("다친 사람이 있는데 대인 담당자가 없는 진행 중 접수를 가린다", () => {
  const intake = { status: "assigned", stage: "facts", injured_count: 1, injury_assignee_id: null };
  assert.equal(needsInjuryAdjuster(intake), true);
  assert.equal(needsInjuryAdjuster({ ...intake, injury_assignee_id: ID }), false);
  assert.equal(needsInjuryAdjuster({ ...intake, injured_count: 0 }), false);
  assert.equal(needsInjuryAdjuster({ ...intake, stage: "done" }), false);
  assert.equal(needsInjuryAdjuster({ ...intake, status: "unassigned" }), false);
});
