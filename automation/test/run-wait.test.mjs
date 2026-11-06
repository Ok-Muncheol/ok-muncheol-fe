// main 머지 커밋의 CI run 대기(automation/bin/run-wait.mjs)를 gh 대역으로 확인한다.
import assert from "node:assert/strict";
import { test } from "node:test";

import { main } from "../bin/run-wait.mjs";
import { apiError, captureOutput, fakeGh, ghMissing, json, noSleep } from "./helpers.mjs";

const ARGS = ["ci.yml", "main", "abc123", "600"];

// `gh run list --json status,conclusion,databaseId` 출력. status가 없으면 run이 아직 없다
const runs = (status, conclusion = "") =>
  status === undefined ? "[]" : json([{ status, conclusion, databaseId: 7 }]);

test("run이 성공할 때까지 기다린다", async (t) => {
  const output = captureOutput(t);
  const { gh, calls } = fakeGh(runs(), runs("in_progress"), runs("completed", "success"));

  assert.equal(await main(ARGS, { gh, sleep: noSleep }), 0);
  assert.equal(output.out.at(-1), "RUN_RESULT result=success run_id=7");
  assert.deepEqual(calls[0], [
    "run", "list", "--branch", "main", "--workflow", "ci.yml", "--commit", "abc123",
    "--limit", "1", "--json", "status,conclusion,databaseId",
  ]);
});

test("실패 conclusion은 그대로 보고한다", async (t) => {
  const output = captureOutput(t);
  const { gh } = fakeGh(runs("completed", "failure"));

  assert.equal(await main(ARGS, { gh, sleep: noSleep }), 1);
  assert.equal(output.out.at(-1), "RUN_RESULT result=failure run_id=7");
});

// run이 한 번도 안 보였으면 미트리거(NOT_FOUND), 보였는데 안 끝났으면 TIMEOUT이다
for (const [response, want] of [
  [runs(), "RUN_RESULT result=NOT_FOUND"],
  [runs("in_progress"), "RUN_RESULT result=TIMEOUT"],
]) {
  test(`타임아웃 구분: ${want}`, async (t) => {
    const output = captureOutput(t);
    const { gh } = fakeGh(response);

    assert.equal(await main(["ci.yml", "main", "abc123", "0"], { gh, sleep: noSleep }), 1);
    assert.equal(output.out.at(-1), want);
  });
}

test("GitHub 조회 3회 연속 실패 → API_ERROR", async (t) => {
  const output = captureOutput(t);
  const { gh } = fakeGh(apiError(), apiError(), apiError());

  assert.equal(await main(ARGS, { gh, sleep: noSleep }), 1);
  assert.equal(output.out.at(-1), "RUN_RESULT result=API_ERROR");
});

for (const response of ["", "not json", json({ runs: [] }), json([{ status: "completed" }])]) {
  test(`형식이 다른 응답 ${JSON.stringify(response)} → ERROR`, async (t) => {
    const output = captureOutput(t);
    const { gh } = fakeGh(response);

    assert.equal(await main(ARGS, { gh, sleep: noSleep }), 1);
    assert.equal(output.out.at(-1), "RUN_RESULT result=ERROR");
  });
}

test("gh가 없으면 → ERROR", async (t) => {
  const output = captureOutput(t);
  const { gh } = fakeGh(ghMissing());

  assert.equal(await main(ARGS, { gh, sleep: noSleep }), 1);
  assert.equal(output.out.at(-1), "RUN_RESULT result=ERROR");
});

for (const argv of [["ci.yml", "main"], ["ci.yml", "main", "abc123", "soon"]]) {
  test(`잘못된 인자 ${JSON.stringify(argv)} → usage`, async (t) => {
    const output = captureOutput(t);

    assert.equal(await main(argv), 2);
    assert.match(output.err.join("\n"), /usage/);
  });
}
