import type { NextConfig } from "next";

// next dev를 AI 에이전트(Claude Code·Codex 등) 안에서 돌리면 AGENTS.md에 Next 16 번들 문서 안내 블록을 넣는다
// (agentRules, 기본 켜짐). 그 블록을 커밋해 두어 팀원 작업 트리에 변경이 생기지 않게 한다 — 블록은 next dev가
// 관리하므로 고치지 않는다. 직접 쓴 내용을 AGENTS.md에 더해도 블록 밖은 그대로 둔다.
// 개발 서버 화면 왼쪽 아래의 Next 표시(N)는 시연 화면에 보이지 않게 끈다.
const nextConfig: NextConfig = { devIndicators: false };

export default nextConfig;
