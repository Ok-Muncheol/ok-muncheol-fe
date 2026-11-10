/**
 * A·B: 사실 카드 화면의 순수 규칙 — 칸 수정·담당자 확인, 바뀐 칸 고르기, 저장 요청(FactPatch) 모양, 칸 집계.
 * 화면(src/features/facts/)과 테스트(view.test.mjs)가 같이 쓴다. 런타임 import는 두지 않는다.
 * 확신도 임계값이나 확정 가능 여부는 여기서 정하지 않는다 — 확정 검사(핵심 불명·충돌·매핑)는 BE가 한다.
 */
import type { FactCard, FactField, FactPatch } from "@/lib/api/types";

type Fields = Record<string, FactField>;
type Value = FactField["value"];

const same = (a: Value, b: Value) => (a === null || b === null ? a === b : String(a) === String(b));

/**
 * 담당자가 값을 고른다. 고르면 그 칸은 담당자 확인이 된다 — 불명(null)을 고른 것도 「확인했는데 알 수 없다」는 답이다.
 * 모델 원값·확신도·출처는 건드리지 않는다(원값 보존). 같은 값을 다시 고르면 그대로 둔다.
 */
export function editValue(field: FactField, value: Value): FactField {
  return same(field.value, value) ? field : { ...field, value, verification_status: "human_confirmed" };
}

/** 값은 그대로 두고 담당자 확인만 켜고 끈다. 끄면 원래 상태로 돌아가되, 원래 확인돼 있던 칸은 미확인이 된다. */
export function setConfirmed(field: FactField, confirmed: boolean, original: FactField): FactField {
  const off = original.verification_status === "human_confirmed" ? "unverified" : original.verification_status;
  return { ...field, verification_status: confirmed ? "human_confirmed" : off };
}

/** 저장할 것이 있는 칸 — 값이나 확인 상태가 받은 카드와 다른 칸. */
export function changedKeys(original: Fields, draft: Fields): string[] {
  return Object.keys(draft).filter((key) => {
    const before = original[key];
    const after = draft[key];
    return !before || !same(before.value, after.value) || before.verification_status !== after.verification_status;
  });
}

/** 저장 요청. 받은 카드 버전을 기대 버전으로 보내고(다르면 BE가 409), 바뀐 칸만 싣는다. 사유는 수정 이력에 남는다. */
export function buildPatch(card: Pick<FactCard, "version" | "fields" | "party_mapping">, draft: Fields, reason: string): FactPatch {
  const fields = Object.fromEntries(changedKeys(card.fields, draft).map((key) => [key, draft[key]]));
  return { expected_version: card.version, fields, party_mapping: card.party_mapping, reason: reason.trim() };
}

export type FieldCounts = { total: number; confirmed: number; needsReview: number; unverified: number; unknown: number };

/** 칸 집계 — 확인 상태별 개수와 값이 불명인 칸 수. 화면은 이 수를 보여 주기만 하고 확정을 막지 않는다. */
export function countFields(fields: Fields): FieldCounts {
  const all = Object.values(fields);
  const by = (status: FactField["verification_status"]) => all.filter((f) => f.verification_status === status).length;
  return {
    total: all.length,
    confirmed: by("human_confirmed"),
    needsReview: by("needs_review"),
    unverified: by("unverified"),
    unknown: all.filter((f) => f.value === null).length,
  };
}

/** 프레임 시각 — 영상 시작부터 분:초.십분의 일초(예: 00:03.4). */
export function frameTime(ms: number): string {
  const tenths = Math.floor(ms / 100);
  const minutes = Math.floor(tenths / 600);
  const seconds = Math.floor((tenths % 600) / 10);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${tenths % 10}`;
}
