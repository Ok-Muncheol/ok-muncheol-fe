"use client";

/**
 * B: 구분 질문 답변 — BE가 낸 질문마다 보기 하나나 ‘확인 불가’를 골라 따로 보낸다(POST …/questions/{question_id}/answer).
 * 답하면 사실 카드 새 버전이 생기고, 사실 카드 화면에서 그 카드를 다시 확정해야 판단을 재개한다. 여기서 판정을 바꾸지 않는다.
 * 보기는 고르지 않은 채로 연다 — 모델 원값을 미리 골라 두면 확인 없이 넘기기 쉽다.
 * TODO: 요청 연결 — 보내는 중·실패·버전 충돌(409)·중복 전송 방지, 보낸 뒤 카드 새 버전으로 기대 버전을 올린다.
 * 지금은 견본이라 보내지 않고, 보낼 값을 화면에 보여 준다.
 */
import { useState, type FormEvent } from "react";
import { ModelValue } from "@/components/model-value";
import { VerificationLabel } from "@/components/status-label";
import { fieldLabel, optionLabel } from "@/lib/api/chart-scope";
import type { ConfirmationQuestion, FactField, QuestionAnswer } from "@/lib/api/types";
import { UNKNOWN_CHOICE, answerFor } from "@/lib/judgment/view";
import { Button, ChoiceGroup, Empty, Notice } from "@/ui/controls";

type Props = {
  questions: readonly ConfirmationQuestion[];
  /** 질문을 받은 카드 버전 — 답변의 expected_card_version */
  expectedCardVersion: number;
  /** 질문이 묻는 카드 칸의 지금 값. 카드를 못 읽었으면 비어 있다. */
  fields: Partial<Record<string, FactField>>;
};

export function QuestionPanel({ questions, expectedCardVersion, fields }: Props) {
  return (
    <ol className="flex flex-col divide-y divide-line">
      {questions.map((question, i) => (
        <li key={question.question_id} className="py-4 first:pt-0 last:pb-0">
          <QuestionForm
            question={question}
            position={`${i + 1}/${questions.length}`}
            expectedCardVersion={expectedCardVersion}
            field={fields[question.field_key]}
          />
        </li>
      ))}
    </ol>
  );
}

function QuestionForm({
  question,
  position,
  expectedCardVersion,
  field,
}: {
  question: ConfirmationQuestion;
  position: string;
  expectedCardVersion: number;
  field: FactField | undefined;
}) {
  const [choice, setChoice] = useState<string | null>(null);
  const [held, setHeld] = useState<QuestionAnswer | null>(null);
  const key = question.field_key;
  const choices = [
    ...question.options.map((option) => ({ value: option, label: optionLabel(key, option) ?? option })),
    ...(question.allow_unknown ? [{ value: UNKNOWN_CHOICE, label: "확인 불가" }] : []),
  ];

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (choice === null) return;
    // TODO(B): createApiClient().answerQuestion(caseId, answer) — 견본이라 보내지 않고 보낼 값만 남긴다.
    setHeld(answerFor(question, choice, expectedCardVersion));
  }

  return (
    <form onSubmit={submit} className="flex flex-col items-start gap-3">
      <ChoiceGroup
        name={question.question_id}
        legend={question.text}
        choices={choices}
        value={choice}
        onChange={(value) => {
          setChoice(value);
          setHeld(null);
        }}
      >
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-caption text-ink-muted">
          <span className="font-mono tabular-nums">질문 {position}</span>
          <span aria-hidden>·</span>
          <span>{fieldLabel(key)}</span>
          {field && <FieldNow fieldKey={key} field={field} />}
        </p>
      </ChoiceGroup>
      <Button type="submit" size="sm" disabled={choice === null}>
        답변 보내기
      </Button>
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

/** 지금 카드 값·확인 상태와 모델 원값. 모델 값은 model 톤으로만 적는다. */
function FieldNow({ fieldKey, field }: { fieldKey: string; field: FactField }) {
  return (
    <>
      <span aria-hidden>·</span>
      <span>
        지금 카드 값 <span className="font-semibold text-ink">{optionLabel(fieldKey, field.value) ?? <Empty>불명</Empty>}</span>
      </span>
      <VerificationLabel status={field.verification_status} />
      <ModelValue fieldKey={fieldKey} field={field} />
    </>
  );
}
