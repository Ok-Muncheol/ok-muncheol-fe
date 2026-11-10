# 역할별 개발 가이드 — FE

경로는 FE 저장소 루트 기준이다. **개발 마감은 2026-11-13(금)**, 권장 기능 통합일은 11/12다.
BE와 같은 담당(정지원(A)·구준휘(B)·김지은(C)·옥석현(D), 코드 주석의 A–D는 이 순서)이 같은 기능의 화면을 맡는다. lumi의 담당별 폴더·공통 타입/견본·API 클라이언트 분리 방식을 참고했다.
서비스 범위는 [README.md](README.md), 판단·검색·계산 계약은
[BE TEAM.md](https://github.com/Ok-Muncheol/ok-muncheol-be/blob/main/TEAM.md)를 따른다.

아래 파일은 **타입·화면 컴포넌트 초안**이다. Next.js 앱은 라우트 골격과 담당 사건 보드·사건 상세·사실 카드·판단 화면 초안·내 정보(합성 견본)까지 있다. BE 요청은 판단 화면만 보내고(API 모드) 인증·업로드·상태 저장은 아직 연결하지 않았다.
컴포넌트 일부는 전달받은 값을 표시하지만 완성 화면/업무 동작을 뜻하지 않는다. 타입은 수동 초안이며 OpenAPI 생성물이 아니다.
설치·개발 서버·검증 명령은 README 「개발 시작과 검증」에 있다. lumi의 런타임·모바일 화면·배포 완료 상태를 복제하지 않는다.

## 원칙

- 과실·금액·판정·필드별 확인 여부는 BE 값을 표시한다. FE가 산식이나 확신도 임계값을 결정하지 않는다.
- 모델 원값·확신도와 담당자 수정/확인을 분리한다. 수동 입력 확신도는 해당 없음, 미확정 비율/금액은 빈 상태로 표시한다.
- 촬영 차량·가입자·도표 A/B, 작업 진행·판정 결과, 공식·가정 결과를 각각 구분한다.
- 카드·판단·보고서 버전을 기준으로 저장/실행/승인한다. 재접속은 상태 조회로 복원하고 작업을 자동 중복 생성하지 않는다.
- 근거 ID·원문 페이지·적용판·프레임을 연결한다. 비공개 파일의 서명 URL을 견본/로그에 남기지 않는다.

## 역할 요약

| 담당 | BE 책임 | FE 책임 / 경로 |
| --- | --- | --- |
| 정지원 | 영상 접수·비전 워커·사실 카드·담당자 확인 | `src/features/cases/`, `facts/`: 사건 접수·영상/수동 선택·업로드·진행·카드 편집/확정·매핑 |
| 구준휘 | 판단 워크플로우·검증 3겹·질의응답 | `src/features/judgment/`, `qa/`: 판단 진행·구분 질문·검증·근거 답변/what-if. `src/features/cases/case-board.tsx`·`case-stepper.tsx`: 담당 사건 보드·사건 상세(`/cases`, `/cases/[id]`). `src/features/profile/`: 내 정보(`/profile`) |
| 김지은 | 검색툴 3개·PDF 파싱/청킹/문서 임베딩·평가셋 | `src/features/evidence/`, `knowledge/`: 도표/결정례/약관·원문/페이지·개발용 품질 확인 |
| 옥석현 | 공통 RAG·손해액/보험금·구상·검토 초안 보고서 | `src/features/calculation/`, `claims/`, `reports/`: 산정·구상 패키지·보고서·버전/승인 |

공통 기반은 **구준휘가 통합 창구**를 맡되 전원이 함께 구현한다. 구준휘는 `src/app/`, `src/lib/api/`, 공통 UI와 타입·견본 동기화를 정리한다.
정지원은 `src/lib/supabase/`의 인증/업로드·Realtime/조회 복원을, 구준휘는 질문/판단 상태 연결을, 김지은은 근거 표시 계약을 함께 맡는다.
PDF 파싱·문서 임베딩·평가 실행은 김지은의 BE/오프라인 책임이다. FE 브라우저에 PDF 처리 파이프라인이나 모델 비밀키를 두지 않는다.

## 정지원 — 접수·영상·카드·담당자 확인

| 파일 | 채울 본문 / 연결 |
| --- | --- |
| `src/features/cases/case-intake.tsx` | 사건 범위/당사자 수·영상/수동 입력, BE cases API, 업로드/실패/재시도 |
| `src/features/facts/fact-card-panel.tsx` | 값·모델 원값·출처·확신도·증거, 편집/저장/확정, 수정 이력·매핑·버전 충돌. 초안(구준휘, 2026-11-10): 칸 수정·담당자 확인·저장/확정 요청 모양까지 있고 요청·이력·매핑 편집은 없다 |
| `src/app/cases/[id]/facts/page.tsx`, `src/features/facts/evidence-frames.tsx`·`fact-source.ts`, `src/lib/facts/view.ts` | 사실 카드 화면 초안(카드·당사자·근거 프레임 목록)과 카드 조회·화면 규칙. 카드 조회 API·권한 있는 프레임 URL·영상 연결 |
| `src/lib/supabase/README.md` | 인증·직접 업로드·권한 있는 프레임 조회·Realtime 알림/조회 복원 구현 |

완료 기준: 영상 없이도 입력/확정, 카드 칸→근거 프레임 이동, 불명·불일치·매핑 확인,
원값 보존, 미확정 판단 차단, 저장 중/실패/버전 충돌·미저장 변경 처리.
비전 워커는 FE에서 실행하지 않고 작업 ID·상태만 표시한다.

## 구준휘 — 판단·검증 3겹·질의응답

| 파일 | 채울 본문 / 연결 |
| --- | --- |
| `src/features/judgment/judgment-panel.tsx` | 작업 진행과 세 판정 상태, 근거 체크/반박 검토/코드 계산 검증·실패 이유 |
| `src/features/judgment/question-panel.tsx` | BE 질문/보기/불명 응답, 기대 카드 버전, 답변→정지원 카드 재확정→재판단 |
| `src/app/cases/[id]/judgment/page.tsx`, `src/features/judgment/judgment-source.ts`, `retry-judgment.tsx` | 판단 화면(진행 단계·실패·구분 질문·확인할 칸·판정). API 모드에서 판단 조회·답변·판단 시작/다시 시작을 BE로 보낸다(2026-11-10). Realtime 변경 알림·로그인 토큰 연결 |
| `src/lib/judgment/view.ts`, `src/lib/api/chart-scope.ts` | 판단 화면 규칙(단계·검증 층·답변 모양)과 도표 선택 칸 표기. BE `graph.py`·`chart_scope.py`와 맞춘다 |
| `src/features/qa/qa-panel.tsx` | 근거 답변·추가 질문·가정 조건/결과. 공식 결과와 나란히 구분 |
| `src/app/profile/page.tsx`, `src/features/profile/profile-source.ts` | 내 정보 초안(소속·계정·담당 사건 수·로그아웃). 로그인한 담당자는 지금 합성 견본(`src/fixtures/profile.json`)이다. 세션 사용자 조회·로그아웃의 세션 종료를 정지원 인증과 연결 |
| `src/lib/api/types.ts`, `client.ts` | BE 계약 대응·요청 클라이언트·인증/오류·버전 충돌·복원 |
| `src/components/status-label.tsx`, `src/app/README.md` | 공통 상태 표현·앱/라우트 통합 |

완료 기준: 초안 작성 가능/추가 확인 필요/판단 보류를 오류와 구분,
질문/재개·재실행 상한 결과 표시, 인용 근거로 이동, QA가 공식 보고서/승인을 덮어쓰지 않음.
과실 산식은 구준휘의 BE, 금액 산식은 옥석현의 BE에서만 실행한다.

## 김지은 — 세 검색툴의 근거·원문·평가 확인

| 파일 | 채울 본문 / 연결 |
| --- | --- |
| `src/features/evidence/evidence-panel.tsx` | 인정기준/결정례/약관 구분, 도표/조항/부모 ID·적용판·페이지·선택/제외 이유 |
| `src/features/knowledge/corpus-preview.tsx` | 개발용 코퍼스/출처·검수 상태 미리보기. 평가 실행·관리자 API는 별도 계약 필요 |
| `src/fixtures/contracts.json` | BE 생성 합성 양식 동기화. 실제 사건/원문·임의 정답을 넣지 않음 |

완료 기준: 세 코퍼스 구분, 실제 권한 있는 원문/페이지까지 추적, 근거 없음·미확인 상태 표시,
검색 평가 지표는 BE 산출물 그대로 표시. 개발용 페이지는 운영에서 접근 불가하도록 라우팅 단계에 게이트 구현.
별도 운영용 데이터 관리 콘솔은 이번 기본 화면 범위에 자동 추가하지 않는다.

## 옥석현 — 산정·구상·검토 초안 보고서

| 파일 | 채울 본문 / 연결 |
| --- | --- |
| `src/features/calculation/calculation-panel.tsx` | 인정 손해액·보험금·자기부담금·추정/자료 필요/확정·근거/규칙 버전 |
| `src/features/claims/claim-package-panel.tsx` | 예정액/청구액/회수액/고객 자기부담금 검토액, 승인 후 PDF/JSON 다운로드 |
| `src/features/reports/review-report.tsx` | 1~7항목·확장 8~9항목, 근거·계산 로그·보고서 버전·승인/이력 |

완료 기준: 표시한 버전에만 승인, 근거·수치·버전 일치, 자료 없으면 미확정,
공식 재산정과 what-if 분리, 견적만 추가하면 금액 단계부터 재실행, 승인 전 외부 전달 차단.

## 계약과 개발 순서

BE `app/schemas/` → `make contracts` → FE `types.ts`/`fixtures/contracts.json` → 각 화면을 함께 맞춘다.
현재 JSON은 필드 모양 양식이고 실행 가능한 시나리오가 아니다. OpenAPI 확정 후 자동 생성 방식으로 교체한다.
`client.ts`는 BE 경로 17개에 요청을 보낸다(오류 `ApiRequestError`·버전 충돌 `isVersionConflict`·접수 중복 키 `newIdempotencyKey`).
로그인 연결 전에는 토큰 없이 보내 로컬 BE 개발 인증에서만 통한다. 화면 데이터 출처는 `isSampleSource`(`src/features/cases/case-source.ts`) 하나로 고른다 —
운영은 늘 BE, 그 밖은 견본이 기본이고 `OKM_DATA_SOURCE=api`면 BE다. 지금 BE를 읽는 화면은 판단 화면뿐이고, 나머지 화면 연결은 담당별 `*-source.ts`·패널의 TODO에서 한다.

| 날짜 | 합류 목표 |
| --- | --- |
| 11/5(목) | 담당별 입출력/타입·견본·화면 분담·공통 기반 계약 |
| 11/6(금) | 앱 부트스트랩·공통 API, 정지원 수동 카드·구준휘 판정·김지은 근거·옥석현 보고서 첫 화면 |
| 11/9(월) | 수동 카드→질문/검증→보고서/승인 BE 연결 |
| 11/10(화) | 영상/프레임·약관 근거·QA·금액/구상 단독 화면 |
| 11/11(수) | 전 담당 기능 연결, 실패/버전 충돌·공식/가정 구분 |
| 11/12(목) | 기능 통합 목표, 새로고침/재접속·권한·승인·기본 접근성 검수 |
| 11/13(금) | 결함 수정·최종 시나리오 재현·개발 마감 |

BE와 같은 [날짜별 작업 계획](https://github.com/Ok-Muncheol/ok-muncheol-be/blob/main/docs/development-plan.md)을 따른다.
선행 MVP·1차 확장은 순서이며 확장 담당을 마감 이후로 미루는 의미가 아니다. 미완료는 기능별로 명시한다.

## 검증·PR 규칙

변경을 마치면 `npm run lint`·`npm run typecheck`·`npm test`·`npm run build`를 통과시킨다. CI `check`가 같은 명령을 같은 순서로 돈다.
화면은 `src/app/`의 라우트 골격에 담당 컴포넌트를 붙여 만든다(`src/app/README.md`).
각 화면은 정상·불명·불일치·질문·보류·작업 실패·버전 충돌 견본으로 확인한다.
접수→확정→판단→근거→보고서/승인·산정/구상, 키보드·라벨·포커스·상태의 글자 표현을 검수한다.
데스크톱 업무 배치를 먼저 확인하고 좁은 화면에서도 확인/저장을 유지한다.

이슈에 담당/계약/완료 기준/대응 BE 작업을 적는다. `<타입>/#<번호>` 브랜치 → main PR → 검사/검토 → squash merge.
PR에 `close #번호`, 검증 결과·대응 BE PR을 적는다. `main`은 PR 필수·필수 체크 `check`·`gitleaks`로 보호되고,
변경은 ship 하네스(Claude Code `/ship`, Codex `$ship`)로 올린다 — README 「브랜치·PR 규칙」.
공통 계약을 바꾸면 소비 담당과 타입·견본·화면을 함께 수정한다. 비밀키·실제 사건·서명 URL은 커밋하지 않는다.
