import { X } from "lucide-react";
import { useT } from "../i18n";
import type { RecentArchive } from "../lib/storage";
import { InkFileGlyph } from "./art";

function fmtBytes(b: number): string {
  if (b <= 0) return "—";
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1073741824) return `${(b / 1048576).toFixed(1)} MB`;
  return `${(b / 1073741824).toFixed(2)} GB`;
}
function fmtDate(ms: number): string {
  try {
    return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(ms));
  } catch { return ""; }
}

export default function RecentArchives({
  items, onOpen, onRemove,
}: {
  items: RecentArchive[];
  onOpen: (r: RecentArchive) => void;
  onRemove: (path: string) => void;
}) {
  const t = useT();
  if (!items.length) return null;

  return (
    <div className="px-8 pb-5 pt-1 shrink-0">
      <p className="text-[11px] font-semibold tracking-[0.14em] text-ink-faint uppercase mb-2.5">
        {t("recent.title")}
      </p>
      <div className="flex gap-2.5 overflow-x-auto pb-1">
        {items.slice(0, 10).map(r => (
          <div key={r.path} className="ink-card group !p-3 w-48 shrink-0 cursor-pointer" onClick={() => onOpen(r)}>
            <InkFileGlyph size={26} />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium text-ink truncate font-mono">{r.name}</p>
              <p className="text-[11px] text-ink-faint truncate">{fmtDate(r.date)} · {fmtBytes(r.size)}</p>
            </div>
            <button
              onClick={e => { e.stopPropagation(); onRemove(r.path); }}
              className="ink-card-remove" title={t("recent.remove")}
            >
              <X size={13} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
