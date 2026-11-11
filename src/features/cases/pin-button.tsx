"use client";

/**
 * B 통합: 사건 고정 버튼 — 고정 폼(pin-actions.ts의 togglePin) 안에 둔다.
 * 보내는 동안에는 바뀔 모양을 먼저 보이고(낙관적 표시) 다시 눌러도 보내지 않는다 — 두 번 눌러 고정이 도로 풀리지 않게 한다.
 */
import { useFormStatus } from "react-dom";
import { PinIcon } from "./pin-icon";

export function PinButton({ caseId, pinned }: { caseId: string; pinned: boolean }) {
  const { pending } = useFormStatus();
  const shown = pending ? !pinned : pinned;
  return (
    <button
      type="submit"
      aria-pressed={shown}
      aria-busy={pending}
      title={shown ? "고정 해제" : "고정"}
      onClick={(event) => {
        if (pending) event.preventDefault();
      }}
      className={`flex size-7 shrink-0 items-center justify-center rounded-control transition-colors hover:bg-surface-muted ${
        shown ? "text-primary-strong" : "text-ink-faint hover:text-ink-muted"
      }`}
    >
      <PinIcon filled={shown} />
      <span className="sr-only">{caseId} 고정</span>
    </button>
  );
}
