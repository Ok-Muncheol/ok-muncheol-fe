"use client";
/**
 * B 통합·A 인증: 로그인 화면 본문 — 보상 담당자 로그인(Supabase 이메일·비밀번호, 브라우저)과 시연 계정 버튼(서버에서 로그인, demo-login.ts).
 * 세션은 쿠키에 남아(@supabase/ssr) 서버·브라우저 API 클라이언트가 같은 access token을 BE에 보낸다(src/lib/api/server.ts·browser.ts).
 * 계정은 Supabase 대시보드에서 만든다. 로그인하면 next(로그인 화면이 ?next=를 걸러 넘긴 값, src/lib/auth/next-path.ts)로 간다.
 */
import { useRouter } from "next/navigation";
import { type FormEvent, useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { Button, Card, Field, Input } from "@/ui/controls";
import type { DemoChoice } from "./demo-accounts";
import { demoLogin } from "./demo-login";

export function LoginForm({ next, demoAccounts }: { next: string; demoAccounts: DemoChoice[] }) {
  const router = useRouter();
  const supabase = getSupabaseBrowserClient();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    const { error: failed } = await supabase.auth.signInWithPassword({
      email: String(form.get("email") ?? "").trim(),
      password: String(form.get("password") ?? ""),
    });
    setPending(false);
    if (failed) {
      // 계정 존재 여부를 드러내지 않도록 한 가지 문구로 알린다
      setError("이메일 또는 비밀번호가 맞지 않습니다.");
      return;
    }
    router.replace(next);
    router.refresh();
  }

  return (
    <main className="flex min-h-dvh items-center justify-center px-6 py-10">
      <Card className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2 text-heading font-bold">
          <span aria-hidden className="flex size-7 items-center justify-center rounded-control bg-primary text-caption text-on-primary">
            OK
          </span>
          OK문철
        </div>
        <h1 className="text-title font-bold">보상 담당자 로그인</h1>
        {!supabase && (
          <p className="mt-1 text-body text-ink-muted">
            로그인 설정이 없습니다(NEXT_PUBLIC_SUPABASE_URL·NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY).
          </p>
        )}
        <form className="mt-6 flex flex-col gap-4" onSubmit={signIn}>
          <Field id="login-email" label="이메일">
            <Input id="login-email" name="email" type="email" autoComplete="username" required disabled={!supabase || pending} />
          </Field>
          <Field id="login-password" label="비밀번호" error={error}>
            <Input
              id="login-password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              disabled={!supabase || pending}
            />
          </Field>
          <Button type="submit" disabled={!supabase || pending} className="mt-2">
            {pending ? "로그인 중…" : "로그인"}
          </Button>
        </form>
        {supabase && demoAccounts.length > 0 && <DemoLogin accounts={demoAccounts} next={next} />}
      </Card>
    </main>
  );
}

/**
 * 시연 계정 버튼 — 누른 계정으로 서버가 로그인한다(demo-login.ts). 서버에 시연 계정이 설정됐을 때만 보인다(demo-accounts.ts).
 * 버튼 셋이 한 폼이고 누른 버튼의 name·value(account)가 함께 간다. 좁은 화면에서는 한 줄에 하나씩 쌓는다.
 */
function DemoLogin({ accounts, next }: { accounts: DemoChoice[]; next: string }) {
  const [error, action] = useActionState(demoLogin, null);
  return (
    <form action={action} className="mt-6 border-t border-line pt-5">
      <p className="mb-2 text-caption font-semibold text-ink-muted">시연 계정으로 로그인</p>
      <input type="hidden" name="next" value={next} />
      <div className="grid gap-2 sm:grid-cols-3">
        {accounts.map((account) => (
          <DemoButton key={account.key} account={account} />
        ))}
      </div>
      {error && (
        <p role="alert" className="mt-2 text-caption text-danger">
          {error}
        </p>
      )}
    </form>
  );
}

/** 누른 버튼만 「로그인 중…」이 되고, 도는 동안 셋 다 막는다. */
function DemoButton({ account }: { account: DemoChoice }) {
  const { pending, data } = useFormStatus();
  return (
    <Button type="submit" name="account" value={account.key} variant="secondary" size="sm" disabled={pending}>
      {pending && data?.get("account") === account.key ? "로그인 중…" : account.label}
    </Button>
  );
}
