/**
 * B 통합: 사건 관제 — 관리자가 현황과 접수 건의 진행을 보고, 필요하면 직접 배정·이관한다. 담당자별 업무량은 메뉴 「담당자」(/admin/staff)에 있다.
 * 접수를 등록하는 폼은 두지 않는다 — 접수는 고객이 앱·전화로 하고, 들어온 건을 배정 에이전트가 배정한다. 관리자는 그 결과를 보고 바로잡는다.
 * (BE `POST /admin/intakes`와 ApiClient.registerAdminIntake는 남아 있다.)
 * 관리자만 들어온다. 메뉴는 관리자에게만 보이고(레이아웃), 화면은 BE가 403을 주면 없는 화면이 된다(admin-source.ts).
 * 보기(탭·지역·담당자·쪽)는 주소 검색어다 — 새로고침·뒤로 가기에도 같은 목록이 나온다.
 * 탭은 전체 · 미배정 · 접수 · 판단 · 검토 보고서 · 완료 사건이다. 진행 중인 건을 담당자 화면의 단계 묶음으로 나누고, 현황 줄의 단계 수도
 * 같은 묶음으로 더한다(view.ts INTAKE_TABS · stageGroupCounts). 표의 단계 배지는 묶음 안의 세부 단계(영상 분석·사실 카드 등)를 그대로 보인다.
 * 현황 줄 아래는 본문이 넓으면 [오늘 지역별 접수 지도 | 접수 건] 두 칸이다 — 지도에서 지역을 누르면 바로 옆 목록이 그 지역으로 걸린다.
 * 두 칸은 화면 폭이 아니라 본문 폭(컨테이너 쿼리 @min-[68rem], 1088px 이상)으로 가른다. 접수 건 표는 단추를 위아래로 쌓아도 720px쯤 필요해서,
 * 본문이 1120px(1440px 이상 화면, 또는 왼쪽 메뉴를 접은 1280px)이면 두 칸(접수 건 760px), 그보다 좁으면(메뉴를 펼친 1280px·1366px)
 * 지도 · 접수 건 순으로 쌓아 표가 본문 폭을 다 쓴다. 어느 쪽이든 줄 끝의 상세·이관 단추까지 가로 스크롤 없이 보인다.
 * BE가 지역별 수를 주기 전 응답이면 지도 없이 접수 건이 전체 폭이다.
 * 접수 건 칸은 보이는 제목 없이 탭부터 시작한다. 제목 「접수 건」은 화면 낭독기용 숨은 제목(sr-only)으로만 둔다(지도 카드의 「오늘 지역별 접수」도 같다).
 */
import Link from "next/link";
import { IntakeTable } from "@/features/admin/intake-table";
import { PAGE_SIZE, loadAdmin } from "@/features/admin/admin-source";
import { RegionMap } from "@/features/admin/region-map";
import { INTAKE_TABS, REGIONS, adminHref, parseAdminView, regionToday, shortTime, stageGroupCounts, staffName } from "@/lib/admin/view";
import { Badge, ButtonLink, Notice, PageHeader, Stat, StatStrip } from "@/ui/controls";

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
  const picked = staff.find((member) => member.user_id === view.assignee);
  const last = intakes.at(-1);
  const today = regionToday(summary);

  return (
    <>
      <PageHeader title="사건 관제" />

      <StatStrip className="mb-6" aside={<span className="text-caption text-ink-muted">{shortTime(overview.generated_at)} 기준</span>}>
        <Stat label="진행 중" value={summary.open} tone="info" />
        <Stat label="미배정" value={summary.unassigned} tone={summary.unassigned > 0 ? "warning" : "neutral"} />
        <Stat label="오늘 접수" value={summary.received_today} />
        {stageGroupCounts(summary.by_stage).map(({ key, label, count }) => (
          <Stat key={key} label={label} value={count} />
        ))}
        {/* 오늘 완료는 맨 끝 — 오늘 접수 → 단계(접수·판단·검토 보고서) → 오늘 완료로 접수 건이 지나는 순서대로 읽힌다 */}
        <Stat label="오늘 완료" value={summary.closed_today} tone="success" />
      </StatStrip>

      <div className="@container">
        <div className={today ? "grid gap-6 @min-[68rem]:grid-cols-[21rem_minmax(0,1fr)] @min-[68rem]:items-start" : ""}>
          {today && <RegionMap today={today} selected={view.region} hrefFor={(region) => adminHref(view, { region })} />}

          <section aria-labelledby="intakes-heading" className="min-w-0">
            <h2 id="intakes-heading" className="sr-only">
              접수 건
            </h2>
            <nav aria-label="접수 건 보기" className="mb-3 flex flex-wrap gap-1">
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

            {/* 지역 칩 18개(전국 + 17개 시·도)가 지도 옆 칸(760px)에서도 한 줄에 들어가게 칩 안 여백을 6px로 둔다(8px면 763px라 제주가 다음 줄로 떨어진다) */}
            <nav aria-label="지역으로 거르기" className="mb-3 flex flex-wrap gap-1">
              {["", ...REGIONS].map((region) => (
                <Link
                  key={region || "all"}
                  href={adminHref(view, { region })}
                  aria-current={view.region === region ? "true" : undefined}
                  className={`flex h-7 items-center rounded-badge px-1.5 text-caption ${
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
        </div>
      </div>
    </>
  );
}
