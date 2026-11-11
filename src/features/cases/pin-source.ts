/**
 * B 통합: 고정한 사건 읽기 — 담당자 브라우저 쿠키(PIN_COOKIE, src/lib/cases/pins.ts)다.
 * 서버 컴포넌트에서만 부른다. cookies()를 읽어 그 화면은 요청마다 그린다. 고정을 BE에 저장하게 되면 여기와 pin-actions.ts만 바꾼다.
 */
import { cookies } from "next/headers";
import { PIN_COOKIE, parsePinned } from "@/lib/cases/pins";

export async function getPinnedCaseIds(): Promise<string[]> {
  return parsePinned((await cookies()).get(PIN_COOKIE)?.value);
}
