/** A: 새 사건 — 사고 날짜와 블랙박스 영상을 받아 바로 분석을 시작한다(CaseIntake). */
import { isSampleSource } from "@/features/cases/case-source";
import { CaseIntake } from "@/features/cases/case-intake";

export default function NewCasePage() {
  return <CaseIntake sample={isSampleSource()} />;
}
