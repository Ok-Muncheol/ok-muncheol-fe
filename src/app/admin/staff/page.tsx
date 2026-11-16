/**
 * B 통합: 담당자 — 관리자가 담당자별 업무량(진행 중·종결)과 지역·분야·경력·전문 분야, 부재·고액 권한·자동 배정 제외를 본다.
 * 사건 관제(/admin) 아래에 있던 표를 메뉴 「담당자」로 옮겼다. 줄마다 「맡은 건 보기」를 누르면 사건 관제에서 그 담당자의 진행 중 접수 건만 거른다.
 * 관리자만 들어온다. 메뉴는 관리자에게만 보이고(src/ui/app-shell.tsx), 화면은 BE가 403을 주면 없는 화면이 된다(admin-source.ts).
 */
import Link from "next/link";
import { loadStaff } from "@/features/admin/admin-source";
import { COVERAGE_LABELS, REGIONS, adminHref, parseAdminView, specialtyLabels, staffName } from "@/lib/admin/view";
import { Badge, Notice, PageHeader, Table, Td, Th } from "@/ui/controls";

export default async function StaffPage() {
  const data = await loadStaff();

  if (data.kind === "sample") {
    return (
      <>
        <PageHeader title="담당자" />
        <Notice title="견본 모드에서는 볼 수 없습니다">담당자 목록은 BE를 읽는 배포에서만 보입니다(OKM_DATA_SOURCE=api).</Notice>
      </>
    );
  }
  if (data.kind === "problem") {
    return (
      <>
        <PageHeader title="담당자" />
        <Notice tone="danger" title="담당자 목록을 읽지 못했습니다">{data.message}</Notice>
      </>
    );
  }

  const adjusters = data.overview.staff.filter((member) => member.staff_role === "adjuster");
  // 「맡은 건 보기」는 사건 관제의 기본 보기(진행 중 · 전국)에서 담당자만 고른 주소다
  const intakes = parseAdminView({});

  return (
    <>
      <PageHeader
        title={
          <>
            담당자 <span className="font-mono text-body font-normal tabular-nums text-ink-muted">{adjusters.length}명</span>
          </>
        }
      />
      <p className="mb-3 text-caption break-keep text-ink-muted">
        부재인 담당자는 자동 배정에서 빠지지만 직접 배정·이관으로는 줄 수 있습니다. 고액 사건(예상 손해액 3,000만 원 이상, 중상·사망)은 고액 권한이 있는 담당자에게만 자동 배정합니다.
      </p>
      <Table>
        <caption className="sr-only">담당자별 업무량과 경력·전문 분야 — 지역, 분야 순</caption>
        <thead>
          <tr>
            {/* 좁은 화면에서 표가 칸에 맞추려고 「서/울」·「진/행 중」처럼 한 글자씩 꺾지 않게 짧은 칸은 줄을 바꾸지 않는다(표는 가로로 민다) */}
            <Th className="whitespace-nowrap">담당자</Th>
            <Th className="whitespace-nowrap">지역</Th>
            <Th className="whitespace-nowrap">분야</Th>
            <Th className="text-right whitespace-nowrap">경력</Th>
            <Th className="whitespace-nowrap">전문 분야</Th>
            <Th className="text-right whitespace-nowrap">진행 중</Th>
            <Th className="text-right whitespace-nowrap">종결</Th>
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
                  <span className="font-semibold whitespace-nowrap">{staffName(member, member.user_id)}</span>
                  {member.away && (
                    <Badge tone="warning" className="ml-2">
                      부재
                    </Badge>
                  )}
                  {member.high_value && (
                    <Badge tone="info" className="ml-2">
                      고액 권한
                    </Badge>
                  )}
                  {!member.auto_assign && <Badge className="ml-2">자동 배정 제외</Badge>}
                </Td>
                <Td className="whitespace-nowrap">{member.region ?? <span className="text-ink-faint">없음</span>}</Td>
                <Td className="whitespace-nowrap">{member.coverage ? COVERAGE_LABELS[member.coverage] : ""}</Td>
                <Td className="text-right font-mono whitespace-nowrap tabular-nums">{member.career_years != null ? `${member.career_years}년` : ""}</Td>
                <Td className="break-keep">{specialtyLabels(member).join(" · ") || <span className="text-ink-faint">없음</span>}</Td>
                <Td className="text-right font-mono tabular-nums">{member.cases.open}</Td>
                <Td className="text-right font-mono tabular-nums text-ink-muted">{member.cases.closed}</Td>
                <Td className="text-right whitespace-nowrap">
                  <Link href={adminHref(intakes, { assignee: member.user_id })} className="text-caption font-semibold text-primary-strong">
                    맡은 건 보기
                  </Link>
                </Td>
              </tr>
            ))}
        </tbody>
      </Table>
    </>
  );
}
