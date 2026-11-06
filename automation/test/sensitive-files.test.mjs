// 민감 파일 커밋 차단을 확인한다 — 파이프라인 게이트(sensitive-gate.mjs)와 하네스 훅.
//
// 스크래치 리포에서 돌려 사용자 리포의 인덱스·워킹트리와 전역 git 설정을 건드리지 않는다.
// 게이트는 `node <스크립트>`로 실제 실행해 마커와 종료코드를 본다. 훅(validate-git-sensitive.sh)에는
// Claude Code·Codex가 주는 stdin JSON을 그대로 흘린다. 훅은 bash·jq로 도는 macOS·Linux 하네스용이라
// Windows와 bash·jq가 없는 환경에서는 건너뛴다.
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { devNull, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const GATE = fileURLToPath(new URL("../bin/sensitive-gate.mjs", import.meta.url));
const HOOK = fileURLToPath(new URL("../hooks/validate-git-sensitive.sh", import.meta.url));
const GIT_ENV = { ...process.env, GIT_CONFIG_GLOBAL: devNull, GIT_CONFIG_NOSYSTEM: "1" };

const hasTool = (command) => spawnSync(command, ["--version"], { stdio: "ignore" }).status === 0;
const skipHook =
  process.platform === "win32" || !hasTool("bash") || !hasTool("jq")
    ? "훅은 bash·jq로 도는 macOS·Linux 하네스용이다"
    : false;

function scratchRepo(t) {
  const dir = mkdtempSync(join(tmpdir(), "ship-gate-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const git = (...args) => execFileSync("git", args, { cwd: dir, env: GIT_ENV, stdio: "pipe" });
  const write = (path, text = "secret\n") => {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), text);
  };
  git("init", "-q");
  write("note.txt", "hi\n");
  git("add", "note.txt");
  git("-c", "user.email=smoke@test", "-c", "user.name=smoke", "commit", "-qm", "init");
  return {
    dir,
    write,
    stage: (path) => {
      write(path);
      git("add", "-f", path);
    },
  };
}

function gate(repo, env = GIT_ENV) {
  const done = spawnSync(process.execPath, [GATE], { cwd: repo.dir, env, encoding: "utf8" });
  return [done.status, done.stdout.trim().split("\n")];
}

// 훅에 하네스 stdin JSON을 흘려 deny/pass를 받는다. 훅은 판정과 상관없이 0으로 끝나야 한다.
function decide(repo, command) {
  const input = JSON.stringify({ tool_name: "Bash", tool_input: { command } });
  const done = spawnSync("bash", [HOOK], { cwd: repo.dir, env: GIT_ENV, input, encoding: "utf8" });
  assert.equal(done.status, 0, done.stderr);
  if (!done.stdout.trim()) return "pass";
  return JSON.parse(done.stdout).hookSpecificOutput.permissionDecision;
}

test("게이트: 민감 파일 없음 → PASS", (t) => {
  const repo = scratchRepo(t);
  repo.stage("src/app/page.tsx");

  assert.deepEqual(gate(repo), [0, ["SENSITIVE_GATE result=PASS"]]);
});

for (const path of [
  ".env.local",
  ".env",
  "AuthKey_test.p8",
  ".vercel/project.json",
  "certs/dev.crt",
  ".claude/settings.local.json",
  ".mcp.json",
  "firebase-adminsdk-abc.json",
  "keys/id_rsa",
  // 한글 경로도 그대로 받는다 — git 기본 출력은 경로를 따옴표·8진수로 바꿔 정규식을 빠져나간다
  "비밀/.env.local",
]) {
  test(`게이트: ${path} 스테이징 → BLOCKED`, (t) => {
    const repo = scratchRepo(t);
    repo.stage(path);

    assert.deepEqual(gate(repo), [
      1,
      ["차단된 민감 파일:", `  ${path}`, "SENSITIVE_GATE result=BLOCKED"],
    ]);
  });
}

test("게이트: .env.example 스테이징 → PASS (템플릿 예외)", (t) => {
  const repo = scratchRepo(t);
  repo.stage(".env.example");

  assert.deepEqual(gate(repo), [0, ["SENSITIVE_GATE result=PASS"]]);
});

test("게이트: git 실패 → ERROR (fail-closed)", (t) => {
  const repo = scratchRepo(t);

  const [status, lines] = gate(repo, { ...GIT_ENV, GIT_DIR: join(repo.dir, "missing") });
  assert.equal(status, 1);
  assert.equal(lines.at(-1), "SENSITIVE_GATE result=ERROR");
});

// 스크래치 리포에 .env.local·.vercel/이 untracked로 있다
for (const [command, want] of [
  ["npm run build", "pass"], // git 외 명령
  ["git status --short", "pass"],
  ["git add .env.local", "deny"],
  ["git add .vercel/project.json", "deny"],
  ["git add -A && git commit -m x", "deny"], // 광역 add가 untracked 민감 파일을 끌어들인다
  ["git add note.txt", "pass"],
  ["git commit -m 'x'", "pass"], // 스테이징된 민감 파일이 없다
]) {
  test(`훅: ${command} → ${want}`, { skip: skipHook }, (t) => {
    const repo = scratchRepo(t);
    repo.write(".env.local");
    repo.write(".vercel/project.json", "{}\n");

    assert.equal(decide(repo, command), want);
  });
}

test("훅: .env.local 스테이징 상태의 git commit → deny", { skip: skipHook }, (t) => {
  const repo = scratchRepo(t);
  repo.stage(".env.local");

  assert.equal(decide(repo, "git commit -m 'x'"), "deny");
});

// .gitignore가 막는 민감 파일을 -f로 끌어들이는 경로 — 명시 인자 파싱이 광역 판정으로 새지 않아야
// 잡힌다 (macOS sed는 \b를 몰라 원본 훅의 파싱이 광역 판정으로 떨어졌다 — 회귀 방지)
for (const [command, want] of [
  ["git add -f .env.local", "deny"],
  ["git add -A -f", "deny"], // 광역 + 강제는 ignored 파일까지 스테이징한다
  ["git add .", "pass"], // git도 ignored 파일은 add하지 않는다
  ["git add -f note.txt", "pass"], // 강제지만 명시·비민감
  ["git add -- .env.local", "deny"],
]) {
  test(`훅(ignored .env.local): ${command} → ${want}`, { skip: skipHook }, (t) => {
    const repo = scratchRepo(t);
    repo.write(".gitignore", ".env*\n");
    repo.write(".env.local");

    assert.equal(decide(repo, command), want);
  });
}
