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
  latestJudgment,
  pagesLabel,
  qaSlot,
  questionProblem,
  splitAnswer,
  toolLabel,
} from "./view.ts";

const contracts = JSON.parse(readFileSync(new URL("../../fixtures/contracts.json", import.meta.url), "utf8"));
const sample = contracts.qa_answer;
const board = JSON.parse(readFileSync(new URL("../../fixtures/case-board.json", import.meta.url), "utf8")).cases;

test("최신 판단은 판단 조회를 먼저 쓰고, 없으면(견본 보고서 단계) 사건 요약의 버전으로 고른다", () => {
  const result = { status: "draft_ready" };
  assert.deepEqual(latestJudgment({ judgment_version: 3, status: "completed", result, report_version: 4 }, null), {
    judgmentVersion: 3,
    decided: true,
    reportVersion: 4,
  });
  assert.equal(latestJudgment({ judgment_version: 3, status: "running", result: null, report_version: null }, null).decided, false);
  const summary = { task_status: "completed", judgment_status: "deferred", versions: { judgment_version: 2, report_version: 2 } };
  assert.deepEqual(latestJudgment(null, summary), { judgmentVersion: 2, decided: true, reportVersion: 2 });
  assert.equal(latestJudgment(null, { ...summary, task_status: "running" }).decided, false, "새 판단 진행 중");
  assert.equal(latestJudgment(null, { ...summary, versions: { judgment_version: null, report_version: null } }), null);
  assert.equal(latestJudgment(null, null), null);
});

test("질의응답은 최신 판정으로 만든 최신 보고서에서만 묻는다", () => {
  const latest = { judgmentVersion: 2, decided: true, reportVersion: 3 };
  assert.deepEqual(qaSlot(latest, 3), { kind: "ready", judgmentVersion: 2 });
  assert.deepEqual(qaSlot(latest, 2), { kind: "not_latest", judgmentVersion: 2, latestReport: 3 }, "지난 보고서");
  assert.deepEqual(qaSlot({ ...latest, reportVersion: null }, 1), { kind: "not_latest", judgmentVersion: 2, latestReport: null }, "최신 판정의 보고서 없음");
  assert.deepEqual(qaSlot({ ...latest, decided: false }, 3), { kind: "undecided" }, "새 판단이 판정 전");
  assert.deepEqual(qaSlot(null, 1), { kind: "undecided" });
  // 보고서를 보이지 않는 자리(보고서 전)는 어긋날 보고서가 없어 판정만 났으면 묻는다
  assert.deepEqual(qaSlot({ ...latest, reportVersion: null }, null), { kind: "ready", judgmentVersion: 2 });
  assert.deepEqual(qaSlot({ ...latest, decided: false }, null), { kind: "undecided" });
});

test("견본의 검토 보고서 단계 사건은 최신 보고서에서 물을 수 있다", () => {
  const reports = board.filter((c) => c.stage === "report");
  assert.ok(reports.length > 0);
  for (const c of reports) {
    assert.equal(qaSlot(latestJudgment(null, c), c.versions.report_version).kind, "ready", c.case_id);
  }
});

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
