/**
 * D·B·C: 버전별 검토 보고서. 왼쪽은 보고서 본문(옥석현 ReviewReport — 판정·검증 3겹·근거·비율 초안·승인, 연결 전)이고
 * 오른쪽은 근거 질의응답(구준휘 QaSide — src/features/qa/qa-side.tsx)이다. 질의응답은 보고서를 읽으며 근거를 묻고 ‘만약 ~였다면’을
 * 가정해 보는 자리라 보고서 옆에 둔다. 가정 결과는 오른쪽에만 그리고 왼쪽 공식 보고서는 바뀌지 않는다. 좁은 화면에서는 본문 아래로 내려간다.
 * 데스크톱에서는 질의응답 패널을 왼쪽 가장자리 손잡이로 접고 펼친다(SidePanelLayout, src/ui/side-panel.tsx). 접힘 여부는 쿠키로 남는다.
 * BE는 최신 판단의 판정을 근거로 답하므로 그 판정으로 만든 최신 보고서에서만 묻는다(qaSlot, src/lib/qa/view.ts).
 * 최신 판단은 판단 조회(judgment-source)로 읽는다. 사건 요약(보드)을 못 읽어도 그린다 — API 모드는 사건 목록 API 전이다.
 * 맨 위 진행 단계 한 줄은 사건 요약이 있을 때만 그린다. 보고서가 아직 없을 때의 자리는 ../page.tsx(/reports)다.
 * TODO(D): GET /cases/{id}/reports/{version}로 본문·승인 상태를 읽고 버전 비교·담당자 승인을 붙인다.
 */
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { CaseStatusBadge } from "@/features/cases/case-board";
import { getCaseSummary, isSampleSource } from "@/features/cases/case-source";
import { CaseHeader } from "@/features/cases/case-header";
import { getLatestJudgmentRun } from "@/features/judgment/judgment-source";
import { QA_PANEL_COOKIE, QaIcon, QaSide } from "@/features/qa/qa-side";
import { latestJudgment, qaSlot } from "@/lib/qa/view";
import { ButtonLink, Card, Notice, PageHeader } from "@/ui/controls";
import { SidePanelLayout } from "@/ui/side-panel";

function Version({ n }: { n: number }) {
  return <span className="font-mono tabular-nums">v{n}</span>;
}

export default async function ReportPage(props: PageProps<"/cases/[id]/reports/[version]">) {
  const { id, version } = await props.params;
  // 보고서 버전은 1부터 오르는 정수다(BE review_reports.report_version)
  const reportVersion = Number(version);
  if (!Number.isInteger(reportVersion) || reportVersion < 1) notFound();
  const live = !isSampleSource();
  const [summary, { run, error }, cookieStore] = await Promise.all([getCaseSummary(id), getLatestJudgmentRun(id), cookies()]);
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
  // 승인 상태는 보고서 조회 연결 전이라, 사건 요약이 이 버전을 최신 보고서로 가리킬 때만 안다(견본 모드)
  const approval = summary && summary.versions.report_version === reportVersion ? summary.approval_status : null;

  return (
    <>
      {/* 머리는 접수 · 판단 화면과 같은 모양이다(CaseHeader). 이 아래는 보고서 영역이다. */}
      <CaseHeader info={{ caseId: id, accidentDate: summary?.accident_date, assignedAt: summary?.created_at }} progress={summary} viewing="report" />
      <div className="mb-4">
        <h2 className="flex flex-wrap items-center gap-2 text-heading font-semibold">
          검토 보고서 <Version n={reportVersion} />
          {approval && (
            <span className="ml-2 inline-flex align-middle">
              <CaseStatusBadge status={{ kind: "approval", status: approval }} />
            </span>
          )}
        </h2>
        <p className="mt-1 text-caption text-ink-muted">
          {"판정 · 근거 · 과실비율 초안을 확인하고 승인한다. 근거 질의응답에서 근거를 묻거나 가정해 볼 수 있고, 가정 결과는 보고서를 바꾸지 않는다."}
        </p>
      </div>
      <SidePanelLayout
        id="report-qa"
        label="근거 질의응답"
        icon={<QaIcon />}
        defaultOpen={qaOpen}
        cookieName={QA_PANEL_COOKIE}
        main={
          <Card title="보고서 본문">
            <p className="text-ink-muted">준비 중 — 판정 상태 · 검증 3겹 · 근거 · 과실비율 초안과 승인 이력을 보여 준다.</p>
          </Card>
        }
        panel={<QaSide caseId={id} live={live} base={base} error={error} slot={qaSlot(latestJudgment(run, summary), reportVersion)} />}
      />
    </>
  );
}
