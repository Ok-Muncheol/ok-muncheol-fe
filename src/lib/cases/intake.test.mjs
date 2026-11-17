// 새 사건 화면 규칙 테스트. Node가 .ts의 타입만 지우고 실행한다(런타임 import 없음).
import assert from "node:assert/strict";
import { test } from "node:test";
import { MAX_VIDEO_BYTES, caseNo, caseTitle, todayInKorea, videoContentType, videoProblem, watchAnalysis } from "./intake.ts";

const now = new Date("2026-11-12T10:00:00+09:00");

test("caseTitle은 사고 날짜로 이름을 만들고 올해가 아니면 연도를 붙인다", () => {
  assert.equal(caseTitle("2026-11-07", now), "11월 7일 사고");
  assert.equal(caseTitle("2026-11-07T18:05:00+09:00", now), "11월 7일 사고");
  assert.equal(caseTitle("2025-12-31", now), "2025년 12월 31일 사고");
});

test("caseTitle은 한국 날짜 기준이다 — UTC로는 전날인 새벽 사고도 그날이다", () => {
  assert.equal(caseTitle("2026-11-06T16:30:00Z", now), "11월 7일 사고");
});

test("caseTitle은 날짜가 없거나 읽을 수 없으면 날짜 모르는 사고다", () => {
  assert.equal(caseTitle(null, now), "날짜 모르는 사고");
  assert.equal(caseTitle("", now), "날짜 모르는 사고");
  assert.equal(caseTitle("어제", now), "날짜 모르는 사고");
});

test("caseNo는 UUID 사건 ID를 앞 8자리로 줄이고 청구 번호는 사건 ID 부분만 줄이며 UUID가 아닌 ID는 그대로 둔다", () => {
  const id = "3f8a2c1d-5b6e-4f70-9a81-0c2d3e4f5a6b";
  assert.equal(caseNo(id), "3f8a2c1d");
  assert.equal(caseNo(`${id}-C2`), "3f8a2c1d-C2");
  assert.equal(caseNo(id.toUpperCase()), "3F8A2C1D");
  assert.equal(caseNo("SYN-2026-0105"), "SYN-2026-0105");
  assert.equal(caseNo("SYN-2026-0105-C1"), "SYN-2026-0105-C1");
  assert.equal(caseNo("3f8a2c1d"), "3f8a2c1d");
});

test("videoContentType은 형식이 비면 확장자로 고르고 받지 않는 형식은 null이다", () => {
  assert.equal(videoContentType({ name: "a.mp4", type: "video/mp4" }), "video/mp4");
  assert.equal(videoContentType({ name: "a.MKV", type: "" }), "video/x-matroska");
  assert.equal(videoContentType({ name: "a.mov", type: "video/quicktime; codecs=x" }), "video/quicktime");
  assert.equal(videoContentType({ name: "a.pdf", type: "application/pdf" }), null);
});

test("videoProblem은 형식·크기·빈 파일을 거른다", () => {
  assert.equal(videoProblem({ name: "a.mp4", type: "video/mp4", size: 1000 }), null);
  assert.match(videoProblem({ name: "a.jpg", type: "image/jpeg", size: 1000 }), /영상만/);
  assert.match(videoProblem({ name: "a.mp4", type: "video/mp4", size: MAX_VIDEO_BYTES + 1 }), /50MB/);
  assert.match(videoProblem({ name: "a.mp4", type: "video/mp4", size: 0 }), /빈 파일/);
});

test("todayInKorea는 한국 날짜다", () => {
  assert.equal(todayInKorea(new Date("2026-11-12T16:00:00Z")), "2026-11-13");
});

// BE GET /cases/{id}가 주는 모양(app/api/cases.py summarize) — 분석 단계에서만 task_status가 분석 작업 상태다.
const seen = (stage, fact_card_version, task_status = null) => ({ stage, task_status, versions: { fact_card_version } });

test("watchAnalysis는 새 사건의 분석을 카드가 생길 때까지 기다리고 실패하면 알린다", () => {
  assert.equal(watchAnalysis(seen("intake", 0), 0, true), "wait", "분석 접수 전");
  assert.equal(watchAnalysis(seen("analysis", 0, "queued"), 0, true), "wait");
  assert.equal(watchAnalysis(seen("analysis", 0, "running"), 0, true), "wait");
  assert.equal(watchAnalysis(seen("analysis", 0, "failed"), 0, true), "failed");
  assert.equal(watchAnalysis(seen("facts", 1), 0, true), "done");
  // 최신 분석 작업을 따로 실어 주는 응답(analysis)도 실패로 읽는다
  assert.equal(watchAnalysis({ stage: "analysis", task_status: "running", analysis: { status: "failed" } }, 0, true), "failed");
  // 버전이 없는 응답은 예전처럼 단계로만 가른다
  assert.equal(watchAnalysis({ stage: "facts", task_status: null }, 0, true), "done");
});

test("watchAnalysis는 카드가 있던 사건(영상 다시 올리기)을 옛 카드로 넘기지 않고 새 카드 버전이 생겨야 끝난 것으로 본다", () => {
  // 분석 접수 전 — 단계는 아직 판단 · 검토 보고서이고 카드 버전도 그대로다
  assert.equal(watchAnalysis(seen("judgment", 2, "completed"), 2, false), "wait");
  assert.equal(watchAnalysis(seen("report", 2), 2, false), "wait");
  // 판단이 실패해 있던 사건 — 판단 단계의 failed는 분석 실패가 아니다
  assert.equal(watchAnalysis(seen("judgment", 2, "failed"), 2, false), "wait");
  // 분석 중
  assert.equal(watchAnalysis(seen("analysis", 2, "running"), 2, false), "wait");
  // 분석이 끝나 분석 카드가 새 버전이 됐다
  assert.equal(watchAnalysis(seen("facts", 3), 2, true), "done");
  // 분석 단계를 못 본 채 끝나도 새 카드 버전이면 끝난 것이다
  assert.equal(watchAnalysis(seen("facts", 3), 2, false), "done");
});

test("watchAnalysis는 카드가 있던 사건의 분석이 실패해 이전 단계로 돌아오면 실패로 본다", () => {
  // 판단까지 간 사건 — 분석 단계를 본 뒤 카드 버전 그대로 판단 · 검토 보고서로 돌아왔다(BE는 이전 판단을 그대로 둔다)
  assert.equal(watchAnalysis(seen("judgment", 2, "completed"), 2, true), "failed");
  assert.equal(watchAnalysis(seen("report", 2), 2, true), "failed");
  // 카드만 있던 사건(판단 전)은 BE가 분석 단계에 실패로 둔다
  assert.equal(watchAnalysis(seen("analysis", 1, "failed"), 1, false), "failed");
});
