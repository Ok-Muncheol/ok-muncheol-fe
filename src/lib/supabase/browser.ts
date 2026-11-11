/** B 통합: 브라우저(클라이언트 컴포넌트)용 Supabase 클라이언트. 서버와 같은 쿠키 세션을 읽는다. */
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseConfig } from "./config";

let client: SupabaseClient | null | undefined;

/** 설정이 없으면 null(로그인 없이 동작). 한 번 만들어 계속 쓴다. */
export function getSupabaseBrowserClient(): SupabaseClient | null {
  if (client === undefined) {
    const config = supabaseConfig();
    client = config ? createBrowserClient(config.url, config.key) : null;
  }
  return client;
}

/** BE에 보낼 access token. 만료가 가까우면 supabase-js가 갱신한 뒤 돌려준다. */
export async function browserAccessToken(): Promise<string | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}
