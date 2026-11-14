"use client";

/**
 * B 통합: 접수 등록 — 관리자가 들은 대로 사고 장소와 내용을 적으면 배정 에이전트가 바로 배정한다(POST /admin/intakes).
 * 지역은 적지 않는다 — 사고 장소 글에서 에이전트가 판별한다. 결과(누구에게 배정됐는지, 못 했으면 왜)를 바로 보이고 목록을 새로 읽는다.
 */
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { createBrowserApiClient } from "@/lib/api/browser";
import { asApiError } from "@/lib/api/client";
import type { ApiError, IntakeView, StaffMember } from "@/lib/api/types";
import { METHOD_VIEW, staffName } from "@/lib/admin/view";
import { Badge, Button, Field, Input, Notice, Textarea } from "@/ui/controls";

export function IntakeForm({ staff }: { staff: StaffMember[] }) {
  const router = useRouter();
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [injured, setInjured] = useState("0");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [result, setResult] = useState<IntakeView | null>(null);
  const byId = new Map(staff.map((member) => [member.user_id, member]));
  const ready = location.trim() !== "" && description.trim() !== "";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready || sending) return;
    setSending(true);
    setError(null);
    setResult(null);
    try {
      const created = await createBrowserApiClient().registerAdminIntake({
        location: location.trim(), description: description.trim(), injured_count: Number(injured) || 0,
      });
      setResult(created);
      setLocation("");
      setDescription("");
      setInjured("0");
      router.refresh();
    } catch (caught) {
      setError(asApiError(caught));
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-[1fr_8rem]">
        <Field id="intake-location" label="사고 장소" hint="들은 대로 적습니다. 지역은 배정 에이전트가 판별합니다." required>
          <Input id="intake-location" value={location} onChange={(event) => setLocation(event.target.value)} maxLength={500} placeholder="예: 성남시 분당구 판교역로 사거리" />
        </Field>
        <Field id="intake-injured" label="다친 사람 수" hint="1명 이상이면 대인 담당자도 배정합니다.">
          <Input id="intake-injured" type="number" min={0} max={20} value={injured} onChange={(event) => setInjured(event.target.value)} className="font-mono tabular-nums" />
        </Field>
      </div>
      <Field id="intake-description" label="사고 내용" required>
        <Textarea id="intake-description" rows={2} value={description} onChange={(event) => setDescription(event.target.value)} maxLength={4000} placeholder="예: 신호 교차로에서 직진하던 차와 맞은편 좌회전 차가 부딪쳤습니다." />
      </Field>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={!ready || sending}>
          {sending ? "배정하는 중…" : "접수하고 배정"}
        </Button>
        {sending && <span className="text-caption text-ink-muted">배정 에이전트가 후보를 보고 있습니다. 몇 초 걸립니다.</span>}
      </div>
      {error && <Notice tone="danger" title="접수하지 못했습니다">{error.message}</Notice>}
      {result && result.status === "unassigned" && (
        <Notice tone="warning" title="담당자를 구하지 못해 미배정으로 남았습니다">
          {result.unassigned_reason} 아래 목록의 「미배정」 탭에서 직접 배정할 수 있습니다.
        </Notice>
      )}
      {result && result.status !== "unassigned" && (
        <Notice tone="success" title={`${result.region ?? ""} 지역 담당자에게 배정했습니다`}>
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {result.assignment && <Badge tone={METHOD_VIEW[result.assignment.method].tone}>{METHOD_VIEW[result.assignment.method].label}</Badge>}
            <span>
              대물 {staffName(byId.get(result.property_assignee_id ?? ""), result.property_assignee_id)}
              {result.injury_assignee_id && ` · 대인 ${staffName(byId.get(result.injury_assignee_id), result.injury_assignee_id)}`}
            </span>
          </span>
          {result.assignment && <span className="mt-1 block">{result.assignment.reason}</span>}
          {result.unassigned_reason && <span className="mt-1 block">{result.unassigned_reason}</span>}
        </Notice>
      )}
    </form>
  );
}
