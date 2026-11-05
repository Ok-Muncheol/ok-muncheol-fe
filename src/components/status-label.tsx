/** D 통합: 작업과 판정의 서로 다른 타입을 그대로 표시한다. */
import type { JudgmentStatus, TaskStatus } from "../lib/api/types";

const labels: Record<JudgmentStatus | TaskStatus, string> = {
  queued: "대기", running: "처리 중", waiting_for_confirmation: "확인 대기",
  completed: "작업 완료", failed: "작업 실패", draft_ready: "초안 작성 가능",
  needs_confirmation: "추가 확인 필요", deferred: "판단 보류",
};

export function StatusLabel({ status }: { status: JudgmentStatus | TaskStatus }) {
  return <span>{labels[status]}</span>;
}
