/**
 * B 통합: 서버(서버 컴포넌트·Server Action)용 Supabase 클라이언트. 세션은 쿠키에 있다(@supabase/ssr).
 * 요청마다 새로 만든다. 서버 컴포넌트는 쿠키를 쓸 수 없어 토큰 갱신은 src/proxy.ts가 맡는다.
 */
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { supabaseConfig } from "./config";

export async function createSupabaseServerClient() {
  const config = supabaseConfig();
  if (!config) return null;
  const store = await cookies();
  return createServerClient(config.url, config.key, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (toSet) => {
        try {
          toSet.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // 서버 컴포넌트에서는 쿠키를 쓸 수 없다. Server Action·proxy.ts에서는 쓴다
        }
      },
    },
  });
}

/** BE에 보낼 access token. BE가 서명·만료를 검증하므로 여기서는 쿠키의 세션을 그대로 넘긴다. */
export async function serverAccessToken(): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}
