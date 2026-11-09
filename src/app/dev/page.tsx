/**
 * 전원·C 근거 미리보기: 개발 전용. 운영 배포에서는 열리지 않는다.
 * 지금은 디자인 시스템 「청람」의 토큰과 공통 컨트롤을 한 화면에서 본다. 담당 화면이 생기면 아래에
 * src/fixtures/의 비식별 견본으로 정상·불명·불일치·질문·보류·실패·버전 충돌 미리보기를 더한다.
 */
import { notFound } from "next/navigation";
import { StatusLabel } from "@/components/status-label";
import { CaseBoard } from "@/features/cases/case-board";
import sample from "@/fixtures/case-board.json";
import type { CaseSummary, JudgmentStatus, TaskStatus } from "@/lib/api/types";
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  DescriptionList,
  DescriptionRow,
  Empty,
  Field,
  Input,
  Notice,
  PageHeader,
  Select,
  Spinner,
  Table,
  Td,
  Textarea,
  Th,
} from "@/ui/controls";

const TASK_STATUSES: TaskStatus[] = ["queued", "running", "waiting_for_confirmation", "completed", "failed"];
const JUDGMENT_STATUSES: JudgmentStatus[] = ["draft_ready", "needs_confirmation", "deferred"];

const SWATCHES: { name: string; className: string; note: string }[] = [
  { name: "page", className: "bg-page", note: "화면 바탕" },
  { name: "surface", className: "bg-surface", note: "카드·표·머리글" },
  { name: "surface-muted", className: "bg-surface-muted", note: "표 머리줄·비활성 입력" },
  { name: "primary", className: "bg-primary", note: "주요 버튼·로고(면)" },
  { name: "primary-strong", className: "bg-primary-strong", note: "링크·현재 메뉴·초점 고리" },
  { name: "primary-soft", className: "bg-primary-soft", note: "선택·quiet 버튼 hover" },
  { name: "info-soft", className: "bg-info-soft", note: "처리 중·초안 작성 가능" },
  { name: "success-soft", className: "bg-success-soft", note: "완료·확정·승인" },
  { name: "warning-soft", className: "bg-warning-soft", note: "확인 필요·보류" },
  { name: "danger-soft", className: "bg-danger-soft", note: "실패·충돌" },
  { name: "model-soft", className: "bg-model-soft", note: "모델 원값·확신도" },
];

export default function DevPage() {
  // Vercel 운영 배포에서는 없는 페이지로 둔다 — 견본 화면이 운영에 노출되지 않게 한다 (lumi /dev와 같은 방식)
  if (process.env.VERCEL_ENV === "production") notFound();

  return (
    <>
      <PageHeader
        eyebrow="개발 전용"
        title="디자인 시스템 「청람」"
        description="토큰과 공통 컨트롤(src/ui/controls.tsx)을 한 화면에서 본다. OS 다크 모드를 켜면 어두운 세트로 바뀐다."
        actions={
          <>
            <Button variant="secondary">보조 동작</Button>
            <Button>주요 동작</Button>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="색 토큰" aside={<Badge>globals.css</Badge>}>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {SWATCHES.map((swatch) => (
              <li key={swatch.name} className="flex items-center gap-3">
                <span aria-hidden className={`size-9 shrink-0 rounded-control border border-line ${swatch.className}`} />
                <span className="min-w-0">
                  <span className="block font-mono text-caption">{swatch.name}</span>
                  <span className="block text-caption text-ink-muted">{swatch.note}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-caption text-ink-muted">
            글자는 <span className="text-ink">ink</span> · <span className="text-ink-muted">ink-muted</span> ·{" "}
            <span className="text-ink-faint">ink-faint</span>, 선은 line · line-strong이다. Tailwind 기본 팔레트(gray·blue 등)는 지웠다.
          </p>
        </Card>

        <Card title="글자" aside={<Badge>Noto Sans KR · IBM Plex Mono</Badge>}>
          <p className="text-title font-bold">text-title 22px — 화면 제목</p>
          <p className="mt-2 text-heading font-semibold">text-heading 17px — 카드 제목</p>
          <p className="mt-2 text-body">text-body 14px — 본문. 보상 담당자가 사실 카드의 필드·출처·증거·확인 상태를 읽는 기본 크기다.</p>
          <p className="mt-2 text-caption text-ink-muted">text-caption 12px — 라벨·안내·표 머리줄</p>
          <p className="mt-3 font-mono text-body tabular-nums">
            font-mono tabular-nums — CASE-2026-000123 · v3 · 1,250,000원 · 70:30
          </p>
        </Card>

        <Card title="상태 — 작업 진행" aside={<Badge tone="neutral">TaskStatus</Badge>}>
          <div className="flex flex-wrap gap-2">
            {TASK_STATUSES.map((status) => (
              <StatusLabel key={status} status={status} />
            ))}
          </div>
          <p className="mt-3 text-caption text-ink-muted">작업 완료(success)는 판정이 아니다. 판정은 아래 세 가지로만 표시한다.</p>
        </Card>

        <Card title="상태 — 판정 결과" aside={<Badge tone="neutral">JudgmentStatus</Badge>}>
          <div className="flex flex-wrap gap-2">
            {JUDGMENT_STATUSES.map((status) => (
              <StatusLabel key={status} status={status} />
            ))}
            <Badge tone="model">모델 원값</Badge>
            <Badge tone="model">확신도 0.62</Badge>
            <Badge tone="success">담당자 확인</Badge>
            <Badge tone="neutral">초안</Badge>
            <Badge tone="success">승인</Badge>
          </div>
          <p className="mt-3 text-caption text-ink-muted">model 톤은 모델이 낸 값에만 쓴다. 담당자가 고친 값은 ink로, 확인한 값은 success로 보인다.</p>
        </Card>

        <Card title="버튼">
          <div className="flex flex-wrap items-center gap-2">
            <Button>주요</Button>
            <Button variant="secondary">보조</Button>
            <Button variant="quiet">조용한</Button>
            <Button variant="danger">위험</Button>
            <Button disabled>비활성</Button>
            <Button size="sm">작은 주요</Button>
            <Button size="sm" variant="secondary">
              작은 보조
            </Button>
            <ButtonLink href="/cases" variant="secondary">
              링크
            </ButtonLink>
          </div>
          <div className="mt-4 flex items-center gap-2 text-body text-ink-muted">
            <Spinner /> 영상 분석 진행 중 — 작업 ID로 상태를 다시 조회한다.
          </div>
        </Card>

        <Card title="안내">
          <div className="flex flex-col gap-3">
            <Notice tone="info" title="검토 초안">
              이 보고서는 담당자 승인 전 검토 초안이다. 외부 전달은 승인 후에만 할 수 있다.
            </Notice>
            <Notice tone="warning" title="추가 확인 필요">
              신호 상태가 불명이다. 아래 질문에 답하면 카드를 다시 확정하고 판단을 재개한다.
            </Notice>
            <Notice tone="danger" title="버전 충돌">
              다른 담당자가 카드 v3을 저장했다. 최신 값을 다시 불러온 뒤 수정한다.
            </Notice>
            <Notice tone="success">보고서 v2를 승인했다.</Notice>
          </div>
        </Card>

        <Card title="입력">
          <form className="grid gap-4 sm:grid-cols-2">
            <Field id="dev-accident-date" label="사고 일시" required hint="약관 적용판은 사고 일시 기준으로 고른다">
              <Input id="dev-accident-date" type="datetime-local" />
            </Field>
            <Field id="dev-input-path" label="입력 경로">
              <Select id="dev-input-path" defaultValue="video">
                <option value="video">영상 업로드</option>
                <option value="manual">사실 카드 직접 입력</option>
              </Select>
            </Field>
            <Field id="dev-reason" label="수정 사유" error="수정 사유를 적어야 저장할 수 있다">
              <Input id="dev-reason" aria-invalid placeholder="예: 블랙박스 02:13 프레임에서 신호 확인" />
            </Field>
            <Field id="dev-disabled" label="확신도" hint="수동 입력은 해당 없음">
              <Input id="dev-disabled" disabled value="해당 없음" readOnly />
            </Field>
            <div className="sm:col-span-2">
              <Field id="dev-statement" label="진술 근거">
                <Textarea id="dev-statement" placeholder="당사자 진술을 그대로 적는다" />
              </Field>
            </div>
          </form>
        </Card>

        <Card title="이름 · 값 목록">
          <DescriptionList>
            <DescriptionRow term="사건 번호">
              <span className="font-mono">CASE-2026-000123</span>
            </DescriptionRow>
            <DescriptionRow term="신호 상태" note={<Badge tone="model">모델 원값 녹색 · 확신도 0.58</Badge>}>
              적색 <Badge tone="success" className="ml-1">담당자 확인</Badge>
            </DescriptionRow>
            <DescriptionRow term="기본 과실 A:B">
              <span className="font-mono tabular-nums">70 : 30</span>
            </DescriptionRow>
            <DescriptionRow term="인정 손해액" note="견적서 접수 전">
              <Empty />
            </DescriptionRow>
          </DescriptionList>
        </Card>

        <div className="lg:col-span-2">
          <h2 className="mb-3 text-heading font-semibold">표</h2>
          <Table>
            <thead>
              <tr>
                <Th>사건 번호</Th>
                <Th>사고 일시</Th>
                <Th>작업</Th>
                <Th>판정</Th>
                <Th>보고서</Th>
                <Th className="text-right">과실 A:B</Th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <Td className="font-mono">CASE-2026-000123</Td>
                <Td>2026-11-01 14:20</Td>
                <Td>
                  <StatusLabel status="completed" />
                </Td>
                <Td>
                  <StatusLabel status="draft_ready" />
                </Td>
                <Td>
                  v2 <Badge tone="success">승인</Badge>
                </Td>
                <Td className="text-right font-mono tabular-nums">70 : 30</Td>
              </tr>
              <tr>
                <Td className="font-mono">CASE-2026-000124</Td>
                <Td>2026-11-03 09:05</Td>
                <Td>
                  <StatusLabel status="waiting_for_confirmation" />
                </Td>
                <Td>
                  <StatusLabel status="needs_confirmation" />
                </Td>
                <Td>
                  v1 <Badge>초안</Badge>
                </Td>
                <Td className="text-right font-mono tabular-nums">
                  <Empty />
                </Td>
              </tr>
              <tr>
                <Td className="font-mono">CASE-2026-000125</Td>
                <Td>2026-11-04 18:41</Td>
                <Td>
                  <StatusLabel status="failed" />
                </Td>
                <Td>
                  <Empty>없음</Empty>
                </Td>
                <Td>
                  <Empty>없음</Empty>
                </Td>
                <Td className="text-right font-mono tabular-nums">
                  <Empty />
                </Td>
              </tr>
            </tbody>
          </Table>
        </div>

        <div className="lg:col-span-2">
          <h2 className="mb-1 text-heading font-semibold">담당 사건 보드</h2>
          <p className="mb-3 text-caption text-ink-muted">
            열은 아키텍처 단계, 배지는 그 단계 안의 상태다(src/lib/cases/stages.ts). 손댈 사건은 왼쪽 선이 warning이고 열 안에서 앞에 선다. 견본은 src/fixtures/case-board.json.
          </p>
          <CaseBoard cases={sample.cases as CaseSummary[]} />
        </div>
      </div>
    </>
  );
}
