/**
 * B: 사건 개요 — 보드 접수 열 카드가 여기로 온다. 맨 위에 진행 단계 한 줄(사실 카드·판단·검토 보고서 화면과 같은 자리),
 * 제목 옆에 현재 상태, 아래에 손댈 일 안내와 사건 요약. 다른 단계 화면으로는 진행 단계 한 줄로 가고 머리글에 이동 버튼을 두지 않는다.
 * TODO: GET /cases/{id}로 복원(Realtime은 변경 알림만), 확인 질문 요약.
 */
import { CaseStatusBadge } from "@/features/cases/case-board";
import { getCaseSummary } from "@/features/cases/case-source";
import { CaseStepper } from "@/features/cases/case-stepper";
import { STAGES, currentStatus, stageIndex } from "@/lib/cases/stages";
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
  const { versions } = summary;

  return (
    <>
      <CaseStepper summary={summary} viewing="intake" />
      <PageHeader
        eyebrow="담당 사건"
        title={
          <>
            <span className="font-mono">{summary.case_id}</span>
            <span className="ml-2 inline-flex align-middle">
              <CaseStatusBadge status={currentStatus(summary)} />
            </span>
          </>
        }
        description={`현재 단계: ${stage.label} — ${stage.description}`}
      />
      <div className="flex max-w-4xl flex-col gap-6">
        {summary.open_questions > 0 && (
          <Notice tone="warning" title="추가 확인 필요">
            답하지 않은 구분 질문이 <span className="font-mono tabular-nums">{summary.open_questions}</span>건 있다. 답하면 카드를 다시 확정하고 판단을 재개한다.
          </Notice>
        )}
        {summary.task_status === "failed" && (
          <Notice tone="danger" title="작업 실패">
            마지막 작업이 실패했다. 실패 이유를 확인한 뒤 다시 시작한다.
          </Notice>
        )}
        <Card title="사건 요약">
          <DescriptionList>
            <DescriptionRow term="사고 일시">{dateTime.format(new Date(summary.accident_date))}</DescriptionRow>
            <DescriptionRow term="접수">{dateTime.format(new Date(summary.created_at))}</DescriptionRow>
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
