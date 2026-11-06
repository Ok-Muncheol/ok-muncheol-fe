/** D 통합: 첫 화면 자리. TODO: 로그인 상태에 따라 /login 또는 /cases로 보낸다. */
import Link from "next/link";

const routes = [
  { href: "/login", label: "담당자 로그인" },
  { href: "/cases", label: "담당 사건 목록" },
  { href: "/cases/new", label: "사건 접수" },
  { href: "/dev", label: "개발 미리보기" },
];

export default function Home() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-2xl font-semibold">옥문철</h1>
      <p className="mt-2 text-neutral-600">과실비율 검토 초안 — 화면 골격만 있고 기능은 준비 중입니다.</p>
      <ul className="mt-6 list-disc space-y-1 pl-5">
        {routes.map((route) => (
          <li key={route.href}>
            <Link className="underline" href={route.href}>
              {route.label}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
