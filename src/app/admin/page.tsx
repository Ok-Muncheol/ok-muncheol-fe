/**
 * B 통합: 사건 관제 — 관리자가 접수를 등록하고, 담당자별 업무량과 접수 건의 진행을 보고, 필요하면 직접 배정·이관한다.
 * 관리자만 들어온다. 메뉴는 관리자에게만 보이고(레이아웃), 화면은 BE가 403을 주면 없는 화면이 된다(admin-source.ts).
 * 보기(탭·지역·담당자·쪽)는 주소 검색어다 — 새로고침·뒤로 가기에도 같은 목록이 나온다.
 */
import Link from "next/link";
import { IntakeForm } from "@/features/admin/intake-form";
import { IntakeTable } from "@/features/admin/intake-table";
import { PAGE_SIZE, loadAdmin } from "@/features/admin/admin-source";
import { COVERAGE_LABELS, INTAKE_TABS, OPEN_STAGES, REGIONS, STAGE_VIEW, adminHref, parseAdminView, shortTime, staffName } from "@/lib/admin/view";
import { Badge, ButtonLink, Card, Notice, PageHeader, Stat, StatStrip, Table, Td, Th } from "@/ui/controls";

export default async function AdminPage(props: PageProps<"/admin">) {
  const view = parseAdminView(await props.searchParams);
  const data = await loadAdmin(view);

  if (data.kind === "sample") {
    return (
      <>
        <PageHeader title="사건 관제" />
        <Notice title="견본 모드에서는 볼 수 없습니다">사건 관제는 BE를 읽는 배포에서만 보입니다(OKM_DATA_SOURCE=api).</Notice>
      </>
    );
  }
  if (data.kind === "problem") {
    return (
      <>
        <PageHeader title="사건 관제" />
        <Notice tone="danger" title="현황을 읽지 못했습니다">{data.message}</Notice>
      </>
    );
  }

  const { overview, intakes } = data;
  const { summary, staff } = overview;
  const adjusters = staff.filter((member) => member.staff_role === "adjuster");
  const picked = staff.find((member) => member.user_id === view.assignee);
  const last = intakes.at(-1);

  return (
    <>
      <PageHeader
        title="사건 관제"
        description="접수된 사고를 배정 에이전트가 지역의 대물·대인 담당자에게 배정합니다. 필요하면 직접 배정하거나 이관합니다."
      />

      <StatStrip className="mb-6" aside={<span className="text-caption text-ink-muted">{shortTime(overview.generated_at)} 기준</span>}>
        <Stat label="진행 중" value={summary.open} tone="info" />
        <Stat label="미배정" value={summary.unassigned} tone={summary.unassigned > 0 ? "warning" : "neutral"} />
        <Stat label="오늘 접수" value={summary.received_today} />
        <Stat label="오늘 종결" value={summary.closed_today} tone="success" />
        {OPEN_STAGES.filter((stage) => summary.by_stage[stage]).map((stage) => (
          <Stat key={stage} label={STAGE_VIEW[stage].label} value={summary.by_stage[stage]} />
        ))}
      </StatStrip>

      <div className="flex flex-col gap-6">
        <Card title="접수 등록">
          <IntakeForm staff={staff} />
        </Card>

        <section aria-labelledby="intakes-heading">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 id="intakes-heading" className="text-heading font-semibold">
              접수 건
            </h2>
            <nav aria-label="접수 건 보기" className="flex flex-wrap gap-1">
              {INTAKE_TABS.map((tab) => (
                <Link
                  key={tab.key || "all"}
                  href={adminHref(view, { state: tab.key })}
                  aria-current={view.state === tab.key ? "page" : undefined}
                  className={`flex h-8 items-center rounded-control px-3 text-caption font-semibold ${
                    view.state === tab.key ? "bg-primary-soft text-on-primary-soft" : "text-ink-muted hover:bg-surface-muted hover:text-ink"
                  }`}
                >
                  {tab.label}
                </Link>
              ))}
            </nav>
          </div>

          <nav aria-label="지역으로 거르기" className="mb-3 flex flex-wrap gap-1">
            {["", ...REGIONS].map((region) => (
              <Link
                key={region || "all"}
                href={adminHref(view, { region })}
                aria-current={view.region === region ? "true" : undefined}
                className={`flex h-7 items-center rounded-badge px-2 text-caption ${
                  view.region === region ? "bg-ink font-semibold text-surface" : "border border-line text-ink-muted hover:bg-surface-muted"
                }`}
              >
                {region || "전국"}
              </Link>
            ))}
          </nav>

          {view.assignee && (
            <p className="mb-3 flex flex-wrap items-center gap-2 text-caption text-ink-muted">
              <Badge tone="info">{staffName(picked, view.assignee)} 담당 건만</Badge>
              <Link href={adminHref(view, { assignee: "" })} className="font-semibold text-primary-strong">
                모두 보기
              </Link>
            </p>
          )}

          {intakes.length === 0 ? (
            <p className="rounded-card border border-line bg-surface px-5 py-8 text-center text-ink-muted">조건에 맞는 접수 건이 없어요</p>
          ) : (
            <IntakeTable intakes={intakes} staff={staff} />
          )}

          <div className="mt-3 flex items-center justify-between gap-3 text-caption text-ink-muted">
            <span>{intakes.length}건{view.before && ` · ${shortTime(view.before)} 이전`}</span>
            <span className="flex gap-2">
              {view.before && (
                <ButtonLink href={adminHref(view)} variant="secondary" size="sm">
                  처음으로
                </ButtonLink>
              )}
              {last && intakes.length === PAGE_SIZE && (
                <ButtonLink href={adminHref(view, { before: last.received_at })} variant="secondary" size="sm">
                  더 이전 접수
                </ButtonLink>
              )}
            </span>
          </div>
        </section>

        <section aria-labelledby="staff-heading">
          <h2 id="staff-heading" className="mb-3 text-heading font-semibold">
            담당자 <span className="font-mono text-body font-normal tabular-nums text-ink-muted">{adjusters.length}명</span>
          </h2>
          <Table>
            <caption className="sr-only">담당자별 업무량 — 지역, 분야 순</caption>
            <thead>
              <tr>
                <Th>담당자</Th>
                <Th>지역</Th>
                <Th>분야</Th>
                <Th className="text-right">진행 중</Th>
                <Th className="text-right">종결</Th>
                <Th>
                  <span className="sr-only">접수 건 보기</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {[...adjusters]
                .sort(
                  (a, b) =>
                    REGIONS.indexOf(a.region ?? "") - REGIONS.indexOf(b.region ?? "") ||
                    (a.coverage ?? "").localeCompare(b.coverage ?? "") * -1 ||
                    b.cases.open - a.cases.open,
                )
                .map((member) => (
                  <tr key={member.user_id}>
                    <Td>
                      <span className="font-semibold">{staffName(member, member.user_id)}</span>
                      {!member.auto_assign && <Badge className="ml-2">자동 배정 제외</Badge>}
                    </Td>
                    <Td>{member.region ?? <span className="text-ink-faint">없음</span>}</Td>
                    <Td>{member.coverage ? COVERAGE_LABELS[member.coverage] : ""}</Td>
                    <Td className="text-right font-mono tabular-nums">{member.cases.open}</Td>
                    <Td className="text-right font-mono tabular-nums text-ink-muted">{member.cases.closed}</Td>
                    <Td className="text-right">
                      <Link href={adminHref(view, { assignee: member.user_id, state: "open", region: "" })} className="text-caption font-semibold text-primary-strong">
                        맡은 건 보기
                      </Link>
                    </Td>
                  </tr>
                ))}
            </tbody>
          </Table>
        </section>
      </div>
    </>
  );
}
