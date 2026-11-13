// 판단 화면 규칙 테스트. Node가 .ts의 타입만 지우고 실행한다(런타임 import 없음).
import assert from "node:assert/strict";
import { test } from "node:test";
import { fieldLabel, optionLabel } from "../api/chart-scope.ts";
import {
  JUDGMENT_STAGES,
  UNKNOWN_CHOICE,
  answerFor,
  answerableQuestions,
  answeredValues,
  evidenceDecisions,
  fieldsToCheck,
  isStaleInput,
  judgmentEvidence,
  partyRoles,
  runBadgeStatus,
  stageLabel,
  stageSteps,
  validationLayers,
  waitingFor,
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
  // 11/13 카드 v1 담당자 입력 칸과 점멸 신호
  assert.equal(fieldLabel("collision_signal_A"), "A 충돌 순간 신호");
  assert.equal(optionLabel("collision_signal_B", "flashing_red"), "적색 점멸");
  assert.equal(optionLabel("lane_marking_A", "straight_left"), "직진·좌회전");
  assert.equal(optionLabel("unprotected_left_sign", "true"), "있음");
});

const question = (field_key, answer = null) => ({
  question_id: `q-${field_key}`, field_key, text: `${field_key}?`, options: ["a", "b"], allow_unknown: true, answer,
});
const answered = (value) => ({
  value, unknown: value === null, expected_card_version: 2, resulting_card_version: null, answered_at: "2026-11-10T10:00:00+09:00",
});

test("답할 질문은 확인 대기 실행의 questions뿐이다 — 끝났거나 실패한 실행의 질문은 BE가 거절한다", () => {
  const questions = [question("movement_B")];
  assert.deepEqual(answerableQuestions({ status: "waiting_for_confirmation", questions }), questions);
  for (const status of ["queued", "running", "completed", "failed"]) {
    assert.deepEqual(answerableQuestions({ status, questions }), [], status);
  }
});

test("확인할 칸은 완료 + 추가 확인 필요 판정의 result.questions다", () => {
  const asked = [{ question_id: "q1", field_key: "night", text: "야간?", options: ["true", "false"], allow_unknown: true }];
  assert.deepEqual(fieldsToCheck({ result: { status: "needs_confirmation", questions: asked } }), asked);
  assert.deepEqual(fieldsToCheck({ result: { status: "deferred", questions: asked } }), []);
  assert.deepEqual(fieldsToCheck({ result: null }), []);
});

test("확인 대기 실행은 남은 답 → 카드 반영 순으로 기다리고, 모두 ‘확인 불가’면 기다리지 않는다", () => {
  assert.equal(waitingFor([question("movement_B", answered(null)), question("signal_B")]), "answers");
  assert.equal(waitingFor([question("movement_B", answered(null)), question("signal_B", answered("a"))]), "card_update");
  assert.equal(waitingFor([question("movement_B", answered(null))]), null, "BE가 같은 실행을 재개한다");
});

test("카드에 반영할 값은 값으로 답한 칸만 — ‘확인 불가’와 안 답한 질문은 넣지 않는다", () => {
  const questions = [question("movement_B", answered(null)), question("signal_B", answered("a")), question("night")];
  assert.deepEqual(answeredValues(questions), { signal_B: "a" });
});

const evidenceHit = (chunkId) => ({
  chunk: {
    chunk_id: chunkId, parent_id: "synthetic-standards:S-1", page_start: 10, page_end: 10, text: "합성", metadata: {},
    document: { document_id: "synthetic-standards", corpus: "fault_standards", source_uri: "synthetic.pdf", edition: "synthetic-1",
      effective_from: "2024-01-01", effective_to: null, content_hash: "0", parser_version: "synthetic" },
  },
  score: 0.9, retrieval_version: "synthetic",
});

test("판정 근거는 도표를 고른 판정에만 있다 — 보류·도표 전에 멈춘 추가 확인은 근거 칸을 그리지 않는다", () => {
  const hits = [evidenceHit("c1")];
  assert.deepEqual(judgmentEvidence({ chart_id: "S-1", evidence: hits }), hits);
  assert.deepEqual(judgmentEvidence({ chart_id: "S-1", evidence: [] }), [], "도표는 골랐는데 근거가 비면 패널이 '근거 없음'을 알린다");
  assert.equal(judgmentEvidence({ chart_id: null, evidence: [] }), null);
});

test("판정 근거는 모두 '판단에 사용'이고 이유 칸에는 BE 값(판정 도표 ID)만 적는다", () => {
  assert.deepEqual(evidenceDecisions([evidenceHit("c1"), evidenceHit("c2")], "S-1"), {
    c1: { status: "selected", reason: "판정 도표 S-1의 근거" },
    c2: { status: "selected", reason: "판정 도표 S-1의 근거" },
  });
});
