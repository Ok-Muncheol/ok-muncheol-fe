"use client";

/**
 * B 통합: 접수 건 목록 — 한 줄에 접수 시각·장소·단계·대물/대인 담당자·배정 방식과 까닭을 보이고, 줄마다 직접 배정·이관을 연다.
 * 배정 폼은 고른 줄 바로 아래에 펼친다(POST /admin/intakes/{id}/assignments). 담당자가 없던 분야면 직접 배정, 있었으면 이관이다.
 * 종결된 건은 담당자를 바꿀 수 없어 단추를 두지 않는다. 가상 접수(시연용)는 「가상」 표시를 단다.
 * 배정 참고 정보(details)는 사고 내용 아래에 한 줄 요약과 표식(고액 사건·수입차·다중 추돌·대인배상Ⅱ 미가입·민원)으로 보이고,
 * 가입 담보·계약자 이력 전체는 「상세」로 줄 아래에 펼친다. 참고 정보가 없는 건(예전 접수·실제 사건)에는 아무것도 보이지 않는다.
 */
import { useRouter } from "next/navigation";
import { type FormEvent, Fragment, useState } from "react";
import { createBrowserApiClient } from "@/lib/api/browser";
import { asApiError } from "@/lib/api/client";
import type { ApiError, Coverage, IntakeDetails, IntakeView, StaffMember } from "@/lib/api/types";
import {
  COVERAGE_LABELS, METHOD_VIEW, PERSONAL_INJURY_LABELS, SEVERITY_LABELS, STAGE_VIEW, VEHICLE_LABELS, assignable, detailFlags, detailSummary, hasDetails,
  highValueFor, needsInjuryAdjuster, shortTime, staffName, staffOptionLabel, won,
} from "@/lib/admin/view";
import { Badge, Button, DescriptionList, DescriptionRow, Field, Input, Notice, Select, Table, Td, Th } from "@/ui/controls";

type Panel = { id: string; kind: "assign" | "details" };

export function IntakeTable({ intakes, staff }: { intakes: IntakeView[]; staff: StaffMember[] }) {
  const [panel, setPanel] = useState<Panel | null>(null);
  const toggle = (id: string, kind: Panel["kind"]) => setPanel((now) => (now?.id === id && now.kind === kind ? null : { id, kind }));
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
          const open = panel?.id === intake.intake_id ? panel.kind : null;
          const flags = detailFlags(intake.details);
          const summary = detailSummary(intake.details);
          const detailed = hasDetails(intake.details);
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
                  {summary && <span className="mt-1 block font-mono text-caption break-keep tabular-nums text-ink">{summary}</span>}
                  {flags.length > 0 && (
                    <span className="mt-1 flex flex-wrap gap-1">
                      {flags.map((flag) => (
                        <Badge key={flag.key} tone={flag.tone}>
                          {flag.label}
                        </Badge>
                      ))}
                    </span>
                  )}
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
                  {detailed && (
                    <Button variant="quiet" size="sm" aria-expanded={open === "details"} onClick={() => toggle(intake.intake_id, "details")}>
                      {open === "details" ? "닫기" : "상세"}
                    </Button>
                  )}
                  {!closed && (
                    <Button variant="quiet" size="sm" aria-expanded={open === "assign"} onClick={() => toggle(intake.intake_id, "assign")}>
                      {open === "assign" ? "닫기" : intake.status === "assigned" ? "이관" : "직접 배정"}
                    </Button>
                  )}
                </Td>
              </tr>
              {open === "assign" && (
                <tr>
                  <Td colSpan={7} className="bg-surface-muted">
                    <AssignForm intake={intake} staff={staff} onDone={() => setPanel(null)} />
                  </Td>
                </tr>
              )}
              {open === "details" && detailed && (
                <tr>
                  <Td colSpan={7} className="bg-surface-muted">
                    <DetailPanel details={intake.details} />
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

const yesNo = (value: boolean) => (value ? "가입" : "미가입");

/** 배정 참고 정보 전체 — 사고 규모, 가입 담보, 계약자 이력. 없는 값은 「정보 없음」으로 둔다 */
function DetailPanel({ details }: { details: IntakeDetails }) {
  const { policy, policyholder } = details;
  const none = <span className="text-ink-faint">정보 없음</span>;
  return (
    <div className="grid gap-x-8 gap-y-4 py-1 lg:grid-cols-3">
      <section>
        <h3 className="mb-1 text-caption font-semibold text-ink-muted">사고 규모</h3>
        <DescriptionList>
          <DescriptionRow term="예상 손해액">
            {details.estimated_damage != null ? <span className="font-mono tabular-nums">{won(details.estimated_damage)}</span> : none}
          </DescriptionRow>
          <DescriptionRow term="차종">{details.vehicle_type ? VEHICLE_LABELS[details.vehicle_type] : none}</DescriptionRow>
          <DescriptionRow term="관련 차량 수">
            {details.vehicle_count != null ? <span className="font-mono tabular-nums">{details.vehicle_count}대</span> : none}
          </DescriptionRow>
          <DescriptionRow term="다친 정도">{details.injury_severity ? SEVERITY_LABELS[details.injury_severity] : none}</DescriptionRow>
        </DescriptionList>
      </section>
      <section>
        <h3 className="mb-1 text-caption font-semibold text-ink-muted">가입 담보</h3>
        {policy ? (
          <DescriptionList>
            <DescriptionRow term="대인배상Ⅱ">{policy.bodily_injury_ii ? "가입" : <Badge tone="warning">미가입</Badge>}</DescriptionRow>
            <DescriptionRow term="대물 한도">
              <span className="font-mono tabular-nums">{won(policy.property_limit)}</span>
            </DescriptionRow>
            <DescriptionRow term="자기차량손해">{yesNo(policy.own_damage)}</DescriptionRow>
            <DescriptionRow term="자기신체 담보">{PERSONAL_INJURY_LABELS[policy.personal_injury] ?? policy.personal_injury}</DescriptionRow>
            <DescriptionRow term="무보험차상해">{yesNo(policy.uninsured_motorist)}</DescriptionRow>
          </DescriptionList>
        ) : (
          <p className="py-2.5">{none}</p>
        )}
      </section>
      <section>
        <h3 className="mb-1 text-caption font-semibold text-ink-muted">계약자 이력</h3>
        {policyholder ? (
          <DescriptionList>
            <DescriptionRow term="최근 3년 사고">
              <span className="font-mono tabular-nums">{policyholder.accidents_3y}회</span>
            </DescriptionRow>
            <DescriptionRow term="민원">
              <span className="font-mono tabular-nums">{policyholder.complaints}회</span>
            </DescriptionRow>
            <DescriptionRow term="장기 고객">{policyholder.long_term ? "5년 이상" : "아님"}</DescriptionRow>
          </DescriptionList>
        ) : (
          <p className="py-2.5">{none}</p>
        )}
      </section>
    </div>
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
  const chosen = options.find((member) => member.user_id === assignee);
  const highValue = highValueFor(intake.details, coverage);

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
                {staffOptionLabel(member)}
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
      {highValue && (
        <p className="text-caption break-keep text-ink-muted">
          {COVERAGE_LABELS[coverage]} 고액 사건입니다. 자동 배정은 고액 권한이 있는 담당자에게만 합니다.
          {chosen && !chosen.high_value && <span className="font-semibold text-on-warning-soft"> 고른 담당자에게는 고액 권한이 없습니다.</span>}
        </p>
      )}
      {chosen?.away && <p className="text-caption font-semibold break-keep text-on-warning-soft">고른 담당자는 부재 중입니다. 그대로 배정할 수 있습니다.</p>}
      {waiting && <p className="text-caption text-ink-muted">미배정 건은 대물 담당자를 먼저 정합니다. 대인 담당자는 그 뒤에 줄 수 있습니다.</p>}
      {error && <Notice tone="danger" title="저장하지 못했습니다">{error.message}</Notice>}
    </form>
  );
}
