"use client";

/**
 * B 통합: 사건 관제의 새 접수 알림 — 화면이 보이는 동안 POLL_MS마다 최근 접수(BE GET /admin/intakes, limit POLL_LIMIT)를 읽는다.
 * 목록이 바뀌면(새 접수, 1분 뒤 지워진 시연 접수) 현황 숫자·지도·접수 건을 서버에서 다시 그리고(router.refresh),
 * 새 접수는 그 지역 지도에 물결(RegionRipples)을 화면에 나타난 때부터 RIPPLE_MS 동안 띄운다. 규칙은 src/lib/admin/live.ts.
 * 처음 읽을 때는 다시 그리지 않고 막 들어온 건만 물결을 띄운다. 탭이 보이지 않으면 읽지 않고, 다시 보이면 바로 읽는다.
 * 읽기에 실패하면(네트워크·세션 만료) 다음 차례에 다시 읽는다 — 화면에는 알리지 않는다.
 */
import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { POLL_LIMIT, POLL_MS, type Ripple, freshRipples, listChanged } from "@/lib/admin/live";
import { createBrowserApiClient } from "@/lib/api/browser";
import { REGION_PATHS } from "./korea-map";

const RipplesContext = createContext<Ripple[]>([]);

/** 물결 하나가 끝나기 전에 옅어지는 시간 */
const FADE_MS = 1_000;
/** 물결 동심원이 가장 크게 퍼졌을 때의 반지름(지도 좌표 — 0.5km 단위). 지도 폭 288px에서 60px쯤이다 */
const RIPPLE_R = 150;
/** 동심원 셋이 따라 나오는 간격 — 하나가 퍼지는 데 2.4초(아래 animate-[ok-ripple_2400ms…])라 늘 셋이 겹쳐 보인다 */
const RING_DELAYS = [0, 800, 1_600];

export function LiveArrivals({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [ripples, setRipples] = useState<Ripple[]>([]);
  // 지난번에 읽은 최근 접수 ID(최근 접수 순). 아직 한 번도 못 읽었으면 null
  const last = useRef<string[] | null>(null);

  useEffect(() => {
    const client = createBrowserApiClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;

    async function poll() {
      timer = undefined;
      if (stopped || document.visibilityState !== "visible") return;
      try {
        const latest = await client.listAdminIntakes({ limit: POLL_LIMIT });
        if (stopped) return;
        const ids = latest.map((intake) => intake.intake_id);
        const fresh = freshRipples(latest, new Set(last.current ?? []), Date.now());
        if (last.current && listChanged(last.current, ids)) router.refresh();
        last.current = ids;
        if (fresh.length > 0) setRipples((now) => [...now, ...fresh]);
      } catch {
        // 다음 차례에 다시 읽는다
      }
      if (!stopped && document.visibilityState === "visible") timer = setTimeout(poll, POLL_MS);
    }

    function onVisibility() {
      if (document.visibilityState === "visible" && timer === undefined) void poll();
    }

    void poll();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [router]);

  // 끝난 물결을 걷어 낸다
  useEffect(() => {
    if (ripples.length === 0) return;
    const next = Math.min(...ripples.map((ripple) => ripple.until));
    const timer = setTimeout(() => setRipples((now) => now.filter((ripple) => ripple.until > Date.now())), Math.max(0, next - Date.now()));
    return () => clearTimeout(timer);
  }, [ripples]);

  return <RipplesContext value={ripples}>{children}</RipplesContext>;
}

/**
 * 지도 위 물결 — 잔잔한 물에 물방울이 떨어진 것처럼 그 지역 자리에서 동심원 셋이 차례로 퍼지며 옅어지기를 되풀이하고,
 * 그 지역 면은 옥색으로 천천히 밝아졌다 어두워지기를 되풀이한다. 끝나기 1초 전부터 다 같이 옅어진다.
 * RegionMap(서버 컴포넌트)이 지역마다 물결 자리(이름표 자리, 인천은 지시선 끝)를 넘긴다. 지도 면 위·이름표 아래에 그린다.
 * 옥색 지도 위에서도 보이게 동심원은 굵은 옥색 선(3px) 바깥에 면 색(흰색 — 다크는 어두운 색) 테두리를 둘렀다.
 * 움직임 줄이기 설정에서는 퍼지지 않고 면 빛과 고리 하나만 그 시간 동안 멈춰 보인다.
 * 지도는 눈으로 보는 그림이라(aria-hidden) 물결도 화면 낭독기에는 읽히지 않는다 — 새 접수는 목록·현황 숫자로 읽힌다.
 */
export function RegionRipples({ anchors, width, height }: { anchors: Record<string, { x: number; y: number }>; width: number; height: number }) {
  const ripples = useContext(RipplesContext);
  if (ripples.length === 0) return null;
  return (
    <svg aria-hidden viewBox={`0 0 ${width} ${height}`} className="pointer-events-none absolute inset-0 size-full">
      {ripples.map(({ id, region, from, until }) => {
        const at = anchors[region];
        if (!at) return null;
        return (
          <g
            key={id}
            className="motion-safe:animate-[ok-ripple-out_1s_ease-in_forwards]"
            style={{ animationDelay: `${Math.max(0, until - from - FADE_MS)}ms` }}
          >
            {REGION_PATHS[region] && (
              <path
                d={REGION_PATHS[region]}
                fillRule="evenodd"
                className="fill-primary-strong opacity-0 motion-safe:animate-[ok-glow_1600ms_ease-in-out_infinite] motion-reduce:opacity-35"
              />
            )}
            {RING_DELAYS.map((delay, index) => (
              <g
                key={delay}
                className={`opacity-0 [transform-box:fill-box] [transform-origin:center] motion-safe:animate-[ok-ripple_2400ms_ease-out_infinite] ${
                  index === 0 ? "motion-reduce:scale-50 motion-reduce:opacity-90" : ""
                }`}
                style={{ animationDelay: `${delay}ms` }}
              >
                <circle cx={at.x} cy={at.y} r={RIPPLE_R} strokeWidth={7} vectorEffect="non-scaling-stroke" className="fill-none stroke-surface" />
                <circle cx={at.x} cy={at.y} r={RIPPLE_R} strokeWidth={3} vectorEffect="non-scaling-stroke" className="fill-none stroke-primary-strong" />
              </g>
            ))}
          </g>
        );
      })}
    </svg>
  );
}
