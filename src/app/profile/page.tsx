/** B 통합: 내 정보 — 로그인한 보상 담당자의 소속·계정, 담당 사건 수, 로그아웃(Supabase 세션 종료). */
import { RedirectType, redirect } from "next/navigation";
import { listCases } from "@/features/cases/case-source";
import { getCurrentProfile, isSampleProfile } from "@/features/profile/profile-source";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { summarizeBoard } from "@/lib/cases/stages";
import { Badge, Button, ButtonLink, Card, DescriptionList, DescriptionRow, Notice, PageHeader } from "@/ui/controls";

const SAMPLE_NOTE = "로그인하지 않아 src/fixtures/profile.json의 합성 담당자를 보여 준다. 운영 배포에서는 비어 있다.";

/**
 * 로그아웃 — 폼 POST(Server Action)로 둔다. 링크(GET)는 Next가 미리 불러올 수 있어 로그아웃에 쓰지 않는다.
 * Supabase 세션을 끝내고(쿠키 삭제) 로그인 화면으로 보낸다. replace라 뒤로 가기가 로그아웃 전 화면으로 돌아오지 않는다.
 */
async function logout() {
  "use server";
  const supabase = await createSupabaseServerClient();
  await supabase?.auth.signOut();
  redirect("/login", RedirectType.replace);
}

export default async function ProfilePage() {
  const profile = await getCurrentProfile();

  if (!profile) {
    return (
      <>
        <PageHeader title="내 정보" />
        <Notice tone="info">로그인하지 않아 담당자 정보가 없다. 로그인하면 소속·계정과 담당 사건 수를 보여 준다.</Notice>
      </>
    );
  }

  // 수는 사건 보드 요약 줄과 같은 규칙으로 센다(src/lib/cases/stages.ts).
  const summary = summarizeBoard(await listCases());
  const counts = [
    { term: "전체", value: summary.total },
    { term: "손댈 차례", value: summary.attention, note: "확인·답변·승인 대기" },
    { term: "처리 중", value: summary.running, note: "분석·판단 진행" },
    { term: "실패", value: summary.failed, note: "다시 시작 필요" },
    { term: "승인", value: summary.approved, note: "보고서 승인 완료" },
  ];

  return (
    <>
      <PageHeader
        eyebrow="내 정보"
        title={profile.name}
        actions={
          <form action={logout}>
            <Button type="submit" variant="secondary">
              로그아웃
            </Button>
          </form>
        }
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card
          title="담당자 정보"
          aside={
            isSampleProfile(profile) && (
              <span title={SAMPLE_NOTE}>
                <Badge>합성 견본</Badge>
              </span>
            )
          }
        >
          <DescriptionList>
            <DescriptionRow term="소속">{profile.team}</DescriptionRow>
            <DescriptionRow term="역할">{profile.role}</DescriptionRow>
            {/* 좁은 화면에서 긴 이메일·ID가 칸을 넘지 않게 한다. 하이픈 같은 끊을 자리가 있으면 거기서 먼저 끊는다. */}
            <DescriptionRow term="이메일">
              <span className="wrap-anywhere">{profile.email}</span>
            </DescriptionRow>
            <DescriptionRow term="담당자 ID" note="사실 카드 확정·보고서 승인 기록에 남는 값">
              <span className="font-mono wrap-anywhere">{profile.user_id}</span>
            </DescriptionRow>
          </DescriptionList>
        </Card>
        <Card
          title="담당 사건"
          aside={
            // 버튼(32px)이 머리줄을 키우지 않게 위아래 여백을 겹친다 — 옆 카드의 배지 머리줄과 구분선 높이가 같아진다.
            <ButtonLink href="/cases" variant="quiet" size="sm" className="-my-1">
              보드 열기
            </ButtonLink>
          }
        >
          <DescriptionList>
            {counts.map((count) => (
              <DescriptionRow key={count.term} term={count.term} note={count.note}>
                <span className="font-mono tabular-nums">{count.value}</span>건
              </DescriptionRow>
            ))}
          </DescriptionList>
        </Card>
      </div>
    </>
  );
}
