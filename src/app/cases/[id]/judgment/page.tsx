/**
 * B·A: 판단 — 진행 단계 「판단」의 화면이다. 사실 카드 화면을 합쳤다(2026-11-11). 판단 단계의 일은 사실 확인 → 판단 →
 * 구분 질문 답·확인할 칸 → 사실 수정 → 다시 판단으로 이어지는 한 고리라 한 화면에 둔다. 보드 판단 열의 카드(사실 카드·판단 단계)가 모두 여기로 온다.
 * 왼쪽은 지금 할 일(조회 실패·새 카드·실패·판단 시작·판단 진행·구분 질문·확인할 칸) → 사실 카드(정지원 FactCardPanel — 확인·수정·확정) → 판정 근거,
 * 오른쪽은 판정 → 사고·당사자(도표 A · B는 여기 한 번만) → 근거 프레임이다. 좁은 화면에서는 왼쪽 다음 오른쪽 순서로 쌓는다.
 * 구분 질문·확인할 칸은 카드 값을 다시 적지 않고 같은 화면 카드의 그 칸(#fact-{칸})·카드(#fact-card)로 이동한다.
 * 아직 오지 않은 단계는 같은 칸을 비운 틀(FactCardSkeleton·JudgmentSkeleton)을 보인다.
 * 검증 3겹은 따로 그리지 않는다 — BE가 걸린 검증과 그 이유를 판정 사유에 넣고(graph.py), 층별 결과는 검토 보고서가 보여 준다. 판정 · 과실은 BE 값만 그린다.
 * 판단은 판단 조회(judgment-source — 견본 또는 BE GET /cases/{id}/judgment), 사실 카드는 fact-source로 읽고 답변 · 판단 접수 뒤에는 다시 읽는다.
 * 사건 요약(보드)을 못 읽어도 그린다 — API 모드는 사건 목록 API 전이다. 근거 질의응답은 검토 보고서 화면 오른쪽에 있다.
 * 화면 사이 이동은 맨 위 진행 단계 한 줄이 맡아 머리글에 이동 버튼을 두지 않는다.
 * TODO: Realtime 변경 알림이 오면 다시 읽는다. TODO(A): 영상 재생·권한 있는 프레임 URL, 저장·확정 요청, 수정 이력, 매핑 편집.
 */
import Link from "next/link";
import type { ReactNode } from "react";
import { StatusLabel } from "@/components/status-label";
import { getCaseSummary, isSampleSource } from "@/features/cases/case-source";
import { CaseStepper } from "@/features/cases/case-stepper";
import { EvidencePanel } from "@/features/evidence/evidence-panel";
import { EvidenceFrames } from "@/features/facts/evidence-frames";
import { FactCardPanel } from "@/features/facts/fact-card-panel";
import { FactCardSkeleton } from "@/features/facts/fact-card-skeleton";
import { getFactCard } from "@/features/facts/fact-source";
import { PartiesCard } from "@/features/facts/parties-card";
import { JudgmentOutcome, JudgmentSkeleton } from "@/features/judgment/judgment-panel";
import { JudgmentProgress } from "@/features/judgment/judgment-progress";
import { getLatestJudgmentRun } from "@/features/judgment/judgment-source";
import { QuestionPanel } from "@/features/judgment/question-panel";
import { RetryJudgment, StartJudgment } from "@/features/judgment/retry-judgment";
import { fieldLabel, optionLabel } from "@/lib/api/chart-scope";
import type { ApiError, CaseSummary, ConfirmationQuestion, FactCard, JudgmentRunView, QuestionView } from "@/lib/api/types";
import { stageIndex } from "@/lib/cases/stages";
import {
  JUDGMENT_EVIDENCE_ID,
  answerableQuestions,
  answeredValues,
  evidenceDecisions,
  fieldsToCheck,
  isStaleInput,
  judgmentEvidence,
  runBadgeStatus,
  stageLabel,
  waitingFor,
} from "@/lib/judgment/view";
import { Badge, ButtonLink, Card, Notice, PageHeader } from "@/ui/controls";

/** 같은 화면 안에서 사실 카드로 가는 자리(구분 질문·확인할 칸·카드 반영 안내가 쓴다). 칸 하나는 #fact-{칸}(FactCardPanel의 입력 id)이다. */
const FACT_CARD_ID = "fact-card";

const dateTime = new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Seoul" });

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
  // 판단을 접수할 수 있는 카드 — 담당자가 확정한 최신 카드만
  const confirmedCard = card?.status === "confirmed" ? card : null;
  // 영상 사건인지는 사건 요약으로 안다. 요약이 없으면(API 모드) 카드의 근거 프레임이 있을 때만 영상 사건으로 본다.
  const hasVideo = summary ? summary.input_path === "video" : (card?.evidence_frames.length ?? 0) > 0;
  const accidentAt = card?.accident_date ?? summary?.accident_date ?? null;
  // 사실 카드가 아직 없는 단계(접수·영상 분석)면 아직 오지 않은 단계, 판단 뒤 단계인데 판단 기록이 없으면(보고서 단계 견본) 기록 없음이다
  const beforeFacts = summary !== null && stageIndex(summary.stage) < stageIndex("facts");
  const pastJudgment = summary !== null && stageIndex(summary.stage) > stageIndex("judgment");

  const result = run?.result ?? null;
  // 판정이 고른 도표의 원문 근거. 도표를 고르지 못한 판정이면 null이라 근거 칸을 그리지 않는다
  const evidence = result ? judgmentEvidence(result) : null;
  const latestCard = card?.version ?? summary?.versions.fact_card_version ?? null;
  const answerable = run ? answerableQuestions(run) : [];
  const toCheck = run ? fieldsToCheck(run) : [];
  const pending = answerable.filter((q) => q.answer === null).length;
  const waiting = run?.status === "waiting_for_confirmation" ? waitingFor(answerable) : null;
  // 실행 중이면 BE가 새 접수를 409(judgment_in_progress)로 거절한다
  const idle = run !== null && run.status !== "queued" && run.status !== "running";
  const head = header({ run, error, summary, beforeFacts, pastJudgment, confirmedCard, hasVideo, answerable });

  return (
    <>
      {/* 진행 단계 한 줄은 사건 요약(보드)이 있을 때만 그린다 — API 모드는 사건 목록 API 전이라 없다. */}
      {summary && <CaseStepper summary={summary} viewing="judgment" />}
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
            판단 <span className="ml-2 inline-flex align-middle">{head.badge}</span>
          </>
        }
        description={head.description}
      />
      <div className="grid items-start gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="flex min-w-0 flex-col gap-6">
          {error && <LoadFailure error={error} />}
          {run && latestCard !== null && isStaleInput(run, latestCard) && (
            <Notice tone="warning" title="새 사실 카드가 있다">
              <p>
                판단에 쓴 카드는 <Version n={run.fact_card_version} />이고 최신 카드는 <Version n={latestCard} />이다.{" "}
                {confirmedCard ? "새 카드로 판단을 다시 요청한다." : "아래 사실 카드에서 새 카드를 확정한 뒤 다시 판단한다."}
              </p>
              {confirmedCard && idle && (
                <div className="mt-3">
                  <StartJudgment caseId={id} cardVersion={confirmedCard.version} live={live} />
                </div>
              )}
            </Notice>
          )}
          {run?.status === "failed" && <FailureNotice run={run} live={live} cardVersion={confirmedCard?.version ?? run.fact_card_version} />}
          {!run && !error && !pastJudgment && confirmedCard && (
            <Notice tone="info" title="판단을 시작할 수 있다">
              <p>
                확정한 사실 카드 <Version n={confirmedCard.version} />로 판단을 시작한다.
              </p>
              <div className="mt-3">
                <StartJudgment caseId={id} cardVersion={confirmedCard.version} live={live} />
              </div>
            </Notice>
          )}
          {run && run.status !== "completed" && (
            <Card title="판단 진행">
              <JudgmentProgress run={run} />
              {PROGRESS_NOTE[run.status] && <p className="mt-4 text-caption text-ink-muted">{PROGRESS_NOTE[run.status]}</p>}
            </Card>
          )}
          {run && answerable.length > 0 && (
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
                질문마다 하나씩 답한다. 모두 ‘확인 불가’면 그 칸 없이 판단을 이어가고, 값으로 답한 칸이 있으면 아래 사실 카드에 반영해 다시
                확정한 뒤 판단을 다시 요청한다. 도표 A · B가 누구인지는 오른쪽 사고·당사자에 있다.
              </p>
              {waiting === "card_update" && <CardUpdateNotice values={answeredValues(answerable)} />}
              <div className="mt-4">
                <QuestionPanel caseId={id} live={live} questions={answerable} expectedCardVersion={run.fact_card_version} fields={card?.fields ?? {}} />
              </div>
            </Card>
          )}
          {toCheck.length > 0 && <FieldsToCheck questions={toCheck} card={card} />}
          <FactsSection card={card} beforeFacts={beforeFacts} hasVideo={hasVideo} />
          {result?.chart_id && evidence && (
            <div id={JUDGMENT_EVIDENCE_ID} className="scroll-mt-20">
              <EvidencePanel hits={evidence} decisions={evidenceDecisions(evidence, result.chart_id)} />
            </div>
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-6">
          {result ? (
            <JudgmentOutcome result={result} evidenceHref={evidence ? `#${JUDGMENT_EVIDENCE_ID}` : undefined} />
          ) : (
            !error && <JudgmentSkeleton label={!run && pastJudgment ? "기록 없음" : "판정 전"} />
          )}
          <PartiesCard mapping={card?.party_mapping ?? null} hasVideo={hasVideo} accidentDate={accidentAt ? dateTime.format(new Date(accidentAt)) : null} />
          {hasVideo && <EvidenceFrames card={card ?? { evidence_frames: [], fields: {} }} />}
        </div>
      </div>
    </>
  );
}

/** 머리글 배지와 설명 한 줄 — 지금 상태에서 담당자가 할 일. */
function header({
  run,
  error,
  summary,
  beforeFacts,
  pastJudgment,
  confirmedCard,
  hasVideo,
  answerable,
}: {
  run: JudgmentRunView | null;
  error: ApiError | null;
  summary: CaseSummary | null;
  beforeFacts: boolean;
  pastJudgment: boolean;
  confirmedCard: FactCard | null;
  hasVideo: boolean;
  answerable: readonly QuestionView[];
}): { badge: ReactNode; description?: ReactNode } {
  if (error) {
    return {
      badge: (
        <Badge tone="danger" dot>
          조회 실패
        </Badge>
      ),
    };
  }
  if (run) return { badge: <StatusLabel status={runBadgeStatus(run)} />, description: describe(run, answerable) };
  if (pastJudgment) {
    return {
      badge: summary?.judgment_status ? <StatusLabel status={summary.judgment_status} /> : <Badge dot>기록 없음</Badge>,
      description: "지난 단계지만 이 사건의 판단 기록을 불러오지 못했다 — 합성 견본은 판단 단계 사건에만 있다.",
    };
  }
  const badge = <Badge dot>판단 전</Badge>;
  if (beforeFacts) {
    return {
      badge,
      description: `아직 오지 않은 단계다 — ${hasVideo ? "영상 분석이 끝나면 사실 카드가 채워지고" : "접수를 마치면 사실 카드를 직접 입력하고"}, 카드를 확정하면 판단을 시작한다.`,
    };
  }
  return { badge, description: confirmedCard ? "확정한 사실 카드로 판단을 시작할 수 있다." : "아래 사실 카드를 확인·수정해 확정하면 판단을 시작한다." };
}

/** 머리글 설명 — 판단 실행이 있을 때 지금 상태에서 담당자가 할 일 한 줄. */
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
        ? "답한 값을 아래 사실 카드에 반영해 다시 확정한 뒤 판단을 다시 요청한다."
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
          return "판단 보류 — 사유를 확인한다. 사실이 틀렸으면 아래 사실 카드를 고쳐 다시 확정한 뒤 다시 판단한다.";
        case "needs_confirmation": {
          const n = run.result.questions.length;
          return n > 0
            ? `확인할 칸 ${n}개를 아래 사실 카드에서 확인해 다시 확정한 뒤 판단을 다시 요청한다.`
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

/**
 * 사실 카드 — 카드가 있으면 FactCardPanel(정지원)로 확인·수정·확정하고, 없으면 같은 칸을 비운 틀을 보인다.
 * 구분 질문·확인할 칸·카드 반영 안내가 #fact-card · #fact-{칸}으로 여기로 온다.
 */
function FactsSection({ card, beforeFacts, hasVideo }: { card: FactCard | null; beforeFacts: boolean; hasVideo: boolean }) {
  const confirmed = card?.status === "confirmed";
  const badge = card ? (
    <Badge tone={confirmed ? "success" : "warning"} dot>
      {confirmed ? "확정" : "확정 전"}
    </Badge>
  ) : (
    <Badge dot>{beforeFacts ? "작성 전" : "기록 없음"}</Badge>
  );
  const description = card
    ? confirmed
      ? `${card.confirmed_at ? `${dateTime.format(new Date(card.confirmed_at))} ` : ""}확정 — 이 카드로 판단한다. 값을 고치면 새 버전을 다시 확정해야 한다.`
      : hasVideo
        ? "영상 분석이 채운 값을 근거 프레임과 맞춰 보고, 틀린 값은 고친 뒤 확정한다."
        : "직접 입력한 값을 확인하고 확정한다."
    : beforeFacts
      ? `아직 오지 않은 단계다 — ${hasVideo ? "영상 분석이 끝나면 칸이 채워진다." : "접수를 마치면 칸을 직접 입력한다."}`
      : "이 사건의 사실 카드를 불러오지 못했다 — 합성 견본은 사실 카드·판단 단계 사건에만 있고, 사실 카드 조회 API는 연결 전이다.";
  return (
    <section id={FACT_CARD_ID} aria-labelledby="fact-card-title" className="flex flex-col gap-3">
      <div>
        <h2 id="fact-card-title" className="flex flex-wrap items-center gap-x-2 gap-y-1 text-heading font-semibold">
          사실 카드 {card && <Version n={card.version} />}
          <span className="inline-flex">{badge}</span>
        </h2>
        <p className="mt-0.5 text-caption text-ink-muted">{description}</p>
      </div>
      {card ? <FactCardPanel card={card} /> : <FactCardSkeleton />}
    </section>
  );
}

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
function CardUpdateNotice({ values }: { values: Record<string, string> }) {
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
        <p className="mt-2">아래 사실 카드에서 이 값으로 고쳐 다시 확정한 뒤, 새 카드로 판단을 다시 요청한다.</p>
        <div className="mt-3">
          <ButtonLink href={`#${FACT_CARD_ID}`} variant="secondary" size="sm">
            사실 카드에서 반영
          </ButtonLink>
        </div>
      </Notice>
    </div>
  );
}

/**
 * 완료 + 추가 확인 필요 판정이 확인을 요구한 칸 — 답변 경로로 답하지 않고 사실 카드에서 고쳐 다시 판단한다.
 * 칸의 지금 값은 같은 화면 사실 카드에 있어 다시 적지 않고, 칸 이름을 그 칸으로 가는 링크로 둔다.
 */
function FieldsToCheck({ questions, card }: { questions: readonly ConfirmationQuestion[]; card: FactCard | null }) {
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
        판단이 이 칸을 확인하지 못해 추가 확인이 필요하다고 냈다. 여기서 답하지 않는다 — 아래 사실 카드에서 값을 확인·수정해 다시 확정한 뒤
        판단을 다시 요청한다.
      </p>
      <ul className="mt-4 flex flex-col divide-y divide-line">
        {questions.map((q) => (
          <li key={q.question_id} className="py-3 first:pt-0 last:pb-0">
            <p className="text-body font-semibold break-keep">{q.text}</p>
            <p className="mt-1 text-caption">
              {card?.fields[q.field_key] ? (
                <a href={`#fact-${q.field_key}`} className="text-primary-strong underline-offset-4 hover:underline">
                  {fieldLabel(q.field_key)} — 사실 카드에서 보기
                </a>
              ) : (
                <span className="text-ink-muted">{fieldLabel(q.field_key)}</span>
              )}
            </p>
          </li>
        ))}
      </ul>
    </Card>
  );
}
