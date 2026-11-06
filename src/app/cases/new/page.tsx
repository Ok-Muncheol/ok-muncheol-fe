/** A: 사건 접수. 사고 정보·당사자·입력 경로·범위 확인은 CaseIntake가 채운다. */
import { CaseIntake } from "@/features/cases/case-intake";

export default function NewCasePage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-2xl font-semibold">새 사건</h1>
      <p className="mt-2 text-neutral-600">준비 중 — 사고 정보·당사자·입력 경로·범위를 확인합니다.</p>
      <CaseIntake />
    </main>
  );
}
