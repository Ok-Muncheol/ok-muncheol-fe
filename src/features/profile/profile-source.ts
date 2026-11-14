/**
 * B 통합: 내 정보(/profile)와 머리글이 읽는 로그인한 보상 담당자. 로그인했으면 Supabase 세션 사용자(검증한 토큰의
 * sub·email, 이름·소속·역할은 user_metadata)이고, 아니면 견본 모드에서만 비식별 합성 견본을 보여 준다(사건 보드와 같은 기준).
 */
import { isSampleSource } from "@/features/cases/case-source";
import sample from "@/fixtures/profile.json";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * user_id는 Supabase auth.users.id다 — BE가 토큰에서 정하는 actor_id이고, 사건 담당자(cases.assignee_id)와
 * 사실 카드 confirmed_by·보고서 approved_by에 남는 값이다. 이름·소속·역할은 BE에 아직 없어 FE 제안이다.
 */
export type ReviewerProfile = { user_id: string; name: string; email: string; team: string; role: string };

const SAMPLE: ReviewerProfile = sample.profile;

/** 화면이 견본 표시를 붙일지 가린다(로그인한 사용자면 견본이 아니다). */
export function isSampleProfile(profile: ReviewerProfile): boolean {
  return profile.user_id === SAMPLE.user_id;
}

export async function getCurrentProfile(): Promise<ReviewerProfile | null> {
  const user = await sessionUser();
  if (user) return user;
  return isSampleSource() ? SAMPLE : null;
}

/** 로그인한 사용자. getClaims는 토큰 서명을 검증한다(쿠키 값을 그대로 믿지 않는다). */
async function sessionUser(): Promise<ReviewerProfile | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  const meta = (claims.user_metadata ?? {}) as Record<string, unknown>;
  const text = (key: string) => (typeof meta[key] === "string" ? (meta[key] as string) : "");
  const email = typeof claims.email === "string" ? claims.email : "";
  return {
    user_id: claims.sub,
    name: text("name") || email || "보상 담당자",
    email,
    team: text("team"),
    role: text("role") || "보상 담당자",
  };
}

/**
 * 로그인한 사람이 관리자인지 — 검증한 토큰의 app_metadata.staff_role이 admin일 때만 참이다.
 * app_metadata는 서버 키로만 바꿀 수 있다(사용자가 고칠 수 있는 user_metadata는 보지 않는다).
 * 여기서는 메뉴를 보일지만 정한다. 실제 차단은 BE가 한다(/admin 경로는 관리자가 아니면 403).
 */
export async function isCurrentAdmin(): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return false;
  const { data } = await supabase.auth.getClaims();
  const meta = data?.claims?.app_metadata as Record<string, unknown> | undefined;
  return meta?.staff_role === "admin";
}
