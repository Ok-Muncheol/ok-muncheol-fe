// PR 게이트(automation/bin/pr-gate.mjs)를 gh 없이 확인한다.
// 판정은 fixture JSON으로, 폴링은 gh 대역으로 본다.
import assert from "node:assert/strict";
import { test } from "node:test";

import { judge, main } from "../bin/pr-gate.mjs";
import { apiError, captureOutput, fakeGh, ghMissing, json, noSleep } from "./helpers.mjs";

const run = (name, conclusion = "SUCCESS", status = "COMPLETED") => ({
  __typename: "CheckRun",
  name,
  status,
  conclusion,
});
const vercel = (state) => ({ __typename: "StatusContext", context: "Vercel", state });
const view = (checks, mergeable = "MERGEABLE") => ({ mergeable, statusCheckRollup: checks });
const VIEW_ARGS = ["pr", "view", "12", "--json", "mergeable,statusCheckRollup"];

const CASES = [
  ["check 성공 → PASS", view([run("check")]), ["check"], "PASS"],
  [
    "check + Vercel(StatusContext) 성공 → PASS",
    view([run("check"), vercel("SUCCESS")]),
    ["check"],
    "PASS",
  ],
  [
    "Vercel 프리뷰 진행 중 → PENDING (전수 대기)",
    view([run("check"), vercel("PENDING")]),
    ["check"],
    "PENDING anchors_absent= pending=Vercel mergeable=MERGEABLE",
  ],
  [
    "Vercel 프리뷰 실패 → FAIL",
    view([run("check"), vercel("FAILURE")]),
    ["check"],
    "FAIL failed=Vercel mergeable=MERGEABLE",
  ],
  [
    "앵커 체크 실패 → FAIL",
    view([run("check", "FAILURE")]),
    ["check"],
    "FAIL failed=check mergeable=MERGEABLE",
  ],
  [
    "비앵커 체크 실패도 차단 (전수 검사) → FAIL",
    view([run("check"), run("e2e", "FAILURE")]),
    ["check"],
    "FAIL failed=e2e mergeable=MERGEABLE",
  ],
  [
    "앵커 부재(Vercel만 등록) → PENDING (vacuous pass 방지)",
    view([vercel("SUCCESS")]),
    ["check"],
    "PENDING anchors_absent=check pending= mergeable=MERGEABLE",
  ],
  [
    "체크 진행 중 → PENDING",
    view([run("check", null, "IN_PROGRESS")]),
    ["check"],
    "PENDING anchors_absent= pending=check mergeable=MERGEABLE",
  ],
  [
    "NEUTRAL·SKIPPED는 통과",
    view([run("check"), run("lint", "NEUTRAL"), run("e2e", "SKIPPED")]),
    ["check"],
    "PASS",
  ],
  [
    "충돌 → FAIL mergeable=CONFLICTING",
    view([run("check")], "CONFLICTING"),
    ["check"],
    "FAIL failed= mergeable=CONFLICTING",
  ],
  [
    "체크 0개 + 앵커 지정 → PENDING (vacuous pass 방지)",
    view([]),
    ["check"],
    "PENDING anchors_absent=check pending= mergeable=MERGEABLE",
  ],
  // 앵커 없음 모드 (CI 없는 레포) — 체크 존재를 요구하지 않는다
  ["앵커 없음 + 체크 0개 + MERGEABLE → PASS", view([]), [], "PASS"],
  [
    "앵커 없음 + mergeable UNKNOWN → PENDING",
    { mergeable: "UNKNOWN", statusCheckRollup: null },
    [],
    "PENDING anchors_absent= pending= mergeable=UNKNOWN",
  ],
  [
    "앵커 없음이라도 실패 체크는 차단 → FAIL",
    view([run("x", "FAILURE")]),
    [],
    "FAIL failed=x mergeable=MERGEABLE",
  ],
];

for (const [name, pr, anchors, want] of CASES) {
  test(`judge: ${name}`, () => {
    assert.equal(judge(pr, anchors), want);
  });
}

test("main: 체크가 끝날 때까지 기다렸다가 PASS", async (t) => {
  const output = captureOutput(t);
  const { gh, calls } = fakeGh(
    json(view([run("check", null, "QUEUED")])),
    json(view([run("check")])),
  );

  assert.equal(await main(["12", "600", "check"], { gh, sleep: noSleep }), 0);
  assert.equal(output.out.at(-1), "PR_GATE_DONE result=PASS");
  assert.deepEqual(calls, [VIEW_ARGS, VIEW_ARGS]);
});

test("main: 체크 실패 → 즉시 FAIL", async (t) => {
  const output = captureOutput(t);
  const { gh } = fakeGh(json(view([run("check", "FAILURE")])));

  assert.equal(await main(["12", "600", "check"], { gh, sleep: noSleep }), 1);
  assert.equal(output.out.at(-1), "PR_GATE_DONE result=FAIL failed=check mergeable=MERGEABLE");
});

test("main: 대기 중 타임아웃 → TIMEOUT과 마지막 판정", async (t) => {
  const output = captureOutput(t);
  const { gh } = fakeGh(json(view([vercel("SUCCESS")])));

  assert.equal(await main(["12", "0", "check"], { gh, sleep: noSleep }), 1);
  assert.equal(
    output.out.at(-1),
    "PR_GATE_DONE result=TIMEOUT PENDING anchors_absent=check pending= mergeable=MERGEABLE",
  );
});

test("main: GitHub 조회 3회 연속 실패 → API_ERROR", async (t) => {
  const output = captureOutput(t);
  const { gh } = fakeGh(apiError(), apiError(), apiError());

  assert.equal(await main(["12", "600", "check"], { gh, sleep: noSleep }), 1);
  assert.equal(output.out.at(-1), "PR_GATE_DONE result=API_ERROR");
});

test("main: 조회가 한 번 성공하면 실패 횟수를 다시 센다", async (t) => {
  captureOutput(t);
  const pending = json(view([vercel("SUCCESS")]));
  const passed = json(view([run("check")]));
  const { gh } = fakeGh(apiError(), apiError(), pending, apiError(), apiError(), passed);

  assert.equal(await main(["12", "600", "check"], { gh, sleep: noSleep }), 0);
});

// 판정 입력이 이상하면 TIMEOUT까지 기다리지 않고 바로 ERROR로 끝난다 (fail-closed)
for (const response of ["", "not json", "[]", "null", json({ statusCheckRollup: [] })]) {
  test(`main: 형식이 다른 응답 ${JSON.stringify(response)} → ERROR`, async (t) => {
    const output = captureOutput(t);
    const { gh } = fakeGh(response);

    assert.equal(await main(["12", "600", "check"], { gh, sleep: noSleep }), 1);
    assert.equal(output.out.at(-1), "PR_GATE_DONE result=ERROR");
  });
}

test("main: gh가 없으면 → ERROR", async (t) => {
  const output = captureOutput(t);
  const { gh } = fakeGh(ghMissing());

  assert.equal(await main(["12", "600", "check"], { gh, sleep: noSleep }), 1);
  assert.equal(output.out.at(-1), "PR_GATE_DONE result=ERROR");
});

for (const argv of [["12"], ["12", "ten", "check"]]) {
  test(`main: 잘못된 인자 ${JSON.stringify(argv)} → usage`, async (t) => {
    const output = captureOutput(t);

    assert.equal(await main(argv), 2);
    assert.match(output.err.join("\n"), /usage/);
  });
}
