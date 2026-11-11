# 정지원 구현·구준휘 통합 — 인증·Storage·진행 알림

## 로그인 (11/11 연결, B)

- Supabase 이메일·비밀번호 로그인(`src/app/login/page.tsx`). 계정은 Supabase 대시보드(Authentication → Users)에서 만든다.
- 세션은 쿠키에 둔다(`@supabase/ssr`). 서버 컴포넌트·Server Action은 `server.ts`, 클라이언트 컴포넌트는 `browser.ts`를 쓴다.
- BE 호출은 `createServerApiClient()`(`src/lib/api/server.ts`)·`createBrowserApiClient()`(`src/lib/api/browser.ts`)로 한다.
  세션의 access token을 `Authorization: Bearer`로 붙이고, 담당자(actor_id)는 BE가 토큰의 `sub`에서만 정한다.
- `src/proxy.ts`(Next 16의 미들웨어)가 요청마다 만료된 토큰을 갱신해 쿠키에 다시 쓴다. 로그인을 강제하지는 않는다 —
  로그인하지 않으면 토큰 없이 보내 로컬 BE 개발 인증(`APP_ENV=local`·`DEV_ACTOR_ID`)에서만 통한다.
- 내 정보(`src/features/profile/profile-source.ts`)는 검증한 토큰(`getClaims`)의 `sub`·`email`, 이름·소속·역할은 `user_metadata`다.
  로그아웃은 `src/app/profile/page.tsx`의 Server Action이 `auth.signOut()`으로 세션을 끝낸다.
- 설정: `NEXT_PUBLIC_SUPABASE_URL`·`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`(`config.ts`). 비우면 로그인 없이 동작한다.

## 남은 일

- BE에서 담당 사건의 서명 URL을 발급받아 파일을 Storage에 직접 전송한다(`requestUpload` → `upload_url`에 PUT).
- Realtime은 변경 알림으로 쓰고 새로고침/재접속은 사건 조회로 복원한다.
- 서명 URL·비공개 파일·실제 사건을 견본·문서·로그에 넣지 않는다.
- 모델/DB/Modal/Supabase 서버 비밀키(secret key)를 브라우저에 두지 않는다. publishable key만 쓴다.
