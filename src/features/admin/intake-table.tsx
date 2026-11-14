"use client";

/**
 * B 통합: 접수 건 목록 — 한 줄에 접수 시각·장소·단계·대물/대인 담당자·배정 방식과 까닭을 보이고, 줄마다 직접 배정·이관을 연다.
 * 배정 폼은 고른 줄 바로 아래에 펼친다(POST /admin/intakes/{id}/assignments). 담당자가 없던 분야면 직접 배정, 있었으면 이관이다.
 * 종결된 건은 담당자를 바꿀 수 없어 단추를 두지 않는다. 가상 접수(시연용)는 「가상」 표시를 단다.
 */
import { useRouter } from "next/navigation";
import { type FormEvent, Fragment, useState } from "react";
import { createBrowserApiClient } from "@/lib/api/browser";
import { asApiError } from "@/lib/api/client";
import type { ApiError, Coverage, IntakeView, StaffMember } from "@/lib/api/types";
import { COVERAGE_LABELS, METHOD_VIEW, STAGE_VIEW, assignable, needsInjuryAdjuster, shortTime, staffName } from "@/lib/admin/view";
import { Badge, Button, Field, Input, Notice, Select, Table, Td, Th } from "@/ui/controls";

export function IntakeTable({ intakes, staff }: { intakes: IntakeView[]; staff: StaffMember[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const byId = new Map(staff.map((member) => [member.user_id, member]));
  const name = (userId: string | null) => staffName(byId.get(userId ?? ""), userId);

  return (
    <Table>
      <caption className="sr-only">접수 건 목록 — 최근 접수 순</caption>
      <thead>
        <tr>
          <Th>접수</Th>
          <Th>사고 장소 · 내용</Th>
          <Th>단계</Th>
          <Th>대물 담당</Th>
          <Th>대인 담당</Th>
          <Th>배정</Th>
          <Th>
            <span className="sr-only">동작</span>
          </Th>
        </tr>
      </thead>
      <tbody>
        {intakes.map((intake) => {
          const stage = STAGE_VIEW[intake.stage];
          const method = intake.assignment && METHOD_VIEW[intake.assignment.method];
          const closed = intake.stage === "done";
          const open = openId === intake.intake_id;
          return (
            <Fragment key={intake.intake_id}>
              <tr>
                <Td className="font-mono text-caption whitespace-nowrap tabular-nums text-ink-muted">
                  <time dateTime={intake.received_at}>{shortTime(intake.received_at)}</time>
                  {intake.simulated && <Badge className="mt-1 flex w-fit">가상</Badge>}
                </Td>
                <Td className="max-w-[22rem]">
                  <span className="block font-semibold break-keep">{intake.location}</span>
                  <span className="block text-caption break-keep text-ink-muted">{intake.description}</span>
                </Td>
                <Td className="whitespace-nowrap">
                  <Badge tone={stage.tone} dot>
                    {stage.label}
                  </Badge>
                  {intake.region && <span className="mt-1 block text-caption text-ink-muted">{intake.region}</span>}
                </Td>
                <Td className="whitespace-nowrap">{name(intake.property_assignee_id) || <span className="text-ink-faint">없음</span>}</Td>
                <Td className="whitespace-nowrap">
                  {name(intake.injury_assignee_id) ||
                    (needsInjuryAdjuster(intake) ? <Badge tone="warning">배정 필요</Badge> : <span className="text-ink-faint">{intake.injured_count > 0 ? "없음" : "해당 없음"}</span>)}
                </Td>
                <Td className="max-w-[20rem]">
                  {method && <Badge tone={method.tone}>{method.label}</Badge>}
                  {intake.assignment && <span className="mt-1 block text-caption break-keep text-ink-muted">{intake.assignment.reason}</span>}
                  {intake.unassigned_reason && <span className="mt-1 block text-caption break-keep text-on-warning-soft">{intake.unassigned_reason}</span>}
                </Td>
                <Td className="text-right whitespace-nowrap">
                  {!closed && (
                    <Button variant="quiet" size="sm" aria-expanded={open} onClick={() => setOpenId(open ? null : intake.intake_id)}>
                      {open ? "닫기" : intake.status === "assigned" ? "이관" : "직접 배정"}
                    </Button>
                  )}
                </Td>
              </tr>
              {open && (
                <tr>
                  <Td colSpan={7} className="bg-surface-muted">
                    <AssignForm intake={intake} staff={staff} onDone={() => setOpenId(null)} />
                  </Td>
                </tr>
              )}
            </Fragment>
          );
        })}
      </tbody>
    </Table>
  );
}

function AssignForm({ intake, staff, onDone }: { intake: IntakeView; staff: StaffMember[]; onDone: () => void }) {
  const router = useRouter();
  const waiting = intake.status !== "assigned";
  // 미배정 건은 대물 담당자부터 정한다. 대인 담당자가 비어 있는 건은 그 분야를 먼저 고른다
  const [coverage, setCoverage] = useState<Coverage>(needsInjuryAdjuster(intake) ? "injury" : "property");
  const [assignee, setAssignee] = useState("");
  const [reason, setReason] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const current = coverage === "property" ? intake.property_assignee_id : intake.injury_assignee_id;
  const options = assignable(staff, coverage, intake, current);
  const id = `assign-${intake.intake_id}`;
  const ready = assignee !== "" && reason.trim() !== "";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready || sending) return;
    setSending(true);
    setError(null);
    try {
      await createBrowserApiClient().assignAdminIntake(intake.intake_id, { coverage, assignee_id: assignee, reason: reason.trim() });
      router.refresh();
      onDone();
    } catch (caught) {
      setError(asApiError(caught));
      setSending(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 py-1">
      <div className="grid gap-3 lg:grid-cols-[8rem_1fr_1.4fr_auto] lg:items-end">
        <Field id={`${id}-coverage`} label="분야">
          <Select
            id={`${id}-coverage`}
            value={coverage}
            disabled={waiting}
            onChange={(event) => {
              setCoverage(event.target.value as Coverage);
              setAssignee("");
            }}
          >
            <option value="property">{COVERAGE_LABELS.property}</option>
            <option value="injury">{COVERAGE_LABELS.injury}</option>
          </Select>
        </Field>
        <Field id={`${id}-assignee`} label={current ? "새 담당자" : "담당자"} required>
          <Select id={`${id}-assignee`} value={assignee} onChange={(event) => setAssignee(event.target.value)}>
            <option value="">고르세요</option>
            {options.map((member) => (
              <option key={member.user_id} value={member.user_id}>
                {staffName(member, member.user_id)} · {member.region ?? "지역 없음"} · 진행 중 {member.cases.open}건{member.auto_assign ? "" : " · 자동 배정 제외"}
              </option>
            ))}
          </Select>
        </Field>
        <Field id={`${id}-reason`} label="까닭" hint="배정 이력에 남습니다." required>
          <Input id={`${id}-reason`} value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} placeholder="예: 담당자 부재로 이관" />
        </Field>
        <Button type="submit" disabled={!ready || sending}>
          {sending ? "저장하는 중…" : current ? "이관" : "배정"}
        </Button>
      </div>
      {waiting && <p className="text-caption text-ink-muted">미배정 건은 대물 담당자를 먼저 정합니다. 대인 담당자는 그 뒤에 줄 수 있습니다.</p>}
      {error && <Notice tone="danger" title="저장하지 못했습니다">{error.message}</Notice>}
    </form>
  );
}
