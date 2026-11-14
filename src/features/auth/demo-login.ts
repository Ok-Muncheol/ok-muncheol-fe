"use server";

/**
 * B 통합: 시연 계정 로그인 Server Action — 로그인 화면의 시연 계정 버튼 폼이 부른다. 버튼이 보낸 키(property·injury·admin)의 계정으로
 * 서버에서 Supabase 비밀번호 로그인을 하고, 세션 쿠키를 응답에 쓴 뒤 ?next=(없으면 역할의 첫 화면)로 보낸다.
 * 쿠키를 바꾼 Server Action이라 Next가 같은 왕복으로 레이아웃(주 메뉴 · 계정 자리)까지 다시 그린다. 계정 값은 서버 환경변수에만 있다(demo-accounts.ts).
 * 첫 화면(/)을 거치지 않고 역할의 첫 화면으로 바로 보낸다 — 거치면 /가 다시 보내는 동안 본문이 빈 화면이 잠깐 보인다.
 */
import { redirect } from "next/navigation";
import { homePath, safeNext } from "@/lib/auth/next-path";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { demoAccount } from "./demo-accounts";

/** 실패하면 화면에 보일 문구를 돌려준다. 성공하면 다른 화면으로 보내고 돌아오지 않는다. */
export async function demoLogin(_previous: string | null, form: FormData): Promise<string | null> {
  const account = demoAccount(form.get("account"));
  const supabase = await createSupabaseServerClient();
  if (!account || !supabase) return "시연 계정 로그인이 설정되지 않았습니다.";
  const { error } = await supabase.auth.signInWithPassword({ email: account.email, password: account.password });
  if (error) return `${account.label} 계정으로 로그인하지 못했습니다. 시연 계정 설정(DEMO_LOGIN_…)을 확인해 주세요.`;
  const next = safeNext(form.get("next"));
  redirect(next === "/" ? homePath(account.key === "admin" ? "admin" : "adjuster") : next);
}
