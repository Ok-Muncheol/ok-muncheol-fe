/**
 * B 통합: Supabase 공개 설정. 둘 다 브라우저 번들에 실려도 되는 값이다(publishable key, 비밀 아님).
 * 비어 있으면 로그인 없이 동작한다 — API 클라이언트는 토큰 없이 보내 로컬 BE 개발 인증에서만 통한다.
 * `process.env.NEXT_PUBLIC_…`를 글자 그대로 읽어야 빌드 때 값이 들어간다.
 */
export type SupabaseConfig = { url: string; key: string };

export function supabaseConfig(): SupabaseConfig | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
  return url && key ? { url: url.replace(/\/+$/, ""), key } : null;
}
