// 사실 카드 화면 규칙 테스트. Node가 .ts의 타입만 지우고 실행한다(런타임 import 없음).
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  acceptAiValues,
  buildCardPatch,
  cardLabel,
  cardOptions,
  cardValueLabel,
  chartPartyName,
  confirmedFields,
  egoName,
  emptyField,
  fieldsToFix,
  groupFields,
  isFromVideo,
  isRelevant,
  parseOption,
  parseSeconds,
  pick,
  readableMessage,
  readableReason,
  reasonParts,
  remainingReview,
  resetFields,
  scenarioRows,
  withScenario,
  swapChartParties,
  withAnswers,
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

test("groupFields는 확인 필요·질문 칸을 묶음 안 앞에 두고, 상관없는 칸을 따로 둔다", () => {
  const fields = {
    location_type: f("signalized_intersection"),
    signal_A: f(null, "needs_review"),
    road_priority: f("none"),
    movement_A: f("straight"),
    movement_B: f("left_turn"),
  };
  const groups = groupFields(fields, fields, ["movement_B"]);
  assert.deepEqual(groups.review, ["signal_A", "movement_B"]);
  assert.deepEqual(groups.rest, ["signal_A", "movement_B", "location_type", "movement_A"], "확인할 칸이 묶음 안에서 앞, 그 안은 카드 칸 순서");
  assert.deepEqual(groups.unused, ["road_priority"]);
});

test("groupFields는 영상 카드의 담당자 입력 칸을 따로 묶고, 질문이 오면 표시한다", () => {
  const manual = (value) => ({ ...f(value), source: "manual", model_value: null, model_confidence: null });
  const fields = {
    location_type: f("signalized_intersection"),
    movement_A: f("straight"),
    collision_signal_A: manual(null),
    lane_marking_A: manual(null),
  };
  const groups = groupFields(fields, fields);
  assert.deepEqual(groups.rest, ["location_type", "movement_A"]);
  assert.deepEqual(groups.manual, ["collision_signal_A", "lane_marking_A"]);
  const asked = groupFields(fields, fields, ["lane_marking_A"]);
  assert.deepEqual(asked.review, ["lane_marking_A"], "판단이 물은 칸은 확인할 칸");
  assert.deepEqual(asked.manual, ["lane_marking_A", "collision_signal_A"], "물은 칸은 담당자 입력 묶음 안에서 앞");
  // 영상 분석 칸이 없는 카드(모든 칸이 manual)는 따로 묶지 않는다
  const typed = { movement_A: manual("straight"), lane_marking_A: manual(null) };
  assert.deepEqual(groupFields(typed, typed).manual, []);
});

test("groupFields는 판단이 물었는데 카드에 없는 칸(11/16 전 영상 카드의 새 칸)도 줄로 둔다", () => {
  const fields = { location_type: f("highway"), movement_A: f("lane_change"), relative_position: f("right") };
  const asked = groupFields(fields, fields, ["lane_reduction"]);
  assert.deepEqual(asked.review, ["lane_reduction"]);
  assert.deepEqual(asked.manual, ["lane_reduction"], "영상 카드에서는 담당자 입력 묶음 — AI가 채운 값 묶음의 제목을 바꾸지 않는다");
  assert.deepEqual(asked.rest, ["location_type", "movement_A", "relative_position"]);
  // 영상 분석 칸이 없는 카드는 한 묶음이다
  const typed = { movement_A: { ...f("straight"), source: "manual" } };
  assert.deepEqual(groupFields(typed, typed, ["shoulder"]).rest, ["shoulder", "movement_A"]);
  // 묻지 않은 칸은 카드에 없으면 그대로 없다
  assert.equal(groupFields(fields, fields).manual.includes("lane_reduction"), false);
});

test("withAnswers는 답한 값을 칸 값으로 바꿔 미리 채우고, 카드에 없던 칸은 빈 담당자 칸에서 만든다", () => {
  const fields = { night: f(null, "needs_review"), movement_B: f("straight") };
  const filled = withAnswers(fields, { lane_reduction: "false", night: "true", movement_B: "left_turn" });
  // 참거짓 칸은 글자가 아니라 true/false다(BE 카드 수정은 글자 "true"를 거절한다)
  assert.deepEqual(filled.lane_reduction, { ...emptyField(), value: false, verification_status: "human_confirmed" });
  assert.equal(filled.night.value, true);
  assert.equal(filled.night.verification_status, "human_confirmed");
  assert.equal(filled.movement_B.value, "left_turn");
  assert.equal(filled.movement_B.model_value, "straight", "모델 원값은 그대로 둔다");
  assert.deepEqual(withAnswers(fields, {}), fields, "답이 없으면 칸을 바꾸지 않는다");
  // 빈 담당자 칸은 BE apply_patch가 없던 칸을 만들 때와 같은 모양이다
  assert.deepEqual(emptyField(), {
    value: null, model_value: null, source: "manual", model_confidence: null, verification_status: "unverified",
    evidence_frame_ids: [], source_document_ids: [],
  });
});

test("pick은 같은 값을 골라도 확인함으로 만들고 모델 원값은 둔다", () => {
  const picked = pick(f("straight", "needs_review"), "straight");
  assert.equal(picked.verification_status, "human_confirmed");
  assert.equal(picked.model_value, "straight");
  assert.deepEqual(remainingReview({ a: picked, b: f(null, "needs_review") }), ["b"]);
});

test("AI가 값을 채운 확인 필요 칸은 확정을 막지 않고, 확정할 때 그 값 그대로 확인한다", () => {
  const card = {
    version: 2,
    fields: {
      movement_B: f("right_turn", "needs_review"),
      signal_A: f(null, "needs_review"),
      signal_B: f("green"),
      movement_A: { ...pick(f("straight"), "left_turn"), model_value: "straight" },
    },
    party_mapping: mapping,
  };
  // AI가 채우지 못한(모름) 칸만 담당자가 골라야 한다
  assert.deepEqual(remainingReview(card.fields), ["signal_A"]);
  const accepted = acceptAiValues(card.fields);
  assert.equal(accepted.movement_B.verification_status, "human_confirmed");
  assert.equal(accepted.movement_B.value, "right_turn");
  assert.equal(accepted.movement_B.model_value, "right_turn");
  assert.equal(accepted.signal_A.verification_status, "needs_review", "모름 칸은 그대로");
  assert.equal(accepted.signal_B.verification_status, "unverified", "표시 없는 칸은 BE 확정이 확인한다");
  assert.equal(accepted.movement_A.value, "left_turn", "담당자가 고친 값은 그대로");
  assert.equal(card.fields.movement_B.verification_status, "needs_review", "받은 칸은 바꾸지 않는다");
  // 저장 요청에는 담당자가 고른 칸과 AI 값으로 확인한 칸만 실린다
  assert.deepEqual(Object.keys(buildCardPatch(card, accepted, mapping, "x").fields).sort(), ["movement_B"]);
  // 견본 확정은 BE처럼 값이 있는 칸을 모두 확인한다 — 모름 칸과 비운 담당자 입력 칸은 그대로
  const manual = { ...f(null), source: "manual", model_value: null, model_confidence: null };
  const confirmed = confirmedFields({ ...accepted, signal_A: pick(card.fields.signal_A, "red"), lane_marking_A: manual });
  for (const key of ["movement_B", "signal_A", "signal_B", "movement_A"]) assert.equal(confirmed[key].verification_status, "human_confirmed", key);
  assert.equal(confirmed.signal_B.value, "green");
  assert.equal(confirmed.lane_marking_A.verification_status, "unverified");
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
  // 가입자는 블랙박스 차로 고정이지만, 이전에 상대 차로 저장한 카드도 그대로 읽는다
  const other = { ...mapping, insured_party_id: "P2" };
  assert.equal(chartPartyName(other, "A"), "상대 차(가입자)");
});

test("영상 없이 진행한 카드는 카드 B를 가입자 차라고 부른다 — 칸·보기·도표 A/B 이름", () => {
  const manual = (value = null) => ({ ...f(value), source: "manual", model_value: null, model_confidence: null });
  // BE blank_card: 칸이 모두 비었고 근거 장면이 없다. 가입자 차(P1)가 카드 B 자리다
  const blank = { fields: { movement_A: manual(), movement_B: manual() }, evidence_frames: [] };
  const video = { fields: { movement_A: f("straight"), movement_B: manual() }, evidence_frames: [] };
  const edited = { fields: { movement_A: manual("straight") }, evidence_frames: [{ frame_id: "f001", timestamp_ms: 0, storage_path: null }] };
  assert.deepEqual([blank, video, edited].map(isFromVideo), [false, true, true], "담당자가 칸을 다 고쳐도 근거 장면이 남으면 영상 카드");
  assert.equal(egoName(blank), "가입자 차");
  assert.equal(egoName(video), "블랙박스 차");

  assert.equal(cardLabel("movement_B", "가입자 차"), "가입자 차 움직임");
  assert.equal(cardLabel("movement_A", "가입자 차"), "상대 차 움직임");
  assert.equal(cardLabel("movement_B"), "블랙박스 차 움직임", "이름을 주지 않으면 영상 카드 이름");
  assert.equal(cardValueLabel("road_priority", "major_B", "가입자 차"), "가입자 차 쪽이 대로");
  assert.deepEqual(cardOptions("entry_order", ["first", "second"], "가입자 차"), [["first", "상대 차"], ["second", "가입자 차"]]);
  // 가입자 차는 이미 가입자라 「(가입자)」를 다시 붙이지 않는다. 맞바꾸면 도표 A가 가입자 차다
  assert.equal(chartPartyName(mapping, "B", "가입자 차"), "가입자 차");
  assert.equal(chartPartyName(swapChartParties(mapping), "A", "가입자 차"), "가입자 차");
  assert.equal(chartPartyName(mapping, "A", "가입자 차"), "상대 차");
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

test("readableReason은 판단 사유의 도표 칸 이름을 매핑에 맞는 카드 칸 이름으로, 파이썬 목록을 괄호 목록으로 바꾼다", () => {
  // 기본 매핑: 도표 A = 상대 차(카드 A), 도표 B = 블랙박스 차(카드 B)
  const mapping = { video_ego_party_id: "P1", insured_party_id: null, chart_party_A_id: "P2", chart_party_B_id: "P1" };
  assert.equal(
    readableReason("차43-2: 카드와 불일치 ['movement_A', 'movement_B', 'relative_position']", mapping),
    "차43-2: 카드와 불일치 (상대 차 움직임, 블랙박스 차 움직임, 상대 차가 온 쪽)",
  );
  assert.equal(readableReason("도표 선택 칸 미확인: movement_B", mapping), "도표 선택 칸 미확인: 블랙박스 차 움직임");
  // 도표 A가 블랙박스 차면 도표 칸 _A는 카드 B(블랙박스 차) 칸이다(BE card_fields.is_swapped)
  const swapped = swapChartParties(mapping);
  assert.equal(
    readableReason("S-1 선택: 확인한 칸 4개 일치 (accident_type, location_type, movement_A, movement_B)", swapped),
    "S-1 선택: 확인한 칸 4개 일치 (사고 유형, 사고 장소, 블랙박스 차 움직임, 상대 차 움직임)",
  );
  assert.equal(
    readableReason("emergency_vehicle_A: 담당자 표시 없음 — 촬영 차(가입자 차)라 '아니오'로 봄", swapped),
    "블랙박스 차 긴급자동차(긴급 운행) 여부: 담당자 표시 없음 — 촬영 차(가입자 차)라 '아니오'로 봄",
  );
  assert.equal(readableReason("B-1 「synthetic B-1」: 카드와 불일치 ['two_wheeler_B']", swapped), "B-1 「synthetic B-1」: 카드와 불일치 (상대 차 이륜차 여부)");
  // 영상 없이 진행한 카드는 카드 B를 가입자 차로 부른다
  assert.equal(readableReason("카드와 불일치 ['movement_B']", mapping, "가입자 차"), "카드와 불일치 (가입자 차 움직임)");
  // 모르는 낱말과 칸 이름 속 칸 이름(collision_signal_A 속 signal_A)은 그대로 둔다
  assert.equal(readableReason("U-1: 확인 불가 칸 ['collision_signal_A', 'foo_A']", swapped), "U-1: 확인 불가 칸 (블랙박스 차 충돌 순간 신호, foo_A)");
  assert.equal(readableReason("검수한 도표 근거 없음", mapping), "검수한 도표 근거 없음");
  // 토막은 칸 이름 자리에 카드 칸을 함께 준다(화면이 그 칸으로 가는 링크를 건다) — 맞바뀐 카드는 카드 칸으로 바꾼 이름이다
  assert.deepEqual(reasonParts("차43-2: 카드와 불일치 ['movement_A', 'relative_position']", swapped), [
    "차43-2: 카드와 불일치 (",
    { key: "movement_B", label: "블랙박스 차 움직임" },
    ", ",
    { key: "relative_position", label: "상대 차가 온 쪽" },
    ")",
  ]);
  assert.deepEqual(reasonParts("검수한 도표 근거 없음", mapping), ["검수한 도표 근거 없음"]);
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

test("담당자 입력 칸(11/13)은 이름·보기가 있고 비보호 좌회전 표지는 참거짓으로 저장한다", () => {
  assert.equal(cardLabel("collision_signal_B"), "블랙박스 차 충돌 순간 신호");
  assert.equal(cardOptions("lane_marking_A").length, 6);
  // 구분 질문이 걸리면 질문의 보기만 칩으로 남는다 — 보기가 없으면 「모르겠어요」만 남아 답할 수 없다
  assert.deepEqual(cardOptions("lane_marking_B", ["left_only"]), [["left_only", "좌회전 전용"]]);
  assert.deepEqual(cardOptions("collision_signal_A", ["flashing_red"]), [["flashing_red", "적색 점멸"]]);
  assert.equal(cardValueLabel("signal_A", "flashing_yellow"), "황색 점멸");
  assert.equal(parseOption("unprotected_left_sign", "true"), true);
  assert.equal(parseOption("unprotected_left_sign", "false"), false);
  assert.equal(parseOption("lane_marking_A", "none"), "none");
  assert.equal(cardValueLabel("unprotected_left_sign", false), "없음");
  assert.equal(isRelevant("collision_signal_A", "unsignalized_intersection"), false);
  assert.equal(isRelevant("unprotected_left_sign", "signalized_intersection"), true);
  assert.equal(isRelevant("lane_marking_A", "unsignalized_intersection"), true);
  assert.equal(readableMessage("남은 칸: lane_marking_A, collision_signal_B"), "남은 칸: 상대 차 차로 노면표시, 블랙박스 차 충돌 순간 신호");
});

test("resetFields는 확정 전 카드는 받은 그대로, 확정한 카드는 AI 원값으로 되돌리고 확인을 지운다", () => {
  const fields = {
    movement_B: { ...f("left_turn", "human_confirmed"), model_value: "straight" },
    night: f("false", "human_confirmed"),
    lane_marking_A: { ...f("left_only", "human_confirmed"), model_value: null, source: "manual" },
  };
  const draft = resetFields({ status: "draft", fields });
  assert.deepEqual(draft, fields);
  const reset = resetFields({ status: "confirmed", fields });
  assert.equal(reset.movement_B.value, "straight");
  assert.equal(reset.night.value, "false");
  assert.equal(reset.lane_marking_A.value, null);
  for (const key of Object.keys(reset)) assert.equal(reset[key].verification_status, "unverified");
  assert.equal(fields.movement_B.value, "left_turn"); // 받은 카드는 바꾸지 않는다
});

test("교차로 밖 도표 칸(11/16)은 이름·보기가 있고 참거짓 칸은 bool로 저장한다", () => {
  assert.equal(cardLabel("two_wheeler_A"), "상대 차 이륜차 여부");
  assert.equal(cardLabel("roundabout_move_B", "가입자 차"), "가입자 차 회전교차로 진행");
  assert.deepEqual(cardOptions("overtake_line").map(([v]) => v), ["yellow_solid", "yellow_dashed", "white_solid", "no_passing_zone", "none"]);
  assert.deepEqual(cardOptions("roundabout_lanes", ["two_plus"]), [["two_plus", "2차로 이상"]]);
  assert.equal(cardValueLabel("movement_A", "parking_out"), "주차구획에서 출차");
  assert.equal(cardValueLabel("location_type", "parking_lot"), "주차장");
  for (const key of ["two_wheeler_B", "emergency_vehicle_A", "center_line_crossing_A", "door_open_B", "traffic_jam", "bus_stop"]) {
    assert.equal(parseOption(key, "true"), true, key);
    assert.equal(cardValueLabel(key, false), "아니요", key);
  }
  assert.equal(parseOption("u_turn_zone", "signal"), "signal", "값 칸은 글자 그대로");
  assert.equal(readableMessage("남은 칸: two_wheeler_A, roundabout_lanes, collision_signal_B"), "남은 칸: 상대 차 이륜차 여부, 회전 차로 수, 블랙박스 차 충돌 순간 신호");
});

test("isRelevant는 회전교차로 칸과 도로 상황 칸을 그 장소에서만 쓴다", () => {
  assert.equal(isRelevant("roundabout_lanes", "roundabout"), true);
  assert.equal(isRelevant("roundabout_lanes", "straight_road"), false);
  assert.equal(isRelevant("overtake_line", "straight_road"), true);
  assert.equal(isRelevant("shoulder", "highway"), true);
  assert.equal(isRelevant("center_line_crossing_A", "signalized_intersection"), false);
  assert.equal(isRelevant("traffic_jam", "unsignalized_intersection"), true, "차61-1은 신호 없는 교차로의 정체");
  assert.equal(isRelevant("traffic_jam", "parking_lot"), false);
  assert.equal(isRelevant("two_wheeler_A", "parking_lot"), true, "이륜차·긴급자동차는 어디서나");
  assert.equal(isRelevant("emergency_vehicle_B", "signalized_intersection"), true);
  assert.equal(isRelevant("signal_A", "straight_road"), false);
});

test("진로 변경 순서 칸(BE #261)은 이름·보기가 있고 일반 도로·고속도로에서 쓴다", () => {
  assert.equal(cardLabel("lane_change_timing"), "두 차 진로 변경 순서");
  assert.deepEqual(cardOptions("lane_change_timing").map(([v]) => v), ["simultaneous", "follower_first", "leader_first"]);
  assert.equal(cardValueLabel("lane_change_timing", "leader_first"), "같은 차로 앞차가 먼저");
  assert.equal(parseOption("lane_change_timing", "follower_first"), "follower_first", "값 칸은 글자 그대로");
  assert.equal(isRelevant("lane_change_timing", "straight_road"), true);
  assert.equal(isRelevant("lane_change_timing", "signalized_intersection"), false);
  assert.equal(readableMessage("남은 칸: lane_change_timing"), "남은 칸: 두 차 진로 변경 순서");
});


test("fieldsToFix는 미확인 칸과 가장 가까운 도표의 다른 칸만 고른다", () => {
  const mapping = { video_ego_party_id: "P1", insured_party_id: "P1", chart_party_A_id: "P2", chart_party_B_id: "P1" };
  assert.deepEqual(fieldsToFix(["도표 선택 칸 미확인: relative_position"], mapping), ["relative_position"]);
  const deferred = [
    "검수한 도표 근거 없음",
    "차11-3: 카드와 불일치 ['location_type', 'movement_A', 'movement_B']",
    "차43-6: 카드와 불일치 ['relative_position']",
    "그 밖에 제외한 도표 37개",
    "도표 A/B를 맞바꾸면 차43-2 「후행 직진 대 선행 진로변경」: 카드와 불일치 ['relative_position']",
    "도표 A/B를 맞바꾸면 차43-1 「차로 감소 도로 (합류) 사고」: 카드와 불일치 ['lane_reduction']",
  ];
  assert.deepEqual(fieldsToFix(deferred, mapping), ["relative_position", "lane_reduction"], "멀리 어긋난 도표(차11-3)의 칸은 칠하지 않는다");
  // 도표 A가 블랙박스 차면 카드 칸 이름으로 바꾼다
  assert.deepEqual(fieldsToFix(["S-1: 카드와 불일치 ['movement_A']"], swapChartParties(mapping)), ["movement_B"]);
  assert.deepEqual(fieldsToFix(["검수한 도표 근거 없음"], mapping), []);
});

test("scenarioRows는 BE 경우별 도표를 카드 칸 이름·보기 글자로 바꿔 카드 칸 순서로 두고, 값만 다른 경우를 한 줄로 묶는다", () => {
  // 도표 A가 블랙박스 차인 카드 — BE가 card_fields에 카드 칸 이름·값으로 바꿔 준다(도표 movement_B = 카드 movement_A, 왼쪽 ↔ 오른쪽)
  const chart11 = { chart_id: "차1-1", title: "녹색직진 대 적색직진", variant: null, base_A: 0, base_B: 100 };
  const scenarios = [
    { ...chart11, fields: { movement_B: "straight", signal_A: "green", signal_B: "red", relative_position: "left" }, card_fields: { movement_A: "straight", signal_B: "green", signal_A: "red", relative_position: "right" } },
    { ...chart11, fields: { movement_B: "straight", signal_A: "green", signal_B: "red", relative_position: "right" }, card_fields: { movement_A: "straight", signal_B: "green", signal_A: "red", relative_position: "left" } },
    {
      fields: { movement_B: "stopped", door_open_B: "true", secondary_collision: "false" },
      card_fields: { movement_A: "stopped", door_open_A: "true", secondary_collision: "false" },
      chart_id: "차52-1", title: "", variant: "가", base_A: 20, base_B: 80,
    },
  ];
  assert.deepEqual(scenarioRows(scenarios), [
    {
      chartId: "차1-1", title: "녹색직진 대 적색직진", variant: null, baseA: 0, baseB: 100,
      conditions: [
        { key: "signal_A", label: "상대 차 신호", values: ["적색"] },
        { key: "signal_B", label: "블랙박스 차 신호", values: ["녹색"] },
        { key: "movement_A", label: "상대 차 움직임", values: ["직진"] },
        // 온 쪽만 다른 두 경우는 한 줄이 되고, 값은 그 칸의 보기 순서다(BE 순서는 오른쪽·왼쪽)
        { key: "relative_position", label: "상대 차가 온 쪽", values: ["왼쪽 도로에서", "오른쪽 도로에서"] },
      ],
      // 「이 값으로 고치기」는 값이 여럿인 칸에 보기 순서의 첫 값을 넣는다
      cardFields: { signal_A: "red", signal_B: "green", movement_A: "straight", relative_position: "left" },
    },
    {
      // 참거짓 칸은 그 칸의 보기 글자(예·아니요)로, 빈 제목은 null로
      chartId: "차52-1", title: null, variant: "가", baseA: 20, baseB: 80,
      conditions: [
        { key: "movement_A", label: "상대 차 움직임", values: ["정차·주정차"] },
        { key: "door_open_A", label: "상대 차 문 열림", values: ["예"] },
        { key: "secondary_collision", label: "앞차가 사고로 정차 중(2차 사고)", values: ["아니요"] },
      ],
      cardFields: { movement_A: "stopped", door_open_A: "true", secondary_collision: "false" },
    },
  ]);
  // 영상 없이 진행한 카드는 카드 B를 가입자 차로 부른다
  assert.equal(scenarioRows(scenarios, "가입자 차")[0].conditions[1].label, "가입자 차 신호");
});

test("scenarioRows는 두 칸이 2×2로 갈린 경우 넷을 한 줄로 묶고, 비율·변형·칸이 다른 경우는 따로 둔다", () => {
  const chart = { chart_id: "차2-4", title: "황(적)색 직진 대 황(적)색 좌회전(동일신호)", variant: null, base_A: 50, base_B: 50 };
  const grid = ["yellow", "red"].flatMap((a) => ["yellow", "red"].map((b) => ({ ...chart, fields: {}, card_fields: { movement_A: "left_turn", signal_A: a, signal_B: b } })));
  const rows = scenarioRows([
    ...grid,
    // 같은 도표라도 변형·비율이 다르면 묶지 않는다
    { ...chart, variant: "나", base_A: 60, base_B: 40, fields: {}, card_fields: { movement_A: "left_turn", signal_A: "green", signal_B: "red" } },
    // 칸 구성이 다르면(표지 칸이 더 있음) 묶지 않는다
    { ...chart, fields: {}, card_fields: { movement_A: "left_turn", signal_A: "green", signal_B: "green", unprotected_left_sign: "false" } },
    // 두 칸이 다른 경우(신호 둘 다 다름)는 묶으면 없는 조합이 생기므로 따로 둔다
    { ...chart, fields: {}, card_fields: { movement_A: "left_turn", signal_A: "flashing_red", signal_B: "flashing_yellow" } },
  ]);
  assert.deepEqual(rows.map((row) => [row.variant, row.baseA, ...row.conditions.map((c) => `${c.key}=${c.values.join("|")}`)]), [
    [null, 50, "signal_A=황색|적색", "signal_B=황색|적색", "movement_A=좌회전"],
    [null, 50, "signal_A=녹색", "signal_B=녹색", "unprotected_left_sign=없음", "movement_A=좌회전"],
    [null, 50, "signal_A=적색 점멸", "signal_B=황색 점멸", "movement_A=좌회전"],
    ["나", 60, "signal_A=녹색", "signal_B=적색", "movement_A=좌회전"],
  ]);
});

test("scenarioRows는 카드 칸 이름·값이 없는 예전 결과(11/17 정오 전 저장분)와 경우가 없는 결과를 줄로 만들지 않는다", () => {
  const old = [{ fields: { movement_B: "left_turn", signal_A: "green" }, chart_id: "차44-1", variant: null, base_A: 20, base_B: 80 }];
  assert.deepEqual(scenarioRows(old), []);
  assert.deepEqual(scenarioRows(undefined), []);
  assert.deepEqual(scenarioRows([]), []);
});

test("withScenario는 경우의 칸 값을 담당자가 고른 값으로 한 번에 넣고, 카드에 없는 칸은 새로 만든다", () => {
  const fields = { signal_A: f("unknown", "human_confirmed"), movement_A: f("left_turn"), weather: f("clear") };
  const next = withScenario(fields, { signal_A: "red", movement_A: "straight", door_open_A: "true" });
  assert.deepEqual(next.signal_A, pick(fields.signal_A, "red"));
  assert.deepEqual(next.movement_A, pick(fields.movement_A, "straight"));
  // 참거짓 칸은 원값 글자를 참거짓으로
  assert.deepEqual(next.door_open_A, pick(emptyField(), true));
  // 다른 칸·원래 카드는 그대로
  assert.equal(next.weather, fields.weather);
  assert.equal(fields.signal_A.value, "unknown");
});
