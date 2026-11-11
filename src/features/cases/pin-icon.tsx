/** B 통합: 고정 표시(압정). 색은 글자 색(currentColor)을 따른다 — 토큰 클래스(text-…)로 칠한다. 고정이면 속을 채운다. */
export function PinIcon({ filled = false, className = "size-4" }: { filled?: boolean; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8.5 3h7v6.5l3 3.5v1.5h-13V13l3-3.5z" fill={filled ? "currentColor" : "none"} />
      <path d="M12 14.5V21" />
    </svg>
  );
}
