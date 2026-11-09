/** B: 사건 상세 — 단계 표시·현재 상태·요약. TODO: GET /cases/{id}로 복원(Realtime은 변경 알림만), 확인 질문 요약. */
import { CaseStatusBadge } from "@/features/cases/case-board";
import { getCaseSummary } from "@/features/cases/case-source";
import { CaseStepper } from "@/features/cases/case-stepper";
import { STAGES, currentStatus, stageHref, stageIndex } from "@/lib/cases/stages";
import { ButtonLink, Card, DescriptionList, DescriptionRow, Empty, Notice, PageHeader } from "@/ui/controls";

const dateTime = new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Seoul" });

export default async function CasePage(props: PageProps<"/cases/[id]">) {
  const { id } = await props.params;
  const summary = await getCaseSummary(id);

  if (!summary) {
    return (
      <>
        <PageHeader eyebrow="담당 사건" title={<span className="font-mono">{id}</span>} />
        <Notice tone="warning" title="사건을 찾지 못했다">
          담당 사건 목록에 없는 번호이거나 조회 API가 아직 연결되지 않았다.{" "}
          <ButtonLink href="/cases" variant="quiet" size="sm">
            목록으로
          </ButtonLink>
        </Notice>
      </>
    );
  }

  const stage = STAGES[stageIndex(summary.stage)];
  const href = stageHref(summary);
  const isHere = href === `/cases/${encodeURIComponent(summary.case_id)}`;
  const { versions } = summary;

  return (
    <>
      <PageHeader
        eyebrow="담당 사건"
        title={<span className="font-mono">{summary.case_id}</span>}
        description={`현재 단계: ${stage.label} — ${stage.description}`}
        actions={!isHere && <ButtonLink href={href}>{stage.label} 화면으로</ButtonLink>}
      />
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card title="진행 단계" aside={<CaseStatusBadge status={currentStatus(summary)} />}>
          <CaseStepper summary={summary} />
          {summary.open_questions > 0 && (
            <div className="mt-4">
              <Notice tone="warning" title="추가 확인 필요">
                답하지 않은 구분 질문이 <span className="font-mono tabular-nums">{summary.open_questions}</span>건 있다. 답하면 카드를 다시 확정하고 판단을 재개한다.
              </Notice>
            </div>
          )}
          {summary.task_status === "failed" && (
            <div className="mt-4">
              <Notice tone="danger" title="작업 실패">
                마지막 작업이 실패했다. 실패 이유를 확인한 뒤 다시 시작한다.
              </Notice>
            </div>
          )}
        </Card>
        <Card title="사건 요약">
          <DescriptionList>
            <DescriptionRow term="사고 일시">{dateTime.format(new Date(summary.accident_date))}</DescriptionRow>
            <DescriptionRow term="입력 경로">{summary.input_path === "video" ? "영상 업로드" : "사실 카드 직접 입력"}</DescriptionRow>
            <DescriptionRow term="사실 카드">
              {versions.fact_card_version > 0 ? <span className="font-mono tabular-nums">v{versions.fact_card_version}</span> : <Empty>없음</Empty>}
            </DescriptionRow>
            <DescriptionRow term="판단">
              {versions.judgment_version === null ? <Empty>없음</Empty> : <span className="font-mono tabular-nums">v{versions.judgment_version}</span>}
            </DescriptionRow>
            <DescriptionRow term="보고서">
              {versions.report_version === null ? <Empty>없음</Empty> : <span className="font-mono tabular-nums">v{versions.report_version}</span>}
            </DescriptionRow>
            <DescriptionRow term="최근 변경">{dateTime.format(new Date(summary.updated_at))}</DescriptionRow>
          </DescriptionList>
        </Card>
      </div>
    </>
  );
}
