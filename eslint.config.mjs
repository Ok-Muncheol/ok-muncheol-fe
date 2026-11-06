import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  // .claude/worktrees는 Claude Code worktree(같은 저장소의 다른 체크아웃, .gitignore 대상)라 그 안에서 따로 검사한다.
  globalIgnores([".next/**", "out/**", "next-env.d.ts", ".claude/worktrees/**"]),
]);
