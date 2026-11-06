// automation/bin 스크립트 공용 — gh 실행과 진입점 처리. Node 표준 라이브러리만 쓴다.
import { spawnSync } from "node:child_process";
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

// gh가 0이 아닌 코드로 끝났다 — GitHub 조회 실패로 센다 (API_ERROR 후보)
export class GhFailed extends Error {}

// gh를 실행해 stdout을 돌려준다. gh를 실행할 수 없으면(설치 안 됨 등) spawn 에러를 그대로 던진다.
// stderr는 가로채지 않는다 — 로그에 남아야 API_ERROR를 보고할 때 실제 원인을 요약할 수 있다.
export function runGh(args) {
  const result = spawnSync("gh", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new GhFailed(`gh ${args.join(" ")} → exit ${result.status}`);
  return result.stdout;
}

function isEntry(moduleUrl) {
  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(moduleUrl));
  } catch {
    return false;
  }
}

// `node <스크립트>`로 직접 실행됐을 때만 main을 돌린다 — 테스트가 import할 때는 돌지 않는다.
// 예상 못 한 예외도 마커 없이 끝나지 않게 `<marker> result=ERROR`로 끝낸다 (fail-closed).
export async function runIfMain(moduleUrl, main, marker) {
  if (!isEntry(moduleUrl)) return;
  try {
    process.exitCode = await main(process.argv.slice(2));
  } catch (error) {
    console.error(error);
    console.log(`${marker} result=ERROR`);
    process.exitCode = 1;
  }
}
