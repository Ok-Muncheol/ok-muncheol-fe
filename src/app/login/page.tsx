/**
 * B 통합·A 인증: 보상 담당자 로그인 화면(Supabase 이메일·비밀번호 — 본문은 src/features/auth/login-form.tsx). 계정은 Supabase 대시보드에서 만든다.
 * 로그인하면 ?next=로 받은 화면(사건 화면이 로그인이 필요해 보낸 곳)으로, 없으면 첫 화면(/)으로 가서 역할에 맞는 화면이 열린다
 * (관리자는 사건 관제, 담당자는 담당 사건). next는 이 사이트 안 경로만 받는다(src/lib/auth/next-path.ts).
 * 서버에 시연 계정이 설정돼 있으면(DEMO_LOGIN_* — src/features/auth/demo-accounts.ts) 대물 담당자 · 대인 담당자 · 관리자 버튼도 둔다.
 */
import { demoChoices } from "@/features/auth/demo-accounts";
import { LoginForm } from "@/features/auth/login-form";
import { safeNext } from "@/lib/auth/next-path";

export default async function LoginPage(props: PageProps<"/login">) {
  const { next } = await props.searchParams;
  return <LoginForm next={safeNext(Array.isArray(next) ? next[0] : next)} demoAccounts={demoChoices()} />;
}
