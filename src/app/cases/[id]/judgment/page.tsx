/**
 * B: 판단 — 담당 사건 보드의 판단 열 카드가 여기로 온다. 지금 할 일(진행 단계 · 실패 · 구분 질문)과 판정만 한 열로 둔다.
 * 검증 3겹은 따로 그리지 않는다 — BE가 걸린 검증과 그 이유를 판정 사유에 넣고(graph.py), 층별 결과는 검토 보고서가 보여 준다.
 * 판단에 쓴 사실 전체는 사실 카드 화면에서 본다. 판정 · 과실은 BE 값만 그린다.
 * TODO: 판단 조회 · 답변 · 다시 시작 API 연결(src/features/judgment/judgment-source.ts), Realtime 변경 알림이 오면 다시 조회한다.
 */
import Link from "next/link";
import type { ReactNode } from "react";
import { StatusLabel } from "@/components/status-label";
import { getCaseSummary } from "@/features/cases/case-source";
import { getFactCard } from "@/features/facts/fact-source";
import { JudgmentOutcome } from "@/features/judgment/judgment-panel";
import { JudgmentProgress } from "@/features/judgment/judgment-progress";
import { getLatestJudgmentRun } from "@/features/judgment/judgment-source";
import { QuestionPanel } from "@/features/judgment/question-panel";
import { RetryJudgment } from "@/features/judgment/retry-judgment";
import type { JudgmentRun, PartyMapping } from "@/lib/api/types";
import { stageIndex } from "@/lib/cases/stages";
import { isStaleInput, partyRoles, runBadgeStatus, stageLabel } from "@/lib/judgment/view";
import { Badge, ButtonLink, Card, Empty, Notice, PageHeader } from "@/ui/controls";

function Version({ n }: { n: number }) {
  return <span className="font-mono tabular-nums">v{n}</span>;
}

export default async function JudgmentPage(props: PageProps<"/cases/[id]/judgment">) {
  const { id } = await props.params;
  const [summary, run, card] = await Promise.all([getCaseSummary(id), getLatestJudgmentRun(id), getFactCard(id)]);

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

  const base = `/cases/${encodeURIComponent(summary.case_id)}`;
  const factsHref = `${base}/facts`;
  const eyebrow = (
    <>
      담당 사건 ·{" "}
      <Link href={base} className="font-mono text-primary-strong underline-offset-4 hover:underline">
        {summary.case_id}
      </Link>
    </>
  );
  const title = (badge: ReactNode) => (
    <>
      판단 <span className="ml-2 inline-flex align-middle">{badge}</span>
    </>
  );

  if (!run) {
    // 판단 전 사건(사실 카드 단계까지)이거나, 보고서 단계인데 판단 기록을 못 읽은 경우다.
    const beforeJudgment = stageIndex(summary.stage) < stageIndex("judgment");
    const badge = beforeJudgment ? (
      <Badge dot>판단 전</Badge>
    ) : summary.judgment_status ? (
      <StatusLabel status={summary.judgment_status} />
    ) : (
      <Badge dot>기록 없음</Badge>
    );
    return (
      <div className="max-w-4xl">
        <PageHeader eyebrow={eyebrow} title={title(badge)} />
        <Notice tone="info" title={beforeJudgment ? "아직 판단할 수 없다" : "판단 기록을 불러오지 못했다"}>
          {beforeJudgment ? "사실 카드를 확정하면 판단을 시작한다." : "판단 조회 API 연결 전이다. 합성 견본은 판단 단계 사건에만 있다."}{" "}
          <ButtonLink href={beforeJudgment ? factsHref : base} variant="quiet" size="sm">
            {beforeJudgment ? "사실 카드로" : "사건 개요로"}
          </ButtonLink>
        </Notice>
      </div>
    );
  }

  const { result } = run;
  const latestCard = summary.versions.fact_card_version;
  const reportVersion = summary.versions.report_version;

  // 한 열로 두고 폭을 줄인다 — 할 일과 판정만 남아 1280px 전체로 펴면 줄이 너무 길다.
  return (
    <div className="max-w-4xl">
      <PageHeader
        eyebrow={eyebrow}
        title={title(<StatusLabel status={runBadgeStatus(run)} />)}
        description={describe(run)}
        actions={
          <>
            <ButtonLink href={factsHref} variant="secondary">
              사실 카드 화면으로
            </ButtonLink>
            {result?.status === "draft_ready" && reportVersion !== null && (
              <ButtonLink href={`${base}/reports/${reportVersion}`}>
                검토 보고서 <Version n={reportVersion} />
              </ButtonLink>
            )}
          </>
        }
      />
      <div className="flex flex-col gap-6">
        {isStaleInput(run, latestCard) && (
          <Notice tone="warning" title="새 사실 카드가 있다">
            판단에 쓴 카드는 <Version n={run.fact_card_version} />이고 최신 카드는 <Version n={latestCard} />이다. 새 카드를 확정한 뒤 다시
            판단한다.
          </Notice>
        )}
        {run.status === "failed" && <FailureNotice run={run} />}
        {run.status !== "completed" && (
          <Card title="판단 진행">
            <JudgmentProgress run={run} />
            {PROGRESS_NOTE[run.status] && <p className="mt-4 text-caption text-ink-muted">{PROGRESS_NOTE[run.status]}</p>}
          </Card>
        )}
        {result && result.questions.length > 0 && (
          <Card
            title="구분 질문"
            aside={
              <Badge tone="warning" dot>
                <span>
                  답변 대기 <span className="font-mono tabular-nums">{result.questions.length}</span>건
                </span>
              </Badge>
            }
          >
            <p className="text-caption text-ink-muted">답하면 사실 카드 새 버전이 생긴다. 사실 카드 화면에서 그 카드를 확정하면 판단을 재개한다.</p>
            {card && <ChartParties mapping={card.party_mapping} />}
            <div className="mt-4">
              <QuestionPanel questions={result.questions} expectedCardVersion={result.versions.fact_card_version} fields={card?.fields ?? {}} />
            </div>
          </Card>
        )}
        {result && <JudgmentOutcome result={result} />}
      </div>
    </div>
  );
}

/** 머리글 설명 — 지금 상태에서 담당자가 할 일 한 줄. */
function describe(run: JudgmentRun): ReactNode {
  const stage = stageLabel(run.stage);
  switch (run.status) {
    case "queued":
      return (
        <>
          판단 대기 — 차례가 오면 사실 카드 <Version n={run.fact_card_version} />로 시작한다.
        </>
      );
    case "running":
      return `판단 진행 중 — 지금 ${stage} 단계다.`;
    case "waiting_for_confirmation":
      return `${stage} 단계에서 담당자 확인을 기다린다.`;
    case "failed":
      return `${stage} 단계에서 판단이 멈췄다. 실패 이유를 확인한다.`;
    case "completed": {
      if (!run.result) return "판단을 마쳤다.";
      switch (run.result.status) {
        case "draft_ready":
          return "검토 초안을 만들 수 있다. 검토 보고서에서 근거와 비율을 확인하고 승인한다.";
        case "deferred":
          return "판단 보류 — 사유를 확인한다. 사실이 틀렸으면 사실 카드를 고쳐 다시 확정한 뒤 다시 판단한다.";
        case "needs_confirmation": {
          const n = run.result.questions.length;
          return n > 0 ? `구분 질문 ${n}건에 답하면 사실 카드를 다시 확정하고 판단을 재개한다.` : "추가 확인이 필요하다. 사유를 확인한다.";
        }
      }
    }
  }
}

const PROGRESS_NOTE: Partial<Record<JudgmentRun["status"], string>> = {
  queued: "앞 작업이 끝나면 시작한다. 이 화면을 닫아도 판단은 이어진다.",
  running: "이 화면을 닫아도 판단은 이어진다. 다시 열면 진행 상태를 새로 읽는다.",
  waiting_for_confirmation: "담당자 확인이 끝나면 이어서 판단한다.",
};

function FailureNotice({ run }: { run: JudgmentRun }) {
  const { error } = run;
  return (
    <Notice tone="danger" title="판단 실패">
      <p>{error?.message ?? "실패 이유를 받지 못했다."}</p>
      {error && (
        <p className="mt-1 text-caption">
          오류 코드 <span className="font-mono">{error.code}</span> ·{" "}
          {error.retryable ? "같은 카드로 다시 시작할 수 있다." : "자동으로 다시 시작할 수 없다. 사건 번호와 오류 코드로 원인을 확인한다."}
        </p>
      )}
      {error?.retryable && (
        <div className="mt-3">
          <RetryJudgment cardVersion={run.fact_card_version} />
        </div>
      )}
    </Notice>
  );
}

/**
 * 구분 질문은 도표 A · B로 묻는다(「B 진행 방향」). 누가 A · B인지 카드의 매핑 ID로만 적고 같은 당사자라고 가정하지 않는다.
 * 빈 역할은 가입자도 촬영 차량도 아닌 상대다.
 */
function ChartParties({ mapping }: { mapping: PartyMapping }) {
  return (
    <p className="mt-2 flex flex-wrap gap-x-6 gap-y-1">
      {(["A", "B"] as const).map((party) => {
        const roles = partyRoles(mapping, party);
        return (
          <span key={party}>
            <span className="text-ink-muted">도표 {party}</span>{" "}
            {roles === null ? <Empty>매핑 전</Empty> : roles.length > 0 ? roles.join(" · ") : "상대"}
          </span>
        );
      })}
    </p>
  );
}
