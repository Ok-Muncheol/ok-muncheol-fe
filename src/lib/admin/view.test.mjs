// 사건 관제 표시 규칙 테스트. Node가 .ts의 타입만 지우고 실행한다.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  REGIONS, accountRole, adminHref, assignable, binLabel, byCount, detailFlags, detailSummary, hasDetails, highValueFor, intakeFilter, mapBinWidth, mapStep,
  needsInjuryAdjuster, parseAdminView, regionToday, shortTime, specialtyLabels, staffName, staffOptionLabel, won,
} from "./view.ts";

const ID = "11111111-1111-4111-8111-111111111111";
const member = (over) => ({
  user_id: ID, email: "kim@example.com", name: "김대물", staff_role: "adjuster", coverage: "property",
  region: "서울", auto_assign: true, career_years: 7, specialties: [], high_value: false, away: false, cases: { open: 3, closed: 0 }, ...over,
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

const NONE = { estimated_damage: null, vehicle_type: null, vehicle_count: null, injury_severity: null, policy: null, policyholder: null };
const details = (over) => ({ ...NONE, ...over });
/** 서버가 가입 담보에 넣는 기본값과 같은 모양 — 대인배상Ⅱ 가입 */
const POLICY = { bodily_injury_ii: true, property_limit: 200_000_000, own_damage: true, personal_injury: "self_injury", uninsured_motorist: true };

test("금액은 억/만 원으로 적는다", () => {
  assert.equal(won(35_000_000), "3,500만 원");
  assert.equal(won(120_000_000), "1억 2,000만 원");
  assert.equal(won(200_000_000), "2억 원");
  assert.equal(won(10_000_000_000), "100억 원");
  assert.equal(won(123_456_789), "1억 2,345만 원"); // 만 원 아래는 버린다
  assert.equal(won(5_000), "5,000원");
  assert.equal(won(0), "0원");
  assert.equal(won(null), "");
  assert.equal(won(undefined), "");
});

test("참고 정보가 모두 비었으면 없는 것으로 본다 — 예전 접수 건, details가 없는 응답", () => {
  assert.equal(hasDetails(NONE), false);
  assert.equal(hasDetails(undefined), false);
  assert.equal(hasDetails(null), false);
  assert.equal(hasDetails(details({ estimated_damage: 0 })), true);
  assert.deepEqual(detailFlags(NONE), []);
  assert.deepEqual(detailFlags(undefined), []);
  assert.equal(detailSummary(NONE), "");
  assert.equal(detailSummary(undefined), "");
});

test("고액 사건 — 대물은 예상 손해액 3,000만 원 이상, 대인은 중상·사망", () => {
  assert.equal(highValueFor(details({ estimated_damage: 29_990_000 }), "property"), false);
  assert.equal(highValueFor(details({ estimated_damage: 30_000_000 }), "property"), true);
  assert.equal(highValueFor(details({ estimated_damage: 30_000_000 }), "injury"), false);
  assert.equal(highValueFor(details({ injury_severity: "minor" }), "injury"), false);
  assert.equal(highValueFor(details({ injury_severity: "serious" }), "injury"), true);
  assert.equal(highValueFor(details({ injury_severity: "fatal" }), "injury"), true);
  assert.equal(highValueFor(details({ injury_severity: "fatal" }), "property"), false);
  assert.equal(highValueFor(undefined, "property"), false);
});

test("표식 — 고액 사건, 수입차, 다중 추돌, 대인배상Ⅱ 미가입, 민원 2회 이상", () => {
  const keys = (value) => detailFlags(value).map((flag) => flag.key);
  assert.deepEqual(keys(details({ estimated_damage: 30_000_000 })), ["high_value"]);
  assert.deepEqual(keys(details({ injury_severity: "serious", estimated_damage: 50_000_000 })), ["high_value"]); // 둘 다여도 표식은 하나
  assert.deepEqual(keys(details({ vehicle_type: "imported", vehicle_count: 2 })), ["imported"]);
  assert.deepEqual(keys(details({ vehicle_type: "truck", vehicle_count: 3 })), ["multi_vehicle"]);
  assert.deepEqual(keys(details({ policy: POLICY, policyholder: { accidents_3y: 5, complaints: 1, long_term: true } })), []);
  const flags = detailFlags(details({ policy: { ...POLICY, bodily_injury_ii: false }, policyholder: { accidents_3y: 0, complaints: 2, long_term: false } }));
  assert.deepEqual(flags.map((flag) => flag.label), ["대인배상Ⅱ 미가입", "민원 2회"]);
  assert.ok(flags.every((flag) => flag.tone === "warning"));
});

test("목록 한 줄 요약은 있는 값만 잇는다", () => {
  assert.equal(detailSummary(details({ estimated_damage: 35_000_000, vehicle_type: "imported", vehicle_count: 3, injury_severity: "serious" })), "예상 3,500만 원 · 수입차 3대 · 중상");
  assert.equal(detailSummary(details({ vehicle_count: 2 })), "차량 2대");
  assert.equal(detailSummary(details({ vehicle_type: "motorcycle" })), "이륜차");
  assert.equal(detailSummary(details({ policy: POLICY })), "");
});

test("담당자 속성 — 전문 분야 이름, 고르기 목록의 한 줄", () => {
  assert.deepEqual(specialtyLabels(member({ specialties: ["imported", "serious_injury", "multi_vehicle"] })), ["수입차", "중상해", "다중 추돌"]);
  assert.deepEqual(specialtyLabels({}), []); // 속성을 주기 전 응답
  assert.equal(staffOptionLabel(member()), "김대물 · 서울 · 진행 중 3건 · 경력 7년");
  assert.equal(
    staffOptionLabel(member({ region: null, high_value: true, away: true, auto_assign: false })),
    "김대물 · 지역 없음 · 진행 중 3건 · 경력 7년 · 고액 권한 · 부재 · 자동 배정 제외",
  );
});

test("계정 역할은 토큰 app_metadata로 가린다 — 관리자, 대물·대인 담당자, 그 밖은 역할 없음", () => {
  assert.deepEqual(accountRole({ staff_role: "admin" }), { staffRole: "admin", label: "관리자" });
  assert.deepEqual(accountRole({ staff_role: "admin", coverage: "property" }), { staffRole: "admin", label: "관리자" });
  assert.deepEqual(accountRole({ staff_role: "adjuster", coverage: "property", region: "서울" }), { staffRole: "adjuster", label: "대물 담당자" });
  assert.deepEqual(accountRole({ staff_role: "adjuster", coverage: "injury" }), { staffRole: "adjuster", label: "대인 담당자" });
  assert.deepEqual(accountRole({ staff_role: "adjuster" }), { staffRole: "adjuster", label: "보상 담당자" });
  for (const meta of [undefined, null, "admin", {}, { staff_role: "ADMIN" }, { staff_role: ["admin"] }, { coverage: "property" }]) {
    assert.deepEqual(accountRole(meta), { staffRole: null, label: "보상 담당자" });
  }
});

const summary = (over) => ({ open: 0, unassigned: 0, received_today: 0, closed_today: 0, by_stage: {}, ...over });

test("지도 단계 폭 — 가장 많은 지역을 4단계로 나누고, 10을 넘으면 범례가 읽기 쉬운 수로 올린다", () => {
  assert.deepEqual([0, 1, 3, 4, 10, 22, 35, 40, 41, 150, 480].map(mapBinWidth), [1, 1, 1, 1, 3, 6, 9, 10, 15, 40, 200]);
  assert.deepEqual([0, 1, 10, 11, 35, 99].map((n) => mapStep(n, 10)), [0, 1, 1, 2, 4, 4]);
});

test("오늘 지역별 접수 — 17개 시·도로 펼치고, 없는 지역은 0건, 지역 미상은 합에서 뺀 나머지", () => {
  const today = regionToday(summary({ received_today: 61, received_today_by_region: { 서울: 12, 경기: 35, 부산: 9, 제주: 1, 한양: 4 } }));
  assert.deepEqual(today.regions.map((r) => r.region), REGIONS);
  const at = (region) => today.regions.find((r) => r.region === region);
  assert.deepEqual([at("경기"), at("서울"), at("부산"), at("제주"), at("세종")], [
    { region: "경기", count: 35, step: 4 },
    { region: "서울", count: 12, step: 2 },
    { region: "부산", count: 9, step: 1 },
    { region: "제주", count: 1, step: 1 },
    { region: "세종", count: 0, step: 0 },
  ]);
  assert.equal(today.unknown, 4); // 61 − (12 + 35 + 9 + 1). 시·도가 아닌 키(한양)는 세지 않는다
  assert.deepEqual(today.bins.map(binLabel), ["1–9", "10–18", "19–27", "28–35"]);
  assert.deepEqual(byCount(today.regions).slice(0, 5).map((r) => r.region), ["경기", "서울", "부산", "제주", "대구"]); // 0건은 시·도 순
});

test("오늘 지역별 접수 — 적을 때는 한 값씩 단계가 되고, 아무 데도 없으면 범례가 비고, BE가 주기 전 응답이면 지도가 없다", () => {
  const few = regionToday(summary({ received_today: 3, received_today_by_region: { 대전: 2, 울산: 1 } }));
  assert.deepEqual(few.bins.map(binLabel), ["1", "2"]);
  assert.deepEqual(byCount(few.regions).slice(0, 2).map((r) => [r.region, r.step]), [["대전", 2], ["울산", 1]]);
  const none = regionToday(summary({ received_today: 2, received_today_by_region: {} }));
  assert.deepEqual([none.bins, none.unknown, none.regions.every((r) => r.count === 0 && r.step === 0)], [[], 2, true]);
  assert.equal(regionToday(summary({ received_today: 5 })), null);
});
