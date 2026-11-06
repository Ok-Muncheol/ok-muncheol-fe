// Actions 워크플로우 run 대기 — 특정 커밋이 트리거한 run의 완료를 폴링한다 (30초 간격).
// main 머지 커밋의 CI(ci.yml) 대기에 쓴다.
//
// run이 한 번도 발견되지 않은 채 타임아웃되면 NOT_FOUND로 구분한다 — 워크플로우 미트리거
// (트리거 조건·파일명 변경 등) 신호이므로, 진행 중일 수 있는 TIMEOUT과 다르게 처리한다.
// Node 표준 라이브러리와 gh만 쓴다 — bash·jq가 없는 Windows(PowerShell)에서도 같은 명령으로 돈다.
//
// 사용법: node automation/bin/run-wait.mjs <워크플로우파일> <브랜치> <커밋SHA> <타임아웃초>
//   예: run-wait.mjs ci.yml main "$MERGE_SHA" 600
// 종료 마커: RUN_RESULT result=success|<conclusion>|NOT_FOUND|TIMEOUT|API_ERROR|ERROR
//   완료 시 run_id=<id>가 함께 찍힌다 — 실패면 gh run view <id> --log-failed로 로그를 요약한다.
//   ERROR = gh 부재·run 목록 형식 이상·예상 못 한 예외 (fail-closed)

import { setTimeout as wait } from "node:timers/promises";

import { GhFailed, runGh, runIfMain } from "./cli.mjs";

const INTERVAL_MS = 30_000;
const MAX_API_ERRORS = 3;

// `gh run list --json status,conclusion,databaseId` 출력의 첫 run. 없으면 null, 형식이 다르면 TypeError
export function latestRun(out) {
  const runs = JSON.parse(out);
  if (!Array.isArray(runs)) throw new TypeError("run 목록이 배열이 아니다");
  if (runs.length === 0) return null;
  const { status, conclusion, databaseId } = runs[0];
  if (status === undefined || conclusion === undefined || databaseId === undefined) {
    throw new TypeError("status·conclusion·databaseId가 없다");
  }
  return { status, conclusion: conclusion || "unknown", id: databaseId };
}

export async function main(argv, { gh = runGh, sleep = wait } = {}) {
  if (argv.length !== 4 || !/^\d+$/.test(argv[3])) {
    console.error("usage: run-wait.mjs <워크플로우파일> <브랜치> <커밋SHA> <타임아웃초>");
    return 2;
  }
  const [workflow, branch, sha, limit] = argv;
  const deadline = performance.now() + Number(limit) * 1000;
  let apiErrors = 0;
  let found = false;
  for (;;) {
    let out;
    try {
      out = gh([
        "run", "list", "--branch", branch, "--workflow", workflow, "--commit", sha,
        "--limit", "1", "--json", "status,conclusion,databaseId",
      ]);
    } catch (error) {
      if (!(error instanceof GhFailed)) {
        console.log(`gh를 실행할 수 없다 — run 상태 조회에 필요하다 (${error.message})`);
        console.log("RUN_RESULT result=ERROR");
        return 1;
      }
      // GitHub 조회 실패를 pending으로 삼키지 않는다 — 3회 연속 실패 시 API_ERROR로 종료.
      apiErrors += 1;
      console.log(`GitHub API query failed (${apiErrors}/${MAX_API_ERRORS})`);
      if (apiErrors >= MAX_API_ERRORS) {
        console.log("RUN_RESULT result=API_ERROR");
        return 1;
      }
      await sleep(INTERVAL_MS);
      continue;
    }
    apiErrors = 0;
    let run;
    try {
      run = latestRun(out);
    } catch {
      // 형식이 다르면 조용히 TIMEOUT까지 돌지 않고 즉시 끝낸다.
      console.log(`run 목록 형식이 다르다: ${JSON.stringify(out.slice(0, 200))}`);
      console.log("RUN_RESULT result=ERROR");
      return 1;
    }
    if (run !== null) {
      found = true;
      if (run.status === "completed") {
        console.log(`RUN_RESULT result=${run.conclusion} run_id=${run.id}`);
        return run.conclusion === "success" ? 0 : 1;
      }
    }
    if (performance.now() >= deadline) {
      console.log(`RUN_RESULT result=${found ? "TIMEOUT" : "NOT_FOUND"}`);
      return 1;
    }
    await sleep(INTERVAL_MS);
  }
}

await runIfMain(import.meta.url, main, "RUN_RESULT");
