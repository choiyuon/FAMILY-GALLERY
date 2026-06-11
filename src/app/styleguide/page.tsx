import { notFound } from "next/navigation";
import { Topbar } from "@/components/design/topbar";
import { Hero } from "@/components/design/hero";
import { MasonryLayout } from "@/components/design/masonry-layout";
import { PillButton } from "@/components/design/pill-button";
import { UnderlineInput } from "@/components/design/underline-input";
import { ClientChipDemo } from "./_chip-demo";

const SEEDS = ["s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8", "s9", "s10", "s11", "s12"];

export default function StyleguidePage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return (
    <main className="min-h-screen">
      <Topbar
        navItems={[
          { href: "/gallery", label: "사진" },
          { href: "/admin", label: "관리" },
        ]}
        cta={<PillButton>업로드</PillButton>}
      />

      <Hero title="가족 갤러리." subtitle="— 우리가 모은 순간들 —" />

      <ClientChipDemo />

      <MasonryLayout>
        {SEEDS.map((seed, i) => {
          const heights = [400, 200, 320, 480, 240, 360, 200, 280, 400, 220, 320, 260];
          const h = heights[i % heights.length];
          return (
            <img
              key={seed}
              src={`https://picsum.photos/seed/${seed}/400/${h}`}
              alt={`sample-${seed}`}
              className="w-full block rounded-sm"
              loading="lazy"
            />
          );
        })}
      </MasonryLayout>

      <section className="px-6 md:px-10 py-10 border-t border-[var(--color-border)]">
        <h2 className="font-serif text-2xl mb-4">PillButton</h2>
        <div className="flex flex-wrap gap-3">
          <PillButton>primary</PillButton>
          <PillButton variant="ghost">ghost</PillButton>
          <PillButton disabled>disabled</PillButton>
        </div>
      </section>

      <section className="px-6 md:px-10 py-10 border-t border-[var(--color-border)]">
        <h2 className="font-serif text-2xl mb-4">UnderlineInput</h2>
        <div className="max-w-sm flex flex-col gap-4">
          <UnderlineInput placeholder="이메일" />
          <UnderlineInput type="password" placeholder="비밀번호" />
        </div>
      </section>
    </main>
  );
}
