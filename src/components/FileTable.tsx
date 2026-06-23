import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, X } from "lucide-react";
import { InkFileGlyph } from "./art";
import { useT } from "../i18n";

/** One row in a file table — used both pre-seal (Create) and post-unlock (Open). */
export interface FileItem {
  key: string;        // unique id (the path)
  name: string;       // basename shown in mono
  sub?: string;       // secondary line (full archive path)
  size: number;       // bytes (ignored when isDir)
  isDir?: boolean;
  date?: number;      // unix seconds, enables date sort when present
}

type SortKey = "name" | "size" | "date";

function formatBytes(b: number): string {
  if (b < 1024)       return `${b} B`;
  if (b < 1048576)    return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1073741824) return `${(b / 1048576).toFixed(1)} MB`;
  return `${(b / 1073741824).toFixed(2)} GB`;
}

interface FileTableProps {
  items: FileItem[];
  /** Show selection checkboxes + a select-all row (Open). */
  selectable?: boolean;
  selected?: Set<string>;
  onSelectedChange?: (s: Set<string>) => void;
  /** Per-row remove button (Create). */
  onRemove?: (key: string) => void;
  /** Right-hand toolbar slot; receives the currently-selected keys. */
  toolbarRight?: (selectedKeys: string[]) => React.ReactNode;
  /** Dim + block the list (e.g. while extracting). */
  busy?: boolean;
}

/**
 * The shared file browser: search box, name/size(/date) sorting and a scrollable
 * list of `.file-row`s. The same component backs the pre-seal review list and the
 * unlocked-archive view so they read identically.
 */
export default function FileTable({
  items, selectable = false, selected, onSelectedChange, onRemove, toolbarRight, busy = false,
}: FileTableProps) {
  const t = useT();
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortAsc, setSortAsc] = useState(true);
  const [search, setSearch]   = useState("");

  const hasDate = useMemo(() => items.some(i => i.date != null), [items]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return [...items]
      .filter(i => i.name.toLowerCase().includes(q) || (i.sub?.toLowerCase().includes(q) ?? false))
      .sort((a, b) => {
        let cmp = 0;
        if (sortKey === "name") cmp = a.name.localeCompare(b.name);
        if (sortKey === "size") cmp = a.size - b.size;
        if (sortKey === "date") cmp = (a.date ?? 0) - (b.date ?? 0);
        return sortAsc ? cmp : -cmp;
      });
  }, [items, search, sortKey, sortAsc]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortAsc(!sortAsc);
    else { setSortKey(k); setSortAsc(true); }
  };

  const sel = selected ?? new Set<string>();
  const setSel = (s: Set<string>) => onSelectedChange?.(s);
  const toggle = (key: string) => {
    const next = new Set(sel);
    next.has(key) ? next.delete(key) : next.add(key);
    setSel(next);
  };
  const allSelected = filtered.length > 0 && filtered.every(i => sel.has(i.key));
  const toggleAll = () =>
    setSel(allSelected ? new Set() : new Set(filtered.map(i => i.key)));

  const SortBtn = ({ k, label }: { k: SortKey; label: string }) => (
    <button onClick={() => toggleSort(k)} className="flex items-center gap-0.5 text-ink-faint hover:text-ink transition-colors">
      {label}
      {sortKey === k && (sortAsc ? <ChevronUp size={9} /> : <ChevronDown size={9} />)}
    </button>
  );

  return (
    <>
      {/* toolbar */}
      <div className="flex items-center gap-3 px-8 py-2.5 border-b border-border shrink-0">
        <input type="text" className="input-box py-1.5 px-3 text-xs w-44" placeholder={t("open.filter")}
          value={search} onChange={e => setSearch(e.target.value)} />
        <span className="text-xs text-ink-faint">
          {filtered.length !== items.length ? `${filtered.length} / ` : ""}{items.length}
        </span>
        <span className="flex gap-3 text-xs ml-1">
          <SortBtn k="name" label={t("open.colName")} />
          <SortBtn k="size" label={t("open.colSize")} />
          {hasDate && <SortBtn k="date" label={t("open.colDate")} />}
        </span>
        {toolbarRight && <div className="ml-auto flex items-center gap-2">{toolbarRight([...sel])}</div>}
      </div>

      {/* list */}
      <div className="flex-1 overflow-y-auto relative">
        {busy && <div className="absolute inset-0 z-10 bg-bg/55 animate-fade-in" />}
        <div className="px-8 py-1">
          {selectable && (
            <div className="file-row">
              <input type="checkbox" checked={allSelected} onChange={toggleAll} className="w-3.5 h-3.5 accent-accent rounded" />
              <span className="text-xs text-ink-faint flex-1">{t("open.selectAll")}</span>
            </div>
          )}
          {filtered.map(item => {
            const checked = sel.has(item.key);
            return (
              <div key={item.key}
                className={`file-row rounded-lg -mx-2 px-2 transition-colors ${selectable ? "cursor-pointer hover:bg-hover/60" : "group"}`}
                onClick={selectable ? () => toggle(item.key) : undefined}>
                {selectable && (
                  <input type="checkbox" checked={checked} onChange={() => toggle(item.key)}
                    onClick={e => e.stopPropagation()} className="w-3.5 h-3.5 accent-accent rounded shrink-0" />
                )}
                <InkFileGlyph size={18} tint={item.isDir ? "#C9760E" : "#5B5347"} className="shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-sm text-ink truncate">{item.name}</div>
                  {item.sub && item.sub !== item.name && (
                    <div className="text-xs text-ink-faint truncate leading-tight">{item.sub}</div>
                  )}
                </div>
                <span className="font-mono text-xs text-ink-faint shrink-0 tabular-nums">
                  {item.isDir ? "—" : formatBytes(item.size)}
                </span>
                {onRemove && (
                  <button
                    onClick={e => { e.stopPropagation(); onRemove(item.key); }}
                    className="shrink-0 w-6 h-6 flex items-center justify-center rounded-lg text-ink-faint opacity-0 group-hover:opacity-100 hover:text-wax hover:bg-wax/10 transition-all"
                    aria-label="remove"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
