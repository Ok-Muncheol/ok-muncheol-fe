/**
 * D·B·C: 버전별 검토 보고서. 왼쪽은 보고서 본문(옥석현 ReviewReport — 판정·검증 3겹·근거·비율 초안·승인, 연결 전)이고
 * 오른쪽은 근거 질의응답(구준휘 QaSide — src/features/qa/qa-side.tsx)이다. 질의응답은 보고서를 읽으며 근거를 묻고 ‘만약 ~였다면’을
 * 가정해 보는 자리라 보고서 옆에 둔다. 가정 결과는 오른쪽에만 그리고 왼쪽 공식 보고서는 바뀌지 않는다. 좁은 화면에서는 본문 아래로 내려간다.
 * 데스크톱에서는 질의응답 패널을 왼쪽 가장자리 손잡이로 접고 펼친다(SidePanelLayout, src/ui/side-panel.tsx). 접힘 여부는 쿠키로 남는다.
 * BE는 최신 판단의 판정을 근거로 답하므로 그 판정으로 만든 최신 보고서에서만 묻는다(qaSlot, src/lib/qa/view.ts).
 * 최신 판단은 판단 조회(judgment-source)로 읽는다. 사건 요약(보드)을 못 읽어도 그린다 — API 모드는 사건 목록 API 전이다.
 * 맨 위 진행 단계 한 줄은 사건 요약이 있을 때만 그린다. 보고서가 아직 없을 때의 자리는 ../page.tsx(/reports)다.
 * 본문은 BE GET /cases/{id}/reports/{version}(견본 모드는 src/fixtures/reports.json)을 ReportView가 그린다(견적서 · 면책 · 협의 과실 · 확인 완료).
 */
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { getCaseSummary, isSampleSource } from "@/features/cases/case-source";
import { CaseHeader } from "@/features/cases/case-header";
import { getLatestJudgmentRun } from "@/features/judgment/judgment-source";
import { QA_PANEL_COOKIE, QaIcon, QaSide } from "@/features/qa/qa-side";
import { getReport } from "@/features/reports/report-source";
import { ReportView } from "@/features/reports/report-view";
import { latestJudgment, qaSlot } from "@/lib/qa/view";
import { ButtonLink, Notice, PageHeader } from "@/ui/controls";
import { SidePanelLayout } from "@/ui/side-panel";

export default async function ReportPage(props: PageProps<"/cases/[id]/reports/[version]">) {
  const { id, version } = await props.params;
  // 보고서 버전은 1부터 오르는 정수다(BE review_reports.report_version)
  const reportVersion = Number(version);
  if (!Number.isInteger(reportVersion) || reportVersion < 1) notFound();
  const live = !isSampleSource();
  const [summary, { run, error }, cookieStore, { report, error: reportError }] = await Promise.all([
    getCaseSummary(id),
    getLatestJudgmentRun(id),
    cookies(),
    getReport(id, reportVersion),
  ]);
  const qaOpen = cookieStore.get(QA_PANEL_COOKIE)?.value !== "closed";

  // 견본 모드에서 보드에 없는 번호다. API 모드는 사건 목록 API 전이라 요약 없이 판단 조회 결과로 그린다.
  if (!summary && !live) {
    return (
      <>
        <PageHeader eyebrow="담당 사건" title={<span className="font-mono">{id}</span>} />
        <Notice tone="warning" title="사건을 찾지 못했다">
          담당 사건 목록에 없는 번호다.{" "}
          <ButtonLink href="/cases" variant="quiet" size="sm">
            목록으로
          </ButtonLink>
        </Notice>
      </>
    );
  }

  const base = `/cases/${encodeURIComponent(id)}`;

  return (
    <>
      {/* 머리는 접수 · 판단 화면과 같은 모양이다(CaseHeader). 이 아래는 보고서 영역이다. */}
      <CaseHeader info={{ caseId: id, accidentDate: summary?.accident_date, assignedAt: summary?.created_at }} progress={summary} viewing="report" />
      <SidePanelLayout
        id="report-qa"
        label="근거 질의응답"
        icon={<QaIcon />}
        defaultOpen={qaOpen}
        cookieName={QA_PANEL_COOKIE}
        main={
          report ? (
            <ReportView caseId={id} report={report} live={live} claimHref={`${base}/reports/${reportVersion}/claim`} />
          ) : (
            <div className="rounded-card border border-line bg-surface px-6 py-5">
              <p className="font-semibold">{reportError ? "검토 보고서를 불러오지 못했어요" : `검토 보고서 v${reportVersion}가 없어요`}</p>
              <p className="mt-1 text-body text-ink-muted">{reportError ? reportError.message : "판단이 끝나면 보고서가 만들어져요."}</p>
            </div>
          )
        }
        panel={<QaSide caseId={id} live={live} base={base} error={error} slot={qaSlot(latestJudgment(run, summary), reportVersion)} />}
      />
    </>
  );
}
