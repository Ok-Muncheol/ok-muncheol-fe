/** B 통합: 클라이언트 컴포넌트가 쓰는 BE 클라이언트. 로그인 세션의 access token을 Authorization: Bearer로 붙인다. */
import { browserAccessToken } from "@/lib/supabase/browser";

import { createApiClient, type ApiClient } from "./client";

export function createBrowserApiClient(): ApiClient {
  return createApiClient({ getAccessToken: browserAccessToken });
}
