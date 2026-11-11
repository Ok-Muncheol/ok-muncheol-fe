// 판단 화면 사실 카드 견본(fact-cards.json)이 담당 사건 보드 견본(case-board.json)·카드 규칙과 어긋나지 않는지 본다.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { OPTION_LABELS, isChartFieldKey } from "../lib/api/chart-scope.ts";

const read = (name) => JSON.parse(readFileSync(new URL(name, import.meta.url), "utf8"));
const board = read("./case-board.json").cases;
const cards = read("./fact-cards.json").fact_cards;
const inFacts = board.filter((c) => c.stage === "facts");

test("사실 카드 단계 사건마다 확정 전 카드가 하나 있고 보드와 버전·사고 일시가 같다", () => {
  assert.deepEqual(cards.map((c) => c.case_id).sort(), inFacts.map((c) => c.case_id).sort());
  for (const summary of inFacts) {
    const card = cards.find((c) => c.case_id === summary.case_id);
    assert.equal(card.version, summary.versions.fact_card_version, summary.case_id);
    assert.equal(card.accident_date, summary.accident_date, summary.case_id);
    assert.equal(card.status, "draft", `${summary.case_id}: 확정하면 판단 단계로 간다`);
    assert.equal(card.confirmed_by, null, summary.case_id);
    assert.equal(card.confirmed_at, null, summary.case_id);
  }
});

test("직접 입력·진술 칸에는 모델 값·확신도·프레임이 없고, 영상 없는 사건에는 영상 칸·프레임·촬영 차량이 없다", () => {
  for (const card of cards) {
    const summary = inFacts.find((c) => c.case_id === card.case_id);
    for (const [key, field] of Object.entries(card.fields)) {
      const at = `${card.case_id}.${key}`;
      if (field.source === "vision") {
        assert.equal(typeof field.model_confidence, "number", at);
      } else {
        assert.equal(field.model_value, null, at);
        assert.equal(field.model_confidence, null, `${at}: 수동 입력 확신도는 해당 없음`);
        assert.deepEqual(field.evidence_frame_ids, [], at);
      }
      if (summary.input_path === "manual") assert.notEqual(field.source, "vision", at);
    }
    if (summary.input_path === "manual") {
      assert.deepEqual(card.evidence_frames, [], card.case_id);
      assert.equal(card.party_mapping.video_ego_party_id, null, card.case_id);
    }
  }
});

test("칸은 도표 선택 칸이고 값은 허용값이거나 불명이며, 근거 프레임은 카드에 있는 프레임이다", () => {
  for (const card of cards) {
    const frameIds = new Set(card.evidence_frames.map((f) => f.frame_id));
    assert.equal(frameIds.size, card.evidence_frames.length, `${card.case_id}: 프레임 ID 중복 없음`);
    for (const [key, field] of Object.entries(card.fields)) {
      const at = `${card.case_id}.${key}`;
      assert.ok(isChartFieldKey(key), at);
      for (const value of [field.value, field.model_value]) {
        if (value !== null) assert.ok(String(value) in OPTION_LABELS[key], `${at}: ${value}`);
      }
      for (const id of field.evidence_frame_ids) assert.ok(frameIds.has(id), `${at}: ${id}`);
    }
  }
});

test("프레임에는 서명 URL이나 실제 경로를 넣지 않는다", () => {
  for (const card of cards) {
    for (const frame of card.evidence_frames) {
      assert.match(frame.storage_path, /^synthetic\//, frame.frame_id);
      assert.doesNotMatch(frame.storage_path, /https?:|token=|signature/i, frame.frame_id);
    }
  }
});
