// Vercel 프로덕션 배포 대기(automation/bin/deploy-wait.mjs)를 gh 대역으로 확인한다.
import assert from "node:assert/strict";
import { test } from "node:test";

import { main } from "../bin/deploy-wait.mjs";
import { apiError, captureOutput, fakeGh, ghMissing, json, noSleep } from "./helpers.mjs";

const REPO = json({ nameWithOwner: "Ok-Muncheol/ok-muncheol-fe" });
const URL = "https://vercel.com/team/fe/abc";
// 커밋 상태 목록 (GitHub는 최신순으로 준다)
const vercel = (...states) =>
  json(states.map((state) => ({ context: "Vercel", state, target_url: URL })));
const NONE = json([]);
const COMMIT = json({ parents: [{ sha: "parent1" }] });
const statusesCall = (sha) => ["api", `repos/Ok-Muncheol/ok-muncheol-fe/commits/${sha}/statuses?per_page=100`];

test("머지 커밋의 Vercel 최신 상태가 success면 성공이다", async (t) => {
  const output = captureOutput(t);
  const { gh, calls } = fakeGh(REPO, vercel("success", "pending"));

  assert.equal(await main(["abc123"], { gh, sleep: noSleep }), 0);
  assert.equal(output.out.at(-1), `DEPLOY_RESULT result=success url=${URL}`);
  assert.deepEqual(calls, [["repo", "view", "--json", "nameWithOwner"], statusesCall("abc123")]);
});

test("다른 컨텍스트의 상태는 보지 않는다", async (t) => {
  const output = captureOutput(t);
  const { gh } = fakeGh(
    REPO,
    json([
      { context: "ci", state: "failure" },
      { context: "Vercel", state: "success", target_url: URL },
    ]),
  );

  assert.equal(await main(["abc123"], { gh, sleep: noSleep }), 0);
  assert.equal(output.out.at(-1), `DEPLOY_RESULT result=success url=${URL}`);
});

test("pending이면 끝날 때까지 기다린다", async (t) => {
  const output = captureOutput(t);
  const { gh } = fakeGh(REPO, vercel("pending"), vercel("success", "pending"));

  assert.equal(await main(["abc123"], { gh, sleep: noSleep }), 0);
  assert.equal(output.out.at(-1), `DEPLOY_RESULT result=success url=${URL}`);
});

for (const state of ["failure", "error"]) {
  test(`종료 상태 ${state} → ${state}`, async (t) => {
    const output = captureOutput(t);
    const { gh } = fakeGh(REPO, vercel(state, "pending"));

    assert.equal(await main(["abc123"], { gh, sleep: noSleep }), 1);
    assert.equal(output.out.at(-1), `DEPLOY_RESULT result=${state} url=${URL}`);
  });
}

test("상태가 아직 없으면 직전 main 커밋을 한 번만 보고 생길 때까지 기다린다", async (t) => {
  const output = captureOutput(t);
  const { gh, calls } = fakeGh(REPO, NONE, COMMIT, vercel("success"), NONE, vercel("success"));

  assert.equal(await main(["abc123"], { gh, sleep: noSleep }), 0);
  assert.equal(output.out.at(-1), `DEPLOY_RESULT result=success url=${URL}`);
  assert.deepEqual(calls.slice(1), [
    statusesCall("abc123"),
    ["api", "repos/Ok-Muncheol/ok-muncheol-fe/git/commits/abc123"],
    statusesCall("parent1"),
    statusesCall("abc123"),
    statusesCall("abc123"),
  ]);
});

// 머지 커밋에 상태가 끝내 안 생기면 직전 main 커밋으로 연동 여부를 가른다
for (const [name, responses, want, code] of [
  ["직전 커밋은 배포됨", [NONE, COMMIT, vercel("success")], "NOT_FOUND", 1],
  ["직전 커밋도 상태 없음", [NONE, COMMIT, NONE], "NOT_CONNECTED", 0],
  ["부모 없는 커밋", [NONE, json({ parents: [] })], "NOT_CONNECTED", 0],
]) {
  test(`상태 없음 · ${name} → ${want}`, async (t) => {
    const output = captureOutput(t);
    const { gh } = fakeGh(REPO, ...responses);

    assert.equal(await main(["abc123"], { gh, sleep: noSleep, graceSeconds: 0 }), code);
    assert.equal(output.out.at(-1), `DEPLOY_RESULT result=${want}`);
  });
}

test("pending인 채로 시간이 다 되면 TIMEOUT이다", async (t) => {
  const output = captureOutput(t);
  const { gh } = fakeGh(REPO, vercel("pending"));

  assert.equal(await main(["abc123"], { gh, sleep: noSleep, limitSeconds: 0 }), 1);
  assert.equal(output.out.at(-1), `DEPLOY_RESULT result=TIMEOUT url=${URL}`);
});

test("레포 이름 조회 실패 → 바로 API_ERROR", async (t) => {
  const output = captureOutput(t);
  const { gh, calls } = fakeGh(apiError());

  assert.equal(await main(["abc123"], { gh, sleep: noSleep }), 1);
  assert.equal(output.out.at(-1), "DEPLOY_RESULT result=API_ERROR");
  assert.equal(calls.length, 1);
});

test("상태 조회 실패가 3회 연속이 아니면 이어서 판정한다", async (t) => {
  const output = captureOutput(t);
  const { gh } = fakeGh(REPO, apiError(), apiError(), vercel("success"));

  assert.equal(await main(["abc123"], { gh, sleep: noSleep }), 0);
  assert.equal(output.out.at(-1), `DEPLOY_RESULT result=success url=${URL}`);
});

test("상태 조회가 3회 연속 실패 → API_ERROR", async (t) => {
  const output = captureOutput(t);
  const { gh } = fakeGh(REPO, apiError(), apiError(), apiError());

  assert.equal(await main(["abc123"], { gh, sleep: noSleep }), 1);
  assert.equal(output.out.at(-1), "DEPLOY_RESULT result=API_ERROR");
});

for (const responses of [
  ["not json"],
  [json({ message: "Not Found" })],
  [json([{ context: "Vercel", state: "queued" }])],
  [NONE, "{}"],
]) {
  test(`형식이 다른 응답 ${JSON.stringify(responses)} → ERROR`, async (t) => {
    const output = captureOutput(t);
    const { gh } = fakeGh(REPO, ...responses);

    assert.equal(await main(["abc123"], { gh, sleep: noSleep }), 1);
    assert.equal(output.out.at(-1), "DEPLOY_RESULT result=ERROR");
  });
}

test("gh가 없으면 → ERROR", async (t) => {
  const output = captureOutput(t);
  const { gh } = fakeGh(ghMissing());

  assert.equal(await main(["abc123"], { gh, sleep: noSleep }), 1);
  assert.equal(output.out.at(-1), "DEPLOY_RESULT result=ERROR");
});

test("인자가 없으면 → usage", async (t) => {
  const output = captureOutput(t);

  assert.equal(await main([]), 2);
  assert.match(output.err.join("\n"), /usage/);
});
