// 사실 카드 화면 규칙 테스트. Node가 .ts의 타입만 지우고 실행한다(런타임 import 없음).
import assert from "node:assert/strict";
import { test } from "node:test";
import { buildPatch, changedKeys, countFields, editValue, frameTime, setConfirmed } from "./view.ts";

const vision = (value, status = "unverified") => ({
  value, model_value: "straight", source: "vision", model_confidence: 0.4, verification_status: status,
  evidence_frame_ids: ["f1"], source_document_ids: [],
});

test("editValue는 값을 바꾸면 담당자 확인으로 만들고 모델 원값·확신도·출처는 남긴다", () => {
  const field = vision("straight");
  const edited = editValue(field, "left_turn");
  assert.equal(edited.value, "left_turn");
  assert.equal(edited.verification_status, "human_confirmed");
  assert.equal(edited.model_value, "straight");
  assert.equal(edited.model_confidence, 0.4);
  assert.equal(edited.source, "vision");
  assert.equal(editValue(field, "straight"), field, "같은 값이면 그대로");
  assert.equal(editValue(field, null).verification_status, "human_confirmed", "불명도 담당자의 답이다");
});

test("setConfirmed는 값은 두고 확인만 바꾸며, 끄면 원래 상태로 돌린다", () => {
  const review = vision("straight", "needs_review");
  const on = setConfirmed(review, true, review);
  assert.equal(on.verification_status, "human_confirmed");
  assert.equal(on.value, "straight");
  assert.equal(setConfirmed(on, false, review).verification_status, "needs_review");
  const confirmed = vision("straight", "human_confirmed");
  assert.equal(setConfirmed(confirmed, false, confirmed).verification_status, "unverified");
});

test("changedKeys·buildPatch는 바뀐 칸만 기대 버전·사유와 함께 싣는다", () => {
  const card = { version: 2, fields: { a: vision("straight"), b: vision("straight") }, party_mapping: { video_ego_party_id: null, insured_party_id: "p1", chart_party_A_id: "p1", chart_party_B_id: "p2" } };
  const draft = { ...card.fields, b: editValue(card.fields.b, "u_turn") };
  assert.deepEqual(changedKeys(card.fields, card.fields), []);
  assert.deepEqual(changedKeys(card.fields, draft), ["b"]);
  const patch = buildPatch(card, draft, "  블랙박스 재확인  ");
  assert.equal(patch.expected_version, 2);
  assert.deepEqual(Object.keys(patch.fields), ["b"]);
  assert.equal(patch.reason, "블랙박스 재확인");
  assert.equal(patch.party_mapping, card.party_mapping);
});

test("countFields는 확인 상태와 불명 칸을 센다", () => {
  const counts = countFields({ a: vision("straight", "human_confirmed"), b: vision(null, "needs_review"), c: vision("straight") });
  assert.deepEqual(counts, { total: 3, confirmed: 1, needsReview: 1, unverified: 1, unknown: 1 });
});

test("frameTime은 분:초.십분의 일초로 적는다", () => {
  assert.equal(frameTime(3400), "00:03.4");
  assert.equal(frameTime(0), "00:00.0");
  assert.equal(frameTime(65250), "01:05.2");
});
