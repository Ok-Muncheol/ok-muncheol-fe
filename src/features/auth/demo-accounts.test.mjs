// 시연 계정 설정 테스트. Node가 .ts의 타입만 지우고 실행한다.
import assert from "node:assert/strict";
import { test } from "node:test";
import { demoAccount, demoChoices } from "./demo-accounts.ts";

const NAMES = ["DEMO_LOGIN_PASSWORD", "DEMO_LOGIN_PROPERTY_EMAIL", "DEMO_LOGIN_INJURY_EMAIL", "DEMO_LOGIN_ADMIN_EMAIL"];

/** 이 테스트 동안만 환경변수를 바꾼다. */
function withEnv(values, run) {
  const saved = Object.fromEntries(NAMES.map((name) => [name, process.env[name]]));
  for (const name of NAMES) delete process.env[name];
  Object.assign(process.env, values);
  try {
    run();
  } finally {
    for (const name of NAMES) {
      if (saved[name] === undefined) delete process.env[name];
      else process.env[name] = saved[name];
    }
  }
}

test("비밀번호가 없으면 시연 계정 버튼이 없다", () => {
  withEnv({ DEMO_LOGIN_PROPERTY_EMAIL: "p@example.com", DEMO_LOGIN_ADMIN_EMAIL: "a@example.com" }, () => {
    assert.deepEqual(demoChoices(), []);
    assert.equal(demoAccount("admin"), null);
  });
});

test("이메일이 있는 역할만 버튼이 되고, 화면으로 보내는 값에는 이메일·비밀번호가 없다", () => {
  withEnv({ DEMO_LOGIN_PASSWORD: "pw", DEMO_LOGIN_PROPERTY_EMAIL: " p@example.com ", DEMO_LOGIN_INJURY_EMAIL: " ", DEMO_LOGIN_ADMIN_EMAIL: "a@example.com" }, () => {
    assert.deepEqual(demoChoices(), [
      { key: "property", label: "대물 담당자" },
      { key: "admin", label: "관리자" },
    ]);
    assert.deepEqual(demoAccount("property"), { key: "property", label: "대물 담당자", email: "p@example.com", password: "pw" });
    assert.equal(demoAccount("injury"), null);
    assert.equal(demoAccount("root"), null);
    assert.equal(demoAccount(null), null);
  });
});
