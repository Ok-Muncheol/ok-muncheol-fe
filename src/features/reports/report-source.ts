/**
 * D·A: 검토 보고서 · 구상 청구서 조회. 견본 모드는 합성 견본(src/fixtures/reports.json), API 모드는 BE
 * GET /cases/{id}/reports/{v} · GET …/claim(담당자 토큰)이다. 로그인이 필요하면(401) 로그인 화면으로 보낸다.
 */
import { redirect } from "next/navigation";
import { isSampleSource } from "@/features/cases/case-source";
import sample from "@/fixtures/reports.json";
import { ApiRequestError, asApiError } from "@/lib/api/client";
import { createServerApiClient } from "@/lib/api/server";
import type { ApiError, ClaimPackage, ReviewReport } from "@/lib/api/types";

const REPORTS = sample.reports as unknown as ReviewReport[];
const CLAIMS = sample.claims as unknown as { case_id: string; report_version: number; package: ClaimPackage }[];

function toLogin(next: string): never {
  redirect(`/login?next=${encodeURIComponent(next)}`);
}

/** 보고서 한 버전. 없으면 report null(404), BE가 거절하거나 연결이 안 되면 error. */
export async function getReport(caseId: string, version: number): Promise<{ report: ReviewReport | null; error: ApiError | null }> {
  if (isSampleSource()) return { report: REPORTS.find((r) => r.versions.case_id === caseId && r.versions.report_version === version) ?? null, error: null };
  try {
    return { report: await createServerApiClient().getReport(caseId, version), error: null };
  } catch (error) {
    if (!(error instanceof ApiRequestError)) throw error;
    if (error.status === 401) toLogin(`/cases/${encodeURIComponent(caseId)}/reports/${version}`);
    if (error.status === 404) return { report: null, error: null };
    return { report: null, error: asApiError(error) };
  }
}

/**
 * 그 보고서 버전으로 만든 구상 청구서. 없으면 null.
 * 견본 모드는 견본 청구서가 있으면 그것을, 없으면 확인 완료를 흉내 내 보고서에서 만든 견본 청구서(sampleClaim)를 돌려준다.
 */
export async function getClaim(caseId: string, version: number): Promise<{ claim: ClaimPackage | null; html: string | null }> {
  if (isSampleSource()) {
    const kept = CLAIMS.find((c) => c.case_id === caseId && c.report_version === version)?.package;
    const report = REPORTS.find((r) => r.versions.case_id === caseId && r.versions.report_version === version);
    return { claim: kept ?? (report ? sampleClaim(report) : null), html: null };
  }
  try {
    const { package: claim, html } = await createServerApiClient().getClaim(caseId, version);
    return { claim, html };
  } catch (error) {
    if (!(error instanceof ApiRequestError)) throw error;
    if (error.status === 401) toLogin(`/cases/${encodeURIComponent(caseId)}/reports/${version}/claim`);
    return { claim: null, html: null };
  }
}

/** 견본 보고서로 만든 견본 청구서 — BE build_claim_package 모양(사건 1행). 금액이 없거나 상대 과실이 0이면 만들지 않는다. */
export function sampleClaim(report: ReviewReport): ClaimPackage | null {
  const payment = report.calculation?.insurance_payment ?? null;
  const cp = (report.calculation as { counterparty_fault?: number | null } | null)?.counterparty_fault ?? null;
  const planned = report.recovery?.planned ?? null;
  if (payment === null || cp === null || cp === 0 || planned === null) return null;
  const v = report.versions.report_version ?? 1;
  const assumptions = (report.calculation as { assumptions?: string[] } | null)?.assumptions ?? [];
  return {
    case_id: report.versions.case_id,
    package_version: 1,
    created_at: report.created_at ?? "",
    report_version: v,
    counterparty: null,
    counterparty_fault: cp,
    fault_change_reason: null,
    rows: [
      {
        claim_no: `${report.versions.case_id}-C1`,
        insured_party_id: report.party_mapping?.insured_party_id ?? null,
        coverage: "자기차량손해",
        insurance_payment: payment,
        counterparty_fault: cp,
        planned_share: planned,
        evidence_count: report.calculation?.source_document_ids.length ?? 0,
      },
    ],
    amounts: { planned, claimed: planned, recovered: null },
    basis: { "근거 조항": ["상법 제682조(제3자에 대한 보험대위)"], "기본 가정": assumptions },
    evidence: [],
    missing_evidence: ["상대 차량 수리 내역(견본)"],
    confirmed_by: "synthetic-adjuster",
    confirmed_at: report.approved_at ?? report.created_at ?? "",
    idempotency_key: `${report.versions.case_id}-r${v}-p1`,
    rule_version: report.calculation?.rule_version ?? "",
    rule_notice: "예시 규칙 기준 — 약관 검수 전 초안",
    assumptions,
  };
}
