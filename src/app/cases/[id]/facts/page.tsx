/** A·B: 영상·근거 프레임과 사실 카드. TODO: FactCardPanel·QuestionPanel 연결, 수동 입력·수정 이력·확정·버전 충돌. */
export default async function FactsPage(props: PageProps<"/cases/[id]/facts">) {
  const { id } = await props.params;
  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-2xl font-semibold">사건 {id} · 사실 카드</h1>
      <p className="mt-2 text-neutral-600">준비 중 — 영상·근거 프레임 옆에서 사실 카드를 확인하고 확정합니다.</p>
    </main>
  );
}
