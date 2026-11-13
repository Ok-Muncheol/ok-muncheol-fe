"use client";

/**
 * A·C: 검토 보고서의 「대물 · 대인 1차 판정」(BE #185, docs/contracts/liability-input.md). 금액은 BE 값 그대로다.
 * - 위: 우리 과실(협의 과실이면 표시)과 1차 판정 주의 문구
 * - 대물: 상대 차 견적서(party_id = 도표에서 가입자 반대쪽) · 대물 입력(대물 한도 · 상대 차 차량가액 · 출고일, 모두 선택) → 상대 차 수리비 × 우리 과실
 * - 대인: 다친 사람마다 급수(1~14) · 치료관계비 누적 총액 · 운전자 여부 → 대인Ⅰ · 대인Ⅱ. 진단서 · 진료비 영수증은 첨부만(읽지 않는다)
 * 입력은 모두 addDocuments로 보내고(저장할 때마다 새 document_id · 지금 시각 received_at), BE가 다시 산정한 새 보고서 버전으로 옮긴다.
 * 모르는 값은 0이 아니라 null로 보낸다. 입력이 없는 사건은 liability가 없고, 그때는 입력 버튼만 보인다.
 */
import { useRef, useState, type ReactNode } from "react";
import type { InjuredPersonDoc, InjuryResult, LiabilityFlag, LiabilityResult, LiabilityStatus, PropertyDamageInputDoc } from "@/lib/api/types";
import { Button, Input, Select, Spinner } from "@/ui/controls";

const won = (v: number | null | undefined) => (v === null || v === undefined ? "—" : `${v.toLocaleString("ko-KR")}원`);
const STATUS: Record<LiabilityStatus, { label: string; tone: string }> = {
  draft: { label: "초안", tone: "bg-surface-muted text-ink-muted" },
  needs_input: { label: "입력 필요", tone: "bg-warning-soft text-on-warning-soft" },
  needs_review: { label: "담당자 확인", tone: "bg-warning-soft text-on-warning-soft" },
};
const newId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;
const now = () => new Date().toISOString();
/** 숫자 칸 — 비우면 null(모름), 아니면 0 이상 정수. 잘못된 값은 undefined(저장하지 않음). */
const parseWon = (text: string): number | null | undefined => {
  const t = text.replaceAll(",", "").trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isInteger(n) && n >= 0 ? n : undefined;
};

export type MedicalKind = "medical_certificate" | "medical_bill";

export function LiabilityBlock({
  liability,
  busy,
  onSave,
  onEstimate,
  onMedical,
}: {
  liability: LiabilityResult | null | undefined;
  busy: boolean;
  onSave: (docs: (InjuredPersonDoc | PropertyDamageInputDoc)[]) => void;
  onEstimate: (file: File) => void;
  onMedical: (file: File, docType: MedicalKind) => void;
}) {
  const property = liability?.property ?? null;
  const injuries = liability?.injuries ?? [];
  const allDraft = injuries.length > 0 && injuries.every((i) => i.status === "draft");
  const [adding, setAdding] = useState(false);

  return (
    <section aria-label="대물 · 대인 1차 판정" className="rounded-card border border-line bg-surface">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-6 py-3">
        <h2 className="text-body font-semibold">대물 · 대인 1차 판정</h2>
        {liability && (
          <span className="text-caption text-ink-muted">
            우리 과실 <b className="text-ink tabular-nums">{liability.insured_fault ?? "—"}%</b>
            {liability.fault_source === "agreed" && <span className="ml-1.5 rounded-badge bg-surface-muted px-1.5 font-semibold">협의 과실 적용</span>}
          </span>
        )}
      </header>

      <div className="flex flex-col gap-6 px-6 py-4">
        {!liability && <p className="text-body text-ink-muted">상대 차 견적서나 다친 사람을 넣으면 대물 · 대인 초안을 계산해요.</p>}

        {/* 대물 */}
        <div>
          <SubHead title="대물 · 상대 차" status={property?.status} />
          <Rows>
            <Row term="상대 차 수리비">
              <span className="flex flex-wrap items-center gap-2">
                {won(property?.repair_cost)}
                <FilePick label={property?.repair_cost != null ? "다른 견적서 올리기" : "상대 차 견적서 PDF 올리기"} accept="application/pdf,.pdf" busy={busy} onFile={onEstimate} />
              </span>
            </Row>
            <Row term="대물 초안">
              <b>{won(property?.amount)}</b>
              {property?.limit_applied && <span className="ml-2 rounded-badge bg-surface-muted px-1.5 text-caption font-semibold text-ink-muted">대물 한도 적용</span>}
              {property?.formula && <span className="mt-0.5 block text-caption text-ink-muted">{property.formula}</span>}
            </Row>
            <Row term="대물 입력">
              <PropertyForm busy={busy} onSave={(doc) => onSave([doc])} />
            </Row>
          </Rows>
          {property && <Notes flags={property.flags} assumptions={property.assumptions} reasons={property.reasons} />}
        </div>

        {/* 대인 */}
        <div>
          <SubHead title="대인 · 다친 사람" />
          {injuries.length === 0 && !adding && <p className="mt-2 text-body text-ink-muted">아직 넣은 사람이 없어요.</p>}
          <ul className="mt-2 flex flex-col gap-3">
            {injuries.map((p) => (
              <Person key={p.person_id} person={p} busy={busy} onSave={(doc) => onSave([doc])} />
            ))}
          </ul>
          {adding ? (
            <div className="mt-3 rounded-control border border-line px-4 py-3">
              <InjuryForm
                busy={busy}
                onCancel={() => setAdding(false)}
                onSave={(doc) => {
                  onSave([doc]);
                  setAdding(false);
                }}
              />
            </div>
          ) : (
            <Button variant="secondary" size="sm" className="mt-3" disabled={busy} onClick={() => setAdding(true)}>
              + 다친 사람 추가
            </Button>
          )}
          {allDraft && (
            <p className="mt-3 flex flex-wrap justify-end gap-x-4 text-body">
              <span className="text-ink-muted">대인 합계</span>
              <span>
                대인Ⅰ <b className="tabular-nums">{won(injuries.reduce((s, i) => s + (i.bodily_1 ?? 0), 0))}</b>
              </span>
              <span>
                대인Ⅱ <b className="tabular-nums">{won(injuries.reduce((s, i) => s + (i.bodily_2 ?? 0), 0))}</b>
              </span>
            </p>
          )}
          <Medical busy={busy} onMedical={onMedical} />
        </div>

        {liability?.notice && <p className="text-caption text-ink-faint">{liability.notice}</p>}
      </div>
    </section>
  );
}

function SubHead({ title, status }: { title: string; status?: LiabilityStatus }) {
  return (
    <h3 className="flex items-center gap-2 text-caption font-semibold text-ink-muted">
      {title}
      {status && <span className={`rounded-full px-2 py-0.5 ${STATUS[status].tone}`}>{STATUS[status].label}</span>}
    </h3>
  );
}

function Rows({ children }: { children: ReactNode }) {
  return <dl className="mt-1 divide-y divide-line">{children}</dl>;
}

function Row({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 py-2.5 text-body sm:grid-cols-[9rem_1fr] sm:gap-4">
      <dt className="text-caption text-ink-muted sm:pt-0.5">{term}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

/** 확인 필요(주황 점) · 기본 가정 · 사유 — 계산하지 않고 담당자에게 알리는 것들. */
function Notes({ flags, assumptions, reasons }: { flags: LiabilityFlag[]; assumptions: string[]; reasons: string[] }) {
  if (flags.length + assumptions.length + reasons.length === 0) return null;
  return (
    <ul className="mt-2 flex flex-col gap-1 text-caption text-ink-muted">
      {flags.map((f) => (
        <li key={f.key} className="flex items-start gap-2">
          <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-warning" />
          <span>
            <b className="text-ink">{f.label}</b> — {f.detail}
          </span>
        </li>
      ))}
      {reasons.map((r) => (
        <li key={r} className="flex gap-2">
          <span className="shrink-0 rounded-badge bg-surface-muted px-1.5 font-semibold">사유</span>
          {r}
        </li>
      ))}
      {assumptions.map((a) => (
        <li key={a} className="flex gap-2">
          <span className="shrink-0 rounded-badge bg-surface-muted px-1.5 font-semibold">가정</span>
          {a}
        </li>
      ))}
    </ul>
  );
}

/** 다친 사람 한 명 — 결과와 「고치기」(같은 person_id로 새 입력을 보낸다). */
function Person({ person: p, busy, onSave }: { person: InjuryResult; busy: boolean; onSave: (doc: InjuredPersonDoc) => void }) {
  const [editing, setEditing] = useState(false);
  return (
    <li className="rounded-control border border-line px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 font-semibold">
          {p.label || p.person_id}
          <span className={`rounded-full px-2 py-0.5 text-caption ${STATUS[p.status].tone}`}>{STATUS[p.status].label}</span>
        </p>
        {!editing && (
          <button type="button" className="text-caption font-semibold text-primary-strong hover:underline" disabled={busy} onClick={() => setEditing(true)}>
            고치기
          </button>
        )}
      </div>
      {editing ? (
        <div className="mt-3">
          <InjuryForm
            busy={busy}
            initial={p}
            onCancel={() => setEditing(false)}
            onSave={(doc) => {
              onSave(doc);
              setEditing(false);
            }}
          />
        </div>
      ) : (
        <>
          <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1.5 text-caption sm:grid-cols-4">
            <Cell term="상해 급수">{p.grade ? `${p.grade}급` : "—"}</Cell>
            <Cell term="치료관계비">{won(p.treatment_cost)}</Cell>
            <Cell term="부상 위자료">{won(p.consolation)}</Cell>
            <Cell term="과실상계 후">{won(p.after_offset)}</Cell>
            <Cell term="대인Ⅰ 한도">{won(p.bodily_1_limit)}</Cell>
            <Cell term="대인Ⅰ">
              <b className="text-ink">{won(p.bodily_1)}</b>
            </Cell>
            <Cell term="대인Ⅱ">
              <b className="text-ink">{won(p.bodily_2)}</b>
            </Cell>
            {p.treatment_guarantee && <Cell term="보장">치료관계비 보장 적용</Cell>}
          </dl>
          {p.formula && <p className="mt-2 text-caption text-ink-muted">{p.formula}</p>}
          <Notes flags={p.flags} assumptions={p.assumptions} reasons={p.reasons} />
        </>
      )}
    </li>
  );
}

function Cell({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-ink-muted">{term}</dt>
      <dd className="tabular-nums">{children}</dd>
    </div>
  );
}

/** 대인 입력 — 표시 이름 · 급수(1~14, 모름) · 치료관계비 누적 총액 · 운전자 여부. 고칠 때는 같은 person_id로 새 문서를 보낸다. */
function InjuryForm({ initial, busy, onSave, onCancel }: { initial?: InjuryResult; busy: boolean; onSave: (doc: InjuredPersonDoc) => void; onCancel: () => void }) {
  const [label, setLabel] = useState(initial?.label ?? "");
  const [grade, setGrade] = useState(initial?.grade ? String(initial.grade) : "");
  const [cost, setCost] = useState(initial?.treatment_cost != null ? String(initial.treatment_cost) : "");
  const [driver, setDriver] = useState<"" | "yes" | "no">("");
  const treatment = parseWon(cost);
  const valid = treatment !== undefined;
  return (
    <div className="flex flex-col gap-2">
      <div className="grid gap-2 sm:grid-cols-2">
        <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="표시 이름 (예: 상대 운전자)" aria-label="표시 이름" className="h-9" />
        <Select value={grade} onChange={(e) => setGrade(e.target.value)} aria-label="상해 급수" className="h-9">
          <option value="">상해 급수 — 모름</option>
          {Array.from({ length: 14 }, (_, i) => i + 1).map((g) => (
            <option key={g} value={g}>
              {g}급
            </option>
          ))}
        </Select>
        <Input value={cost} onChange={(e) => setCost(e.target.value)} inputMode="numeric" placeholder="치료관계비 누적 총액(원) — 모르면 비움" aria-label="치료관계비 누적 총액" className="h-9" />
        <Select value={driver} onChange={(e) => setDriver(e.target.value as "" | "yes" | "no")} aria-label="차량운전자 여부" className="h-9">
          <option value="">운전자 여부 — 모름</option>
          <option value="yes">운전자</option>
          <option value="no">운전자 아님(동승자 등)</option>
        </Select>
      </div>
      {!valid && <p className="text-caption text-on-danger-soft">치료관계비는 0 이상 숫자로 적어 주세요.</p>}
      <span className="flex gap-2">
        <Button
          size="sm"
          disabled={busy || !valid}
          onClick={() =>
            onSave({
              kind: "injured_person",
              document_id: newId("injury"),
              person_id: initial?.person_id ?? newId("person"),
              label: label.trim() || null,
              grade: grade === "" ? null : Number(grade),
              treatment_cost: treatment ?? null,
              is_driver: driver === "" ? null : driver === "yes",
              received_at: now(),
            })
          }
        >
          {busy ? "저장 중" : "저장"}
        </Button>
        <Button size="sm" variant="quiet" onClick={onCancel}>
          취소
        </Button>
      </span>
    </div>
  );
}

/** 대물 입력(모두 선택) — 우리 계약 대물 한도 · 상대 차 사고 직전 차량가액 · 출고일. 비운 칸은 null(모름)로 보낸다. */
function PropertyForm({ busy, onSave }: { busy: boolean; onSave: (doc: PropertyDamageInputDoc) => void }) {
  const [open, setOpen] = useState(false);
  const [limit, setLimit] = useState("");
  const [value, setValue] = useState("");
  const [released, setReleased] = useState("");
  const l = parseWon(limit);
  const v = parseWon(value);
  const valid = l !== undefined && v !== undefined;
  if (!open) {
    return (
      <button type="button" className="text-caption font-semibold text-primary-strong hover:underline" onClick={() => setOpen(true)}>
        대물 한도 · 차량가액 · 출고일 넣기
      </button>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <div className="grid gap-2 sm:grid-cols-3">
        <Input value={limit} onChange={(e) => setLimit(e.target.value)} inputMode="numeric" placeholder="대물 한도(원)" aria-label="대물배상 가입금액" className="h-9" />
        <Input value={value} onChange={(e) => setValue(e.target.value)} inputMode="numeric" placeholder="상대 차 차량가액(원)" aria-label="상대 차 사고 직전 차량가액" className="h-9" />
        <Input type="date" value={released} onChange={(e) => setReleased(e.target.value)} aria-label="상대 차 출고일" className="h-9" />
      </div>
      {!valid && <p className="text-caption text-on-danger-soft">금액은 0 이상 숫자로 적어 주세요.</p>}
      <span className="flex gap-2">
        <Button
          size="sm"
          disabled={busy || !valid}
          onClick={() => {
            onSave({
              kind: "property_damage_input",
              document_id: newId("property"),
              property_damage_limit: l ?? null,
              vehicle_value: v ?? null,
              release_date: released || null,
              received_at: now(),
            });
            setOpen(false);
          }}
        >
          {busy ? "저장 중" : "저장"}
        </Button>
        <Button size="sm" variant="quiet" onClick={() => setOpen(false)}>
          취소
        </Button>
      </span>
    </div>
  );
}

/** 진단서 · 진료비 영수증 첨부 — PDF · JPEG, 첨부만 하고 BE가 읽지 않는다(급수는 담당자가 위에 적는다). */
function Medical({ busy, onMedical }: { busy: boolean; onMedical: (file: File, docType: MedicalKind) => void }) {
  const [docType, setDocType] = useState<MedicalKind>("medical_certificate");
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2 rounded-control bg-surface-muted px-4 py-3 text-body">
      <span className="text-caption text-ink-muted">증빙 첨부</span>
      <Select value={docType} onChange={(e) => setDocType(e.target.value as MedicalKind)} aria-label="증빙 종류" className="h-8 w-40!">
        <option value="medical_certificate">진단서</option>
        <option value="medical_bill">진료비 영수증</option>
      </Select>
      <FilePick label="PDF · JPEG 올리기" accept="application/pdf,.pdf,image/jpeg,.jpg,.jpeg" busy={busy} onFile={(file) => onMedical(file, docType)} />
      <span className="text-caption text-ink-faint">첨부만 하고 읽지 않아요</span>
    </div>
  );
}

function FilePick({ label, accept, busy, onFile }: { label: string; accept: string; busy: boolean; onFile: (file: File) => void }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={input}
        type="file"
        accept={accept}
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = "";
        }}
      />
      <Button variant="secondary" size="sm" disabled={busy} onClick={() => input.current?.click()}>
        {busy ? (
          <>
            <Spinner className="h-3.5! w-3.5!" /> 처리 중
          </>
        ) : (
          label
        )}
      </Button>
    </>
  );
}
