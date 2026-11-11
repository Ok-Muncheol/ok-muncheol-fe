"use server";

/**
 * B 통합: 사건 고정·해제 Server Action. 사건 목록의 고정 버튼 폼이 부른다.
 * 쿠키를 바꾸면 Next가 같은 왕복으로 화면을 다시 그려 목록·보드 순서가 바로 바뀐다. JS 없이도 폼 POST로 동작한다.
 * 쿠키에는 사건 ID만 둔다(src/lib/cases/pins.ts). 담당 사건인지는 따지지 않는다 — 고정은 이 브라우저의 표시 순서만 바꾼다.
 */
import { cookies } from "next/headers";
import { PIN_COOKIE, isCaseId, parsePinned, serializePinned, togglePinned } from "@/lib/cases/pins";

const ONE_YEAR = 60 * 60 * 24 * 365;

export async function togglePin(formData: FormData): Promise<void> {
  const caseId = formData.get("case_id");
  if (!isCaseId(caseId)) return;
  const store = await cookies();
  const next = togglePinned(parsePinned(store.get(PIN_COOKIE)?.value), caseId);
  store.set(PIN_COOKIE, serializePinned(next), {
    path: "/",
    maxAge: ONE_YEAR,
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  });
}
