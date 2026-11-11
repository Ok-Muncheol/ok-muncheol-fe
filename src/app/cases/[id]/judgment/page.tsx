/**
 * B: 판단 — 담당 사건 보드의 판단 열 카드가 여기로 온다. 지금 할 일(진행 단계 · 실패 · 구분 질문 · 확인할 칸)과 판정만 한 열로 둔다.
 * 검증 3겹은 따로 그리지 않는다 — BE가 걸린 검증과 그 이유를 판정 사유에 넣고(graph.py), 층별 결과는 검토 보고서가 보여 준다.
 * 판단에 쓴 사실 전체는 사실 카드 화면에서 본다. 판정 · 과실은 BE 값만 그린다.
 * 판단은 판단 조회(judgment-source — 견본 또는 BE GET /cases/{id}/judgment)로 읽고, 답변 · 판단 접수 뒤에는 다시 읽는다.
 * 사건 요약(보드)을 못 읽어도 판단은 그린다 — API 모드는 사건 목록 API 전이다. TODO: Realtime 변경 알림이 오면 다시 읽는다.
 * 판정이 났으면 판정 아래에 판정 근거(김지은 근거 패널 — 고른 도표의 원문 근거)와 근거 질의응답(QaPanel)을 둔다.
 * 가정 결과는 공식 판정과 따로 그리고 저장하지 않는다. 검증 3겹의 층별 결과는 검토 보고서가 보여 준다.
 */
import Link from "next/link";
import type { ReactNode } from "react";
import { StatusLabel } from "@/components/status-label";
import { getCaseSummary, isSampleSource } from "@/features/cases/case-source";
import { EvidencePanel } from "@/features/evidence/evidence-panel";
import { getFactCard } from "@/features/facts/fact-source";
import { JudgmentOutcome } from "@/features/judgment/judgment-panel";
import { JudgmentProgress } from "@/features/judgment/judgment-progress";
import { getLatestJudgmentRun } from "@/features/judgment/judgment-source";
import { QuestionPanel } from "@/features/judgment/question-panel";
import { RetryJudgment, StartJudgment } from "@/features/judgment/retry-judgment";
import { QaPanel } from "@/features/qa/qa-panel";
import { fieldLabel, optionLabel } from "@/lib/api/chart-scope";
import type { ApiError, ConfirmationQuestion, FactCard, JudgmentRunView, PartyMapping, QuestionView } from "@/lib/api/types";
import { stageIndex } from "@/lib/cases/stages";
import {
  JUDGMENT_EVIDENCE_ID,
  answerableQuestions,
  answeredValues,
  evidenceDecisions,
  fieldsToCheck,
  isStaleInput,
  judgmentEvidence,
  partyRoles,
  runBadgeStatus,
  stageLabel,
  waitingFor,
} from "@/lib/judgment/view";
import { Badge, ButtonLink, Card, Empty, Notice, PageHeader } from "@/ui/controls";

function Version({ n }: { n: number }) {
  return <span className="font-mono tabular-nums">v{n}</span>;
}

export default async function JudgmentPage(props: PageProps<"/cases/[id]/judgment">) {
  const { id } = await props.params;
  const live = !isSampleSource();
  const [summary, { run, error }, card] = await Promise.all([getCaseSummary(id), getLatestJudgmentRun(id), getFactCard(id)]);

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
  const factsHref = `${base}/facts`;
  const eyebrow = (
    <>
      담당 사건 ·{" "}
      <Link href={base} className="font-mono text-primary-strong underline-offset-4 hover:underline">
        {id}
      </Link>
    </>
  );
  const title = (badge: ReactNode) => (
    <>
      판단 <span className="ml-2 inline-flex align-middle">{badge}</span>
    </>
  );
  // 판단을 접수할 수 있는 카드 — 담당자가 확정한 최신 카드만
  const confirmedCard = card?.status === "confirmed" ? card : null;

  if (error) {
    return (
      <div className="max-w-4xl">
        <PageHeader
          eyebrow={eyebrow}
          title={title(
            <Badge tone="danger" dot>
              조회 실패
            </Badge>,
          )}
        />
        <LoadFailure error={error} />
      </div>
    );
  }

  if (!run) {
    // 판단 전 사건이다. 견본 모드는 보드 단계로 가르고(보고서 단계인데 판단 기록이 없으면 기록 없음), API 모드는 BE가 판단 전(null)이라고 했다.
    const beforeJudgment = summary ? stageIndex(summary.stage) < stageIndex("judgment") : true;
    const badge = beforeJudgment ? (
      <Badge dot>판단 전</Badge>
    ) : summary?.judgment_status ? (
      <StatusLabel status={summary.judgment_status} />
    ) : (
      <Badge dot>기록 없음</Badge>
    );
    return (
      <div className="max-w-4xl">
        <PageHeader eyebrow={eyebrow} title={title(badge)} />
        <Notice tone="info" title={beforeJudgment ? "아직 판단하지 않았다" : "판단 기록을 불러오지 못했다"}>
          {!beforeJudgment ? (
            <>
              합성 견본은 판단 단계 사건에만 있다.{" "}
              <ButtonLink href={base} variant="quiet" size="sm">
                사건 개요로
              </ButtonLink>
            </>
          ) : confirmedCard ? (
            <>
              <p>
                확정한 사실 카드 <Version n={confirmedCard.version} />로 판단을 시작할 수 있다.
              </p>
              <div className="mt-3">
                <StartJudgment caseId={id} cardVersion={confirmedCard.version} live={live} />
              </div>
            </>
          ) : (
            <>
              사실 카드를 확정하면 판단을 시작한다.{" "}
              <ButtonLink href={factsHref} variant="quiet" size="sm">
                사실 카드로
              </ButtonLink>
            </>
          )}
        </Notice>
      </div>
    );
  }

  const { result } = run;
  // 판정이 고른 도표의 원문 근거. 도표를 고르지 못한 판정이면 null이라 근거 칸을 그리지 않는다
  const evidence = result ? judgmentEvidence(result) : null;
  const latestCard = card?.version ?? summary?.versions.fact_card_version ?? null;
  const answerable = answerableQuestions(run);
  const toCheck = fieldsToCheck(run);
  const pending = answerable.filter((q) => q.answer === null).length;
  const waiting = run.status === "waiting_for_confirmation" ? waitingFor(answerable) : null;
  // 실행 중이면 BE가 새 접수를 409(judgment_in_progress)로 거절한다
  const idle = run.status !== "queued" && run.status !== "running";

  // 한 열로 두고 폭을 줄인다 — 할 일과 판정만 남아 1280px 전체로 펴면 줄이 너무 길다.
  return (
    <div className="max-w-4xl">
      <PageHeader
        eyebrow={eyebrow}
        title={title(<StatusLabel status={runBadgeStatus(run)} />)}
        description={describe(run, answerable)}
        actions={
          <>
            <ButtonLink href={factsHref} variant="secondary">
              사실 카드 화면으로
            </ButtonLink>
            {run.report_version !== null && (
              <ButtonLink href={`${base}/reports/${run.report_version}`}>
                검토 보고서 <Version n={run.report_version} />
              </ButtonLink>
            )}
          </>
        }
      />
      <div className="flex flex-col gap-6">
        {latestCard !== null && isStaleInput(run, latestCard) && (
          <Notice tone="warning" title="새 사실 카드가 있다">
            <p>
              판단에 쓴 카드는 <Version n={run.fact_card_version} />이고 최신 카드는 <Version n={latestCard} />이다.{" "}
              {confirmedCard ? "새 카드로 판단을 다시 요청한다." : "새 카드를 확정한 뒤 다시 판단한다."}
            </p>
            {confirmedCard && idle && (
              <div className="mt-3">
                <StartJudgment caseId={id} cardVersion={confirmedCard.version} live={live} />
              </div>
            )}
          </Notice>
        )}
        {run.status === "failed" && (
          <FailureNotice run={run} live={live} cardVersion={confirmedCard?.version ?? run.fact_card_version} />
        )}
        {run.status !== "completed" && (
          <Card title="판단 진행">
            <JudgmentProgress run={run} />
            {PROGRESS_NOTE[run.status] && <p className="mt-4 text-caption text-ink-muted">{PROGRESS_NOTE[run.status]}</p>}
          </Card>
        )}
        {answerable.length > 0 && (
          <Card
            title="구분 질문"
            aside={
              <Badge tone="warning" dot>
                {pending > 0 ? (
                  <span>
                    답변 대기 <span className="font-mono tabular-nums">{pending}</span>건
                  </span>
                ) : (
                  "카드 반영 대기"
                )}
              </Badge>
            }
          >
            <p className="text-caption text-ink-muted">
              질문마다 하나씩 답한다. 모두 ‘확인 불가’면 그 칸 없이 판단을 이어가고, 값으로 답한 칸이 있으면 사실 카드에 반영해 다시
              확정한 뒤 판단을 다시 요청한다.
            </p>
            {card && <ChartParties mapping={card.party_mapping} />}
            {waiting === "card_update" && <CardUpdateNotice values={answeredValues(answerable)} factsHref={factsHref} />}
            <div className="mt-4">
              <QuestionPanel
                caseId={id}
                live={live}
                questions={answerable}
                expectedCardVersion={run.fact_card_version}
                fields={card?.fields ?? {}}
              />
            </div>
          </Card>
        )}
        {toCheck.length > 0 && <FieldsToCheck questions={toCheck} card={card} factsHref={factsHref} />}
        {result && <JudgmentOutcome result={result} evidenceHref={evidence ? `#${JUDGMENT_EVIDENCE_ID}` : undefined} />}
        {result?.chart_id && evidence && (
          <div id={JUDGMENT_EVIDENCE_ID} className="scroll-mt-24">
            <EvidencePanel hits={evidence} decisions={evidenceDecisions(evidence, result.chart_id)} />
          </div>
        )}
        {run.status === "completed" && result && <QaPanel caseId={id} live={live} judgmentVersion={run.judgment_version} />}
      </div>
    </div>
  );
}

/** 머리글 설명 — 지금 상태에서 담당자가 할 일 한 줄. */
function describe(run: JudgmentRunView, answerable: readonly QuestionView[]): ReactNode {
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
    case "waiting_for_confirmation": {
      const pending = answerable.filter((q) => q.answer === null).length;
      if (pending > 0) return `구분 질문 ${pending}건에 답하면 판단을 이어간다.`;
      return waitingFor(answerable) === "card_update"
        ? "답한 값을 사실 카드에 반영해 다시 확정한 뒤 판단을 다시 요청한다."
        : `${stage} 단계에서 담당자 확인을 기다린다.`;
    }
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
          return n > 0
            ? `확인할 칸 ${n}개를 사실 카드에서 확인해 다시 확정한 뒤 판단을 다시 요청한다.`
            : "추가 확인이 필요하다. 사유를 확인한다.";
        }
      }
    }
  }
}

const PROGRESS_NOTE: Partial<Record<JudgmentRunView["status"], string>> = {
  queued: "앞 작업이 끝나면 시작한다. 이 화면을 닫아도 판단은 이어진다.",
  running: "이 화면을 닫아도 판단은 이어진다. 다시 열면 진행 상태를 새로 읽는다.",
  waiting_for_confirmation: "담당자 확인이 끝나면 이어서 판단한다.",
};

/** 판단 조회 실패 — BE가 돌려준 이유를 그대로 보여 준다(로그인 전 401, 담당 아님 403, BE·DB 연결 실패 등). */
function LoadFailure({ error }: { error: ApiError }) {
  return (
    <Notice tone="danger" title="판단을 불러오지 못했다">
      <p>{error.message}</p>
      <p className="mt-1 text-caption">
        오류 코드 <span className="font-mono">{error.code}</span>
        {error.retryable && " · 잠시 후 이 화면을 다시 열면 다시 읽는다."}
      </p>
    </Notice>
  );
}

function FailureNotice({ run, live, cardVersion }: { run: JudgmentRunView; live: boolean; cardVersion: number }) {
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
          <RetryJudgment caseId={run.case_id} cardVersion={cardVersion} live={live} />
        </div>
      )}
    </Notice>
  );
}

/** 값으로 답한 칸 — BE는 이 값이 사실 카드에 반영돼 새 카드 버전이 생겨야 판단을 이어간다(next_action update_fact_card). */
function CardUpdateNotice({ values, factsHref }: { values: Record<string, string>; factsHref: string }) {
  return (
    <div className="mt-4">
      <Notice tone="warning" title="답한 값을 사실 카드에 반영해야 판단을 이어간다">
        <ul className="list-disc pl-5">
          {Object.entries(values).map(([key, value]) => (
            <li key={key}>
              {fieldLabel(key)} = <span className="font-semibold">{optionLabel(key, value) ?? value}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2">사실 카드 화면에서 이 값으로 고쳐 다시 확정한 뒤, 이 화면에서 새 카드로 판단을 다시 요청한다.</p>
        <div className="mt-3">
          <ButtonLink href={factsHref} variant="secondary" size="sm">
            사실 카드에서 반영
          </ButtonLink>
        </div>
      </Notice>
    </div>
  );
}

/** 완료 + 추가 확인 필요 판정이 확인을 요구한 칸 — 답변 경로로 답하지 않고 사실 카드에서 고쳐 다시 판단한다. */
function FieldsToCheck({ questions, card, factsHref }: { questions: readonly ConfirmationQuestion[]; card: FactCard | null; factsHref: string }) {
  return (
    <Card
      title="확인할 칸"
      aside={
        <Badge tone="warning" dot>
          <span>
            <span className="font-mono tabular-nums">{questions.length}</span>칸
          </span>
        </Badge>
      }
    >
      <p className="text-caption text-ink-muted">
        판단이 이 칸을 확인하지 못해 추가 확인이 필요하다고 냈다. 여기서 답하지 않는다 — 사실 카드에서 값을 확인·수정해 다시 확정한 뒤
        판단을 다시 요청한다.
      </p>
      {card && <ChartParties mapping={card.party_mapping} />}
      <ul className="mt-4 flex flex-col divide-y divide-line">
        {questions.map((q) => {
          const field = card?.fields[q.field_key];
          return (
            <li key={q.question_id} className="py-3 first:pt-0 last:pb-0">
              <p className="text-body font-semibold break-keep">{q.text}</p>
              <p className="mt-1 text-caption text-ink-muted">
                {fieldLabel(q.field_key)} · 지금 카드 값{" "}
                <span className="font-semibold text-ink">
                  {field ? (optionLabel(q.field_key, field.value) ?? <Empty>불명</Empty>) : <Empty>카드 없음</Empty>}
                </span>
              </p>
            </li>
          );
        })}
      </ul>
      <div className="mt-4">
        <ButtonLink href={factsHref} variant="secondary" size="sm">
          사실 카드에서 확인
        </ButtonLink>
      </div>
    </Card>
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
