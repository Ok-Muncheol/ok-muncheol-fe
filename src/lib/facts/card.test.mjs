// 사실 카드 화면 규칙 테스트. Node가 .ts의 타입만 지우고 실행한다(런타임 import 없음).
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildCardPatch,
  cardOptions,
  cardValueLabel,
  chartPartyName,
  groupFields,
  isRelevant,
  parseSeconds,
  pick,
  readableMessage,
  remainingReview,
  setInsured,
  swapChartParties,
} from "./card.ts";

const f = (value, status = "unverified") => ({
  value, model_value: value, source: "vision", model_confidence: 0.9, verification_status: status,
  evidence_frame_ids: [], source_document_ids: [],
});
const mapping = { video_ego_party_id: "P1", insured_party_id: "P1", chart_party_A_id: "P2", chart_party_B_id: "P1" };

test("isRelevant는 장소에 따라 신호·도로 관계 칸을 가른다", () => {
  assert.equal(isRelevant("signal_A", "signalized_intersection"), true);
  assert.equal(isRelevant("signal_A", "unsignalized_intersection"), false);
  assert.equal(isRelevant("road_priority", "unsignalized_intersection"), true);
  assert.equal(isRelevant("road_priority", "signalized_intersection"), false);
  assert.equal(isRelevant("signal_A", null), true);
  assert.equal(isRelevant("movement_A", "highway"), true);
});

test("groupFields는 확인 필요·질문 칸을 위로, 상관없는 칸을 따로 둔다", () => {
  const fields = {
    location_type: f("signalized_intersection"),
    signal_A: f(null, "needs_review"),
    road_priority: f("none"),
    movement_A: f("straight"),
    movement_B: f("left_turn"),
  };
  const groups = groupFields(fields, fields, ["movement_B"]);
  assert.deepEqual(groups.review, ["signal_A", "movement_B"]);
  assert.deepEqual(groups.rest, ["location_type", "movement_A"]);
  assert.deepEqual(groups.unused, ["road_priority"]);
});

test("pick은 같은 값을 골라도 확인함으로 만들고 모델 원값은 둔다", () => {
  const picked = pick(f("straight", "needs_review"), "straight");
  assert.equal(picked.verification_status, "human_confirmed");
  assert.equal(picked.model_value, "straight");
  assert.deepEqual(remainingReview({ a: picked, b: f(null, "needs_review") }), ["b"]);
});

test("buildCardPatch는 바뀐 칸만 싣고 매핑은 바뀌었을 때만 싣는다", () => {
  const card = { version: 3, fields: { movement_A: f("straight"), movement_B: f("left_turn") }, party_mapping: mapping };
  const draft = { ...card.fields, movement_A: pick(card.fields.movement_A, "right_turn") };
  const patch = buildCardPatch(card, draft, mapping, " 영상 다시 확인 ");
  assert.equal(patch.expected_version, 3);
  assert.deepEqual(Object.keys(patch.fields), ["movement_A"]);
  assert.equal(patch.party_mapping, undefined);
  assert.equal(patch.reason, "영상 다시 확인");
  assert.deepEqual(buildCardPatch(card, draft, swapChartParties(mapping), "x").party_mapping.chart_party_A_id, "P1");
});

test("chartPartyName은 도표 A/B에 차 이름과 가입자를 붙인다", () => {
  assert.equal(chartPartyName(mapping, "A"), "상대 차");
  assert.equal(chartPartyName(mapping, "B"), "블랙박스 차(가입자)");
  const other = setInsured(mapping, false);
  assert.equal(other.insured_party_id, "P2");
  assert.equal(chartPartyName(other, "A"), "상대 차(가입자)");
});

test("보기·값 글자와 초 입력", () => {
  assert.deepEqual(cardOptions("movement_A", ["straight", "left_turn"]).map(([v]) => v), ["straight", "left_turn"]);
  assert.equal(cardValueLabel("night", true), "밤");
  assert.equal(cardValueLabel("collision_time_ms", 3400), "3.4초");
  assert.equal(cardValueLabel("movement_A", null), "모름");
  assert.equal(parseSeconds("3.4"), 3400);
  assert.equal(parseSeconds(""), null);
  assert.equal(parseSeconds("-1"), null);
});

test("readableMessage는 BE 메시지의 칸 이름을 화면 이름으로 바꾼다", () => {
  assert.equal(readableMessage("확인이 필요한 칸이 남았습니다: movement_A, signal_B"), "확인이 필요한 칸이 남았습니다: 상대 차 움직임, 블랙박스 차 신호");
});

test("withDefaultChart는 비어 있는 도표 A/B를 상대 차 · 블랙박스 차로 채운다", async () => {
  const { withDefaultChart, chartPartyName } = await import("./card.ts");
  const empty = { video_ego_party_id: "P1", insured_party_id: "P1", chart_party_A_id: null, chart_party_B_id: null };
  const parties = [{ party_id: "P1" }, { party_id: "P2" }];
  const filled = withDefaultChart(empty, parties);
  assert.equal(filled.chart_party_A_id, "P2");
  assert.equal(filled.chart_party_B_id, "P1");
  assert.equal(chartPartyName(filled, "A"), "상대 차");
  assert.equal(chartPartyName(filled, "B"), "블랙박스 차(가입자)");
  assert.equal(withDefaultChart(empty, undefined), empty, "당사자 목록이 없으면 그대로");
  const set = { ...empty, chart_party_A_id: "P1", chart_party_B_id: "P2" };
  assert.equal(withDefaultChart(set, parties), set, "이미 정한 매핑은 건드리지 않는다");
});
