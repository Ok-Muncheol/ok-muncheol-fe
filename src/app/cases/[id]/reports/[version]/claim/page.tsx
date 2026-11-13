/**
 * A·D: 구상 청구서 — 검토 보고서에서 「확인 완료」하면 여기로 온다. 진행 단계는 그대로 검토 보고서다.
 * 청구서는 BE GET /cases/{id}/reports/{v}/claim(견본 모드는 src/fixtures/reports.json 또는 견본 보고서로 만든 청구서)으로 읽는다.
 * 아직 없으면(확인 전 · 만들 수 없는 보고서) 검토 보고서로 돌아가게 안내한다.
 */
import { notFound } from "next/navigation";
import { CaseHeader } from "@/features/cases/case-header";
import { getCaseSummary } from "@/features/cases/case-source";
import { ClaimView } from "@/features/claims/claim-view";
import { PrintButton } from "@/features/claims/print-button";
import { getClaim } from "@/features/reports/report-source";
import { ButtonLink } from "@/ui/controls";

export default async function ClaimPage(props: PageProps<"/cases/[id]/reports/[version]/claim">) {
  const { id, version } = await props.params;
  const reportVersion = Number(version);
  if (!Number.isInteger(reportVersion) || reportVersion < 1) notFound();
  const [summary, { claim }] = await Promise.all([getCaseSummary(id), getClaim(id, reportVersion)]);
  const reportHref = `/cases/${encodeURIComponent(id)}/reports/${reportVersion}`;

  return (
    <>
      <div className="print:hidden">
        <CaseHeader info={{ caseId: id, accidentDate: summary?.accident_date, assignedAt: summary?.created_at }} progress={summary} viewing="report" />
      </div>
      <div className="max-w-3xl">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 print:hidden">
          <ButtonLink href={reportHref} variant="quiet" size="sm">
            ← 검토 보고서 v{reportVersion}
          </ButtonLink>
          {claim && <PrintButton />}
        </div>
        {claim ? (
          <ClaimView claim={claim} />
        ) : (
          <div className="rounded-card border border-line bg-surface px-6 py-5">
            <p className="font-semibold">아직 구상 청구서가 없어요</p>
            <p className="mt-1 text-body text-ink-muted">검토 보고서에서 「확인 완료」를 누르면 만들어져요. 견적서가 없거나 상대 과실이 0%면 만들지 않아요.</p>
          </div>
        )}
      </div>
    </>
  );
}
