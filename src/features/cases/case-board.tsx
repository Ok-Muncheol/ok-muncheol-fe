/**
 * B 통합: 담당 사건 보드. 위에 요약 수치, 아래에 아키텍처 단계별 열. 카드를 누르면 그 사건의 현재 단계 화면으로 간다.
 * 서버 컴포넌트다 — 상태가 없고 링크만 있다. 새로고침 복구는 페이지의 조회가 맡는다.
 */
import Link from "next/link";
import { StatusLabel } from "@/components/status-label";
import type { CaseSummary } from "@/lib/api/types";
import { STAGES, currentStatus, groupByStage, needsAttention, stageHref, summarizeBoard } from "@/lib/cases/stages";
import { Badge, Board, BoardColumn, Stat, StatStrip } from "@/ui/controls";

const dateFormat = new Intl.DateTimeFormat("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Seoul" });

/** 부모가 flex 세로 컨테이너면 보드가 남은 높이를 모두 차지한다(/cases). 아니면 내용 높이만큼만 그린다(/dev). */
export function CaseBoard({ cases, className = "" }: { cases: readonly CaseSummary[]; className?: string }) {
  const summary = summarizeBoard(cases);
  const groups = groupByStage(cases);
  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      <StatStrip>
        <Stat label="담당 사건" value={summary.total} title="진행 중인 전체" />
        <Stat label="손댈 차례" value={summary.attention} tone="warning" title="확인·답변·승인 대기" />
        <Stat label="처리 중" value={summary.running} tone="info" title="분석·판단 진행" />
        <Stat label="실패" value={summary.failed} tone="danger" title="다시 시작 필요" />
        <Stat label="승인" value={summary.approved} tone="success" title="보고서 승인 완료" />
      </StatStrip>
      <Board columns={STAGES.length} className="flex-1">
        {STAGES.map((stage) => (
          <BoardColumn key={stage.key} id={`stage-${stage.key}`} title={stage.label} description={stage.description} count={groups[stage.key].length}>
            {groups[stage.key].map((c) => (
              <CaseCard key={c.case_id} summary={c} />
            ))}
          </BoardColumn>
        ))}
      </Board>
    </div>
  );
}

function CaseCard({ summary: c }: { summary: CaseSummary }) {
  const status = currentStatus(c);
  const attention = needsAttention(c);
  return (
    <Link
      href={stageHref(c)}
      aria-label={`${c.case_id} 현재 단계로 이동`}
      className={`block rounded-control border bg-surface p-3 shadow-card transition-colors hover:border-line-strong ${attention ? "border-l-4 border-warning" : "border-line"}`}
    >
      {/* ID는 꺾지 않는다 — 열이 좁으면 배지가 아랫줄로 내려간다. */}
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <span className="font-mono text-body font-semibold tabular-nums whitespace-nowrap">{c.case_id}</span>
        <CaseStatusBadge status={status} />
      </div>
      <p className="mt-1.5 flex flex-wrap items-center gap-x-2 text-caption text-ink-muted">
        <span>사고 {dateFormat.format(new Date(c.accident_date))}</span>
        <span aria-hidden>·</span>
        <span>{c.input_path === "video" ? "영상" : "수동 입력"}</span>
        {c.versions.fact_card_version > 0 && (
          <>
            <span aria-hidden>·</span>
            <span className="font-mono tabular-nums">카드 v{c.versions.fact_card_version}</span>
          </>
        )}
      </p>
      {c.open_questions > 0 && (
        <p className="mt-1.5 text-caption text-on-warning-soft">
          구분 질문 <span className="font-mono tabular-nums">{c.open_questions}</span>건 답변 대기
        </p>
      )}
    </Link>
  );
}

/** 상태 한 가지 — 작업·판정은 StatusLabel, 승인은 보고서 배지, 아직 없으면 초안. */
export function CaseStatusBadge({ status }: { status: ReturnType<typeof currentStatus> }) {
  switch (status.kind) {
    case "task":
    case "judgment":
      return <StatusLabel status={status.status} />;
    case "approval":
      return status.status === "approved" ? (
        <Badge tone="success" dot>
          승인
        </Badge>
      ) : (
        <Badge tone="neutral" dot>
          승인 대기
        </Badge>
      );
    default:
      return (
        <Badge tone="neutral" dot>
          초안
        </Badge>
      );
  }
}
