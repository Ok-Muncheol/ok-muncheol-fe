/**
 * A·B: 사실 카드 — 담당 사건 보드의 사실 카드 열 카드와 판단 화면의 「사실 카드 화면으로」가 여기로 온다.
 * 왼쪽은 카드 확인·수정·확정(FactCardPanel), 오른쪽은 당사자 매핑과 근거 프레임이다. 영상 없는 사건은 프레임 칸이 없다.
 * TODO(A): 영상 재생·권한 있는 프레임 URL, 저장·확정 요청, 수정 이력, 매핑 편집. 구분 질문 답변은 판단 화면에서 한다.
 */
import Link from "next/link";
import { getCaseSummary } from "@/features/cases/case-source";
import { EvidenceFrames } from "@/features/facts/evidence-frames";
import { FactCardPanel } from "@/features/facts/fact-card-panel";
import { getFactCard } from "@/features/facts/fact-source";
import type { PartyMapping } from "@/lib/api/types";
import { stageIndex } from "@/lib/cases/stages";
import { partyRoles } from "@/lib/judgment/view";
import { Badge, ButtonLink, Card, DescriptionList, DescriptionRow, Empty, Notice, PageHeader } from "@/ui/controls";

const dateTime = new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Seoul" });

export default async function FactsPage(props: PageProps<"/cases/[id]/facts">) {
  const { id } = await props.params;
  const [summary, card] = await Promise.all([getCaseSummary(id), getFactCard(id)]);

  if (!summary) {
    return (
      <>
        <PageHeader eyebrow="담당 사건" title={<span className="font-mono">{id}</span>} />
        <Notice tone="warning" title="사건을 찾지 못했다">
          담당 사건 목록에 없는 번호이거나 조회 API가 아직 연결되지 않았다.{" "}
          <ButtonLink href="/cases" variant="quiet" size="sm">
            목록으로
          </ButtonLink>
        </Notice>
      </>
    );
  }

  const base = `/cases/${encodeURIComponent(summary.case_id)}`;
  const eyebrow = (
    <>
      담당 사건 ·{" "}
      <Link href={base} className="font-mono text-primary-strong underline-offset-4 hover:underline">
        {summary.case_id}
      </Link>
    </>
  );

  if (!card) {
    // 카드가 아직 없는 사건(접수·영상 분석 단계)이거나, 뒤 단계인데 카드를 못 읽은 경우다.
    const beforeFacts = stageIndex(summary.stage) < stageIndex("facts");
    return (
      <>
        <PageHeader eyebrow={eyebrow} title="사실 카드" />
        <Notice tone="info" title={beforeFacts ? "아직 사실 카드가 없다" : "사실 카드를 불러오지 못했다"}>
          {beforeFacts
            ? summary.input_path === "video"
              ? "영상 분석이 끝나면 사실 카드가 만들어진다."
              : "접수를 마치면 사실 카드를 직접 입력한다."
            : "사실 카드 조회 API 연결 전이다. 합성 견본은 사실 카드·판단 단계 사건에만 있다."}{" "}
          <ButtonLink href={base} variant="quiet" size="sm">
            사건 개요로
          </ButtonLink>
        </Notice>
      </>
    );
  }

  const confirmed = card.status === "confirmed";
  const hasVideo = summary.input_path === "video";
  const pastFacts = stageIndex(summary.stage) > stageIndex("facts");

  return (
    <>
      <PageHeader
        eyebrow={eyebrow}
        title={
          <>
            사실 카드 <span className="font-mono tabular-nums">v{card.version}</span>
            <span className="ml-2 inline-flex align-middle">
              <Badge tone={confirmed ? "success" : "warning"} dot>
                {confirmed ? "확정" : "확정 전"}
              </Badge>
            </span>
          </>
        }
        description={
          confirmed
            ? `${card.confirmed_at ? dateTime.format(new Date(card.confirmed_at)) : ""} 확정 — 이 카드로 판단한다. 값을 고치면 새 버전을 다시 확정해야 한다.`
            : hasVideo
              ? "영상 분석이 채운 값을 근거 프레임과 맞춰 보고, 틀린 값은 고친 뒤 확정한다."
              : "직접 입력한 값을 확인하고 확정한다."
        }
        actions={
          pastFacts && (
            <ButtonLink href={`${base}/judgment`} variant="secondary">
              판단 화면으로
            </ButtonLink>
          )
        }
      />
      <div className="grid items-start gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="min-w-0">
          <FactCardPanel card={card} />
        </div>
        <div className="flex min-w-0 flex-col gap-6">
          <Parties mapping={card.party_mapping} hasVideo={hasVideo} accidentDate={dateTime.format(new Date(card.accident_date))} />
          {hasVideo && <EvidenceFrames card={card} />}
        </div>
      </div>
    </>
  );
}

/**
 * 도표 A · B가 가입자·촬영 차량 중 누구인지 — 카드의 매핑 ID로만 적고 같은 당사자라고 가정하지 않는다.
 * 빈 역할은 가입자도 촬영 차량도 아닌 상대다. 매핑 편집은 아직 없다.
 */
function Parties({ mapping, hasVideo, accidentDate }: { mapping: PartyMapping; hasVideo: boolean; accidentDate: string }) {
  const unmapped = mapping.chart_party_A_id === null || mapping.chart_party_B_id === null;
  return (
    <Card title="사고·당사자">
      <DescriptionList>
        <DescriptionRow term="사고 일시">{accidentDate}</DescriptionRow>
        {(["A", "B"] as const).map((party) => {
          const roles = partyRoles(mapping, party);
          return (
            <DescriptionRow key={party} term={`도표 ${party}`}>
              {roles === null ? <Empty>매핑 전</Empty> : roles.length > 0 ? roles.join(" · ") : "상대"}
            </DescriptionRow>
          );
        })}
        {hasVideo && mapping.video_ego_party_id === null && (
          <DescriptionRow term="촬영 차량">
            <Empty>매핑 전</Empty>
          </DescriptionRow>
        )}
      </DescriptionList>
      {unmapped && (
        <div className="mt-4">
          <Notice tone="warning" title="도표 A·B 매핑 전">
            누가 A·B인지 정해야 「A 진행 방향」 같은 칸을 읽을 수 있다. 매핑 편집은 연결 전이다.
          </Notice>
        </div>
      )}
    </Card>
  );
}
