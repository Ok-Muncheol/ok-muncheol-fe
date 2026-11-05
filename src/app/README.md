# D 통합 — App Router 구성 예정

아직 Next.js 앱/라우트는 없다. 아래 경로를 부트스트랩에서 만들고 담당 컴포넌트를 연결한다.

| 경로 | 담당 | 연결 기능 |
| --- | --- | --- |
| `/login` | D 통합·A 인증 | Supabase 로그인 |
| `/cases`, `/cases/new` | A | 목록·접수·영상/수동 입력 |
| `/cases/[id]`, `/cases/[id]/facts` | A·B | 작업 상태·영상/카드·확인 질문·확정 |
| `/cases/[id]/reports/[version]` | D·B·C | 보고서·검증·근거·버전/승인 |
| 사건 내 QA/산정/구상 영역 | B·D·C | 1차 확장, 별도 라우트 여부 합의 |
| `/dev` | 전원, C 근거 미리보기 | 비식별 견본·개발 전용. 운영 접근 차단 후 연결 |

D: layout/page·공통 UI·API/오류, A: 인증/업로드/조회 복원, B: 질문/판단 상태 연결, C: 근거 표시.
프레임/원문은 권한 있는 URL로만 연다. 비공개 파일 경로를 임의 공개 URL로 바꾸지 않는다.
package.json·TypeScript/Next.js 설정·검증 명령은 후속 부트스트랩 작업이다.
