"use client";

/**
 * B: 실패한 판단 다시 시작 — BE가 다시 시도해도 된다고 한 오류(retryable)에만 둔다.
 * TODO: POST /cases/{id}/judgments {card_version} + Idempotency-Key, 202를 받으면 상태를 다시 조회한다(router.refresh).
 * 버전 충돌(409)이면 최신 카드를 확인하라고 안내한다. 지금은 견본이라 접수하지 않는다.
 */
import { useState } from "react";
import { Button } from "@/ui/controls";

export function RetryJudgment({ cardVersion }: { cardVersion: number }) {
  const [held, setHeld] = useState(false);
  return (
    <div className="flex flex-col items-start gap-2">
      <Button size="sm" onClick={() => setHeld(true)}>
        다시 시작
      </Button>
      {held && (
        <p role="status" className="text-caption">
          견본이라 접수하지 않았다 — 연결 뒤에는 사실 카드 <span className="font-mono tabular-nums">v{cardVersion}</span>로 판단을 다시 접수한다.
        </p>
      )}
    </div>
  );
}
