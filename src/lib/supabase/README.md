# 정지원 구현·구준휘 통합 — 인증·Storage·진행 알림

아직 SDK·인증·업로드 구현은 없다.

- Supabase 세션 토큰을 BE 공통 클라이언트에 전달하고 서버가 소유권을 검증한다.
  `createApiClient({ getAccessToken })`(`src/lib/api/client.ts`)에 세션의 access token을 돌려주는 함수를 넘기면
  `Authorization: Bearer`로 붙는다. 넘기기 전에는 토큰 없이 보내 로컬 BE 개발 인증에서만 통한다.
- BE에서 담당 사건의 서명 URL을 발급받아 파일을 Storage에 직접 전송한다.
- Realtime은 변경 알림으로 쓰고 새로고침/재접속은 사건 조회로 복원한다.
- 서명 URL·비공개 파일·실제 사건을 견본·문서·로그에 넣지 않는다.
- 모델/DB/Modal/Supabase 서버 비밀키를 브라우저에 두지 않는다.
