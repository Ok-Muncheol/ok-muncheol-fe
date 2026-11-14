"use client";

/**
 * B 통합: 접수 등록 — 관리자가 들은 대로 사고 장소와 내용을 적으면 배정 에이전트가 바로 배정한다(POST /admin/intakes).
 * 지역은 적지 않는다 — 사고 장소 글에서 에이전트가 판별한다. 결과(누구에게 배정됐는지, 못 했으면 왜)를 바로 보이고 목록을 새로 읽는다.
 * 배정 참고 정보(예상 손해액·차종·다친 정도·가입 담보·계약자 이력)는 서버 기본값으로 채워 두고 details로 함께 보낸다.
 * 사람을 특정하는 정보(이름·연락처·차량 번호)는 받지 않는다 — 그런 칸을 두지 않는다.
 */
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { createBrowserApiClient } from "@/lib/api/browser";
import { asApiError } from "@/lib/api/client";
import type { ApiError, InjurySeverity, IntakeView, PersonalInjuryCover, Policy, StaffMember, VehicleType } from "@/lib/api/types";
import {
  type DetailsDraft, EMPTY_DETAILS_DRAFT, METHOD_VIEW, PERSONAL_INJURY_LABELS, PROPERTY_LIMITS, SEVERITY_LABELS, VEHICLE_LABELS, detailsInput, staffName, won,
} from "@/lib/admin/view";
import { Badge, Button, Checkbox, Field, Input, Notice, Select, Textarea } from "@/ui/controls";

const GROUP_TITLE = "mb-2 text-caption font-semibold text-ink-muted";

export function IntakeForm({ staff }: { staff: StaffMember[] }) {
  const router = useRouter();
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [injured, setInjured] = useState("0");
  const [details, setDetails] = useState<DetailsDraft>(EMPTY_DETAILS_DRAFT);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [result, setResult] = useState<IntakeView | null>(null);
  const byId = new Map(staff.map((member) => [member.user_id, member]));
  const ready = location.trim() !== "" && description.trim() !== "";
  const injuredCount = Number(injured) || 0;
  const change = (patch: Partial<DetailsDraft>) => setDetails((draft) => ({ ...draft, ...patch }));
  const changePolicy = (patch: Partial<Policy>) => setDetails((draft) => ({ ...draft, policy: { ...draft.policy, ...patch } }));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready || sending) return;
    setSending(true);
    setError(null);
    setResult(null);
    try {
      const created = await createBrowserApiClient().registerAdminIntake({
        location: location.trim(), description: description.trim(), injured_count: injuredCount, details: detailsInput(details, injuredCount),
      });
      setResult(created);
      setLocation("");
      setDescription("");
      setInjured("0");
      setDetails(EMPTY_DETAILS_DRAFT);
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

      <fieldset className="min-w-0 rounded-card border border-line p-4">
        <legend className="px-1 text-body font-semibold">배정 참고 정보</legend>
        <p className="mb-4 text-caption break-keep text-ink-muted">
          배정 에이전트가 담당자를 고를 때 봅니다. 예상 손해액이 3,000만 원 이상이거나 다친 정도가 중상·사망이면 고액 사건이라 고액 권한이 있는 담당자에게만 배정합니다. 모르는 칸은
          비워 둡니다.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field id="intake-damage" label="예상 손해액(만 원)" hint={details.damageManwon.trim() ? won(Number(details.damageManwon) * 10_000) : "예: 3500 = 3,500만 원"}>
            <Input id="intake-damage" type="number" min={0} max={1_000_000} step={1} inputMode="numeric" value={details.damageManwon} onChange={(event) => change({ damageManwon: event.target.value })} className="font-mono tabular-nums" />
          </Field>
          <Field id="intake-vehicle-type" label="차종" hint="우리 계약 차량입니다.">
            <Select id="intake-vehicle-type" value={details.vehicleType} onChange={(event) => change({ vehicleType: event.target.value as VehicleType | "" })}>
              <option value="">모름</option>
              {Object.entries(VEHICLE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="intake-vehicle-count" label="관련 차량 수" hint="3대 이상이면 다중 추돌입니다.">
            <Input id="intake-vehicle-count" type="number" min={1} max={20} step={1} inputMode="numeric" value={details.vehicleCount} onChange={(event) => change({ vehicleCount: event.target.value })} className="font-mono tabular-nums" />
          </Field>
          <Field id="intake-severity" label="다친 정도" hint={injuredCount > 0 ? "가장 크게 다친 사람 기준입니다." : "다친 사람이 있을 때만 고릅니다."}>
            <Select id="intake-severity" value={injuredCount > 0 ? details.severity : ""} disabled={injuredCount === 0} onChange={(event) => change({ severity: event.target.value as InjurySeverity | "" })}>
              <option value="">{injuredCount > 0 ? "모름" : "해당 없음"}</option>
              {Object.entries(SEVERITY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <div>
            <p className={GROUP_TITLE}>가입 담보</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="intake-property-limit" label="대물 한도">
                <Select id="intake-property-limit" value={details.policy.property_limit} onChange={(event) => changePolicy({ property_limit: Number(event.target.value) })} className="font-mono tabular-nums">
                  {PROPERTY_LIMITS.map((limit) => (
                    <option key={limit} value={limit}>
                      {won(limit)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field id="intake-personal-injury" label="자기신체 담보">
                <Select id="intake-personal-injury" value={details.policy.personal_injury} onChange={(event) => changePolicy({ personal_injury: event.target.value as PersonalInjuryCover })}>
                  {Object.entries(PERSONAL_INJURY_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
              <Checkbox checked={details.policy.bodily_injury_ii} onChange={(event) => changePolicy({ bodily_injury_ii: event.target.checked })}>
                대인배상Ⅱ
              </Checkbox>
              <Checkbox checked={details.policy.own_damage} onChange={(event) => changePolicy({ own_damage: event.target.checked })}>
                자기차량손해
              </Checkbox>
              <Checkbox checked={details.policy.uninsured_motorist} onChange={(event) => changePolicy({ uninsured_motorist: event.target.checked })}>
                무보험차상해
              </Checkbox>
            </div>
          </div>
          <div>
            <p className={GROUP_TITLE}>계약자 이력</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="intake-accidents" label="최근 3년 사고 횟수">
                <Input id="intake-accidents" type="number" min={0} max={20} step={1} inputMode="numeric" value={details.accidents3y} onChange={(event) => change({ accidents3y: event.target.value })} className="font-mono tabular-nums" />
              </Field>
              <Field id="intake-complaints" label="민원 횟수">
                <Input id="intake-complaints" type="number" min={0} max={20} step={1} inputMode="numeric" value={details.complaints} onChange={(event) => change({ complaints: event.target.value })} className="font-mono tabular-nums" />
              </Field>
            </div>
            <div className="mt-3">
              <Checkbox checked={details.longTerm} onChange={(event) => change({ longTerm: event.target.checked })}>
                장기 고객(5년 이상)
              </Checkbox>
            </div>
          </div>
        </div>
      </fieldset>

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
