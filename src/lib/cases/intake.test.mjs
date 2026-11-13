// 새 사건 화면 규칙 테스트. Node가 .ts의 타입만 지우고 실행한다(런타임 import 없음).
import assert from "node:assert/strict";
import { test } from "node:test";
import { MAX_VIDEO_BYTES, caseTitle, todayInKorea, videoContentType, videoProblem } from "./intake.ts";

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
