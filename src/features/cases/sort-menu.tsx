"use client";

/**
 * 담당 사건 보드 오른쪽 위의 정렬 메뉴. 고르면 주소(?sort=)가 바뀌고 보드를 서버에서 다시 그린다.
 * 바깥을 누르거나 Esc를 누르면 닫는다.
 */
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export function SortMenu({ current, options }: { current: string; options: readonly { label: string; href: string; active: boolean }[] }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !box.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-8 items-center gap-1.5 rounded-control px-2.5 text-caption text-ink-muted hover:bg-surface-muted hover:text-ink"
      >
        {current}
        <svg aria-hidden viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
          <path d="m4 6 4 4 4-4" />
        </svg>
      </button>
      {open && (
        <ul role="menu" className="absolute top-full right-0 z-30 mt-1 w-40 rounded-control border border-line bg-surface p-1 shadow-raised">
          {options.map((option) => (
            <li key={option.href} role="none">
              <Link
                role="menuitemradio"
                aria-checked={option.active}
                href={option.href}
                scroll={false}
                onClick={() => setOpen(false)}
                className={`flex h-8 items-center justify-between rounded-control px-2.5 text-caption hover:bg-surface-muted ${option.active ? "font-semibold text-ink" : "text-ink-muted"}`}
              >
                {option.label}
                {option.active && (
                  <svg aria-hidden viewBox="0 0 16 16" className="size-3.5 text-primary-strong" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="m3.5 8.5 3 3 6-7" />
                  </svg>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
