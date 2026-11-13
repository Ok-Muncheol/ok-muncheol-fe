/**
 * A·B: 사건 작업 화면 아래쪽의 판단 결과 — 하단 버튼 「과실 비율 보기」가 여기(#fault-result)로 내려온다.
 * 판정 셋을 다르게 그린다: 초안 작성 가능(과실 비율·적용 도표·수정요소·사유), 추가 확인 필요(사유·확인할 칸 → 위 카드의 칸),
 * 판단 보류(사유). 비율·가감치·도표는 BE 값 그대로다 — FE가 계산하지 않는다. 도표 A/B는 매핑으로 「상대 차」「블랙박스 차」 이름을 붙인다.
 * 위 카드가 판단 뒤에 바뀌었으면(stale) 흐리게 두고 이전 카드 기준이라고 알린다.
 * 다음 단계는 비율 제목 줄 오른쪽에 둔다 — 「검토 보고서 보기 →」(보고서 화면으로 넘어간다)와 「사실 카드 고치기」(위 카드를 다시 연다).
 */
import { Button, ButtonLink } from "@/ui/controls";
import { EvidencePanel } from "@/features/evidence/evidence-panel";
import type { JudgmentResult, PartyMapping } from "@/lib/api/types";
import { cardLabel, chartPartyName } from "@/lib/facts/card";
import { evidenceDecisions, judgmentEvidence } from "@/lib/judgment/view";

export const FAULT_RESULT_ID = "fault-result";
/** 비율 제목 줄 — 이 줄이 화면 위로 지나가면 아래 떠 있는 바가 「검토 보고서 보기」를 대신 보인다. */
export const FAULT_RATIO_HEAD_ID = "fault-ratio-head";

type Props = {
  result: JudgmentResult;
  mapping: PartyMapping;
  /** 위 카드가 이 판단 뒤에 바뀌었다 */
  stale: boolean;
  reportHref: string | null;
  /** 위 사실 카드를 다시 열어 고친다 — 고칠 수 없는 때(질문 대기 · 이미 고치는 중)는 넘기지 않는다 */
  onEditCard?: () => void;
  /** 견본 모드의 흉내 낸 결과 */
  sample?: boolean;
};

export function FaultResult({ result, mapping, stale, reportHref, onEditCard, sample }: Props) {
  return (
    <section id={FAULT_RESULT_ID} aria-labelledby="fault-result-title" className={`scroll-mt-20 ${stale ? "opacity-60" : ""}`}>
      {stale && <p className="mb-3 text-caption font-semibold text-on-warning-soft">카드를 고쳐서 이 결과는 이전 카드 기준이에요. 다시 확정하면 새로 판단해요.</p>}
      {result.status === "draft_ready" ? (
        // 이전 카드 기준 결과로는 다음 단계로 넘어가지 않는다.
        <Ratio result={result} mapping={mapping} reportHref={stale ? null : reportHref} onEditCard={stale ? undefined : onEditCard} sample={sample} />
      ) : (
        <NotReady result={result} />
      )}
    </section>
  );
}

function Ratio({
  result,
  mapping,
  reportHref,
  onEditCard,
  sample,
}: {
  result: JudgmentResult;
  mapping: PartyMapping;
  reportHref: string | null;
  onEditCard?: () => void;
  sample?: boolean;
}) {
  const a = result.fault_A;
  const b = result.fault_B;
  const nameA = chartPartyName(mapping, "A");
  const nameB = chartPartyName(mapping, "B");
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
                사실 카드 고치기
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
            <Flow result={result} mapping={mapping} />
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
                      {chartPartyName(mapping, m.applies_to)} {m.name}
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
                      {chartPartyName(mapping, m.applies_to)} {m.name} · {m.decision}
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
              <ul className="flex flex-col gap-1">
                {result.reasons.map((reason, i) => (
                  <li key={i}>{reason}</li>
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
function Flow({ result, mapping }: { result: JudgmentResult; mapping: PartyMapping }) {
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
            {chartPartyName(mapping, m.applies_to)} {m.name}
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

function NotReady({ result }: { result: JudgmentResult }) {
  const deferred = result.status === "deferred";
  return (
    <div className="flex flex-col gap-4">
      <h2 id="fault-result-title" className="text-heading font-semibold">
        {deferred ? "판단을 보류했어요" : "추가 확인이 필요해요"}
      </h2>
      {result.reasons.length > 0 && (
        <ul className="flex flex-col gap-1">
          {result.reasons.map((reason, i) => (
            <li key={i}>{reason}</li>
          ))}
        </ul>
      )}
      {result.questions.length > 0 && (
        <div>
          <p className="text-caption font-semibold text-ink-muted">위 카드에서 확인할 칸</p>
          <ul className="mt-1 flex flex-wrap gap-2">
            {result.questions.map((q) => (
              <li key={q.question_id}>
                <a href={`#fact-${q.field_key}`} className="inline-flex h-8 items-center rounded-control border border-line-strong px-3 hover:bg-surface-muted">
                  {cardLabel(q.field_key)} ↑
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="text-caption text-ink-muted">사실이 틀렸다면 위 카드에서 「수정하기」로 고친 뒤 「확정하고 과실 비율 판단」을 다시 눌러 주세요.</p>
    </div>
  );
}
