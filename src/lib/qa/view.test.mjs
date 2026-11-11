// 근거 질의응답 화면 규칙 테스트. Node가 .ts의 타입만 지우고 실행한다(런타임 import 없음).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  QA_CORPUS_LABELS,
  QA_MAX_LENGTH,
  QA_SOURCE_LABELS,
  QA_TOOL_LABELS,
  citationSource,
  hypothesisKind,
  pagesLabel,
  questionProblem,
  splitAnswer,
  toolLabel,
} from "./view.ts";

const contracts = JSON.parse(readFileSync(new URL("../../fixtures/contracts.json", import.meta.url), "utf8"));
const sample = contracts.qa_answer;

test("빈 질문과 BE 한도(2000자)를 넘는 질문은 보내지 않는다", () => {
  assert.equal(questionProblem("  \n "), "질문을 입력한다.");
  assert.equal(questionProblem("가".repeat(QA_MAX_LENGTH)), null);
  assert.match(questionProblem("가".repeat(QA_MAX_LENGTH + 1)), /2000자까지/);
  assert.equal(questionProblem("왜 B가 80인가요?"), null);
});

test("답 본문을 글과 근거 표시로 나눈다", () => {
  const known = new Set(["E1", "E2", "E3"]);
  assert.deepEqual(splitAnswer("공식은 20:80이다 [E1]. 가정은 50:50 [E2, E3].", known), [
    { kind: "text", text: "공식은 20:80이다 " },
    { kind: "ref", refs: ["E1"] },
    { kind: "text", text: ". 가정은 50:50 " },
    { kind: "ref", refs: ["E2", "E3"] },
    { kind: "text", text: "." },
  ]);
  // 인용 목록에 없는 표시는 링크로 만들지 않는다
  assert.deepEqual(splitAnswer("근거 [E9] 없음", known), [{ kind: "text", text: "근거 [E9] 없음" }]);
  assert.deepEqual(splitAnswer("[E1]", known), [{ kind: "ref", refs: ["E1"] }]);
  assert.deepEqual(splitAnswer("", known), []);
});

test("BE 견본(qa_answer)의 표시는 모두 인용 목록에 있다", () => {
  const known = new Set(sample.citations.map((c) => c.ref));
  const refs = splitAnswer(sample.answer, known).filter((p) => p.kind === "ref").flatMap((p) => p.refs);
  assert.deepEqual(refs, ["E1"]);
  assert.ok(QA_CORPUS_LABELS[sample.citations[0].corpus]);
});

test("도구·쪽 표기", () => {
  assert.deepEqual(Object.keys(QA_TOOL_LABELS), ["get_judgment_log", "search_dispute_cases", "search_policy_terms", "simulate"]);
  assert.equal(toolLabel("simulate"), "가정 실행");
  assert.equal(toolLabel("새 도구"), "새 도구");
  assert.equal(pagesLabel({ page_start: 3, page_end: 3 }), "3쪽");
  assert.equal(pagesLabel({ page_start: 3, page_end: 5 }), "3–5쪽");
});

test("가정 결과 종류 — 판정·확인할 칸·실패", () => {
  const [judged] = sample.hypotheticals;
  assert.equal(hypothesisKind(judged), "judged");
  assert.equal(hypothesisKind({ ...judged, status: "waiting_for_confirmation", judgment_status: null, open_fields: ["signal_B"] }), "needs_fields");
  const error = { code: "dependency_not_ready", message: "검색 색인 미연결", retryable: false };
  assert.equal(hypothesisKind({ ...judged, status: "failed", judgment_status: null, error }), "failed");
  // 완료인데 판정이 비면 판정으로 그리지 않는다
  assert.equal(hypothesisKind({ ...judged, judgment_status: null }), "failed");
});

test("인용 근거 출처 — 가정 실행의 근거만 가정으로 가르고, 출처가 없는 예전 응답은 표시하지 않는다", () => {
  assert.deepEqual(Object.keys(QA_SOURCE_LABELS), ["official", "search", "hypothesis"]);
  assert.deepEqual(citationSource({ source: "official" }), { label: "공식 판단 근거", hypothetical: false });
  assert.deepEqual(citationSource({ source: "search" }), { label: "검색 결과", hypothetical: false });
  assert.deepEqual(citationSource({ source: "hypothesis" }), { label: "가정 실행 근거", hypothetical: true });
  assert.equal(citationSource({}), null, "BE #94 전 응답");
  assert.equal(citationSource({ source: "unknown" }), null);
});

test("BE 견본(qa_answer)의 인용에는 출처가 있다", () => {
  for (const citation of sample.citations) assert.ok(citationSource(citation), citation.ref);
});
