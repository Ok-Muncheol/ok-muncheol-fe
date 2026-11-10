# BE 생성 합성 양식

`contracts.json`은 BE `app/schemas/examples.py` → `make contracts`에서 생성한다.
타입 필드 모양을 보여 주며 실행 가능한 시연 시나리오·평가 정답은 아니다.
BE 계약 변경 시 `src/lib/api/types.ts`와 함께 갱신하고 대응 PR을 연결한다.

`case-board.json`은 FE가 만든 담당 사건 보드(`CaseSummary`) 합성 견본이다. 단계마다 대표 상태만 남긴 12건(접수 1·영상 분석 1·사실 카드 3·판단 5·검토 보고서 2)이고 BE 생성물이 아니다.
BE `GET /cases` 계약이 생기면 `contracts.json` 쪽으로 옮기고 이 파일은 지운다.

`judgment.json`은 FE가 만든 판단 화면(`JudgmentRunView`·`FactCard`) 합성 견본이다. `runs`는 BE 판단 조회(`GET /cases/{id}/judgment`) 응답 모양이고
`case-board.json`의 판단 단계 사건마다 하나씩 있다. 처리 중·작업 실패·구분 질문 확인 대기(질문 2건 중 1건 답함)·추가 확인(반박 — 답하지 않는 확인할 칸)·보류 상태를 담는다.
상태·버전·안 답한 질문 수가 보드 견본과 맞는지, BE `judgment_runs`·`judgment_answers` 제약을 지키는지,
판정 사유가 BE처럼 걸린 검증의 이유를 잇는지는 `judgment.test.mjs`가 본다. 도표가 정해지는 ‘초안 작성 가능’ 견본은 임의 도표·과실비율을 만들지 않으려고 두지 않았다.

`fact-cards.json`은 FE가 만든 사실 카드 화면(`FactCard`) 합성 견본이다. `case-board.json`의 사실 카드 단계 사건마다 확정 전 카드가 하나씩 있고
영상 분석 칸·직접 입력·진술·불명·담당자 수정·매핑 전 상태를 담는다. 프레임은 ID·시각만 있고 이미지·서명 URL은 없다. 보드 견본·카드 규칙과 맞는지는 `fact-cards.test.mjs`가 본다.

`profile.json`은 FE가 만든 로그인한 보상 담당자(내 정보·머리글 이름) 합성 견본이다. 실제 사람이 아니고 `user_id`는 다른 견본의 `confirmed_by`와 같은 값이다.
로그인이 붙으면 Supabase 세션 사용자로 바꾸고 이 파일은 지운다.

추후 정상/추가 확인/보류/작업 실패/버전 충돌별 완성 시나리오 견본을 추가한다.
실제 사건·원문·프레임·서명 URL·임의 도표/금액은 넣지 않는다.
