// API 클라이언트 테스트. Node가 .ts의 타입만 지우고 실행한다(런타임 import 없음). fetch는 가짜로 바꿔 끼운다.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ApiRequestError,
  LOCAL_BACKEND_URL,
  asApiError,
  createApiClient,
  isVersionConflict,
  newIdempotencyKey,
} from "./client.ts";

const BASE = "https://be.example.test";
const CASE = "11111111-1111-4111-8111-111111111111";
const QUESTION = "22222222-2222-4222-8222-222222222222";
const PATCH = {
  expected_version: 2,
  fields: {},
  party_mapping: { video_ego_party_id: null, insured_party_id: null, chart_party_A_id: null, chart_party_B_id: null },
  reason: "담당자 확인",
};
const ANSWER = { question_id: QUESTION, expected_card_version: 3, value: null, unknown: true };
const FAULT = { agreed_counterparty_fault: 70, fault_change_reason: "상대 보험사와 협의" };

// [메서드, 인자, HTTP 메서드, 경로, 본문] — BE app/api/routes.py 순서
const ROUTES = [
  ["createCase", [{ accident_date: "2026-11-01" }], "POST", "/cases", { accident_date: "2026-11-01" }],
  ["requestUpload", [CASE], "POST", `/cases/${CASE}/uploads`, undefined],
  ["startAnalysis", [CASE, "videos/a.mp4", "analysis-key-1"], "POST", `/cases/${CASE}/analysis`, { storage_path: "videos/a.mp4" }],
  ["getCase", [CASE], "GET", `/cases/${CASE}`, undefined],
  ["getFactCard", [CASE], "GET", `/cases/${CASE}/fact-card`, undefined],
  ["patchFactCard", [CASE, PATCH], "PATCH", `/cases/${CASE}/fact-card`, PATCH],
  ["confirmFactCard", [CASE, 3], "POST", `/cases/${CASE}/fact-card/confirm`, { expected_version: 3 }],
  ["startJudgment", [CASE, 3, "judgment-key-1"], "POST", `/cases/${CASE}/judgments`, { card_version: 3 }],
  ["getJudgment", [CASE], "GET", `/cases/${CASE}/judgment`, undefined],
  ["answerQuestion", [CASE, ANSWER], "POST", `/cases/${CASE}/questions/${QUESTION}/answer`, ANSWER],
  ["askQuestion", [CASE, "왜 이 도표인가요?"], "POST", `/cases/${CASE}/qa`, { text: "왜 이 도표인가요?" }],
  ["getReport", [CASE, 2], "GET", `/cases/${CASE}/reports/2`, undefined],
  ["confirmReport", [CASE, 2], "POST", `/cases/${CASE}/reports/2/confirm`, { counterparty: null }],
  ["getClaim", [CASE, 2], "GET", `/cases/${CASE}/reports/2/claim`, undefined],
  ["addDocuments", [CASE, [{ kind: "estimate" }]], "POST", `/cases/${CASE}/documents`, { documents: [{ kind: "estimate" }], case_facts: null }],
  ["uploadEstimate", [CASE, "estimates/a.pdf", "party-1"], "POST", `/cases/${CASE}/estimates`, { storage_path: "estimates/a.pdf", party_id: "party-1" }],
  ["setAgreedFault", [CASE, FAULT], "PATCH", `/cases/${CASE}/agreed-fault`, FAULT],
];

const json = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

/** 부른 요청을 모으는 가짜 fetch를 낀 클라이언트. respond가 응답을 돌려주거나 연결 실패를 던진다. */
function fakeClient({ respond = () => json(200, {}), ...options } = {}) {
  const calls = [];
  const client = createApiClient({
    baseUrl: BASE,
    ...options,
    fetch: async (url, init) => {
      calls.push({ url, init });
      return respond(url, init);
    },
  });
  return { client, calls };
}

const failure = (promise) => promise.then(() => assert.fail("오류가 나야 한다"), (error) => error);

test("메서드 17개가 BE 경로 17개와 1:1이다", () => {
  const { client } = fakeClient();
  assert.equal(ROUTES.length, 17);
  assert.deepEqual(Object.keys(client).sort(), ROUTES.map(([name]) => name).sort());
});

test("메서드마다 BE 경로·HTTP 메서드·본문을 맞춰 보내고 캐시하지 않는다", async () => {
  for (const [name, args, method, path, body] of ROUTES) {
    const { client, calls } = fakeClient();
    await client[name](...args);
    assert.equal(calls.length, 1, name);
    const { url, init } = calls[0];
    assert.equal(url, BASE + path, name);
    assert.equal(init.method, method, name);
    assert.equal(init.cache, "no-store", name);
    assert.deepEqual(init.body === undefined ? undefined : JSON.parse(init.body), body, name);
    assert.equal(init.headers["Content-Type"], body === undefined ? undefined : "application/json", name);
  }
});

test("판단·영상 분석 접수에만 Idempotency-Key를 붙인다", async () => {
  const keys = { startAnalysis: "analysis-key-1", startJudgment: "judgment-key-1" };
  for (const [name, args] of ROUTES) {
    const { client, calls } = fakeClient();
    await client[name](...args);
    assert.equal(calls[0].init.headers["Idempotency-Key"], keys[name], name);
  }
});

test("토큰이 있으면 Bearer로 보내고 없으면 Authorization을 빼고 보낸다", async () => {
  const signedIn = fakeClient({ getAccessToken: async () => "token-1" });
  await signedIn.client.getCase(CASE);
  assert.equal(signedIn.calls[0].init.headers.Authorization, "Bearer token-1");

  const anonymous = fakeClient({ getAccessToken: () => null });
  await anonymous.client.getCase(CASE);
  assert.equal("Authorization" in anonymous.calls[0].init.headers, false);
});

test("BE 오류(ApiError)를 ApiRequestError로 던지고 버전 충돌만 따로 가린다", async () => {
  const stale = fakeClient({
    respond: () =>
      json(409, { error: { code: "version_conflict", message: "사실 카드가 그 사이 바뀌었습니다.", retryable: false } }),
  });
  const conflict = await failure(stale.client.startJudgment(CASE, 3, "judgment-key-1"));
  assert.ok(conflict instanceof ApiRequestError);
  assert.deepEqual(
    [conflict.status, conflict.code, conflict.message, conflict.retryable],
    [409, "version_conflict", "사실 카드가 그 사이 바뀌었습니다.", false],
  );
  assert.equal(isVersionConflict(conflict), true);

  const running = fakeClient({
    respond: () =>
      json(409, { error: { code: "judgment_in_progress", message: "이 사건의 판단이 실행 중입니다.", retryable: true } }),
  });
  const busy = await failure(running.client.startJudgment(CASE, 3, "judgment-key-1"));
  assert.deepEqual([busy.status, busy.code, busy.retryable], [409, "judgment_in_progress", true]);
  assert.equal(isVersionConflict(busy), false);
});

test("ApiError 모양이 아닌 오류 응답은 HTTP 상태로 코드를 만든다", async () => {
  const gateway = fakeClient({ respond: () => new Response("<html>Bad Gateway</html>", { status: 502 }) });
  const badGateway = await failure(gateway.client.getCase(CASE));
  assert.deepEqual([badGateway.status, badGateway.code, badGateway.retryable], [502, "http_502", true]);

  const missing = fakeClient({ respond: () => new Response("Not Found", { status: 404 }) });
  const notFound = await failure(missing.client.getCase(CASE));
  assert.deepEqual([notFound.status, notFound.code, notFound.retryable], [404, "http_404", false]);
});

test("연결 실패는 status 0 network_error, 읽을 수 없는 성공 응답은 invalid_response로 던진다", async () => {
  const offline = fakeClient({
    respond: () => {
      throw new TypeError("fetch failed");
    },
  });
  const unreachable = await failure(offline.client.getCase(CASE));
  assert.deepEqual([unreachable.status, unreachable.code, unreachable.retryable], [0, "network_error", true]);

  const garbled = fakeClient({ respond: () => new Response("ok", { status: 200 }) });
  const unreadable = await failure(garbled.client.getCase(CASE));
  assert.deepEqual([unreadable.status, unreadable.code, unreadable.retryable], [200, "invalid_response", false]);
});

test("본문이 null인 응답은 null로 돌려준다(서류만 저장한 추가 확인·보류 사건)", async () => {
  const { client } = fakeClient({ respond: () => json(200, null) });
  assert.equal(await client.addDocuments(CASE, []), null);
});

test("경로 조각은 인코딩하고 BE 주소 끝 /는 뗀다", async () => {
  const { client, calls } = fakeClient({ baseUrl: `${BASE}//` });
  await client.getFactCard("a/b?c");
  assert.equal(calls[0].url, `${BASE}/cases/a%2Fb%3Fc/fact-card`);
});

test("BE 주소는 NEXT_PUBLIC_BACKEND_URL이고 비어 있으면 로컬 BE다", async (t) => {
  const saved = process.env.NEXT_PUBLIC_BACKEND_URL;
  t.after(() => {
    if (saved === undefined) delete process.env.NEXT_PUBLIC_BACKEND_URL;
    else process.env.NEXT_PUBLIC_BACKEND_URL = saved;
  });
  const urls = [];
  const fakeFetch = async (url) => {
    urls.push(url);
    return json(200, {});
  };

  process.env.NEXT_PUBLIC_BACKEND_URL = "https://ok-muncheol-be.example.test/";
  await createApiClient({ fetch: fakeFetch }).getCase(CASE);
  process.env.NEXT_PUBLIC_BACKEND_URL = "";
  await createApiClient({ fetch: fakeFetch }).getCase(CASE);
  assert.deepEqual(urls, [`https://ok-muncheol-be.example.test/cases/${CASE}`, `${LOCAL_BACKEND_URL}/cases/${CASE}`]);
});

test("중복 요청 키는 BE가 받는 8~128자이고 매번 다르다", () => {
  const keys = new Set(Array.from({ length: 20 }, () => newIdempotencyKey()));
  assert.equal(keys.size, 20);
  for (const key of keys) assert.ok(key.length >= 8 && key.length <= 128, key);
});

test("화면에 보일 오류는 ApiError 모양이고, 모르는 예외는 내부 메시지를 싣지 않는다", () => {
  const known = new ApiRequestError(409, { code: "already_answered", message: "이미 답한 질문입니다.", retryable: false });
  assert.deepEqual(asApiError(known), { code: "already_answered", message: "이미 답한 질문입니다.", retryable: false });
  const unknown = asApiError(new TypeError("secret internals"));
  assert.equal(unknown.code, "client_error");
  assert.ok(!unknown.message.includes("secret"));
});
