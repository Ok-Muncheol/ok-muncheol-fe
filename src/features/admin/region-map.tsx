/**
 * B 통합: 사건 관제 — 오늘 지역별 접수. 시·도마다 오늘 0시부터 들어온 접수 수를 지도의 면 색(지도 단계 map-0~4)과 라벨로 보이고,
 * 옆에 많은 순 목록을 둔다. 지역(면·라벨·목록 줄)을 누르면 아래 접수 건 목록을 그 지역으로 거른다(지역 칩과 같은 주소).
 * 지도는 눈으로 보는 그림이라 화면 낭독기·키보드에서는 감추고(aria-hidden · tabIndex -1) 같은 값을 목록이 읽힌다.
 * 경계는 korea-map.ts(통계청 SGIS 2018 · 공공누리 제1유형 — 출처를 지도 아래에 적는다)이고 라벨 자리는 아래 LABELS에서 손으로 맞췄다.
 */
import Link from "next/link";
import { type RegionToday, binLabel, byCount } from "@/lib/admin/view";
import { Card } from "@/ui/controls";
import { ISLAND_INSET, MAP_HEIGHT, MAP_WIDTH, REGION_PATHS } from "./korea-map";

const FILL = ["fill-map-0", "fill-map-1", "fill-map-2", "fill-map-3", "fill-map-4"];
const SWATCH = ["bg-map-0", "bg-map-1", "bg-map-2", "bg-map-3", "bg-map-4"];

/**
 * 라벨 가운데 자리(지도 단위 — 0.5km, korea-map.ts와 같은 좌표). 작은 시·도가 몰린 곳(서울·인천·경기, 세종·대전·충남·충북, 광주·전남)은
 * 라벨끼리 겹치지 않게 지역 안에서 옮겼다. anchor가 있는 라벨(인천)은 지역 밖 바다에 두고 지역 안 점까지 지시선을 긋는다.
 */
const LABELS: Record<string, { x: number; y: number; anchor?: { x: number; y: number } }> = {
  서울: { x: 228, y: 238 },
  부산: { x: 599, y: 757 },
  대구: { x: 501, y: 621 },
  인천: { x: 68, y: 300, anchor: { x: 155, y: 265 } },
  광주: { x: 185, y: 776 },
  대전: { x: 300, y: 525 },
  울산: { x: 615, y: 689 },
  세종: { x: 262, y: 438 },
  경기: { x: 305, y: 315 },
  강원: { x: 457, y: 220 },
  충북: { x: 370, y: 390 },
  충남: { x: 128, y: 492 },
  전북: { x: 249, y: 644 },
  전남: { x: 220, y: 860 },
  경북: { x: 553, y: 447 },
  경남: { x: 429, y: 738 },
  제주: { x: 126, y: 1168 },
};

const at = (value: number, total: number) => `${((value / total) * 100).toFixed(2)}%`;

export function RegionMap({ today, selected, hrefFor }: { today: RegionToday; selected: string; hrefFor: (region: string) => string }) {
  const ranked = byCount(today.regions);
  const max = ranked[0]?.count ?? 0;
  const picked = today.regions.find((r) => r.region === selected);

  return (
    <Card title="오늘 지역별 접수" className="mb-6">
      {/* 데스크톱은 지도 | 설명·목록 두 칸이고(지도가 두 줄을 차지한다), 좁은 화면은 설명 · 지도 · 목록 순으로 쌓는다 */}
      <div className="grid gap-x-10 gap-y-4 lg:grid-cols-[18rem_minmax(0,1fr)] lg:grid-rows-[auto_1fr]">
        <p className="text-caption break-keep text-ink-muted lg:col-start-2 lg:row-start-1 lg:px-2">
          오늘 0시부터 들어온 접수를 사고 장소의 시·도로 셉니다. 지역을 누르면 아래 접수 건을 그 지역으로 거릅니다.
        </p>
        <div className="mx-auto w-full max-w-[18rem] lg:col-start-1 lg:row-span-2 lg:row-start-1 lg:mx-0">
          <div aria-hidden className="relative w-full" style={{ aspectRatio: `${MAP_WIDTH} / ${MAP_HEIGHT}` }}>
            <svg viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`} className="absolute inset-0 size-full">
              {today.regions.map(({ region, count, step }) => (
                <Link key={region} href={hrefFor(region)} tabIndex={-1}>
                  <title>{`${region} ${count}건`}</title>
                  <path
                    d={REGION_PATHS[region]}
                    fillRule="evenodd"
                    strokeWidth={1}
                    vectorEffect="non-scaling-stroke"
                    className={`${FILL[step]} stroke-surface transition-opacity hover:opacity-75`}
                  />
                  {region === "경북" && (
                    <>
                      <path d={ISLAND_INSET.ulleung} vectorEffect="non-scaling-stroke" className={`${FILL[step]} stroke-line-strong transition-opacity hover:opacity-75`} />
                      <circle cx={ISLAND_INSET.dokdo.cx} cy={ISLAND_INSET.dokdo.cy} r={5} vectorEffect="non-scaling-stroke" className={`${FILL[step]} stroke-line-strong`} />
                    </>
                  )}
                </Link>
              ))}
              {/* 고른 지역의 테두리 — 이웃 면에 가리지 않게 맨 위에 다시 긋는다 */}
              {picked && <path d={REGION_PATHS[picked.region]} fillRule="evenodd" strokeWidth={2} vectorEffect="non-scaling-stroke" className="pointer-events-none fill-none stroke-ink" />}
              <rect
                x={ISLAND_INSET.box.x}
                y={ISLAND_INSET.box.y}
                width={ISLAND_INSET.box.w}
                height={ISLAND_INSET.box.h}
                rx={6}
                vectorEffect="non-scaling-stroke"
                className="pointer-events-none fill-none stroke-line"
              />
              {/* 지역 밖에 둔 라벨(인천)의 지시선 — 라벨 상자가 위에 덮여 지역 쪽 끝과 점만 보인다 */}
              {Object.entries(LABELS).map(
                ([region, { x, y, anchor }]) =>
                  anchor && (
                    <g key={region} className="pointer-events-none">
                      <line x1={x} y1={y} x2={anchor.x} y2={anchor.y} strokeWidth={1} vectorEffect="non-scaling-stroke" className="stroke-ink-muted" />
                      <circle cx={anchor.x} cy={anchor.y} r={4} className="fill-ink-muted" />
                    </g>
                  ),
              )}
            </svg>
            {today.regions.map(({ region, count }) => {
              const label = LABELS[region];
              const on = region === selected;
              return (
                <Link
                  key={region}
                  href={hrefFor(region)}
                  tabIndex={-1}
                  className={`absolute inline-flex h-5 -translate-x-1/2 -translate-y-1/2 items-center gap-1 rounded-badge border px-1.5 text-caption whitespace-nowrap ${
                    on ? "border-ink bg-ink text-surface" : "border-line bg-surface text-ink-muted hover:border-line-strong"
                  }`}
                  style={{ left: at(label.x, MAP_WIDTH), top: at(label.y, MAP_HEIGHT) }}
                >
                  {region}
                  <span className={`font-mono font-semibold tabular-nums ${!on && count > 0 ? "text-ink" : ""}`}>{count}</span>
                </Link>
              );
            })}
            <ul className="absolute right-0 bottom-0 flex flex-col gap-1 text-caption leading-none text-ink-muted">
              {[{ step: 0, label: "0" }, ...today.bins.map((bin) => ({ step: bin.step, label: binLabel(bin) }))].map(({ step, label }) => (
                <li key={step} className="flex items-center gap-1.5">
                  {/* 옅은 단계도 흰 면 위에서 보이게 칸에 가는 테두리를 둔다 */}
                  <span className={`size-3 rounded-xs ring-1 ring-line ring-inset ${SWATCH[step]}`} />
                  <span className="font-mono tabular-nums">{label}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mx-auto w-full max-w-xl min-w-0 lg:col-start-2 lg:row-start-2 lg:mx-0 lg:max-w-none">
          <p className="mb-1 flex justify-between px-2 text-caption font-semibold text-ink-muted">
            <span>많은 순</span>
            <span>건</span>
          </p>
          <ol>
            {ranked.map(({ region, count }) => {
              const on = region === selected;
              return (
                <li key={region}>
                  <Link
                    href={hrefFor(region)}
                    aria-current={on ? "true" : undefined}
                    className={`grid h-6 grid-cols-[2.5rem_minmax(0,1fr)_2.5rem] items-center gap-3 rounded-control px-2 ${
                      on ? "bg-primary-soft font-semibold text-on-primary-soft" : "text-ink hover:bg-surface-muted"
                    }`}
                  >
                    <span>{region}</span>
                    <span aria-hidden className="h-1.5 overflow-hidden rounded-full bg-surface-muted">
                      <span className="block h-full rounded-full bg-map-4" style={{ width: max > 0 ? at(count, max) : 0 }} />
                    </span>
                    <span className="text-right font-mono tabular-nums">
                      {count}
                      <span className="sr-only">건</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>
          {today.unknown > 0 && (
            <p className="mt-2 px-2 text-caption break-keep text-ink-muted">
              지역 미상 <span className="font-mono font-semibold tabular-nums text-ink">{today.unknown}</span>건 — 사고 장소에서 시·도를 판별하지 못한 접수입니다.
            </p>
          )}
          <p className="mt-4 px-2 text-caption break-keep text-ink-muted">울릉도·독도는 지도 오른쪽 위 상자에 옮겨 그렸습니다. 경계: 통계청 SGIS(2018), 공공누리 제1유형</p>
        </div>
      </div>
    </Card>
  );
}
