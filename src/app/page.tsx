/** B 통합: 첫 화면 자리. TODO: 로그인 상태에 따라 /login 또는 /cases로 보낸다. */
import Link from "next/link";
import { Card, PageHeader } from "@/ui/controls";

const routes = [
  { href: "/login", label: "보상 담당자 로그인" },
  { href: "/cases", label: "담당 사건 목록" },
  { href: "/cases/new", label: "사건 접수" },
  { href: "/dev", label: "개발 미리보기 · 디자인 시스템" },
];

export default function Home() {
  return (
    <>
      <PageHeader title="OK문철" description="과실비율 검토 초안 — 화면 골격만 있고 기능은 준비 중입니다." />
      <Card title="화면">
        <ul className="flex flex-col gap-2">
          {routes.map((route) => (
            <li key={route.href}>
              <Link className="text-primary-strong underline underline-offset-4" href={route.href}>
                {route.label}
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
