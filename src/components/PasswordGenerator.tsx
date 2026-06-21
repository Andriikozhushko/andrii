import { useState, useEffect, useCallback } from "react";
import { Copy, CheckCheck, RefreshCw } from "lucide-react";
import { useT } from "../i18n";

const WORDS = [
  "river", "copper", "maple", "ember", "harbor", "lantern", "meadow", "pebble",
  "willow", "cobalt", "marble", "cedar", "falcon", "ginger", "indigo", "juniper",
  "kettle", "lemon", "marrow", "nutmeg", "orchard", "pewter", "quartz", "raven",
  "saffron", "thistle", "umber", "velvet", "walnut", "yarrow", "zephyr", "amber",
  "birch", "clover", "dapple", "elm", "fennel", "garnet", "hazel", "ivory",
  "jasper", "kelp", "linen", "mango", "nectar", "onyx", "poppy", "quill",
  "rust", "slate", "tulip", "vetch", "wheat", "anvil", "brook", "comet",
];
const SYMBOLS = "!@#$%&*?-_=+";
const RANDOM_POOL = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%&*?-_";

function randInt(max: number): number {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0] % max;
}
function pick<T>(arr: T[] | string): T | string {
  return (arr as T[])[randInt(arr.length)];
}
function cap(s: string) { return s.charAt(0).toUpperCase() + s.slice(1); }

function genPhrase(): string {
  const words = Array.from({ length: 4 }, () => cap(pick(WORDS) as string));
  const num = 10 + randInt(90);
  const sym = pick(SYMBOLS) as string;
  return `${words.join("-")}-${num}${sym}`;
}
function genRandom(len: number): string {
  let out = "";
  for (let i = 0; i < len; i++) out += RANDOM_POOL[randInt(RANDOM_POOL.length)];
  return out;
}

export default function PasswordGenerator({ onUse }: { onUse: (pw: string) => void }) {
  const t = useT();
  const [mode, setMode] = useState<"memorable" | "random">("memorable");
  const [len, setLen] = useState(20);
  const [pw, setPw] = useState("");
  const [copied, setCopied] = useState(false);

  const generate = useCallback(() => {
    setPw(mode === "memorable" ? genPhrase() : genRandom(len));
  }, [mode, len]);

  useEffect(() => { generate(); }, [generate]);

  const copy = () => {
    navigator.clipboard.writeText(pw);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="rounded-2xl border border-border-strong bg-surface shadow-card p-4 space-y-3.5 animate-scale-in">
      {/* mode toggle */}
      <div className="flex gap-1 p-1 rounded-xl bg-surface-sunken">
        {(["memorable", "random"] as const).map(m => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`flex-1 py-1.5 rounded-lg text-[13px] font-medium transition-colors
              ${mode === m ? "bg-surface text-ink shadow-card" : "text-ink-faint hover:text-ink"}`}
          >
            {t(`generator.${m}`)}
          </button>
        ))}
      </div>

      {/* output */}
      <div className="flex items-center gap-2 rounded-xl border border-border bg-bg px-3 py-2.5">
        <span className="flex-1 font-mono text-[13px] text-ink break-all leading-snug">{pw}</span>
        <button onClick={generate} title={t("generator.regenerate")} className="p-1.5 rounded-lg text-ink-faint hover:text-ink hover:bg-hover transition-colors">
          <RefreshCw size={15} />
        </button>
        <button onClick={copy} title={t("common.copy")} className="p-1.5 rounded-lg text-ink-faint hover:text-ink hover:bg-hover transition-colors">
          {copied ? <CheckCheck size={15} className="text-safe" /> : <Copy size={15} />}
        </button>
      </div>

      {/* length (random only) */}
      {mode === "random" && (
        <div className="flex items-center gap-3 px-1">
          <span className="text-[12px] text-ink-soft shrink-0">{t("generator.length")}</span>
          <input
            type="range" min={8} max={40} value={len}
            onChange={e => setLen(Number(e.target.value))}
            className="flex-1 accent-accent"
          />
          <span className="text-[12px] font-mono text-ink tabular-nums w-6 text-right">{len}</span>
        </div>
      )}

      <button onClick={() => onUse(pw)} className="btn-primary w-full justify-center">
        {t("generator.useThis")}
      </button>
    </div>
  );
}
