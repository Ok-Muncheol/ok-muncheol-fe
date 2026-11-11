/**
 * B 통합: 요청마다 Supabase 세션 쿠키를 갱신한다(서버 컴포넌트는 쿠키를 쓸 수 없어서, @supabase/ssr 안내).
 * 로그인을 강제하지 않는다 — 로그인하지 않으면 지금처럼 토큰 없이 동작한다. 강제하려면 여기서 /login으로 보낸다.
 */
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { supabaseConfig } from "@/lib/supabase/config";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const settings = supabaseConfig();
  if (!settings) return response;
  const supabase = createServerClient(settings.url, settings.key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet, headers) => {
        toSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers ?? {}).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });
  // 만료된 토큰이면 여기서 갱신하고 setAll로 응답 쿠키에 다시 쓴다
  await supabase.auth.getClaims();
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
