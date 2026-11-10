// 판단 화면 규칙 테스트. Node가 .ts의 타입만 지우고 실행한다(런타임 import 없음).
import assert from "node:assert/strict";
import { test } from "node:test";
import { fieldLabel, optionLabel } from "../api/chart-scope.ts";
import {
  JUDGMENT_STAGES,
  UNKNOWN_CHOICE,
  answerFor,
  isStaleInput,
  partyRoles,
  runBadgeStatus,
  stageLabel,
  stageSteps,
  validationLayers,
} from "./view.ts";

const states = (run) => stageSteps(run).map((s) => s.state);

test("판단 단계는 BE graph.py STAGES 9단계와 같은 순서다", () => {
  assert.deepEqual(JUDGMENT_STAGES.map((s) => s.key), [
    "require_confirmed_card",
    "check_chart_scope",
    "retrieve_chart_candidates",
    "ask_or_resume",
    "select_chart_and_modifiers",
    "check_evidence",
    "review_rebuttal",
    "calculate_and_validate_fault",
    "build_judgment_result",
  ]);
  assert.equal(stageLabel("review_rebuttal"), "반박 검토");
});

test("stageSteps는 지금 단계 앞을 끝남, 뒤를 아직으로 둔다", () => {
  assert.deepEqual(states({ status: "running", stage: "retrieve_chart_candidates" }), [
    "done", "done", "running", "next", "next", "next", "next", "next", "next",
  ]);
  assert.deepEqual(states({ status: "queued", stage: "require_confirmed_card" }).slice(0, 2), ["queued", "next"]);
  assert.equal(states({ status: "failed", stage: "review_rebuttal" })[6], "failed");
  assert.equal(states({ status: "failed", stage: "review_rebuttal" })[5], "done");
  assert.equal(states({ status: "waiting_for_confirmation", stage: "ask_or_resume" })[3], "waiting");
});

test("runBadgeStatus는 끝난 실행만 판정으로 보인다", () => {
  assert.equal(runBadgeStatus({ status: "running", result: null }), "running");
  assert.equal(runBadgeStatus({ status: "failed", result: null }), "failed");
  assert.equal(runBadgeStatus({ status: "completed", result: { status: "deferred" } }), "deferred");
});

test("isStaleInput은 판단에 쓴 카드보다 새 카드가 있을 때만 참이다", () => {
  assert.equal(isStaleInput({ fact_card_version: 2 }, 3), true);
  assert.equal(isStaleInput({ fact_card_version: 2 }, 2), false);
});

test("validationLayers는 결과에 없는 층을 실행 안 함으로 둔다", () => {
  const layers = validationLayers([]);
  assert.deepEqual(layers.map((l) => l.key), ["evidence", "rebuttal", "numerical"]);
  assert.deepEqual(layers.map((l) => l.state), ["not_run", "not_run", "not_run"]);
});

test("validationLayers는 반박 성립의 종류를 남긴다", () => {
  const [evidence, rebuttal, numerical] = validationLayers([
    { layer: "evidence", passed: true, reasons: [] },
    { layer: "rebuttal", passed: false, reasons: ["야간 여부 미확인"], rebuttal_kind: "missing_fact" },
  ]);
  assert.equal(evidence.state, "passed");
  assert.equal(rebuttal.state, "failed");
  assert.equal(rebuttal.rebuttalKind, "missing_fact");
  assert.equal(numerical.state, "not_run");
});

test("같은 층을 다시 시도하면 마지막 시도가 상태를 정하고 시도는 모두 남는다", () => {
  const first = { layer: "rebuttal", passed: false, reasons: ["첫 도표 오선택"], rebuttal_kind: "wrong_chart" };
  const twice = validationLayers([first, { layer: "rebuttal", passed: false, reasons: ["차순위 도표도 오선택"], rebuttal_kind: "wrong_chart" }])[1];
  assert.equal(twice.state, "failed");
  assert.equal(twice.attempts.length, 2);
  const recovered = validationLayers([first, { layer: "rebuttal", passed: true, reasons: [] }])[1];
  assert.equal(recovered.state, "passed");
  assert.equal(recovered.rebuttalKind, null, "통과한 시도에는 반박 종류가 없다");
  assert.equal(recovered.attempts.length, 2);
});

test("answerFor는 확인 불가를 value 없는 unknown으로 보낸다", () => {
  const question = { question_id: "q1" };
  assert.deepEqual(answerFor(question, "left_turn", 2), { question_id: "q1", expected_card_version: 2, value: "left_turn", unknown: false });
  assert.deepEqual(answerFor(question, UNKNOWN_CHOICE, 2), { question_id: "q1", expected_card_version: 2, value: null, unknown: true });
});

test("partyRoles는 매핑 ID로만 가입자·촬영 차량을 맞춘다", () => {
  const mapping = { video_ego_party_id: "p2", insured_party_id: "p2", chart_party_A_id: "p1", chart_party_B_id: "p2" };
  assert.deepEqual(partyRoles(mapping, "A"), []);
  assert.deepEqual(partyRoles(mapping, "B"), ["가입자", "촬영 차량"]);
  assert.equal(partyRoles({ ...mapping, chart_party_A_id: null }, "A"), null, "매핑 전");
});

test("도표 칸 표기는 BE 값을 글자로 바꾸고 모르는 값은 그대로 둔다", () => {
  assert.equal(fieldLabel("movement_B"), "B 진행 방향");
  assert.equal(fieldLabel("lane_change_A"), "lane_change_A");
  assert.equal(optionLabel("entry_order", "first"), "A 먼저");
  assert.equal(optionLabel("night", "true"), "야간");
  assert.equal(optionLabel("signal_A", "flashing"), "flashing");
  assert.equal(optionLabel("signal_A", null), null);
});
