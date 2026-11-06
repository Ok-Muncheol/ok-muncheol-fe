/**
 * B 통합: 작업 진행과 판정 결과의 서로 다른 타입을 그대로 표시한다.
 * 톤은 뜻으로 고른다 — 작업 완료(success)와 초안 작성 가능(info)은 다른 상태라 색도 다르다(README 「화면 원칙」).
 */
import type { JudgmentStatus, TaskStatus } from "../lib/api/types";
import { Badge, type Tone } from "../ui/controls";

const labels: Record<JudgmentStatus | TaskStatus, { text: string; tone: Tone }> = {
  queued: { text: "대기", tone: "neutral" },
  running: { text: "처리 중", tone: "info" },
  waiting_for_confirmation: { text: "확인 대기", tone: "warning" },
  completed: { text: "작업 완료", tone: "success" },
  failed: { text: "작업 실패", tone: "danger" },
  draft_ready: { text: "초안 작성 가능", tone: "info" },
  needs_confirmation: { text: "추가 확인 필요", tone: "warning" },
  deferred: { text: "판단 보류", tone: "warning" },
};

export function StatusLabel({ status }: { status: JudgmentStatus | TaskStatus }) {
  const { text, tone } = labels[status];
  return (
    <Badge tone={tone} dot>
      {text}
    </Badge>
  );
}
