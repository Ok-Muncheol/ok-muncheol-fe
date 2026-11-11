/**
 * A·B: 사고·당사자 — 도표 A · B가 가입자·촬영 차량 중 누구인지. 판단 화면 오른쪽에 한 번만 둔다
 * (구분 질문·확인할 칸이 「B 진행 방향」처럼 도표 A · B로 물을 때도 이 카드를 본다).
 * 카드의 매핑 ID로만 적고 같은 당사자라고 가정하지 않는다. 빈 역할은 가입자도 촬영 차량도 아닌 상대다. 매핑 편집은 아직 없다.
 * 카드가 아직 없으면(mapping null) 도표 A · B 칸을 비운다(Blank). 사고 일시는 사건 요약에도 있어 따로 받는다.
 */
import type { PartyMapping } from "@/lib/api/types";
import { partyRoles } from "@/lib/judgment/view";
import { Blank, Card, DescriptionList, DescriptionRow, Empty, Notice } from "@/ui/controls";

export function PartiesCard({ mapping, hasVideo, accidentDate }: { mapping: PartyMapping | null; hasVideo: boolean; accidentDate: string | null }) {
  const unmapped = mapping !== null && (mapping.chart_party_A_id === null || mapping.chart_party_B_id === null);
  return (
    <Card title="사고·당사자">
      <DescriptionList>
        <DescriptionRow term="사고 일시">{accidentDate ?? <Blank />}</DescriptionRow>
        {(["A", "B"] as const).map((party) => {
          const roles = mapping && partyRoles(mapping, party);
          return (
            <DescriptionRow key={party} term={`도표 ${party}`}>
              {mapping === null ? <Blank /> : roles === null ? <Empty>매핑 전</Empty> : roles.length > 0 ? roles.join(" · ") : "상대"}
            </DescriptionRow>
          );
        })}
        {hasVideo && mapping !== null && mapping.video_ego_party_id === null && (
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
