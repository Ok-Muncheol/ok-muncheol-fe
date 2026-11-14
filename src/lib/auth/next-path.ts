/**
 * B 통합: 로그인 뒤 갈 곳(?next=). 이 사이트 안 경로만 받고, 없거나 바깥 주소면 첫 화면(/)이다 — 첫 화면이 역할에 맞는 곳
 * (관리자는 사건 관제, 담당자는 담당 사건)으로 보낸다. 로그인 화면(src/app/login/page.tsx)과 시연 계정 로그인(Server Action)이 같이 쓴다.
 * "/\evil.com"·"/<탭>/evil.com"처럼 브라우저가 바깥 주소로 읽는 값도 막으려고 글자를 보지 않고 URL로 풀어 출처를 비교한다.
 * 런타임 import는 두지 않는다 — 테스트(next-path.test.mjs)가 Node로 이 파일을 바로 읽는다.
 */
import type { StaffRole } from "../api/types";

const BASE = "http://okm.invalid";

/** 역할의 첫 화면 — 관리자는 사건 관제, 그 밖(대물·대인 담당자, 역할 없음, 로그인 전)은 담당 사건. 첫 화면(/)과 시연 계정 로그인이 같이 쓴다. */
export function homePath(staffRole: StaffRole | null | undefined): string {
  return staffRole === "admin" ? "/admin" : "/cases";
}

export function safeNext(next: unknown): string {
  if (typeof next !== "string" || !next.startsWith("/")) return "/";
  let url: URL;
  try {
    url = new URL(next, BASE);
  } catch {
    return "/";
  }
  if (url.origin !== BASE || url.pathname.startsWith("/login")) return "/";
  return `${url.pathname}${url.search}${url.hash}`;
}
