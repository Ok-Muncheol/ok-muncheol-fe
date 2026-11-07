# AGENTS.md

Codex·Claude Code 같은 AI 에이전트가 이 저장소에서 작업할 때 지키는 규칙이다. 자세한 설명은 [README](README.md)·[TEAM.md](TEAM.md)에 있고, 여기에는 매번 지켜야 할 것만 적는다.
아래 `nextjs-agent-rules` 블록은 `next dev`가 관리하므로 고치지 않는다.

## 디자인 시스템: 청람

보상 담당자가 데스크톱에서 하루 종일 쓰는 업무 화면이다. 토큰과 클래스 표는 README 「디자인 시스템: 청람」에, 공통 컨트롤은 `src/ui/controls.tsx`에 있다. `/dev`에서 한 화면으로 본다.

- 색은 토큰 클래스(`bg-surface`, `text-ink`, `border-line` 등)만 쓴다. `bg-[#…]` 같은 임의 색 값이나 `style` 속성으로 색을 넣지 않는다. 그런 색은 다크 모드에서 그대로 남는다.
- Tailwind 기본 팔레트는 지웠다. `bg-gray-100`·`text-blue-600` 같은 클래스는 에러 없이 무시되고 색이 칠해지지 않는다. 영상 프레임 위 오버레이용 `white`·`black`만 남아 있다.
- 주요 색은 밝은 옥색이다. `bg-primary`(면) 위 글자는 `text-on-primary`이고, 바탕 위 옥색 글자·선(링크·quiet 버튼·현재 메뉴 표시)은 `text-primary-strong`·`border-primary-strong`을 쓴다. `text-primary`·`border-primary`를 바탕 위에 쓰면 대비가 1.9:1뿐이라 읽히지 않는다.
- 상태 색은 뜻으로 고른다. `Badge`·`Notice`의 톤은 neutral(대기·초안) · info(처리 중·초안 작성 가능) · success(완료·확정·승인) · warning(확인 대기·추가 확인 필요·보류) · danger(실패·충돌) · model(모델 원값·확신도)이다. 작업 진행과 판정 결과는 `src/components/status-label.tsx`로 표시하고, 톤을 바꾸려면 거기서 바꾼다.
- 모델이 낸 값에만 model 톤을 쓴다. 담당자가 고친 값은 ink, 확인한 값은 success다. 미확정 비율·금액은 `Empty`로 비워 두고 0이나 빈 문자열로 채우지 않는다.
- 버튼·입력·표·카드·이름값 목록은 `src/ui/controls.tsx`의 컨트롤을 먼저 쓴다. 없는 컨트롤이 필요하면 담당 폴더에 만들지 말고 통합 담당(구준휘)과 맞춰 여기에 더한다.
- 반경·글자 크기·글꼴도 README 표의 토큰(`rounded-card`, `text-body`, `font-mono` 등)을 먼저 쓴다. 사건 ID·금액·버전·비율은 `font-mono tabular-nums`다.
- 색 토큰을 추가하면 `src/app/globals.css`의 두 색 세트(라이트·다크)에 모두 값을 넣는다. 글자는 4.5:1, 표시선과 컨트롤 테두리·상태 점은 3:1 대비를 넘겨야 한다.
- 새 화면은 라이트·다크 둘 다 확인한다. 다크는 개발자 도구 Rendering 패널에서 `prefers-color-scheme: dark`를 켜서 본다. 데스크톱(1280px) 배치를 먼저 맞추고 좁은 화면(360px)에서도 확인·저장이 되게 한다.
- 키보드 초점 고리는 `globals.css`가 모든 컨트롤에 같은 모양으로 둔다. `outline-none`으로 지우지 않는다.

## 검증과 배포

- 변경을 마치면 `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`를 통과시킨다. CI도 같은 명령을 돌린다.
- main에 올릴 때는 ship 하네스를 쓴다. Codex는 `$ship`, Claude Code는 `/ship`이다. 브랜치·PR 규칙은 README 「브랜치·PR 규칙」에 있다.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
