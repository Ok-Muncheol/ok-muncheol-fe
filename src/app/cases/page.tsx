/** A: 담당 사건 목록. TODO: 진행·판정·승인 상태(작업 진행과 판정을 구분), 사건 조회 API 연결. */
import { ButtonLink, PageHeader } from "@/ui/controls";

export default function CasesPage() {
  return (
    <>
      <PageHeader
        title="담당 사건"
        description="준비 중 — 진행·판정·승인 상태별 사건 목록을 보여 줍니다."
        actions={<ButtonLink href="/cases/new">사건 접수</ButtonLink>}
      />
    </>
  );
}
