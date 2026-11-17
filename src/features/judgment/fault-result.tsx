/**
 * A·B: 사건 작업 화면 아래쪽의 판단 결과 — 하단 버튼 「과실 비율 보기」가 여기(#fault-result)로 내려온다.
 * 판정 셋을 다르게 그린다: 초안 작성 가능(과실 비율·적용 도표·수정요소·사유), 추가 확인 필요(사유·확인할 칸 → 위 카드의 칸),
 * 판단 보류(사유). 비율·가감치·도표는 BE 값 그대로다 — FE가 계산하지 않는다. 도표 A/B는 매핑으로 「상대 차」「블랙박스 차」 이름을 붙인다
 * (영상 없이 진행한 카드는 「블랙박스 차」 대신 「가입자 차」 — ego). 사유 속 칸 이름(movement_A 등)도 매핑으로 카드 칸 이름을 붙인다(readableReason).
 * 고를 도표가 없을 때 BE가 도표 A/B를 맞바꿔 대조한 줄은 따로 모아 보인다(도표 A/B는 판단이 정한다).
 * 담당자가 「모르겠어요」로 둔 칸 때문에 도표를 하나로 못 고르면(추가 확인 필요) 그 칸이 어떤 값이면 어느 도표·기본 과실인지
 * (BE result.scenarios)를 목록으로 보인다 — 확정한 비율이 아니라 경우별 참고다. 조건의 칸 이름은 위 카드의 그 칸으로 가는 링크다.
 * 그 경우들의 기본 과실이 모두 같으면 BE가 그 비율을 fault_A/B에 싣고, 화면은 목록 위에 크게 보인다.
 * 위 카드가 판단 뒤에 바뀌었으면(stale) 흐리게 두고 이전 카드 기준이라고 알린다.
 * 다음 단계는 비율 제목 줄 오른쪽에 둔다 — 「검토 보고서 보기 →」(보고서 화면으로 넘어간다)와 「사실 카드 수정하기 ↑」(위 카드의 「수정하기」와 같다 — 카드를 수정 상태로 열고 그리로 올라간다).
 */
import { Button, ButtonLink, Notice } from "@/ui/controls";
import { EvidencePanel } from "@/features/evidence/evidence-panel";
import type { JudgmentResult, PartyMapping } from "@/lib/api/types";
import { cardLabel, chartPartyName, readableReason, reasonParts, scenarioRows, type EgoName, type ScenarioRow } from "@/lib/facts/card";
import { evidenceDecisions, judgmentEvidence, splitScenarioLines, splitSwapHints } from "@/lib/judgment/view";

export const FAULT_RESULT_ID = "fault-result";
/** 비율 제목 줄 — 이 줄이 화면 위로 지나가면 아래 떠 있는 바가 「검토 보고서 보기」를 대신 보인다. */
export const FAULT_RATIO_HEAD_ID = "fault-ratio-head";

type Props = {
  result: JudgmentResult;
  mapping: PartyMapping;
  /** 카드 B 차 이름(영상 없이 진행한 카드는 가입자 차). 없으면 블랙박스 차 */
  ego?: EgoName;
  /** 위 카드가 이 판단 뒤에 바뀌었다 */
  stale: boolean;
  reportHref: string | null;
  /** 위 사실 카드를 다시 열어 고친다 — 고칠 수 없는 때(질문 대기 · 이미 고치는 중)는 넘기지 않는다 */
  onEditCard?: () => void;
  /** 견본 모드의 흉내 낸 결과 */
  sample?: boolean;
};

export function FaultResult({ result, mapping, ego, stale, reportHref, onEditCard, sample }: Props) {
  return (
    <section id={FAULT_RESULT_ID} aria-labelledby="fault-result-title" className={`scroll-mt-20 ${stale ? "opacity-60" : ""}`}>
      {stale && <p className="mb-3 text-caption font-semibold text-on-warning-soft">카드를 고쳐서 이 결과는 이전 카드 기준이에요. 다시 확정하면 새로 판단해요.</p>}
      {result.status === "draft_ready" ? (
        // 이전 카드 기준 결과로는 다음 단계로 넘어가지 않는다.
        <Ratio result={result} mapping={mapping} ego={ego} reportHref={stale ? null : reportHref} onEditCard={stale ? undefined : onEditCard} sample={sample} />
      ) : (
        <NotReady result={result} mapping={mapping} ego={ego} onEditCard={stale ? undefined : onEditCard} />
      )}
    </section>
  );
}

function Ratio({
  result,
  mapping,
  ego,
  reportHref,
  onEditCard,
  sample,
}: {
  result: JudgmentResult;
  mapping: PartyMapping;
  ego?: EgoName;
  reportHref: string | null;
  onEditCard?: () => void;
  sample?: boolean;
}) {
  const a = result.fault_A;
  const b = result.fault_B;
  const nameA = chartPartyName(mapping, "A", ego);
  const nameB = chartPartyName(mapping, "B", ego);
  const applied = (result.modifiers ?? []).filter((m) => m.decision === "적용");
  const notApplied = (result.modifiers ?? []).filter((m) => m.decision !== "적용");
  const evidence = judgmentEvidence(result);

  return (
    <div className="flex flex-col gap-8">
      {/* 이 화면의 주인공 — 흰 면 하나에 큰 비율 · 한 번 차오르는 막대 · 계산 흐름 한 줄. */}
      <div className="rounded-card border border-line bg-surface px-6 py-5 sm:px-8 sm:py-6">
        <div id={FAULT_RATIO_HEAD_ID} className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="fault-result-title" className="text-heading font-semibold" title={sample ? "견본 결과 — 실제 도표 · 비율이 아니다" : undefined}>
            과실 비율
          </h2>
          <div className="flex items-center gap-2">
            {onEditCard && (
              <Button variant="quiet" size="sm" onClick={onEditCard}>
                사실 카드 수정하기 ↑
              </Button>
            )}
            {reportHref && (
              <ButtonLink href={reportHref} className="h-10 px-6">
                검토 보고서 보기 →
              </ButtonLink>
            )}
          </div>
        </div>
        {a !== null && b !== null && (
          <>
            <div className="mt-6 flex items-end justify-between gap-4">
              <Side name={nameA} value={a} />
              <span aria-hidden className="pb-3 text-4xl font-light text-line-strong">:</span>
              <Side name={nameB} value={b} align="right" />
            </div>
            <div className="mt-4 flex h-2.5 gap-0.5 overflow-hidden rounded-full motion-safe:animate-[ok-reveal_900ms_cubic-bezier(0.2,0.8,0.2,1)]" aria-hidden>
              <div className="rounded-l-full bg-ink" style={{ width: `${a}%` }} />
              <div className="rounded-r-full bg-primary" style={{ width: `${b}%` }} />
            </div>
            <Flow result={result} mapping={mapping} ego={ego} />
          </>
        )}
        <p className="mt-4 text-caption text-ink-faint">검토 초안 · 승인 전에는 외부로 보내지 않음</p>
      </div>

      <dl className="grid gap-x-8 gap-y-6 md:grid-cols-2">
        <div>
          <dt className="text-caption font-semibold text-ink-muted">적용 도표</dt>
          <dd className="mt-1">
            <span className="font-semibold">{result.chart_id}</span>
            {result.base_fault_A != null && (
              <span className="ml-2 text-ink-muted">
                기본{" "}
                <span className="tabular-nums">
                  {result.base_fault_A} : {100 - result.base_fault_A}
                </span>
              </span>
            )}
            {result.edition && <span className="ml-2 text-caption text-ink-faint">{result.edition}</span>}
          </dd>
        </div>
        <div>
          <dt className="text-caption font-semibold text-ink-muted">수정요소</dt>
          <dd className="mt-1">
            {applied.length === 0 ? (
              <span className="text-ink-muted">적용한 요소 없음</span>
            ) : (
              <ul className="flex flex-col gap-1">
                {applied.map((m) => (
                  <li key={m.modifier_id} className="flex items-baseline gap-2">
                    <span className="w-10 shrink-0 font-semibold tabular-nums">
                      {m.delta > 0 ? "+" : ""}
                      {m.delta}
                    </span>
                    <span>
                      {chartPartyName(mapping, m.applies_to, ego)} {m.name}
                      {m.reason && <span className="block text-caption text-ink-muted">{m.reason}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {notApplied.length > 0 && (
              <details className="mt-2 text-caption text-ink-muted">
                <summary className="cursor-pointer">적용하지 않은 요소 {notApplied.length}개</summary>
                <ul className="mt-1 flex flex-col gap-0.5">
                  {notApplied.map((m) => (
                    <li key={m.modifier_id}>
                      {chartPartyName(mapping, m.applies_to, ego)} {m.name} · {m.decision}
                      {m.reason && ` — ${m.reason}`}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </dd>
        </div>
        {result.reasons.length > 0 && (
          <div className="md:col-span-2">
            <dt className="text-caption font-semibold text-ink-muted">판단 사유</dt>
            <dd className="mt-1">
              <ul className="flex flex-col gap-1 break-keep">
                {result.reasons.map((reason, i) => (
                  <li key={i}>{readableReason(reason, mapping, ego)}</li>
                ))}
              </ul>
            </dd>
          </div>
        )}
      </dl>

      {result.calculation_log.length > 0 && (
        <details className="text-caption">
          <summary className="cursor-pointer font-semibold text-ink-muted">계산 과정</summary>
          <ol className="mt-2 list-decimal space-y-0.5 pl-5 tabular-nums">
            {result.calculation_log.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ol>
        </details>
      )}

      {evidence && result.chart_id && (
        <details>
          <summary className="cursor-pointer text-caption font-semibold text-ink-muted">근거 원문</summary>
          <div className="mt-3">
            <EvidencePanel hits={evidence} decisions={evidenceDecisions(evidence, result.chart_id)} />
          </div>
        </details>
      )}

    </div>
  );
}

function Side({ name, value, align = "left" }: { name: string; value: number; align?: "left" | "right" }) {
  return (
    <div className={`flex-1 ${align === "right" ? "text-right" : ""}`}>
      <p className="text-body font-semibold text-ink-muted">{name}</p>
      <p className="mt-1 text-7xl leading-none font-bold tracking-tighter tabular-nums motion-safe:animate-[ok-rise_500ms_ease-out]">{value}</p>
    </div>
  );
}

/** 계산 흐름 한 줄 — 기본 비율 → 적용한 수정요소 → 최종 비율. 기본 비율을 모르면 그리지 않는다. 값은 BE 그대로다. */
function Flow({ result, mapping, ego }: { result: JudgmentResult; mapping: PartyMapping; ego?: EgoName }) {
  if (result.base_fault_A == null || result.fault_A === null || result.fault_B === null) return null;
  const applied = (result.modifiers ?? []).filter((m) => m.decision === "적용");
  const step = "inline-flex h-7 items-center gap-1.5 rounded-full border border-line px-3 whitespace-nowrap";
  return (
    <ol aria-label="계산 흐름" className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-2 text-caption text-ink-muted">
      <li className={step}>
        기본 <span className="font-semibold text-ink tabular-nums">{result.base_fault_A} : {100 - result.base_fault_A}</span>
      </li>
      {applied.map((m) => (
        <li key={m.modifier_id} className="flex items-center gap-2">
          <Arrow />
          <span className={step}>
            {chartPartyName(mapping, m.applies_to, ego)} {m.name}
            <span className="font-semibold text-ink tabular-nums">
              {m.delta > 0 ? "+" : ""}
              {m.delta}
            </span>
          </span>
        </li>
      ))}
      <li className="flex items-center gap-2">
        <Arrow />
        <span className={`${step} border-primary-strong bg-primary-soft font-semibold text-on-primary-soft tabular-nums`}>
          {result.fault_A} : {result.fault_B}
        </span>
      </li>
    </ol>
  );
}

function Arrow() {
  return (
    <svg aria-hidden viewBox="0 0 16 16" className="size-3.5 text-ink-faint" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8h10m-3.5-3.5L13 8l-3.5 3.5" />
    </svg>
  );
}

/** 보류 사유 한 줄 — 칸 이름은 위 카드의 그 칸으로 가는 링크다. 누르면 카드를 수정 상태로 열고(열 수 있을 때) 그 칸으로 올라간다. */
function ReasonLine({ reason, mapping, ego, onEditCard }: { reason: string; mapping: PartyMapping; ego?: EgoName; onEditCard?: () => void }) {
  return (
    <>
      {reasonParts(reason, mapping, ego).map((part, i) =>
        typeof part === "string" ? (
          part
        ) : (
          <a key={i} href={`#fact-${part.key}`} onClick={onEditCard} className="font-semibold underline underline-offset-4">
            {part.label}
          </a>
        ),
      )}
    </>
  );
}

/** 처음부터 펼쳐 두는 경우 수 — 넘는 줄은 접어 둔다(모르는 칸이 많으면 경우가 수십 개다). */
const SCENARIOS_SHOWN = 8;
/**
 * 경우 한 줄의 칸 배치 — 넓은 화면은 도표 · 조건 · 기본 과실 세 칸, 좁은 화면은 도표와 기본 과실을 한 줄에 두고 조건을 그 아래에 둔다.
 * 표 컨트롤(Table)은 쓰지 않는다 — 좁은 화면에서 조건 칸이 한 낱말씩 꺾이고 기본 과실이 가로 스크롤 밖으로 밀린다.
 */
const SCENARIO_GRID = "grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-2 px-4 md:grid-cols-[minmax(0,3fr)_minmax(0,6fr)_12rem]";

/**
 * 경우별 도표 목록 — 위 카드의 칸이 「이 값이면」 판단이 고를 도표와 그 기본 과실(수정요소 전).
 * 비율은 BE 값 그대로이고 도표 A : 도표 B 순서다(parties가 그 차 이름). 조건의 칸 이름을 누르면 위 카드의 그 칸으로 간다.
 */
function ScenarioList({ rows, parties, onEditCard }: { rows: ScenarioRow[]; parties: string; onEditCard?: () => void }) {
  return (
    <div className="overflow-hidden rounded-card border border-line bg-surface">
      {/* 머리줄은 넓은 화면에서만 — 줄마다 같은 뜻을 화면 낭독용 글자로 적어 둔다 */}
      <div aria-hidden className={`hidden border-b border-line bg-surface-muted py-2.5 text-caption font-semibold text-ink-muted md:grid ${SCENARIO_GRID}`}>
        <span>도표</span>
        <span>위 카드의 칸이 이 값이면</span>
        <span className="text-right">
          기본 과실
          <span className="block font-normal">{parties}</span>
        </span>
      </div>
      <ul className="divide-y divide-line">
        {rows.map((row, i) => (
          <li key={i} className={`py-2.5 ${SCENARIO_GRID}`}>
            <div className="min-w-0">
              <span className="font-semibold whitespace-nowrap">
                {row.chartId}
                {row.variant && ` (${row.variant})`}
              </span>
              {row.title && <span className="block text-caption text-ink-muted">{row.title}</span>}
            </div>
            <ul aria-label="이 값이면" className="col-span-2 row-start-2 flex flex-wrap content-start gap-1.5 md:col-span-1 md:col-start-2 md:row-start-1">
              {row.conditions.map((condition) => (
                <li key={condition.key} className="inline-flex min-h-6 flex-wrap items-center gap-x-1.5 rounded-badge bg-surface-muted px-2 py-0.5 text-caption">
                  <a href={`#fact-${condition.key}`} onClick={onEditCard} className="text-ink-muted underline underline-offset-4">
                    {condition.label}
                  </a>
                  <span className="font-semibold">{condition.values.join(" 또는 ")}</span>
                </li>
              ))}
            </ul>
            <p className="col-start-2 row-start-1 text-right whitespace-nowrap md:col-start-3">
              <span className="sr-only">기본 과실 {parties} </span>
              <span className="font-mono font-semibold tabular-nums">
                {row.baseA} : {row.baseB}
              </span>
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * 모르는 칸의 경우별 도표 — 앞 몇 줄은 펼쳐 두고 나머지는 접는다. 확정한 비율이 아님을 목록 위에 적는다.
 * common은 경우들의 기본 과실이 모두 같아 BE가 그 비율을 준 결과다(위에 크게 보인다).
 */
function Scenarios({ rows, common, mapping, ego, onEditCard }: { rows: ScenarioRow[]; common: boolean; mapping: PartyMapping; ego?: EgoName; onEditCard?: () => void }) {
  const parties = `${chartPartyName(mapping, "A", ego)} : ${chartPartyName(mapping, "B", ego)}`;
  const charts = new Set(rows.map((row) => row.chartId)).size;
  const rest = rows.slice(SCENARIOS_SHOWN);
  return (
    <section aria-labelledby="fault-scenarios-title" className="flex flex-col gap-3">
      <div>
        <h3 id="fault-scenarios-title" className="font-semibold">
          모르는 칸이 이런 값이면
          <span className="ml-2 text-caption font-normal text-ink-muted">
            도표 {charts}개 · 경우 {rows.length}개
          </span>
        </h3>
        <p className="mt-1">
          {common
            ? "모른다고 답한 칸이 아래 값일 때 고를 도표가 있고, 그 기본 과실은 모두 같아요."
            : "모른다고 답한 칸의 값에 따라 도표와 기본 과실이 달라져서 비율을 정하지 못했어요."}{" "}
          맞는 경우를 확인해 위 카드에 값을 넣고 다시 판단해 주세요.
        </p>
        <p className="mt-1 text-caption text-ink-muted">
          확정한 비율이 아니에요. 검색된 후보 도표 가운데 지금 카드와 맞을 수 있는 도표만 견준 것이라 여기 없는 경우도 있을 수 있어요. 기본 과실은 수정요소를 넣기 전 값이에요.
        </p>
        {/* 좁은 화면에는 머리줄이 없어 비율의 순서를 여기 적는다 */}
        <p className="mt-1 text-caption text-ink-muted md:hidden">기본 과실은 {parties} 순서예요.</p>
      </div>
      <ScenarioList rows={rows.slice(0, SCENARIOS_SHOWN)} parties={parties} onEditCard={onEditCard} />
      {rest.length > 0 && (
        <details>
          <summary className="cursor-pointer text-caption font-semibold text-ink-muted">그 밖의 경우 {rest.length}개 보기</summary>
          <div className="mt-3">
            <ScenarioList rows={rest} parties={parties} onEditCard={onEditCard} />
          </div>
        </details>
      )}
    </section>
  );
}

function NotReady({ result, mapping, ego, onEditCard }: { result: JudgmentResult; mapping: PartyMapping; ego?: EgoName; onEditCard?: () => void }) {
  const deferred = result.status === "deferred";
  const common = !deferred && result.fault_A !== null && result.fault_B !== null;
  const scenarios = scenarioRows(result.scenarios, ego);
  // 경우별 도표를 표로 그리면 사유 끝의 같은 내용 글 줄은 뺀다. 표로 못 그리는 결과(예전 저장분)는 글 줄을 그대로 둔다.
  const { reasons, swapHints } = splitSwapHints(scenarios.length > 0 ? splitScenarioLines(result.reasons).reasons : result.reasons);
  return (
    <div className="flex flex-col gap-4 break-keep">
      <h2 id="fault-result-title" className="text-heading font-semibold">
        {deferred ? "판단을 보류했어요" : "추가 확인이 필요해요"}
      </h2>
      {/* '모름'으로 답한 칸 때문에 갈린 경우의 기본 과실이 모두 같으면 그 비율이 온다(BE scenario_outcome) — 크게 보인다.
          경우는 도표가 있는 값뿐이라(하나일 수도 있다) 「모르는 칸과 상관없이」라고 적지 않는다. */}
      {common && (
        <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-caption font-semibold text-ink-muted">기본 과실(아래 경우 모두 같음)</span>
          <span className="text-heading font-semibold tabular-nums">
            {chartPartyName(mapping, "A", ego)} {result.fault_A} : {chartPartyName(mapping, "B", ego)} {result.fault_B}
          </span>
        </p>
      )}
      {reasons.length > 0 && (
        <ul className="flex flex-col gap-1">
          {reasons.map((reason, i) => (
            <li key={i}>
              <ReasonLine reason={reason} mapping={mapping} ego={ego} onEditCard={onEditCard} />
            </li>
          ))}
        </ul>
      )}
      {swapHints.length > 0 && (
        <Notice tone="warning" title="도표 A/B를 맞바꾸면">
          <ul className="flex flex-col gap-1">
            {swapHints.map((hint, i) => (
              <li key={i}>
                <ReasonLine reason={hint} mapping={mapping} ego={ego} onEditCard={onEditCard} />
              </li>
            ))}
          </ul>
          <p className="mt-2 text-caption">
            도표 A/B는 판단이 더 맞는 쪽으로 정해요. 지금 도표 A는 {chartPartyName(mapping, "A", ego)}예요. 위에 적힌 칸을 고치면 판단이 맞바꿔서 그 도표를 고를 수 있어요.
          </p>
        </Notice>
      )}
      {scenarios.length > 0 && <Scenarios rows={scenarios} common={common} mapping={mapping} ego={ego} onEditCard={onEditCard} />}
      {result.questions.length > 0 && (
        <div>
          <p className="text-caption font-semibold text-ink-muted">위 카드에서 확인할 칸</p>
          <ul className="mt-1 flex flex-wrap gap-2">
            {result.questions.map((q) => (
              <li key={q.question_id}>
                <a href={`#fact-${q.field_key}`} className="inline-flex h-8 items-center rounded-control border border-line-strong px-3 hover:bg-surface-muted">
                  {cardLabel(q.field_key, ego)} ↑
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="text-caption text-ink-muted">칸 이름을 누르면 위 카드의 그 칸으로 가요. 값을 고친 뒤 「확정하고 과실 비율 판단」을 다시 눌러 주세요.</p>
    </div>
  );
}
