"use client";

/**
 * B: 구분 질문 답변 — 확인 대기 실행의 질문(answerableQuestions)마다 보기 하나나 ‘확인 불가’를 골라 따로 보낸다
 * (POST …/questions/{question_id}/answer). 이미 답한 질문은 답만 보여 주고 다시 보내지 않는다(BE는 409 already_answered).
 * ‘확인 불가’만 모이면 BE가 같은 실행을 재개하고, 값 답변이 있으면 사실 카드에 반영·재확정한 뒤 판단을 다시 요청한다 —
 * 무엇을 기다리는지는 판단 화면이 판단 조회로 다시 읽어 안내한다. 여기서 판정을 바꾸지 않는다.
 * 보기는 고르지 않은 채로 연다 — 모델 원값을 미리 골라 두면 확인 없이 넘기기 쉽다.
 * API 모드(live)만 보낸다. 견본 모드는 보내지 않고 보낼 값을 화면에 보여 준다.
 */
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { fieldLabel, optionLabel } from "@/lib/api/chart-scope";
import { createBrowserApiClient } from "@/lib/api/browser";
import { asApiError } from "@/lib/api/client";
import type { AnswerView, ApiError, FactField, QuestionAnswer, QuestionView } from "@/lib/api/types";
import { UNKNOWN_CHOICE, answerFor } from "@/lib/judgment/view";
import { Button, ChoiceGroup, Notice } from "@/ui/controls";

type Props = {
  caseId: string;
  /** API 모드면 BE로 보낸다. 견본 모드면 보내지 않는다. */
  live: boolean;
  questions: readonly QuestionView[];
  /** 질문을 받은 카드 버전 — 답변의 expected_card_version */
  expectedCardVersion: number;
  /** 같은 화면 사실 카드의 칸 — 칸이 있으면 질문의 칸 이름을 그 칸으로 가는 링크로 둔다. 카드를 못 읽었으면 비어 있다. */
  fields: Partial<Record<string, FactField>>;
};

export function QuestionPanel({ caseId, live, questions, expectedCardVersion, fields }: Props) {
  return (
    <ol className="flex flex-col divide-y divide-line">
      {questions.map((question, i) => {
        const position = `${i + 1}/${questions.length}`;
        const field = fields[question.field_key];
        return (
          <li key={question.question_id} className="py-4 first:pt-0 last:pb-0">
            {question.answer ? (
              <AnsweredQuestion question={question} answer={question.answer} position={position} field={field} />
            ) : (
              <QuestionForm
                caseId={caseId}
                live={live}
                question={question}
                position={position}
                expectedCardVersion={expectedCardVersion}
                field={field}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

function QuestionForm({
  caseId,
  live,
  question,
  position,
  expectedCardVersion,
  field,
}: {
  caseId: string;
  live: boolean;
  question: QuestionView;
  position: string;
  expectedCardVersion: number;
  field: FactField | undefined;
}) {
  const router = useRouter();
  const [choice, setChoice] = useState<string | null>(null);
  const [held, setHeld] = useState<QuestionAnswer | null>(null);
  const [sending, setSending] = useState(false);
  const [refreshing, startRefresh] = useTransition();
  const [error, setError] = useState<ApiError | null>(null);
  const key = question.field_key;
  const busy = sending || refreshing;
  const choices = [
    ...question.options.map((option) => ({ value: option, label: optionLabel(key, option) ?? option })),
    ...(question.allow_unknown ? [{ value: UNKNOWN_CHOICE, label: "확인 불가" }] : []),
  ];

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (choice === null || busy) return;
    const answer = answerFor(question, choice, expectedCardVersion);
    if (!live) {
      setHeld(answer);
      return;
    }
    setSending(true);
    setError(null);
    try {
      await createBrowserApiClient().answerQuestion(caseId, answer);
      // 답한 질문과 다음 할 일(남은 질문·카드 반영·재개한 판정)은 판단 조회를 다시 읽어 그린다
      startRefresh(() => router.refresh());
    } catch (caught) {
      setError(asApiError(caught));
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col items-start gap-3" aria-busy={busy}>
      <ChoiceGroup
        name={question.question_id}
        legend={question.text}
        choices={choices}
        value={choice}
        disabled={busy}
        onChange={(value) => {
          setChoice(value);
          setHeld(null);
          setError(null);
        }}
      >
        <QuestionMeta position={position} fieldKey={key} field={field} />
      </ChoiceGroup>
      <Button type="submit" size="sm" disabled={choice === null || busy}>
        {sending ? "보내는 중…" : "답변 보내기"}
      </Button>
      {error && (
        <div className="self-stretch">
          <AnswerError
            error={error}
            refreshing={refreshing}
            onRefresh={() => {
              setError(null);
              startRefresh(() => router.refresh());
            }}
          />
        </div>
      )}
      {held && (
        <div className="self-stretch">
          <Notice tone="info" title="견본이라 보내지 않았다">
            연결 뒤에는 사실 카드 <span className="font-mono tabular-nums">v{held.expected_card_version}</span> 기준으로 「{fieldLabel(key)} ={" "}
            {held.unknown ? "확인 불가" : optionLabel(key, held.value)}」를 보낸다.
          </Notice>
        </div>
      )}
    </form>
  );
}

/** 판단이 그 사이 바뀌어 이 질문에 답할 수 없는 오류 — 다시 읽으면 지금 상태가 보인다. */
const STALE_CODES = new Set(["version_conflict", "question_closed", "already_answered"]);

function AnswerError({ error, refreshing, onRefresh }: { error: ApiError; refreshing: boolean; onRefresh: () => void }) {
  const stale = STALE_CODES.has(error.code);
  return (
    <Notice tone={stale ? "warning" : "danger"} title={stale ? "판단이 그 사이 바뀌었다" : "답변을 보내지 못했다"}>
      <p>{error.message}</p>
      <p className="mt-1 text-caption">
        오류 코드 <span className="font-mono">{error.code}</span>
        {!stale && error.retryable && " · 같은 답을 다시 보낼 수 있다."}
      </p>
      {stale && (
        <Button size="sm" variant="secondary" className="mt-3" onClick={onRefresh} disabled={refreshing}>
          판단 다시 읽기
        </Button>
      )}
    </Notice>
  );
}

/** 이미 답한 질문 — 답과 그 답을 낸 카드 버전. 담당자가 낸 값이라 ink로 적는다(모델 값이 아니다). */
function AnsweredQuestion({
  question,
  answer,
  position,
  field,
}: {
  question: QuestionView;
  answer: AnswerView;
  position: string;
  field: FactField | undefined;
}) {
  const key = question.field_key;
  return (
    <div className="flex flex-col gap-1">
      <p className="text-body font-semibold break-keep">{question.text}</p>
      <QuestionMeta position={position} fieldKey={key} field={field} />
      <p className="mt-1 text-body">
        <span className="text-ink-muted">답</span>{" "}
        <span className="font-semibold text-ink">{answer.unknown ? "확인 불가" : (optionLabel(key, answer.value) ?? answer.value)}</span>
        <span className="text-caption text-ink-muted">
          {" "}
          · 사실 카드 <span className="font-mono tabular-nums">v{answer.expected_card_version}</span> 기준
        </span>
      </p>
    </div>
  );
}

/**
 * 질문 번호와 묻는 칸. 칸의 지금 값·확인 상태·모델 원값은 같은 화면의 사실 카드에 있어 다시 적지 않고,
 * 카드에 그 칸이 있으면 칸 이름을 그 칸으로 가는 링크(#fact-{칸}, FactCardPanel의 입력 id)로 둔다.
 */
function QuestionMeta({ position, fieldKey, field }: { position: string; fieldKey: string; field: FactField | undefined }) {
  return (
    <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-caption text-ink-muted">
      <span className="font-mono tabular-nums">질문 {position}</span>
      <span aria-hidden>·</span>
      {field ? (
        <a href={`#fact-${fieldKey}`} className="text-primary-strong underline-offset-4 hover:underline">
          {fieldLabel(fieldKey)} — 사실 카드에서 보기
        </a>
      ) : (
        <span>{fieldLabel(fieldKey)}</span>
      )}
    </p>
  );
}
