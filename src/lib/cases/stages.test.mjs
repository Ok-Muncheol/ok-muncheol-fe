// 단계 보드 규칙 테스트. Node가 .ts의 타입만 지우고 실행한다(런타임 import 없음).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  BOARD_COLUMNS,
  STAGES,
  boardColumnOf,
  columnIndex,
  countByColumn,
  currentStatus,
  listByIntake,
  needsAttention,
  stageHref,
  stepHref,
  summarizeBoard,
} from "./stages.ts";

const versions = { case_id: "SYN-1", fact_card_version: 1, judgment_version: null, report_version: null };
const base = {
  case_id: "SYN-1", accident_date: "2026-11-01T10:00:00+09:00", created_at: "2026-11-01T12:00:00+09:00", input_path: "video", stage: "intake",
  task_status: null, judgment_status: null, approval_status: null, open_questions: 0, versions, updated_at: "2026-11-09T09:00:00+09:00",
};
const make = (over) => ({ ...base, ...over, versions: { ...versions, ...(over.versions ?? {}) } });

test("stageHref는 현재 단계 화면으로 간다", () => {
  assert.equal(stageHref(make({ stage: "intake" })), "/cases/SYN-1");
  assert.equal(stageHref(make({ stage: "analysis" })), "/cases/SYN-1");
  assert.equal(stageHref(make({ stage: "facts" })), "/cases/SYN-1/judgment", "사실 카드는 판단 화면에 합쳤다");
  assert.equal(stageHref(make({ stage: "judgment" })), "/cases/SYN-1/judgment");
  assert.equal(stageHref(make({ stage: "report", versions: { report_version: 2 } })), "/cases/SYN-1/reports/2");
  assert.equal(stageHref(make({ stage: "report" })), "/cases/SYN-1", "보고서 버전이 없으면 상세로");
  assert.equal(stageHref(make({ case_id: "a/b" })), "/cases/a%2Fb");
});

test("진행 단계 한 줄은 보드와 같은 세 단계이고, 단계를 누르면 그 단계 화면으로 간다", () => {
  assert.deepEqual(["intake", "analysis", "facts", "judgment", "report"].map(columnIndex), [0, 0, 1, 1, 2]);
  const at = (stage, report_version = null) => make({ stage, versions: { report_version } });
  // 접수는 늘 사건 개요
  assert.equal(stepHref(at("report", 2), "intake"), "/cases/SYN-1");
  // 판단은 늘 판단 화면(사실 카드를 합쳤다) — 사실 카드 단계·판단 단계·지난 단계·아직 오지 않은 단계 모두
  assert.equal(stepHref(at("facts"), "judgment"), "/cases/SYN-1/judgment");
  assert.equal(stepHref(at("judgment"), "judgment"), "/cases/SYN-1/judgment");
  assert.equal(stepHref(at("report", 2), "judgment"), "/cases/SYN-1/judgment");
  assert.equal(stepHref(at("intake"), "judgment"), "/cases/SYN-1/judgment");
  // 검토 보고서는 최신 보고서, 없으면 보고서 자리(칸을 비운 화면)
  assert.equal(stepHref(at("report", 2), "report"), "/cases/SYN-1/reports/2");
  assert.equal(stepHref(at("intake"), "report"), "/cases/SYN-1/reports");
  assert.equal(stepHref(make({ case_id: "a/b" }), "report"), "/cases/a%2Fb/reports");
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

test("보드 열은 접수(접수·영상 분석)·판단(사실 카드·판단)·검토 보고서 셋이고 모든 단계가 열 하나에만 들어간다", () => {
  assert.deepEqual(
    BOARD_COLUMNS.map((col) => [col.label, col.stages]),
    [
      ["접수", ["intake", "analysis"]],
      ["판단", ["facts", "judgment"]],
      ["검토 보고서", ["report"]],
    ],
  );
  // 열을 차례로 이으면 진행 단계 순서 그대로다 — 단계가 빠지거나 두 열에 겹치지 않는다
  assert.deepEqual(BOARD_COLUMNS.flatMap((col) => col.stages), STAGES.map((s) => s.key));
  assert.equal(boardColumnOf("analysis").key, "intake");
  assert.equal(boardColumnOf("facts").key, "judgment");
  assert.throws(() => boardColumnOf("calculation"), /보드 열이 정해지지 않은 단계/);
});

test("countByColumn은 세 열을 모두 세고 두 단계를 묶은 열은 합쳐 센다", () => {
  const cases = [
    make({ stage: "intake" }),
    make({ stage: "analysis" }),
    make({ stage: "facts" }),
    make({ stage: "judgment" }),
    make({ stage: "judgment" }),
  ];
  assert.deepEqual(countByColumn(cases), { intake: 2, judgment: 3, report: 0 });
  assert.deepEqual(countByColumn([]), { intake: 0, judgment: 0, report: 0 });
});

test("견본 사건의 접수 시각은 사고 뒤·마지막 변경 전이고 목록에 모두 나온다", () => {
  const board = JSON.parse(readFileSync(new URL("../../fixtures/case-board.json", import.meta.url), "utf8")).cases;
  for (const c of board) {
    assert.ok(Date.parse(c.accident_date) <= Date.parse(c.created_at), `${c.case_id} 사고 뒤 접수`);
    assert.ok(Date.parse(c.created_at) <= Date.parse(c.updated_at), `${c.case_id} 변경 전 접수`);
  }
  assert.equal(listByIntake(board).rest.length, board.length);
});

test("사건 목록은 고정한 사건을 따로 위에 두고 둘 다 접수 순이다", () => {
  // 문자열로 비교하면 SECOND가 앞이지만 시각은 FIRST(00:30Z)가 먼저다 — 시간대가 달라도 시각으로 비교한다
  const first = make({ case_id: "B-FIRST", created_at: "2026-11-01T09:30:00+09:00" });
  const second = make({ case_id: "A-SECOND", created_at: "2026-11-01T01:00:00Z" });
  const third = make({ case_id: "C-THIRD", created_at: "2026-11-02T09:00:00+09:00" });
  assert.deepEqual(
    listByIntake([third, second, first]).rest.map((c) => c.case_id),
    ["B-FIRST", "A-SECOND", "C-THIRD"],
  );
  const { pinned, rest } = listByIntake([third, second, first], ["C-THIRD", "B-FIRST"]);
  assert.deepEqual(pinned.map((c) => c.case_id), ["B-FIRST", "C-THIRD"], "고정한 사건도 접수 순");
  assert.deepEqual(rest.map((c) => c.case_id), ["A-SECOND"]);
});

test("boardStatus는 단계마다 할 일과 상태를 가른다", async () => {
  const { boardStatus } = await import("./stages.ts");
  assert.deepEqual(boardStatus(make({ stage: "intake" })), { label: "영상 업로드 대기", tone: "turn" });
  assert.equal(boardStatus(make({ stage: "analysis", task_status: "running" })).tone, "running");
  assert.equal(boardStatus(make({ stage: "analysis", task_status: "failed" })).tone, "failed");
  assert.equal(boardStatus(make({ stage: "judgment", task_status: "waiting_for_confirmation", open_questions: 2 })).label, "질문 2건");
  assert.equal(boardStatus(make({ stage: "judgment", task_status: "completed", judgment_status: "deferred" })).tone, "turn");
  assert.equal(boardStatus(make({ stage: "report", approval_status: "approved" })).tone, "done");
  assert.equal(boardStatus(make({ stage: "report", approval_status: "draft" })).tone, "turn");
});

test("보드 보기는 주소에서 읽고, 걸러 정렬하고, 고정한 사건을 위에 둔다", async () => {
  const { parseBoardView, boardHref, boardRows, DEFAULT_VIEW } = await import("./stages.ts");
  assert.deepEqual(parseBoardView({}), DEFAULT_VIEW);
  assert.deepEqual(parseBoardView({ stage: "judgment", sort: "stale", turn: "1" }), { stage: "judgment", sort: "stale", turn: true });
  assert.deepEqual(parseBoardView({ stage: "nope", sort: ["recent"] }), { stage: "all", sort: "recent", turn: false });
  assert.equal(boardHref(DEFAULT_VIEW, {}), "/cases");
  assert.equal(boardHref(DEFAULT_VIEW, { stage: "report", turn: true }), "/cases?stage=report&turn=1");

  const a = make({ case_id: "A", stage: "intake", created_at: "2026-11-01T00:00:00Z" });
  const b = make({ case_id: "B", stage: "analysis", task_status: "running", created_at: "2026-11-03T00:00:00Z" });
  const c = make({ case_id: "C", stage: "facts", created_at: "2026-11-02T00:00:00Z" });
  const ids = (r) => r.rows.map((x) => x.case_id);
  assert.deepEqual(ids(boardRows([a, b, c], DEFAULT_VIEW)), ["A", "C", "B"]);
  assert.deepEqual(ids(boardRows([a, b, c], { ...DEFAULT_VIEW, sort: "recent" })), ["B", "C", "A"]);
  assert.deepEqual(ids(boardRows([a, b, c], DEFAULT_VIEW, ["B"])), ["B", "A", "C"]);
  assert.deepEqual(ids(boardRows([a, b, c], { ...DEFAULT_VIEW, stage: "intake" })), ["A", "B"]);
  const turn = boardRows([a, b, c], { ...DEFAULT_VIEW, turn: true });
  assert.deepEqual(ids(turn), ["A", "C"], "처리 중인 B는 빠진다");
  assert.deepEqual(turn.counts, { intake: 1, judgment: 1, report: 0 });
});

test("승인한 사건은 담당 사건 보드에서 빠지고 완료 사건에만 보인다", async () => {
  const { boardRows, boardHref, DEFAULT_VIEW, parseBoardView } = await import("./stages.ts");
  const open = make({ case_id: "OPEN", stage: "report", approval_status: "draft" });
  const done = make({ case_id: "DONE", stage: "report", approval_status: "approved" });
  const all = boardRows([open, done], DEFAULT_VIEW);
  assert.deepEqual(all.rows.map((c) => c.case_id), ["OPEN"]);
  assert.equal(all.counts.report, 1);
  assert.equal(all.done, 1);
  assert.deepEqual(boardRows([open, done], { ...DEFAULT_VIEW, stage: "done" }).rows.map((c) => c.case_id), ["DONE"]);
  assert.equal(boardHref({ ...DEFAULT_VIEW, stage: "done" }, { sort: "recent" }), "/done?sort=recent");
  assert.equal(parseBoardView({ stage: "done" }).stage, "done");
});
