# BE 생성 합성 양식

`contracts.json`은 BE `app/schemas/examples.py` → `make contracts`에서 생성한다.
타입 필드 모양을 보여 주며 실행 가능한 시연 시나리오·평가 정답은 아니다.
BE 계약 변경 시 `src/lib/api/types.ts`와 함께 갱신하고 대응 PR을 연결한다.

`case-board.json`은 FE가 만든 담당 사건 보드(`CaseSummary`) 합성 견본이다. 단계마다 여러 상태가 보이고 열마다 카드가 여러 장 쌓이게 짰고 BE 생성물이 아니다.
BE `GET /cases` 계약이 생기면 `contracts.json` 쪽으로 옮기고 이 파일은 지운다.

추후 정상/추가 확인/보류/작업 실패/버전 충돌별 완성 시나리오 견본을 추가한다.
실제 사건·원문·프레임·서명 URL·임의 도표/금액은 넣지 않는다.
