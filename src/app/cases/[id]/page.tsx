/** A·B: 사건 상세. TODO: GET /cases/{id}로 진행 상태·확인 질문·현재 버전 복원(Realtime은 변경 알림만). */
export default async function CasePage(props: PageProps<"/cases/[id]">) {
  const { id } = await props.params;
  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-2xl font-semibold">사건 {id}</h1>
      <p className="mt-2 text-neutral-600">준비 중 — 진행 상태·확인 질문·현재 버전을 요약합니다.</p>
    </main>
  );
}
