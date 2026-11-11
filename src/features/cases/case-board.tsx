/**
 * B 통합: 담당 사건 보드. 위에 요약 수치, 아래에 사건마다 한 줄인 표(LaneTable — 스윔레인)다.
 * 왼쪽 칸은 사건(고정 버튼·사건 ID·접수 시각), 오른쪽은 세 단계 열(접수·판단·검토 보고서 — 단계를 묶은 BOARD_COLUMNS)이고
 * 사건 카드는 그 사건이 있는 열 칸에만 놓는다. 한 줄의 사건 칸과 단계 칸은 높이가 같다.
 * 줄은 접수 순(먼저 접수한 사건이 위)이고 고정한 사건은 위에 따로 모은다(고정은 담당자 브라우저 쿠키 — src/lib/cases/pins.ts).
 * 사건 ID를 누르면 사건 개요, 카드를 누르면 그 사건의 현재 단계 화면으로 간다. 카드에는 단계 이름(영상 분석·사실 카드 등)을 단다.
 * 서버 컴포넌트다 — 고정 버튼만 클라이언트(pin-button.tsx)이고 폼으로 Server Action(pin-actions.ts)을 부른다.
 * pinned를 넘기지 않으면 고정 버튼 없이 그린다(/dev 미리보기).
 */
import Link from "next/link";
import type { ReactNode } from "react";
import { StatusLabel } from "@/components/status-label";
import type { CaseSummary } from "@/lib/api/types";
import { BOARD_COLUMNS, type BoardColumnKey, STAGES, boardColumnOf, countByColumn, currentStatus, listByIntake, needsAttention, stageHref, stageIndex, summarizeBoard } from "@/lib/cases/stages";
import { Badge, LaneGroup, LaneRow, LaneTable, Stat, StatStrip } from "@/ui/controls";
import { togglePin } from "./pin-actions";
import { PinButton } from "./pin-button";

const dateFormat = new Intl.DateTimeFormat("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Seoul" });

/** 열 머리 바탕 — 옥색을 단계가 갈수록 짙게(globals.css 단계 열 머리 토큰). 상태 톤이 아니라 열 구분이다. */
const COLUMN_TINTS: Record<BoardColumnKey, string> = {
  intake: "bg-stage-intake",
  judgment: "bg-stage-judgment",
  report: "bg-stage-report",
};

/** summaryAside는 요약 줄 오른쪽 끝에 둔다(/cases의 견본 배지). */
export function CaseBoard({ cases, pinned, summaryAside }: { cases: readonly CaseSummary[]; pinned?: readonly string[]; summaryAside?: ReactNode }) {
  const summary = summarizeBoard(cases);
  const counts = countByColumn(cases);
  const rows = listByIntake(cases, pinned ?? []);
  const lanes = BOARD_COLUMNS.map((col) => ({ key: col.key, title: col.label, description: col.description, count: counts[col.key], tint: COLUMN_TINTS[col.key] }));
  const span = lanes.length + 1;
  const row = (c: CaseSummary, isPinned: boolean) => (
    <LaneRow
      key={c.case_id}
      lanes={lanes.length}
      lane={BOARD_COLUMNS.indexOf(boardColumnOf(c.stage))}
      header={<CaseHeader summary={c} pinned={pinned === undefined ? null : isPinned} />}
    >
      <CaseCard summary={c} />
    </LaneRow>
  );
  return (
    <div className="flex flex-col gap-4">
      <StatStrip aside={summaryAside}>
        <Stat label="담당 사건" value={summary.total} title="진행 중인 전체" />
        <Stat label="손댈 차례" value={summary.attention} tone="warning" title="확인·답변·승인 대기" />
        <Stat label="처리 중" value={summary.running} tone="info" title="분석·판단 진행" />
        <Stat label="실패" value={summary.failed} tone="danger" title="다시 시작 필요" />
        <Stat label="승인" value={summary.approved} tone="success" title="보고서 승인 완료" />
      </StatStrip>
      <LaneTable
        caption="담당 사건 — 사건마다 한 줄이고, 카드는 그 사건이 지금 있는 단계 열에 놓인다"
        head={{ key: "cases", title: "사건 목록", description: "접수 순", count: cases.length }}
        lanes={lanes}
      >
        {cases.length === 0 ? (
          <LaneGroup span={span}>
            <tr>
              <td colSpan={span} className="px-4 py-6 text-center text-caption text-ink-faint">
                없음
              </td>
            </tr>
          </LaneGroup>
        ) : (
          <>
            {rows.pinned.length > 0 && (
              <LaneGroup span={span} title="고정">
                {rows.pinned.map((c) => row(c, true))}
              </LaneGroup>
            )}
            {rows.rest.length > 0 && (
              <LaneGroup span={span} title={rows.pinned.length > 0 ? "접수 순" : undefined}>
                {rows.rest.map((c) => row(c, false))}
              </LaneGroup>
            )}
          </>
        )}
      </LaneTable>
    </div>
  );
}

/** 왼쪽 칸 — 고정 버튼(pinned가 null이면 없음), 사건 개요로 가는 사건 ID, 접수 시각. */
function CaseHeader({ summary: c, pinned }: { summary: CaseSummary; pinned: boolean | null }) {
  return (
    <div className="flex items-center gap-1">
      {pinned !== null && (
        <form action={togglePin}>
          <input type="hidden" name="case_id" value={c.case_id} />
          <PinButton caseId={c.case_id} pinned={pinned} />
        </form>
      )}
      <div className="min-w-0">
        <Link
          href={`/cases/${encodeURIComponent(c.case_id)}`}
          className="font-mono font-semibold tabular-nums whitespace-nowrap text-primary-strong underline-offset-4 hover:underline"
        >
          {c.case_id}
        </Link>
        <p className="text-caption text-ink-muted">
          <time dateTime={c.created_at}>{dateFormat.format(new Date(c.created_at))}</time> 접수
        </p>
      </div>
    </div>
  );
}

/**
 * 단계 칸의 카드 — 첫 줄은 단계 이름과 상태(답할 질문이 있으면 그 수도), 둘째 줄은 사고 일시·입력 경로·카드 버전.
 * 두 줄로 맞춰 줄 높이를 고르게 한다. 손댈 사건은 왼쪽 선이 warning이다.
 */
function CaseCard({ summary: c }: { summary: CaseSummary }) {
  const status = currentStatus(c);
  const attention = needsAttention(c);
  const stage = STAGES[stageIndex(c.stage)];
  return (
    <Link
      href={stageHref(c)}
      className={`block rounded-control border bg-surface px-3 py-2 shadow-card transition-colors hover:border-line-strong ${attention ? "border-l-4 border-warning" : "border-line"}`}
    >
      <span className="sr-only">{c.case_id} </span>
      <span className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <span className="font-semibold break-keep">{stage.label}</span>
        <span className="flex items-center gap-1.5">
          {c.open_questions > 0 && (
            <Badge tone="warning">
              {/* 배지는 flex라 글 조각 사이가 벌어진다 — 한 덩어리로 감싼다 */}
              <span>
                질문 <span className="font-mono tabular-nums">{c.open_questions}</span>건
              </span>
            </Badge>
          )}
          <CaseStatusBadge status={status} />
        </span>
      </span>
      <span className="mt-1 flex flex-wrap items-center gap-x-2 text-caption text-ink-muted">
        <span>사고 {dateFormat.format(new Date(c.accident_date))}</span>
        <span aria-hidden>·</span>
        <span>{c.input_path === "video" ? "영상" : "수동 입력"}</span>
        {c.versions.fact_card_version > 0 && (
          <>
            <span aria-hidden>·</span>
            <span className="font-mono tabular-nums">카드 v{c.versions.fact_card_version}</span>
          </>
        )}
      </span>
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
