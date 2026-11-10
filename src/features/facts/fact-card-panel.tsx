"use client";

/**
 * A: 사실 카드 확인·수정·확정. 칸마다 값(ink)·확인 상태·모델 원값/확신도(model 톤)·근거 프레임을 나란히 둔다.
 * 값을 고르면 그 칸은 담당자 확인이 되고 모델 원값은 그대로 남는다. 저장하면 새 버전이 생기고(PATCH, 기대 버전·사유),
 * 확정은 저장한 카드에만 한다(POST …/confirm). 확정할 수 있는지(핵심 불명·충돌·매핑)는 BE가 검사하고 화면은 개수만 보여 준다.
 * TODO(A): 요청 연결 — 저장 중·실패·버전 충돌(409)·중복 전송 방지, 저장 안 한 변경이 있을 때 떠나기 경고, 수정 이력, 당사자 매핑 편집.
 * 지금은 견본이라 보내지 않고, 보낼 값을 화면에 보여 준다.
 */
import { useState } from "react";
import { ModelValue } from "@/components/model-value";
import { VerificationLabel } from "@/components/status-label";
import { CHART_FIELD_KEYS, OPTION_LABELS, fieldLabel, isChartFieldKey, optionLabel } from "@/lib/api/chart-scope";
import type { FactCard, FactField, FactPatch } from "@/lib/api/types";
import { buildPatch, changedKeys, countFields, editValue, frameTime, setConfirmed } from "@/lib/facts/view";
import { Badge, Button, Card, Checkbox, Field, Input, Notice, Select } from "@/ui/controls";

const SOURCE: Record<FactField["source"], string> = { vision: "영상 분석", manual: "직접 입력", statement: "진술" };

type Held = { kind: "save"; patch: FactPatch } | { kind: "confirm" };

export function FactCardPanel({ card }: { card: FactCard }) {
  const [draft, setDraft] = useState(card.fields);
  const [reason, setReason] = useState("");
  const [held, setHeld] = useState<Held | null>(null);

  // 도표 선택 칸을 정해진 순서로, 그 밖의 칸은 뒤에 둔다.
  const keys = [...CHART_FIELD_KEYS.filter((key) => draft[key]), ...Object.keys(draft).filter((key) => !isChartFieldKey(key))];
  const changed = changedKeys(card.fields, draft);
  const dirty = changed.length > 0;
  const counts = countFields(draft);
  const frameTimes = new Map(card.evidence_frames.map((frame) => [frame.frame_id, frame.timestamp_ms]));

  function update(key: string, next: FactField) {
    setDraft((fields) => ({ ...fields, [key]: next }));
    setHeld(null);
  }

  return (
    <Card
      title="사고 사실"
      aside={
        dirty && (
          <Badge tone="warning" dot>
            <span>
              저장 안 한 변경 <span className="font-mono tabular-nums">{changed.length}</span>칸
            </span>
          </Badge>
        )
      }
    >
      <ul className="flex flex-col divide-y divide-line">
        {keys.map((key) => {
          const field = draft[key];
          const id = `fact-${key}`;
          return (
            <li key={key} className="grid gap-x-6 gap-y-2 py-4 first:pt-0 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
              <Field id={id} label={fieldLabel(key)} hint={SOURCE[field.source]}>
                {isChartFieldKey(key) ? (
                  <Select id={id} value={field.value === null ? "" : String(field.value)} onChange={(e) => update(key, editValue(field, e.target.value || null))}>
                    <option value="">불명</option>
                    {Object.entries(OPTION_LABELS[key]).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <Input id={id} value={field.value === null ? "" : String(field.value)} onChange={(e) => update(key, editValue(field, e.target.value || null))} />
                )}
              </Field>
              <div className="flex min-w-0 flex-col items-start gap-2 md:pt-6">
                <div className="flex flex-wrap items-center gap-1.5">
                  <VerificationLabel status={field.verification_status} />
                  <ModelValue fieldKey={key} field={field} />
                </div>
                {field.evidence_frame_ids.length > 0 && (
                  <p className="flex flex-wrap items-center gap-x-2 text-caption text-ink-muted">
                    근거 프레임
                    {field.evidence_frame_ids.map((frameId) => (
                      <a key={frameId} href={`#frame-${frameId}`} className="font-mono text-primary-strong tabular-nums underline-offset-4 hover:underline">
                        {frameTimes.has(frameId) ? frameTime(frameTimes.get(frameId)!) : frameId}
                      </a>
                    ))}
                  </p>
                )}
                <Checkbox
                  checked={field.verification_status === "human_confirmed"}
                  onChange={(e) => update(key, setConfirmed(field, e.target.checked, card.fields[key]))}
                >
                  담당자 확인
                </Checkbox>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="mt-2 flex flex-col gap-4 border-t border-line pt-4">
        <p className="flex flex-wrap gap-x-4 gap-y-1 text-caption text-ink-muted">
          <Count label="담당자 확인" n={counts.confirmed} of={counts.total} />
          <Count label="확인 필요" n={counts.needsReview} />
          <Count label="미확인" n={counts.unverified} />
          <Count label="불명" n={counts.unknown} />
        </p>
        {dirty && (
          <Field id="fact-reason" label="수정 사유" required hint="수정 이력에 남는다.">
            <Input
              id="fact-reason"
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                setHeld(null);
              }}
              placeholder="예) 블랙박스 영상 재확인"
            />
          </Field>
        )}
        <div className="flex flex-wrap items-center gap-2">
          {/* TODO(A): createApiClient().patchFactCard / confirmFactCard — 견본이라 보내지 않고 보낼 값만 남긴다. */}
          <Button variant={dirty ? "primary" : "secondary"} disabled={!dirty || reason.trim() === ""} onClick={() => setHeld({ kind: "save", patch: buildPatch(card, draft, reason) })}>
            저장
          </Button>
          {card.status === "draft" && (
            <Button variant={dirty ? "secondary" : "primary"} disabled={dirty} onClick={() => setHeld({ kind: "confirm" })}>
              카드 확정
            </Button>
          )}
          {dirty && (
            <Button
              variant="quiet"
              onClick={() => {
                setDraft(card.fields);
                setReason("");
                setHeld(null);
              }}
            >
              되돌리기
            </Button>
          )}
        </div>
        <p className="text-caption text-ink-muted">
          {dirty
            ? "저장하면 새 버전이 생긴다. 확정은 저장한 카드에만 할 수 있다."
            : card.status === "draft"
              ? "확정하면 이 버전으로 판단을 시작한다. 확정할 수 있는지는 서버가 검사한다."
              : "확정된 카드다. 값을 고쳐 저장하면 새 버전이 생기고 다시 확정해야 판단을 재개한다."}
        </p>
        {held?.kind === "save" && (
          <Notice tone="info" title="견본이라 저장하지 않았다">
            연결 뒤에는 사실 카드 <span className="font-mono tabular-nums">v{held.patch.expected_version}</span> 기준으로 수정 사유 「{held.patch.reason}」와 함께
            바뀐 칸을 보낸다:{" "}
            {Object.entries(held.patch.fields)
              .map(([key, field]) => `「${fieldLabel(key)} = ${optionLabel(key, field.value) ?? "불명"}」`)
              .join(", ")}
          </Notice>
        )}
        {held?.kind === "confirm" && (
          <Notice tone="info" title="견본이라 확정하지 않았다">
            연결 뒤에는 사실 카드 <span className="font-mono tabular-nums">v{card.version}</span>의 확정을 요청한다.
          </Notice>
        )}
      </div>
    </Card>
  );
}

function Count({ label, n, of }: { label: string; n: number; of?: number }) {
  return (
    <span>
      {label}{" "}
      <span className="font-mono font-semibold text-ink tabular-nums">
        {n}
        {of !== undefined && `/${of}`}
      </span>
    </span>
  );
}
