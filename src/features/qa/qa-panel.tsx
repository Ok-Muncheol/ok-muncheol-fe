"use client";

/**
 * B: 근거 질의응답 — 판정이 난 판단을 근거로 묻고 답을 받는다(POST /cases/{id}/qa, BE app/agents/qa.py).
 * BE는 판단 로그 · 결정례 · 약관 검색 · 가정 실행 도구로 답한다. 가정 결과(what-if)는 공식 판정과 따로 그리고
 * 공식 판단 · 보고서는 바뀌지 않는다. 답의 [E1] 표시는 아래 인용 근거로 이동하고, 인용마다 출처(공식 판단 · 검색 · 가정 실행)를 단다.
 * 질문 · 답은 저장하지 않는다 — 이 화면을 떠나면 사라진다. API 모드(live)만 보낸다. 견본 모드는 보내지 않는다.
 */
import { type FormEvent, useState } from "react";
import { StatusLabel } from "@/components/status-label";
import { fieldLabel, optionLabel } from "@/lib/api/chart-scope";
import { asApiError, createApiClient } from "@/lib/api/client";
import type { ApiError, QaAnswer, QaHypothesis } from "@/lib/api/types";
import {
  QA_CORPUS_LABELS,
  QA_MAX_LENGTH,
  citationSource,
  hypothesisKind,
  pagesLabel,
  questionProblem,
  splitAnswer,
  toolLabel,
} from "@/lib/qa/view";
import { Badge, Button, Card, Empty, Field, Notice, Textarea } from "@/ui/controls";

type Exchange = { id: number; question: string; answer: QaAnswer };

type Props = { caseId: string; live: boolean; judgmentVersion: number };

export function QaPanel({ caseId, live, judgmentVersion }: Props) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [held, setHeld] = useState(false);
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const inputId = `qa-question-${caseId}`;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const issue = questionProblem(text);
    setProblem(issue);
    if (issue) return;
    if (!live) {
      setHeld(true);
      return;
    }
    const question = text.trim();
    setSending(true);
    setError(null);
    try {
      const answer = await createApiClient().askQuestion(caseId, question);
      setExchanges((previous) => [{ id: Date.now(), question, answer }, ...previous]);
      setText("");
    } catch (caught) {
      setError(asApiError(caught));
    } finally {
      setSending(false);
    }
  }

  return (
    <Card
      title="근거 질의응답"
      aside={
        <Badge>
          판단 <span className="font-mono tabular-nums">v{judgmentVersion}</span> 기준
        </Badge>
      }
    >
      <p className="text-caption text-ink-muted">
        판정의 근거를 묻거나 ‘만약 ~였다면’을 물으면 판단 로그 · 결정례 · 약관 검색과 가정 실행으로 답한다. 공식 판정 · 보고서는
        바뀌지 않고, 질문과 답은 저장하지 않는다.
      </p>
      <form onSubmit={submit} className="mt-4 flex flex-col items-stretch gap-3" aria-busy={sending}>
        <Field id={inputId} label="질문" hint={`${text.length} / ${QA_MAX_LENGTH}자`} error={problem}>
          <Textarea
            id={inputId}
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={3}
            maxLength={QA_MAX_LENGTH}
            placeholder="예) B 차량도 녹색 신호였다면 과실이 어떻게 달라지나요?"
            disabled={sending}
          />
        </Field>
        <div className="flex flex-col items-start gap-2">
          <Button type="submit" size="sm" disabled={sending} aria-busy={sending}>
            {sending ? "답을 만드는 중…" : "질문하기"}
          </Button>
          {sending && (
            <p role="status" className="text-caption text-ink-muted">
              도구를 쓰며 답을 만든다. 수십 초 걸릴 수 있다.
            </p>
          )}
          {held && (
            <p role="status" className="text-caption">
              견본이라 보내지 않았다 — 연결 뒤에는 판단 <span className="font-mono tabular-nums">v{judgmentVersion}</span>을 근거로 답한다.
            </p>
          )}
          {error && (
            <p role="alert" className="text-caption">
              <span className="font-semibold">답을 받지 못했다.</span> {error.message} (오류 코드{" "}
              <span className="font-mono">{error.code}</span>){error.retryable && " · 다시 질문할 수 있다."}
            </p>
          )}
        </div>
      </form>
      {exchanges.length > 0 && (
        <ol className="mt-6 flex flex-col divide-y divide-line">
          {exchanges.map((exchange) => (
            <li key={exchange.id} className="py-5 first:pt-0 last:pb-0">
              <QaExchange exchange={exchange} />
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

function QaExchange({ exchange }: { exchange: Exchange }) {
  const { id, question, answer } = exchange;
  const known = new Set(answer.citations.map((citation) => citation.ref));
  const anchor = (ref: string) => `qa-${id}-${ref}`;
  return (
    <article className="flex flex-col gap-3">
      <p className="text-body font-semibold break-keep">Q. {question}</p>
      <p className="text-body whitespace-pre-line break-keep">
        {splitAnswer(answer.answer, known).map((part, index) =>
          part.kind === "text" ? (
            <span key={index}>{part.text}</span>
          ) : (
            <sup key={index} className="mx-0.5">
              [
              {part.refs.map((ref, n) => (
                <span key={ref}>
                  {n > 0 && ", "}
                  <a href={`#${anchor(ref)}`} className="font-mono text-primary-strong underline-offset-2 hover:underline">
                    {ref}
                  </a>
                </span>
              ))}
              ]
            </sup>
          ),
        )}
      </p>
      {answer.hypotheticals.length > 0 && <Hypotheses items={answer.hypotheticals} hint={answer.fact_change_hint} />}
      {answer.citations.length > 0 && (
        <div>
          <p className="text-caption font-semibold text-ink-muted">인용 근거</p>
          <ul className="mt-1 flex flex-col gap-2">
            {answer.citations.map((citation) => {
              const source = citationSource(citation);
              return (
                <li key={citation.ref} id={anchor(citation.ref)} className="text-caption">
                  <span className="font-mono font-semibold">{citation.ref}</span>{" "}
                  {source && (
                    <Badge tone={source.hypothetical ? "warning" : "neutral"} className="mr-1 align-middle">
                      {source.label}
                    </Badge>
                  )}
                  {QA_CORPUS_LABELS[citation.corpus] ?? citation.corpus} · 적용판 <span className="font-mono">{citation.edition}</span> ·{" "}
                  {pagesLabel(citation)}
                  <span className="block text-ink-muted break-keep">{citation.excerpt}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      <p className="text-caption text-ink-muted">
        판단 <span className="font-mono tabular-nums">v{answer.judgment_version}</span> 기준 · 쓴 도구{" "}
        {answer.tool_calls.length > 0
          ? answer.tool_calls.map((call) => `${toolLabel(call.name)}${call.ok ? "" : "(실패)"}`).join(" · ")
          : "없음"}
      </p>
    </article>
  );
}

/** 가정 결과는 공식 판정과 섞지 않는다 — 경고 톤으로 따로 묶고, 공식 반영 경로(fact_change_hint)를 함께 보인다. */
function Hypotheses({ items, hint }: { items: readonly QaHypothesis[]; hint: string | null }) {
  return (
    <Notice tone="warning" title="가정 결과 — 공식 판정이 아니다">
      <ul className="flex flex-col gap-3">
        {items.map((hypothesis, index) => (
          <li key={index}>
            <HypothesisRow hypothesis={hypothesis} />
          </li>
        ))}
      </ul>
      {hint && <p className="mt-3">{hint}</p>}
    </Notice>
  );
}

function HypothesisRow({ hypothesis }: { hypothesis: QaHypothesis }) {
  const changes = Object.entries(hypothesis.changes)
    .map(([key, value]) => `${fieldLabel(key)} = ${optionLabel(key, value) ?? value}`)
    .join(", ");
  const kind = hypothesisKind(hypothesis);
  return (
    <div className="flex flex-col gap-1">
      <p className="font-semibold break-keep">가정: {changes}</p>
      {kind === "judged" && (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {hypothesis.judgment_status && <StatusLabel status={hypothesis.judgment_status} />}
          <span>
            도표 {hypothesis.chart_id ? <span className="font-mono">{hypothesis.chart_id}</span> : <Empty>없음</Empty>}
          </span>
          <span>
            과실 A : B{" "}
            {hypothesis.fault_A !== null && hypothesis.fault_B !== null ? (
              <span className="font-mono tabular-nums">
                {hypothesis.fault_A} : {hypothesis.fault_B}
              </span>
            ) : (
              <Empty>비율 없음</Empty>
            )}
          </span>
        </p>
      )}
      {kind === "needs_fields" && (
        <p className="break-keep">확인할 칸이 남아 판정 전에 멈췄다: {hypothesis.open_fields.map(fieldLabel).join(", ")}</p>
      )}
      {kind === "failed" && <p className="break-keep">가정 실행 실패 — {hypothesis.error?.message ?? "이유를 받지 못했다."}</p>}
      {kind !== "needs_fields" && hypothesis.reasons.length > 0 && (
        <p className="text-caption break-keep">{hypothesis.reasons.join(" · ")}</p>
      )}
    </div>
  );
}
