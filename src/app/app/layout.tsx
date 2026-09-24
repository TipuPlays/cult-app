import { MemberNav } from "@/components/member-nav";

export default function AppSectionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col">
      <div className="flex-1 pb-28">{children}</div>
      <MemberNav />
    </div>
  );
}
