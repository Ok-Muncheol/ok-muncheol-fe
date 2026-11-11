// 판단 화면 견본(judgment.json)이 담당 사건 보드 견본(case-board.json)·BE 제약과 어긋나지 않는지 본다.
// 보드 판단 열에서 판단 단계 카드를 누르면 이 견본으로 화면을 그리므로, 두 파일의 상태·버전·질문 수가 같아야 한다.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { CHART_FIELD_KEYS, OPTION_LABELS } from "../lib/api/chart-scope.ts";

const read = (name) => JSON.parse(readFileSync(new URL(name, import.meta.url), "utf8"));
const board = read("./case-board.json").cases;
const { runs, fact_cards: cards } = read("./judgment.json");
const judging = board.filter((c) => c.stage === "judgment");

test("판단 단계 사건마다 판단 실행과 사실 카드 견본이 하나씩 있다", () => {
  const ids = judging.map((c) => c.case_id).sort();
  assert.deepEqual(runs.map((r) => r.case_id).sort(), ids);
  assert.deepEqual(cards.map((c) => c.case_id).sort(), ids);
  assert.equal(new Set(runs.map((r) => r.task_id)).size, runs.length, "실행 ID가 겹치지 않는다");
});

// BE는 구분 질문을 두 가지로 낸다. 화면이 둘을 따로 그리므로 견본에 둘 다 둔다.
test("답할 질문(확인 대기)과 확인할 칸(완료 + 추가 확인 필요) 견본이 모두 있다", () => {
  const waiting = runs.filter((r) => r.status === "waiting_for_confirmation");
  assert.ok(waiting.some((r) => r.questions.some((q) => q.answer === null)), "안 답한 질문");
  assert.ok(waiting.some((r) => r.questions.some((q) => q.answer !== null)), "이미 답한 질문");
  assert.ok(runs.some((r) => r.result?.status === "needs_confirmation" && r.result.questions.length > 0), "확인할 칸");
});

test("판단 실행은 보드 요약과 같은 작업 상태·판정·질문 수·버전·변경 시각이다", () => {
  for (const summary of judging) {
    const run = runs.find((r) => r.case_id === summary.case_id);
    const card = cards.find((c) => c.case_id === summary.case_id);
    const at = summary.case_id;
    assert.equal(run.status, summary.task_status, at);
    assert.equal(run.result?.status ?? null, summary.judgment_status, at);
    // 보드의 질문 수는 답할 질문(확인 대기 실행의 questions) 중 아직 안 답한 것이다 — 추가 확인 필요의 확인할 칸은 세지 않는다
    const pending = run.status === "waiting_for_confirmation" ? run.questions.filter((q) => q.answer === null).length : 0;
    assert.equal(pending, summary.open_questions, at);
    assert.equal(run.result?.versions.judgment_version ?? null, summary.versions.judgment_version, at);
    assert.equal(run.fact_card_version, summary.versions.fact_card_version, at);
    assert.equal(run.report_version, summary.versions.report_version, at);
    assert.equal(run.updated_at, summary.updated_at, at);
    assert.equal(card.version, summary.versions.fact_card_version, at);
    assert.equal(card.accident_date, summary.accident_date, at);
    assert.equal(card.status, "confirmed", `${at}: 판단은 확정 카드로만 한다`);
  }
});

test("BE judgment_runs 제약을 지킨다 — completed만 결과, failed만 오류, 과실은 초안 작성 가능일 때만", () => {
  for (const run of runs) {
    const at = run.case_id;
    assert.equal(run.status === "completed", run.result !== null, at);
    assert.equal(run.status === "failed", run.error !== null, at);
    assert.ok(run.rebuttal_retry_count >= 0 && run.rebuttal_retry_count <= 1, at);
    assert.ok(run.task_id && run.judgment_version >= 1, `${at}: 실행 ID와 판단 버전이 있다`);
    if (run.status === "waiting_for_confirmation") {
      assert.equal(run.stage, "ask_or_resume", `${at}: 구분 질문으로 멈춘 실행이다`);
      assert.ok(run.questions.length > 0, `${at}: 확인 대기면 답할 질문이 있다`);
    }
    for (const q of run.questions) {
      if (!q.answer) continue;
      assert.equal(q.answer.unknown, q.answer.value === null, `${q.question_id}: '확인 불가'면 값이 비고 값이 있으면 확인 불가가 아니다`);
      assert.equal(q.answer.expected_card_version, run.fact_card_version, `${q.question_id}: 질문을 받은 카드 버전으로 답한다`);
    }
    if (!run.result) continue;
    assert.equal(run.result.versions.judgment_version, run.judgment_version, `${at}: 결과의 판단 버전은 실행 행과 같다`);
    assert.equal(run.result.versions.case_id, at);
    assert.equal(run.result.versions.fact_card_version, run.fact_card_version, at);
    assert.ok((run.result.fault_A === null) === (run.result.fault_B === null), `${at}: A·B는 함께 비거나 함께 찬다`);
    if (run.result.status !== "draft_ready") assert.equal(run.result.fault_A, null, `${at}: 판정 전 비율을 채우지 않는다`);
    for (const check of run.result.checks) {
      if (check.layer === "rebuttal" && !check.passed) assert.ok(check.rebuttal_kind, `${at}: 반박 성립에는 종류가 있다`);
      if (!check.passed) assert.ok(check.reasons.length > 0, `${at}: 실패한 검증에는 이유가 있다`);
    }
  }
});

// BE graph.py는 검증에 걸리면 판정 사유를 [걸린 층의 표제, ...그 검증의 이유]로 만든다. 판단 화면은 검증 3겹 대신 이 사유만 보여 준다.
test("판정 사유는 BE처럼 마지막에 걸린 검증의 이유를 잇는다", () => {
  const stopped = runs.filter((run) => run.result?.checks.at(-1)?.passed === false);
  assert.ok(stopped.length > 0, "검증에 걸린 견본이 있다");
  for (const run of stopped) {
    assert.deepEqual(run.result.reasons.slice(1), run.result.checks.at(-1).reasons, run.case_id);
  }
});

test("견본에 임의 도표·과실비율을 넣지 않는다(src/fixtures/README.md)", () => {
  for (const run of runs) {
    assert.equal(run.result?.chart_id ?? null, null, run.case_id);
    assert.equal(run.result?.fault_A ?? null, null, run.case_id);
  }
});

test("구분 질문·확인할 칸은 카드에 있는 도표 칸을 묻고 보기·답은 그 칸의 허용값이다", () => {
  for (const run of runs) {
    const card = cards.find((c) => c.case_id === run.case_id);
    for (const q of [...run.questions, ...(run.result?.questions ?? [])]) {
      assert.ok(CHART_FIELD_KEYS.includes(q.field_key), q.question_id);
      assert.ok(card.fields[q.field_key], `${q.question_id}: 카드에 ${q.field_key} 칸이 있다`);
      for (const option of q.options) assert.ok(option in OPTION_LABELS[q.field_key], `${q.question_id}: ${option}`);
      if (q.answer?.value != null) assert.ok(q.options.includes(q.answer.value), `${q.question_id}: 답은 보기 중 하나다`);
    }
    for (const [key, field] of Object.entries(card.fields)) {
      if (field.value !== null) assert.ok(String(field.value) in OPTION_LABELS[key], `${run.case_id}.${key}`);
      if (field.source !== "vision") assert.equal(field.model_confidence, null, `${run.case_id}.${key}: 직접 입력은 확신도 해당 없음`);
    }
  }
});
