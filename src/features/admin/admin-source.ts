/**
 * B 통합: 관리자 화면이 읽는 값 — 사건 관제(/admin)는 BE GET /admin/overview(담당자·현황)와 GET /admin/intakes(접수 건 목록),
 * 담당자(/admin/staff)는 GET /admin/overview의 담당자 목록을 읽는다.
 * 관리자만 읽는다. 관리자가 아니면(403) 화면을 없는 것으로 하고, 로그인하지 않았으면(401) 로그인 화면으로 보낸다(돌아올 곳은 그 화면).
 * 견본 모드(개발 배포에서 BE를 읽지 않을 때)에는 견본을 두지 않았다 — 화면이 안내만 보인다.
 */
import { notFound, redirect } from "next/navigation";
import { isSampleSource } from "@/features/cases/case-source";
import { ApiRequestError } from "@/lib/api/client";
import { createServerApiClient } from "@/lib/api/server";
import type { AdminOverview, IntakeView } from "@/lib/api/types";
import { intakeFilter, type AdminView } from "@/lib/admin/view";

export const PAGE_SIZE = 50;

export type AdminData =
  | { kind: "ready"; overview: AdminOverview; intakes: IntakeView[] }
  | { kind: "sample" }
  | { kind: "problem"; message: string };

export type StaffData = { kind: "ready"; overview: AdminOverview } | { kind: "sample" } | { kind: "problem"; message: string };

export async function loadAdmin(view: AdminView): Promise<AdminData> {
  if (isSampleSource()) return { kind: "sample" };
  const client = createServerApiClient();
  try {
    const [overview, intakes] = await Promise.all([client.getAdminOverview(), client.listAdminIntakes(intakeFilter(view, PAGE_SIZE))]);
    return { kind: "ready", overview, intakes };
  } catch (error) {
    return failed(error, "/admin");
  }
}

export async function loadStaff(): Promise<StaffData> {
  if (isSampleSource()) return { kind: "sample" };
  try {
    return { kind: "ready", overview: await createServerApiClient().getAdminOverview() };
  } catch (error) {
    return failed(error, "/admin/staff");
  }
}

/** BE 실패 — 401은 로그인 화면(로그인 뒤 next로 돌아온다), 403은 없는 화면, 그 밖은 화면이 안내로 보인다 */
function failed(error: unknown, next: string): { kind: "problem"; message: string } {
  if (!(error instanceof ApiRequestError)) throw error;
  if (error.status === 401) redirect(`/login?next=${encodeURIComponent(next)}`);
  if (error.status === 403) notFound();
  return { kind: "problem", message: error.message };
}
