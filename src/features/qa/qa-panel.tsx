/** B: 질의응답 표시 초안. TODO: 근거 답변 API·질문 입력·가정 조건·인용 이동. */
export function QaPanel({ answer, hypothetical }: { answer: string | null; hypothetical: boolean }) {
  return <section aria-label="근거 질의응답">
    <h2>{hypothetical ? "가정 결과" : "근거 질의응답"}</h2>
    <p>{answer ?? "답변 없음"}</p>
  </section>;
}
