/** A: 사건 접수. 사고 정보·당사자·입력 경로·범위 확인은 CaseIntake가 채운다. */
import { CaseIntake } from "@/features/cases/case-intake";
import { PageHeader } from "@/ui/controls";

export default function NewCasePage() {
  return (
    <>
      <PageHeader eyebrow="담당 사건" title="새 사건" description="준비 중 — 사고 정보·당사자·입력 경로·범위를 확인합니다." />
      <CaseIntake />
    </>
  );
}
