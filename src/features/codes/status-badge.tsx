import { CirclePause, CircleCheck, Lock } from "lucide-react";
import type { Messages } from "@/i18n/messages";
import type { CodeStatus } from "@/lib/api/types";

const ICONS = { active: CircleCheck, paused: CirclePause, locked: Lock } as const;

/** A code's status as icon and word, never color alone. */
export function StatusBadge({ status, t }: { status: CodeStatus; t: Messages["codes"] }) {
  const Icon = ICONS[status];
  const tone = status === "active" ? "text-accent" : status === "locked" ? "text-danger" : "text-muted";
  return (
    <span className="inline-flex w-fit items-center gap-1.5 text-sm font-medium">
      <Icon aria-hidden="true" className={`size-4 ${tone}`} />
      {t.status[status]}
    </span>
  );
}
