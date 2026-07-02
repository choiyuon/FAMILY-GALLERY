"use client";

import { useState } from "react";
import { UploadDialog } from "./upload-dialog";

export function UploadFab() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="cursor-pointer fixed bottom-6 left-6 z-40 w-14 h-14 rounded-full bg-[var(--color-gold)] text-[var(--color-overlay-fg)] shadow-lg flex items-center justify-center text-2xl hover:bg-[var(--color-gold-soft)] transition-colors"
        aria-label="업로드"
      >
        +
      </button>
      {open && <UploadDialog onClose={() => setOpen(false)} />}
    </>
  );
}
