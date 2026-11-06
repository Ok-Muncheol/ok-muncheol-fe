// Vercel 프로덕션 배포 대기 — main 머지 커밋의 커밋 상태(context `Vercel`)를 폴링한다 (30초 간격, 최대 10분).
// Vercel Git 연동은 배포 결과를 커밋 상태로 남긴다 — pending "Vercel is deploying your app" → success "Deployment
// has completed". GitHub Deployment는 보지 않는다: Vercel 프로젝트 설정에 따라 생기지 않을 수 있다(lumi BE·FE
// 0건, 2026-10-27 실측). 커밋 상태는 연동된 저장소에 항상 붙는다. 판정은 BE의 automation/bin/deploy_wait.py와 같다.
//
// 상태는 컨텍스트 `Vercel`의 최신 1건으로 판정한다 — 같은 컨텍스트에 새 상태가 오면 그것이 현재 값이다.
// 연결 여부도 여기서 판정한다. 머지 커밋에 `Vercel` 상태가 GRACE_SECONDS 안에 생기지 않으면 직전 main 커밋
// (첫 부모)으로 가른다 — 거기엔 있으면 NOT_FOUND(연동은 살아 있는데 이 커밋이 배포되지 않았다), 거기도
// 없으면 NOT_CONNECTED(Vercel 미연결 — 확인할 배포가 없으므로 종료코드 0). Vercel은 push 직후 pending을
// 남기므로, main CI를 기다린 뒤(pipeline.md Step 2) 도는 이 스크립트에서 2분이면 넉넉하다. 배포를 연결하기
// 전(README 「기술 구성」)에는 NOT_CONNECTED로 끝난다.
// Node 표준 라이브러리와 gh만 쓴다 — bash·jq가 없는 Windows(PowerShell)에서도 같은 명령으로 돈다.
//
// 사용법: node automation/bin/deploy-wait.mjs <머지커밋SHA>
// 종료 마커: DEPLOY_RESULT result=success|failure|error|NOT_CONNECTED|NOT_FOUND|TIMEOUT|API_ERROR|ERROR
//   상태를 봤으면 url=<Vercel 배포 페이지>가 함께 찍힌다 — 실패·TIMEOUT이면 거기서 로그를 본다.
//   소문자 error는 Vercel 배포 상태다. 대문자 ERROR = gh 부재·응답 형식 이상·예상 못 한 예외 (fail-closed).

import { setTimeout as wait } from "node:timers/promises";

import { GhFailed, runGh, runIfMain } from "./cli.mjs";

const CONTEXT = "Vercel";
const INTERVAL_MS = 30_000;
const LIMIT_SECONDS = 600;
const GRACE_SECONDS = 120;
const MAX_API_ERRORS = 3;
// 종료 상태별 종료코드. 그 밖의 상태는 pending(진행 중)뿐이다
const DONE = { success: 0, failure: 1, error: 1 };

function nameWithOwner(out) {
  const { nameWithOwner } = JSON.parse(out);
  if (typeof nameWithOwner !== "string") throw new TypeError("nameWithOwner가 없다");
  return nameWithOwner;
}

// `gh api …/commits/<sha>/statuses` 응답(최신순)에서 `Vercel`의 최신 상태. 없으면 null
function vercelStatus(out) {
  const statuses = JSON.parse(out);
  if (!Array.isArray(statuses)) throw new TypeError("statuses 응답이 배열이 아니다");
  const status = statuses.find((item) => item.context === CONTEXT);
  if (status === undefined) return null;
  if (!Object.hasOwn(DONE, status.state) && status.state !== "pending") {
    throw new TypeError(`알 수 없는 커밋 상태 ${status.state}`);
  }
  return { state: status.state, url: status.target_url };
}

// `gh api …/git/commits/<sha>` 응답의 첫 부모 SHA. 부모가 없으면(루트 커밋) null
function firstParent(out) {
  const { parents } = JSON.parse(out);
  if (!Array.isArray(parents)) throw new TypeError("parents가 배열이 아니다");
  return parents[0]?.sha ?? null;
}

function finish(result, url, code) {
  console.log(`DEPLOY_RESULT result=${result}${url ? ` url=${url}` : ""}`);
  return code;
}

// gh를 실행할 수 없거나 응답 형식이 다르면 재시도해도 소용없는 실행 환경 문제다 (fail-closed)
function environmentError(error) {
  console.log(`gh 응답을 쓸 수 없다 — ${error.message}`);
  console.log("DEPLOY_RESULT result=ERROR");
  return 1;
}

export async function main(
  argv,
  { gh = runGh, sleep = wait, limitSeconds = LIMIT_SECONDS, graceSeconds = GRACE_SECONDS } = {},
) {
  if (argv.length !== 1) {
    console.error("usage: deploy-wait.mjs <머지커밋SHA>");
    return 2;
  }
  const [sha] = argv;
  const start = performance.now();
  const deadline = start + limitSeconds * 1000;
  const graceEnd = start + graceSeconds * 1000;
  let repo;
  try {
    repo = nameWithOwner(gh(["repo", "view", "--json", "nameWithOwner"]));
  } catch (error) {
    if (!(error instanceof GhFailed)) return environmentError(error);
    console.log("DEPLOY_RESULT result=API_ERROR");
    return 1;
  }
  const statusOf = (ref) =>
    vercelStatus(gh(["api", `repos/${repo}/commits/${ref}/statuses?per_page=100`]));
  let apiErrors = 0;
  let status = null;
  // 직전 main 커밋에 `Vercel` 상태가 있었나 — 머지 커밋에 상태가 없을 때 한 번만 본다
  let parentDeployed = null;
  for (;;) {
    let queried = false;
    try {
      status = statusOf(sha);
      if (status === null && parentDeployed === null) {
        const parent = firstParent(gh(["api", `repos/${repo}/git/commits/${sha}`]));
        parentDeployed = parent !== null && statusOf(parent) !== null;
      }
      apiErrors = 0;
      queried = true;
    } catch (error) {
      if (!(error instanceof GhFailed)) return environmentError(error);
      // GitHub 조회 실패를 pending으로 삼키지 않는다 — 3회 연속 실패 시 API_ERROR로 종료.
      apiErrors += 1;
      console.log(`GitHub API query failed (${apiErrors}/${MAX_API_ERRORS})`);
      if (apiErrors >= MAX_API_ERRORS) {
        console.log("DEPLOY_RESULT result=API_ERROR");
        return 1;
      }
    }
    if (queried && status !== null && Object.hasOwn(DONE, status.state)) {
      return finish(status.state, status.url, DONE[status.state]);
    }
    if (queried && status === null && performance.now() >= graceEnd) {
      return parentDeployed ? finish("NOT_FOUND", null, 1) : finish("NOT_CONNECTED", null, 0);
    }
    if (performance.now() >= deadline) return finish("TIMEOUT", status?.url, 1);
    await sleep(INTERVAL_MS);
  }
}

await runIfMain(import.meta.url, main, "DEPLOY_RESULT");
