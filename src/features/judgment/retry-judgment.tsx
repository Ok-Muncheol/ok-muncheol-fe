"use client";

/**
 * B: 판단 접수 버튼 — 확정 카드로 판단을 시작하거나(StartJudgment), BE가 다시 시도해도 된다고 한 실패(retryable)를
 * 다시 시작한다(RetryJudgment). POST /cases/{id}/judgments {card_version} + Idempotency-Key.
 * 키는 접수가 성공할 때까지 같은 키를 쓴다 — 응답을 못 받고 다시 눌러도 BE가 같은 접수로 본다. 성공하면 판단 조회를 다시 읽는다.
 * 카드가 그 사이 바뀌었으면(409 version_conflict) 최신 카드를 확인하라는 BE 메시지를 그대로 보여 준다.
 * API 모드(live)만 보낸다. 견본 모드는 접수하지 않는다.
 */
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { asApiError, createApiClient, newIdempotencyKey } from "@/lib/api/client";
import type { ApiError } from "@/lib/api/types";
import { Button } from "@/ui/controls";

type Props = { caseId: string; cardVersion: number; live: boolean };

export function StartJudgment(props: Props) {
  return <JudgmentRequest {...props} label="판단 시작" />;
}

export function RetryJudgment(props: Props) {
  return <JudgmentRequest {...props} label="다시 시작" />;
}

function JudgmentRequest({ caseId, cardVersion, live, label }: Props & { label: string }) {
  const router = useRouter();
  const key = useRef<string | null>(null);
  const [sending, setSending] = useState(false);
  const [refreshing, startRefresh] = useTransition();
  const [held, setHeld] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const busy = sending || refreshing;

  async function request() {
    if (!live) {
      setHeld(true);
      return;
    }
    setSending(true);
    setError(null);
    const idempotencyKey = (key.current ??= newIdempotencyKey());
    try {
      await createApiClient().startJudgment(caseId, cardVersion, idempotencyKey);
      key.current = null;
      startRefresh(() => router.refresh());
    } catch (caught) {
      setError(asApiError(caught));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <Button size="sm" onClick={request} disabled={busy} aria-busy={busy}>
        {sending ? "접수하는 중…" : label}
      </Button>
      {held && (
        <p role="status" className="text-caption">
          견본이라 접수하지 않았다 — 연결 뒤에는 사실 카드 <span className="font-mono tabular-nums">v{cardVersion}</span>로 판단을 접수한다.
        </p>
      )}
      {error && (
        <p role="alert" className="text-caption">
          <span className="font-semibold">접수하지 못했다.</span> {error.message} (오류 코드 <span className="font-mono">{error.code}</span>)
        </p>
      )}
    </div>
  );
}
