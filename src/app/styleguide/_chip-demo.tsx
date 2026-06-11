"use client";

import { useState } from "react";
import { ChipRow, type ChipItem } from "@/components/design/chip-row";

const CHIPS: ChipItem[] = [
  { id: "all", label: "전체" },
  { id: "photo", label: "사진" },
  { id: "video", label: "영상" },
  { id: "2024", label: "2024" },
  { id: "travel", label: "여행" },
  { id: "birthday", label: "생일" },
];

export function ClientChipDemo() {
  const [active, setActive] = useState("all");
  return <ChipRow items={CHIPS} activeId={active} onSelect={setActive} />;
}
