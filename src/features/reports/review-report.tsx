/** D: 보고서 컨테이너 초안. TODO: 1~9항목·승인/이력·버전별 조회 연결. */
import type { ReviewReport as ReviewReportData } from "../../lib/api/types";
import { JudgmentPanel } from "../judgment/judgment-panel";
import { EvidencePanel } from "../evidence/evidence-panel";
import { CalculationPanel } from "../calculation/calculation-panel";
import { ClaimPackagePanel } from "../claims/claim-package-panel";
export function ReviewReport({ report }: { report: ReviewReportData }) {
  return <article aria-label="과실비율 검토 초안">
    <h1>과실비율 검토 초안 · v{report.versions.report_version}</h1>
    <p>{report.approval_status === "approved" ? "담당자 승인 완료" : "담당자 검토 전"}</p>
    <JudgmentPanel result={report.judgment} />
    <EvidencePanel hits={report.judgment.evidence} />
    <CalculationPanel result={report.calculation} />
    <ClaimPackagePanel amounts={report.recovery} />
  </article>;
}
