/**
 * B 통합: 내 정보(/profile)와 머리글이 읽는 로그인한 보상 담당자. 지금은 비식별 합성 견본이고, 로그인이 붙으면
 * Supabase 세션 사용자로 바꾼다(src/lib/supabase/README.md). 운영 배포에서는 견본을 보여 주지 않는다(사건 보드와 같은 기준).
 */
import { isSampleSource } from "@/features/cases/case-source";
import sample from "@/fixtures/profile.json";

/**
 * user_id는 Supabase auth.users.id다 — BE가 토큰에서 정하는 actor_id이고, 사건 담당자(cases.assignee_id)와
 * 사실 카드 confirmed_by·보고서 approved_by에 남는 값이다. 이름·소속·역할은 BE에 아직 없어 FE 제안이다.
 */
export type ReviewerProfile = { user_id: string; name: string; email: string; team: string; role: string };

const SAMPLE: ReviewerProfile = sample.profile;

export async function getCurrentProfile(): Promise<ReviewerProfile | null> {
  // TODO: 세션 사용자(id·email)를 읽고, 이름·소속은 user_metadata로 둘지 BE 조회로 받을지 정해 연결한다.
  return isSampleSource() ? SAMPLE : null;
}
