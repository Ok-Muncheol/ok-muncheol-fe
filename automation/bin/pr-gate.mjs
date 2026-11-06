// PR 게이트 폴링 — PR의 체크가 전부 성공하고 머지 가능해질 때까지 대기한다 (30초 간격).
//
// 게이트 = mergeable MERGEABLE
//        + 앵커 체크 존재 (체크 등록 전 공집합 통과(vacuous pass) 방지)
//        + 비차단 예외를 제외한 모든 체크가 완료·성공 (실패 0, 대기 0, 체크 1개 이상)
// 체크를 이름 허용목록으로 고르지 않는다 — 잡이 추가·개명돼도 게이트가 자동으로 따라간다.
// 앵커를 하나도 주지 않으면 「CI가 없는 레포」 모드다 — 체크 존재를 요구하지 않고 mergeable만 본다
// (워크플로우가 없는 레포용. 이 레포는 CI가 있으므로 반드시 앵커 check·gitleaks를 넘긴다).
// 판정 로직·비차단 예외 목록의 원천은 judge()·EXEMPT다 (automation/test/pr-gate.test.mjs가
// fixture로 검증한다).
//
// Node 표준 라이브러리와 gh만 쓴다 — bash·jq가 없는 Windows(PowerShell)에서도 같은 명령으로 돈다.
//
// 사용법: node automation/bin/pr-gate.mjs <PR번호> <타임아웃초> [앵커 체크명...]
//   CI 있음: pr-gate.mjs <번호> 600 check
//   CI 없음: pr-gate.mjs <번호> 180
// 종료 마커: PR_GATE_DONE result=PASS|FAIL...|TIMEOUT...|API_ERROR|ERROR
//   ERROR = gh 부재·판정 입력 이상·예상 못 한 예외 (fail-closed — TIMEOUT까지 기다리지 않고 즉시 종료)

import { setTimeout as wait } from "node:timers/promises";

import { GhFailed, runGh, runIfMain } from "./cli.mjs";

const INTERVAL_MS = 30_000;
const MAX_API_ERRORS = 3;

// 비차단 예외 체크 — 게이트에서 제외할 이름. 현재 없음: 생기면 여기에만 추가한다.
export const EXEMPT = new Set();

// CheckRun은 name, commit status(StatusContext)는 context에 이름이 있다
const checkName = (check) => check.name || check.context || "";

// CheckRun(.conclusion)과 commit status(.state)를 PASS/PENDING/FAIL로 정규화한다 (NEUTRAL·SKIPPED는 통과)
function checkState(check) {
  if (check.__typename === "StatusContext") {
    if (check.state === "SUCCESS") return "PASS";
    return check.state === "PENDING" || check.state === "EXPECTED" ? "PENDING" : "FAIL";
  }
  if (check.status !== "COMPLETED") return "PENDING";
  return ["SUCCESS", "NEUTRAL", "SKIPPED"].includes(check.conclusion) ? "PASS" : "FAIL";
}

// `gh pr view --json mergeable,statusCheckRollup` 출력을 "PASS" | "FAIL …" | "PENDING …" 한 줄로
// 판정한다. 앵커가 하나라도 있으면 앵커 존재 + 체크 1개 이상 + 전수 성공이 필수다. 앵커가 없으면
// (CI 없는 레포) 체크 존재를 요구하지 않고 mergeable + (있다면) 전수 성공만 본다.
// 입력 형식이 다르면 TypeError를 던진다.
export function judge(view, anchors) {
  if (!("mergeable" in view && "statusCheckRollup" in view)) {
    throw new TypeError("mergeable·statusCheckRollup이 없다");
  }
  const { mergeable } = view;
  const rollup = view.statusCheckRollup ?? [];
  if (!Array.isArray(rollup) || rollup.some((c) => c === null || typeof c !== "object")) {
    throw new TypeError("statusCheckRollup 형식이 다르다");
  }
  // 게이트 대상 = 비차단 예외를 뺀 모든 체크. 이름을 고르는 게 아니라 실패 0을 요구한다.
  const checks = rollup.filter((c) => !EXEMPT.has(checkName(c)));
  const failed = checks.filter((c) => checkState(c) === "FAIL").map(checkName);
  const pending = checks.filter((c) => checkState(c) === "PENDING").map(checkName);
  // 앵커 체크는 존재 자체가 필수 — 체크 등록 전 공집합 통과(vacuous pass)를 막는다.
  const names = new Set(checks.map(checkName));
  const absent = anchors.filter((a) => !names.has(a));
  if (failed.length > 0 || mergeable === "CONFLICTING") {
    return `FAIL failed=${failed.join(",")} mergeable=${mergeable}`;
  }
  const settled = absent.length === 0 && pending.length === 0;
  if (mergeable === "MERGEABLE" && settled && (checks.length > 0 || anchors.length === 0)) {
    return "PASS";
  }
  return `PENDING anchors_absent=${absent.join(",")} pending=${pending.join(",")} mergeable=${mergeable}`;
}

export async function main(argv, { gh = runGh, sleep = wait } = {}) {
  const [pr, limit, ...anchors] = argv;
  if (pr === undefined || !/^\d+$/.test(limit ?? "")) {
    console.error("usage: pr-gate.mjs <PR번호> <타임아웃초> [앵커 체크명...]");
    return 2;
  }
  const deadline = performance.now() + Number(limit) * 1000;
  let apiErrors = 0;
  for (;;) {
    let out;
    try {
      out = gh(["pr", "view", pr, "--json", "mergeable,statusCheckRollup"]);
    } catch (error) {
      if (!(error instanceof GhFailed)) {
        console.log(`gh를 실행할 수 없다 — PR 상태 조회에 필요하다 (${error.message})`);
        console.log("PR_GATE_DONE result=ERROR");
        return 1;
      }
      // GitHub 조회 실패를 pending으로 삼키지 않는다 — 3회 연속 실패 시 API_ERROR로 종료.
      apiErrors += 1;
      console.log(`GitHub API query failed (${apiErrors}/${MAX_API_ERRORS})`);
      if (apiErrors >= MAX_API_ERRORS) {
        console.log("PR_GATE_DONE result=API_ERROR");
        return 1;
      }
      await sleep(INTERVAL_MS);
      continue;
    }
    apiErrors = 0;
    let result;
    try {
      result = judge(JSON.parse(out), anchors);
    } catch {
      // 판정 입력이 비었거나 형식이 다르면 조용히 TIMEOUT까지 돌지 않고 즉시 끝낸다.
      console.log(`판정 입력이 비었거나 형식이 다르다: ${JSON.stringify(out.slice(0, 200))}`);
      console.log("PR_GATE_DONE result=ERROR");
      return 1;
    }
    if (result === "PASS") {
      console.log("PR_GATE_DONE result=PASS");
      return 0;
    }
    if (result.startsWith("FAIL")) {
      console.log(`PR_GATE_DONE result=${result}`);
      return 1;
    }
    if (performance.now() >= deadline) {
      console.log(`PR_GATE_DONE result=TIMEOUT ${result}`);
      return 1;
    }
    await sleep(INTERVAL_MS);
  }
}

await runIfMain(import.meta.url, main, "PR_GATE_DONE");
