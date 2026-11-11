/** B 통합: 서버 컴포넌트가 쓰는 BE 클라이언트. 로그인 세션의 access token을 Authorization: Bearer로 붙인다. */
import { serverAccessToken } from "@/lib/supabase/server";

import { createApiClient, type ApiClient } from "./client";

export function createServerApiClient(): ApiClient {
  return createApiClient({ getAccessToken: serverAccessToken });
}
