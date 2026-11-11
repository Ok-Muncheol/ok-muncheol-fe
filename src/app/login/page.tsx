"use client";
/**
 * B 통합·A 인증: 보상 담당자 로그인(Supabase 이메일·비밀번호). 세션은 쿠키에 남아(@supabase/ssr) 서버·브라우저 API
 * 클라이언트가 같은 access token을 BE에 보낸다(src/lib/api/server.ts·browser.ts). 계정은 Supabase 대시보드에서 만든다.
 */
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { Button, Card, Field, Input } from "@/ui/controls";

export default function LoginPage() {
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
    router.replace("/cases");
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
      </Card>
    </main>
  );
}
