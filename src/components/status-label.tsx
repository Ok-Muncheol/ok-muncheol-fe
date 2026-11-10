/**
 * B 통합: 작업 진행과 판정 결과의 서로 다른 타입을 그대로 표시한다.
 * 톤은 뜻으로 고른다 — 작업 완료(success)와 초안 작성 가능(info)은 다른 상태라 색도 다르다(README 「화면 원칙」).
 * 사실 카드 칸의 확인 상태와 검증 3겹의 층 결과도 여기서 톤을 정한다.
 */
import type { FactField, JudgmentStatus, TaskStatus } from "../lib/api/types";
import type { CheckState } from "../lib/judgment/view";
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

/** 사실 카드 칸의 확인 상태. 담당자 확인만 success다 — 모델 확신도가 높아도 확인 전이면 확인으로 보이지 않는다. */
const verification: Record<FactField["verification_status"], { text: string; tone: Tone }> = {
  unverified: { text: "미확인", tone: "neutral" },
  needs_review: { text: "확인 필요", tone: "warning" },
  human_confirmed: { text: "담당자 확인", tone: "success" },
};

export function VerificationLabel({ status }: { status: FactField["verification_status"] }) {
  const { text, tone } = verification[status];
  return (
    <Badge tone={tone} dot>
      {text}
    </Badge>
  );
}

/** 검증 3겹 한 층의 결과. 걸린 층은 사람이 봐야 다음으로 가므로 warning, 판정이 앞에서 나 가지 않은 층은 neutral이다. */
const checks: Record<CheckState, { text: string; tone: Tone }> = {
  passed: { text: "통과", tone: "success" },
  failed: { text: "확인 필요", tone: "warning" },
  not_run: { text: "실행 안 함", tone: "neutral" },
};

export function CheckLabel({ state }: { state: CheckState }) {
  const { text, tone } = checks[state];
  return (
    <Badge tone={tone} dot>
      {text}
    </Badge>
  );
}
