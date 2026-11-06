/** B 통합·A 인증: 담당자 로그인. TODO: Supabase 로그인, 세션 토큰을 BE 공통 클라이언트에 전달(src/lib/supabase/README.md). */
import { Button, Card, Field, Input } from "@/ui/controls";

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-6 py-10">
      <Card className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2 text-heading font-bold">
          <span aria-hidden className="flex size-7 items-center justify-center rounded-control bg-primary text-caption text-on-primary">
            OK
          </span>
          OK문철
        </div>
        <h1 className="text-title font-bold">담당자 로그인</h1>
        <p className="mt-1 text-body text-ink-muted">준비 중 — Supabase 로그인을 연결합니다.</p>
        <form className="mt-6 flex flex-col gap-4">
          <Field id="login-email" label="이메일">
            <Input id="login-email" type="email" autoComplete="username" disabled />
          </Field>
          <Field id="login-password" label="비밀번호">
            <Input id="login-password" type="password" autoComplete="current-password" disabled />
          </Field>
          <Button disabled className="mt-2">
            로그인
          </Button>
        </form>
      </Card>
    </main>
  );
}
