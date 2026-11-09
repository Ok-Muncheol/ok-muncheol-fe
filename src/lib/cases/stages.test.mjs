// 단계 보드 규칙 테스트. Node가 .ts의 타입만 지우고 실행한다(런타임 import 없음).
import assert from "node:assert/strict";
import { test } from "node:test";
import { currentStatus, groupByStage, needsAttention, stageHref, summarizeBoard, visibleStages } from "./stages.ts";

const versions = { case_id: "SYN-1", fact_card_version: 1, judgment_version: null, report_version: null };
const base = {
  case_id: "SYN-1", accident_date: "2026-11-01T10:00:00+09:00", input_path: "video", stage: "intake",
  task_status: null, judgment_status: null, approval_status: null, open_questions: 0, versions, updated_at: "2026-11-09T09:00:00+09:00",
};
const make = (over) => ({ ...base, ...over, versions: { ...versions, ...(over.versions ?? {}) } });

test("stageHref는 현재 단계 화면으로 간다", () => {
  assert.equal(stageHref(make({ stage: "intake" })), "/cases/SYN-1");
  assert.equal(stageHref(make({ stage: "analysis" })), "/cases/SYN-1");
  assert.equal(stageHref(make({ stage: "facts" })), "/cases/SYN-1/facts");
  assert.equal(stageHref(make({ stage: "judgment" })), "/cases/SYN-1/judgment");
  assert.equal(stageHref(make({ stage: "report", versions: { report_version: 2 } })), "/cases/SYN-1/reports/2");
  assert.equal(stageHref(make({ stage: "report" })), "/cases/SYN-1", "보고서 버전이 없으면 상세로");
  assert.equal(stageHref(make({ case_id: "a/b" })), "/cases/a%2Fb");
});

test("영상 없는 사건은 영상 분석 단계를 건너뛴다", () => {
  assert.deepEqual(visibleStages({ input_path: "manual" }).map((s) => s.key), ["intake", "facts", "judgment", "report"]);
  assert.equal(visibleStages({ input_path: "video" }).length, 5);
});

test("currentStatus는 승인 → 진행 중 작업 → 판정 → 완료 순으로 고른다", () => {
  assert.deepEqual(currentStatus(make({ stage: "report", approval_status: "approved", judgment_status: "draft_ready" })), { kind: "approval", status: "approved" });
  assert.deepEqual(currentStatus(make({ task_status: "running", judgment_status: "draft_ready" })), { kind: "task", status: "running" });
  assert.deepEqual(currentStatus(make({ task_status: "completed", judgment_status: "deferred" })), { kind: "judgment", status: "deferred" });
  assert.deepEqual(currentStatus(make({ task_status: "completed" })), { kind: "task", status: "completed" });
  assert.deepEqual(currentStatus(make({})), { kind: "none" });
});

test("needsAttention은 사람이 봐야 넘어가는 사건만 고른다", () => {
  assert.equal(needsAttention(make({ task_status: "waiting_for_confirmation" })), true);
  assert.equal(needsAttention(make({ judgment_status: "needs_confirmation" })), true);
  assert.equal(needsAttention(make({ judgment_status: "deferred" })), true);
  assert.equal(needsAttention(make({ open_questions: 1 })), true);
  assert.equal(needsAttention(make({ stage: "report", approval_status: "draft" })), true);
  assert.equal(needsAttention(make({ stage: "report", approval_status: "approved" })), false);
  assert.equal(needsAttention(make({ task_status: "running" })), false);
  assert.equal(needsAttention(make({ task_status: "failed" })), false, "실패는 따로 센다");
});

test("summarizeBoard는 다섯 수치를 센다", () => {
  const cases = [
    make({ task_status: "queued" }),
    make({ task_status: "running" }),
    make({ task_status: "failed" }),
    make({ stage: "facts", task_status: "waiting_for_confirmation" }),
    make({ stage: "report", approval_status: "approved" }),
  ];
  assert.deepEqual(summarizeBoard(cases), { total: 5, attention: 1, running: 2, failed: 1, approved: 1 });
});

test("groupByStage는 모든 열을 만들고 손댈 사건을 앞에 둔다", () => {
  const older = make({ case_id: "OLD", stage: "facts", task_status: "waiting_for_confirmation", updated_at: "2026-11-01T00:00:00+09:00" });
  const newer = make({ case_id: "NEW", stage: "facts", task_status: "running", updated_at: "2026-11-09T00:00:00+09:00" });
  const groups = groupByStage([newer, older]);
  assert.deepEqual(Object.keys(groups), ["intake", "analysis", "facts", "judgment", "report"]);
  assert.deepEqual(groups.facts.map((c) => c.case_id), ["OLD", "NEW"]);
  assert.deepEqual(groups.report, []);
});
