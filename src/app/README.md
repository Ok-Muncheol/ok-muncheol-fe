# 구준휘 통합 — App Router 구성

아래 경로는 골격으로 만들어 두었고, `/cases`·`/cases/[id]`에는 사건 보드·상세를, `/cases/[id]/judgment`에는 판단 화면 초안(사실 카드 화면을 합쳤다)을, `/cases/[id]/reports/[version]`에는 오른쪽 근거 질의응답을 붙였다(합성 견본 — 아래 참고. 보고서 본문은 옥석현 연결 전). 담당자가 자기 컴포넌트를 연결해 채운다.
동적 경로의 `params`는 Promise다 — `PageProps<"/cases/[id]">`(`next typegen`이 만드는 전역 타입)로 받아 `await`한다.

| 경로 | 담당 | 연결 기능 |
| --- | --- | --- |
| `/login` | 구준휘 통합·정지원 인증 | Supabase 로그인 |
| `/cases` | 구준휘 | 담당 사건 — 요약 수치와 사건마다 한 줄인 보드(`case-board.tsx`, 공통 `LaneTable`). 왼쪽 칸은 사건(고정·ID·접수 시각), 카드는 세 열(접수·판단·검토 보고서 — 단계를 묶은 `BOARD_COLUMNS`) 중 그 사건의 열 칸에 놓인다. 규칙은 `src/lib/cases/stages.ts`·`pins.ts` |
| `/cases/new` | 정지원 | 접수·영상/수동 입력. 주 메뉴에는 두지 않는다 — 사건은 담당자에게 배정돼 들어온다 |
| `/cases/[id]` | 구준휘 | 현재 상태·요약. 이 화면과 판단·검토 보고서 화면 맨 위에 진행 단계 한 줄(`case-stepper.tsx` — 접수·판단·검토 보고서 세 단계, 모두 그 단계 화면으로 가는 링크 `stepHref`). 머리글에 이동 버튼은 두지 않는다 |
| `/cases/[id]/judgment` | 구준휘·정지원 | 진행 단계 「판단」 화면(사실 카드 화면을 합쳤다, 2026-11-11). 왼쪽 지금 할 일(판단 진행 9단계·실패·구분 질문·확인할 칸) → 사실 카드(정지원 `FactCardPanel` — 확인·수정·확정) → 판정 근거, 오른쪽 판정 → 사고·당사자(`parties-card.tsx`) → 근거 프레임. 규칙은 `src/lib/judgment/view.ts`·`src/lib/facts/view.ts` |
| `/cases/[id]/reports` | 구준휘 통합 | 검토 보고서 자리 — 최신 보고서 버전으로 보내고, 없으면 칸을 비운 틀(`src/features/reports/report-skeleton.tsx`)과 근거 질의응답 |
| `/cases/[id]/reports/[version]` | 옥석현·구준휘·김지은 | 왼쪽 보고서·검증·근거·버전/승인(옥석현), 오른쪽 근거 질의응답(구준휘 — `src/features/qa/qa-side.tsx`·`qa-panel.tsx`) |
| `/profile` | 구준휘 통합·정지원 인증 | 내 정보 — 담당자 소속·이메일·담당자 ID, 담당 사건 수, 로그아웃. 머리글 오른쪽 이름을 누르면 온다 |
| 사건 내 산정/구상 영역 | 옥석현·김지은 | 1차 확장, 별도 라우트 여부 합의. 근거 질의응답은 검토 보고서 오른쪽에 둔다 |
| `/dev` | 전원, 김지은 근거 미리보기 | 비식별 견본·개발 전용. Vercel 운영 배포(`VERCEL_ENV=production`)에서는 404 |

구준휘: layout/page·공통 UI·API/오류·사건 보드/상세·질문/판단 상태 연결, 정지원: 인증/업로드/조회 복원, 김지은: 근거 표시.
사건 보드·상세는 `src/features/cases/case-source.ts`에서 읽는다 — 지금은 `src/fixtures/case-board.json` 합성 견본이고 운영 배포에서는 비어 있다. BE `GET /cases`가 생기면 여기만 바꾼다.
보드의 줄은 `created_at`(접수 시각, BE `cases.created_at`) 순이다 — `GET /cases` 응답에 같은 이름으로 넣어 달라고 BE에 요청한다.
사건 고정은 담당자 브라우저 쿠키(`okm-pinned-cases`)에 사건 ID만 둔다. 읽기는 `pin-source.ts`, 바꾸기는 Server Action `pin-actions.ts`다(기기 사이에는 공유되지 않는다).
진행 단계 한 줄은 사건 요약이 있을 때만 그린다 — API 모드의 판단·보고서 화면은 사건 목록 API 전이라 아직 없다.
아직 오지 않은 단계 화면은 같은 칸을 비운 틀을 보인다 — 사실 카드 `FactCardSkeleton`, 판정 `JudgmentSkeleton`과 모두 아직인 판단 진행 9단계, 보고서 `ReportSkeleton`.
빈 칸은 공통 `Blank`(흐린 줄표, 화면 낭독기에는 "비어 있음")다. 지난 단계인데 기록을 못 읽으면 같은 틀에 「기록 없음」을 단다 —
보고서 단계 합성 견본(0109·0110)은 판단 기록·사실 카드 견본이 없어(도표가 정해지는 견본은 두지 않는다) 판단 화면이 이렇게 보인다.
화면 데이터 출처는 `isSampleSource`(`case-source.ts`) 하나로 고른다 — 운영 배포는 늘 BE, 그 밖은 합성 견본이 기본이고 서버 환경변수 `OKM_DATA_SOURCE=api`면 BE다.
판단 화면은 `src/features/judgment/judgment-source.ts`에서 판단 실행을 읽는다 — 견본 모드는 `src/fixtures/judgment.json`(판단 단계 사건만), API 모드는 BE `GET /cases/{id}/judgment`.
API 모드에서는 구분 질문 답변·판단 시작·다시 시작을 BE로 보내고 다시 읽는다(`router.refresh`). 견본 모드는 보내지 않고 보낼 값만 보여 준다.
사건 목록 API 전이라 API 모드의 판단 화면은 사건 요약 없이 판단 조회 결과로만 그린다.
판정이 도표를 골랐으면 판정 아래에 그 도표의 원문 근거(`result.evidence`)를 `src/features/evidence/evidence-panel.tsx`로 보이고 적용 도표에서 이동한다.
근거 질의응답은 판단 화면이 아니라 검토 보고서 화면 오른쪽에 있다. 판단 조회로 최신 판정을 읽어 그 판정으로 만든 최신 보고서에서만 묻는다(`qaSlot`, `src/lib/qa/view.ts`).
견본 모드는 판단 견본이 판단 단계 사건에만 있어 보고서 단계 사건은 사건 요약의 버전으로 고르고, 질문은 보내지 않는다.
견본에는 임의 도표를 넣지 않으므로 견본 모드에서는 근거 칸이 나오지 않는다.
판단 화면의 사실 카드는 `src/features/facts/fact-source.ts`에서 읽는다(`src/fixtures/fact-cards.json`의 확정 전 카드와 `judgment.json`의 확정 카드). 저장·확정도 보내지 않고 보낼 값만 보여 준다.
구분 질문·확인할 칸은 카드 값을 다시 적지 않고 같은 화면 카드의 그 칸(`#fact-{칸}`)·카드(`#fact-card`)로 이동한다. 도표 A · B는 오른쪽 사고·당사자에만 둔다.
내 정보와 머리글의 담당자 이름은 `src/features/profile/profile-source.ts`에서 읽는다 — 로그인 전이라 `src/fixtures/profile.json` 합성 견본이고 운영 배포에서는 비어 있다. 로그인이 붙으면 세션 사용자로 바꾼다.
로그아웃은 내 정보의 폼 POST(Server Action `logout`)다. 아직 끝낼 세션이 없어 로그인 화면으로만 보낸다.
프레임/원문은 권한 있는 URL로만 연다. 비공개 파일 경로를 임의 공개 URL로 바꾸지 않는다.
`/dev/...` 아래에 미리보기 페이지를 더하면 같은 운영 차단(`notFound()`)을 페이지마다 둔다.
