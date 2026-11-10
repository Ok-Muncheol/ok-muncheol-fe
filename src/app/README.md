# 구준휘 통합 — App Router 구성

아래 경로는 골격으로 만들어 두었고, `/cases`·`/cases/[id]`에는 사건 보드·상세를, `/cases/[id]/judgment`에는 판단 화면 초안을 붙였다(합성 견본 — 아래 참고). 담당자가 자기 컴포넌트를 연결해 채운다.
동적 경로의 `params`는 Promise다 — `PageProps<"/cases/[id]">`(`next typegen`이 만드는 전역 타입)로 받아 `await`한다.

| 경로 | 담당 | 연결 기능 |
| --- | --- | --- |
| `/login` | 구준휘 통합·정지원 인증 | Supabase 로그인 |
| `/cases` | 구준휘 | 담당 사건 보드 — 요약 수치·단계별 열(`src/features/cases/case-board.tsx`, 규칙은 `src/lib/cases/stages.ts`) |
| `/cases/new` | 정지원 | 접수·영상/수동 입력 |
| `/cases/[id]` | 구준휘 | 단계 표시·현재 상태·요약, 현재 단계 화면으로 이동 |
| `/cases/[id]/facts` | 정지원·구준휘 | 영상/카드·확인 질문·확정 |
| `/cases/[id]/judgment` | 구준휘 | 판단 진행(그래프 9단계)·실패·구분 질문·판정(`src/features/judgment/`, 규칙은 `src/lib/judgment/view.ts`) |
| `/cases/[id]/reports/[version]` | 옥석현·구준휘·김지은 | 보고서·검증·근거·버전/승인 |
| 사건 내 QA/산정/구상 영역 | 구준휘·옥석현·김지은 | 1차 확장, 별도 라우트 여부 합의 |
| `/dev` | 전원, 김지은 근거 미리보기 | 비식별 견본·개발 전용. Vercel 운영 배포(`VERCEL_ENV=production`)에서는 404 |

구준휘: layout/page·공통 UI·API/오류·사건 보드/상세·질문/판단 상태 연결, 정지원: 인증/업로드/조회 복원, 김지은: 근거 표시.
사건 보드·상세는 `src/features/cases/case-source.ts`에서 읽는다 — 지금은 `src/fixtures/case-board.json` 합성 견본이고 운영 배포에서는 비어 있다. BE `GET /cases`가 생기면 여기만 바꾼다.
판단 화면은 `src/features/judgment/judgment-source.ts`에서 판단 실행·사실 카드를 읽는다(`src/fixtures/judgment.json`, 판단 단계 사건만). 구분 질문 답변·다시 시작은 API 연결 전이라 보내지 않고 보낼 값만 보여 준다.
프레임/원문은 권한 있는 URL로만 연다. 비공개 파일 경로를 임의 공개 URL로 바꾸지 않는다.
`/dev/...` 아래에 미리보기 페이지를 더하면 같은 운영 차단(`notFound()`)을 페이지마다 둔다.
