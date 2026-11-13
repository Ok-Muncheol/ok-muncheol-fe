// 검토 보고서 · 구상 청구서 합성 견본(reports.json)이 보드 견본 · BE 보고서 규칙과 맞는지 본다.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (name) => JSON.parse(readFileSync(new URL(name, import.meta.url), "utf8"));
const { synthetic, reports, claims } = read("./reports.json");
const board = read("./case-board.json").cases;

test("견본 표시가 있고, 보고서마다 보드의 검토 보고서 단계 사건 · 버전 · 확인 상태와 맞는다", () => {
  assert.equal(synthetic, true);
  for (const r of reports) {
    const c = board.find((x) => x.case_id === r.versions.case_id);
    assert.ok(c, r.versions.case_id);
    assert.equal(c.stage, "report", c.case_id);
    assert.deepEqual(r.versions, c.versions, c.case_id);
    assert.equal(r.approval_status, c.approval_status, c.case_id);
    assert.equal(r.approved_at !== null, r.approval_status === "approved", `${c.case_id}: 확인 시각은 확인 완료일 때만`);
  }
});

test("보고서는 1~9번 항목을 차례로 갖고, 빈 항목은 이유가 있다", () => {
  for (const r of reports) {
    assert.deepEqual(r.sections.map((s) => s.no), [1, 2, 3, 4, 5, 6, 7, 8, 9], r.versions.case_id);
    for (const s of r.sections) assert.equal(s.state === "empty", typeof s.empty_reason === "string", `${r.versions.case_id} ${s.no}`);
  }
});

test("금액은 BE 산식대로다 — 보험금 = 손해액 − 자기부담금, 구상 예정액 = 보험금 × 상대 과실(원 미만 버림)", () => {
  for (const r of reports) {
    const c = r.calculation;
    if (c.insurance_payment === null) continue;
    assert.equal(c.insurance_payment, c.recognized_damage - c.deductible, r.versions.case_id);
    assert.equal(c.counterparty_fault, r.judgment.fault_A, `${r.versions.case_id}: 도표 A가 상대 차`);
    assert.equal(r.recovery.planned, Math.floor((c.insurance_payment * c.counterparty_fault) / 100), r.versions.case_id);
    assert.equal(r.recovery.claimed, r.recovery.planned);
  }
});

test("청구서는 확인 완료한 보고서 버전으로 만들고 금액이 보고서와 같으며, 지어낸 값에는 견본 표시가 있다", () => {
  for (const { case_id, report_version, package: p } of claims) {
    const r = reports.find((x) => x.versions.case_id === case_id && x.versions.report_version === report_version);
    assert.ok(r, case_id);
    assert.equal(r.approval_status, "approved", case_id);
    assert.equal(p.amounts.claimed, r.recovery.claimed, case_id);
    assert.equal(p.rows[0].planned_share, r.recovery.planned, case_id);
    assert.ok(p.counterparty === null || p.counterparty.insurer.includes("견본"), `${case_id}: 보험사는 견본 이름`);
  }
  for (const r of reports) assert.match(r.judgment.chart_id, /견본/, `${r.versions.case_id}: 도표는 견본 ID`);
});
