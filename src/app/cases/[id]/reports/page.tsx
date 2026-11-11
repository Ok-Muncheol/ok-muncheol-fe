/**
 * B 통합: 검토 보고서 자리 — 진행 단계 한 줄의 「검토 보고서」가 보고서 버전을 모를 때 여기로 온다.
 * 최신 보고서가 있으면 그 버전 화면(./[version])으로 보내고, 없으면 보고서 칸을 비운 틀(ReportSkeleton)을 보인다.
 * 아직 판정 전이면 아직 오지 않은 단계이고, 판정은 났는데 보고서가 없으면(보고서 생성 실패) 여기서 최신 판정을 근거로 묻는다(qaSlot의 보고서 전 자리).
 * 최신 보고서 버전은 판단 조회(API 모드 — 최신 판정으로 만든 보고서) 또는 사건 요약(견본 모드)으로 안다.
 */
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCaseSummary, isSampleSource } from "@/features/cases/case-source";
import { CaseStepper } from "@/features/cases/case-stepper";
import { getLatestJudgmentRun } from "@/features/judgment/judgment-source";
import { QA_PANEL_COOKIE, QaIcon, QaSide } from "@/features/qa/qa-side";
import { ReportSkeleton } from "@/features/reports/report-skeleton";
import { latestJudgment, qaSlot } from "@/lib/qa/view";
import { Badge, ButtonLink, Notice, PageHeader } from "@/ui/controls";
import { SidePanelLayout } from "@/ui/side-panel";

export default async function ReportsPage(props: PageProps<"/cases/[id]/reports">) {
  const { id } = await props.params;
  const live = !isSampleSource();
  const [summary, { run, error }, cookieStore] = await Promise.all([getCaseSummary(id), getLatestJudgmentRun(id), cookies()]);

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
  const latest = latestJudgment(run, summary);
  const reportVersion = latest?.reportVersion ?? summary?.versions.report_version ?? null;
  if (reportVersion !== null) redirect(`${base}/reports/${reportVersion}`);

  // 판정은 났는데 보고서가 없으면 「보고서 없음」, 판정 전이면 아직 오지 않은 단계(「작성 전」)다
  const decided = latest?.decided ?? false;
  const label = decided ? "보고서 없음" : "작성 전";

  return (
    <>
      {summary && <CaseStepper summary={summary} viewing="report" />}
      <PageHeader
        eyebrow={
          <>
            담당 사건 ·{" "}
            <Link href={base} className="font-mono text-primary-strong underline-offset-4 hover:underline">
              {id}
            </Link>
          </>
        }
        title={
          <>
            검토 보고서
            <span className="ml-2 inline-flex align-middle">
              <Badge dot>{label}</Badge>
            </span>
          </>
        }
        description={
          decided
            ? "판정은 났지만 그 판정으로 만든 검토 보고서가 없다 — 판단 화면에서 상태를 확인한다. 근거 질의응답은 최신 판정을 근거로 여기서 묻는다."
            : "아직 오지 않은 단계다 — 판정이 나면 검토 보고서가 만들어진다."
        }
      />
      <SidePanelLayout
        id="report-qa"
        label="근거 질의응답"
        icon={<QaIcon />}
        defaultOpen={cookieStore.get(QA_PANEL_COOKIE)?.value !== "closed"}
        cookieName={QA_PANEL_COOKIE}
        main={<ReportSkeleton label={label} />}
        panel={<QaSide caseId={id} live={live} base={base} error={error} slot={qaSlot(latest, null)} />}
      />
    </>
  );
}
