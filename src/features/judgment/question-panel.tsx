"use client";
/** B: 질문 입력 초안. TODO: 전송 중/실패·중복 방지·답변 뒤 A 카드 재확정 연결. */
import type { ConfirmationQuestion, QuestionAnswer } from "../../lib/api/types";

type Props = { question: ConfirmationQuestion; expectedCardVersion: number; onAnswer: (answer: QuestionAnswer) => void };
export function QuestionPanel({ question, expectedCardVersion, onAnswer }: Props) {
  const answer = (value: string | null, unknown: boolean) => onAnswer({
    question_id: question.question_id, expected_card_version: expectedCardVersion, value, unknown,
  });
  return <section aria-label="추가 확인 질문">
    <h2>{question.text}</h2>
    {question.options.map((option) => <button type="button" key={option} onClick={() => answer(option, false)}>{option}</button>)}
    {question.allow_unknown && <button type="button" onClick={() => answer(null, true)}>확인 불가</button>}
  </section>;
}
