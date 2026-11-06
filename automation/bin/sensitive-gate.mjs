// 민감 파일 커밋 게이트 — 스테이징된 파일에 비밀·키·로컬 설정이 없는지 검사한다.
// 반드시 git add(스테이징) 후에 실행한다 — add 이전 검사로는 untracked였던 민감 파일이 잡히지 않는다.
//
// 이 정규식이 민감 파일 패턴의 단일 원천이다. automation/pipeline.md 「민감 파일 커밋 금지」의
// 목록과 automation/hooks/validate-git-sensitive.sh(Claude Code·Codex 훅 이중 방어)의 배열은
// 이 정규식을 따라간다 — 패턴 변경은 여기서 하고 둘을 같이 갱신한다.
// 게이트는 fail-closed다 — git 조회가 실패하면 통과가 아니라 ERROR로 종료한다.
// Node 표준 라이브러리와 git만 쓴다 — bash가 없는 Windows(PowerShell)에서도 같은 명령으로 돈다.
//
// 사용법: node automation/bin/sensitive-gate.mjs
// 종료 마커: SENSITIVE_GATE result=PASS|BLOCKED|ERROR
//   BLOCKED(종료코드 1)면 출력된 파일을 git reset HEAD <파일>로 해제하고 사용자에게 보고한다.

import { spawnSync } from "node:child_process";

import { runIfMain } from "./cli.mjs";

export const SENSITIVE = new RegExp(
  [
    String.raw`(^|/)\.env(\..+)?$`,
    String.raw`(^|/)\.claude/settings\.local\.json$`,
    String.raw`(^|/)\.mcp\.json$`,
    String.raw`(^|/)\.vercel/`,
    String.raw`(^|/)certs/`,
    String.raw`\.(pem|p12|p8|key)$`,
    String.raw`firebase-adminsdk[^/]*\.json$`,
    String.raw`(^|/)id_rsa[^/]*$`,
  ].join("|"),
);

// *.example은 플레이스홀더 템플릿이라 커밋 허용 (.gitignore의 !.env.example과 정합)
export const blocked = (paths) =>
  paths.filter((path) => SENSITIVE.test(path) && !path.endsWith(".example"));

export function main() {
  // -z로 받는다 — 기본 출력은 한글 경로를 "\353\271…"처럼 따옴표로 감싸 정규식을 빠져나간다.
  const git = spawnSync("git", ["diff", "--cached", "--name-only", "-z"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  });
  if (git.error || git.status !== 0) {
    console.log("SENSITIVE_GATE result=ERROR");
    return 1;
  }
  const matches = blocked(git.stdout.split("\0").filter(Boolean));
  if (matches.length > 0) {
    console.log("차단된 민감 파일:");
    for (const path of matches) console.log(`  ${path}`);
    console.log("SENSITIVE_GATE result=BLOCKED");
    return 1;
  }
  console.log("SENSITIVE_GATE result=PASS");
  return 0;
}

await runIfMain(import.meta.url, main, "SENSITIVE_GATE");
