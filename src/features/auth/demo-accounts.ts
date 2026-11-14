/**
 * B 통합: 시연 계정 — 로그인 화면에 버튼으로 두는 대물 담당자 · 대인 담당자 · 관리자 계정. 서버에서만 읽는다(브라우저 번들에 싣지 않는다).
 * FE·BE 저장소가 공개라 이메일·비밀번호를 코드에 두지 않고 서버 환경변수로만 받는다(.env.example의 DEMO_LOGIN_*).
 * 비밀번호가 없으면 버튼이 하나도 없고, 이메일이 빈 역할은 그 버튼만 없다. 운영 배포에 넣으면 주소를 아는 누구나 그 역할로 들어온다.
 * 런타임 import는 두지 않는다 — 테스트(demo-accounts.test.mjs)가 Node로 이 파일을 바로 읽는다.
 */
export type DemoKey = "property" | "injury" | "admin";
/** 로그인 화면으로 보내는 값 — 버튼 키와 이름뿐이다. */
export type DemoChoice = { key: DemoKey; label: string };
type DemoAccount = DemoChoice & { email: string; password: string };

function configured(): DemoAccount[] {
  const password = process.env.DEMO_LOGIN_PASSWORD ?? "";
  if (!password) return [];
  const accounts = [
    { key: "property", label: "대물 담당자", email: process.env.DEMO_LOGIN_PROPERTY_EMAIL },
    { key: "injury", label: "대인 담당자", email: process.env.DEMO_LOGIN_INJURY_EMAIL },
    { key: "admin", label: "관리자", email: process.env.DEMO_LOGIN_ADMIN_EMAIL },
  ] as const;
  return accounts.flatMap(({ key, label, email }) => (email?.trim() ? [{ key, label, email: email.trim(), password }] : []));
}

/** 로그인 화면의 버튼 — 이메일·비밀번호는 브라우저로 보내지 않는다. */
export function demoChoices(): DemoChoice[] {
  return configured().map(({ key, label }) => ({ key, label }));
}

/** 버튼이 보낸 키의 계정. 설정에 없는 키면 null이다. */
export function demoAccount(key: unknown): DemoAccount | null {
  return configured().find((account) => account.key === key) ?? null;
}
