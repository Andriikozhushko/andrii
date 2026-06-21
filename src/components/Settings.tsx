import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useI18n, LANGS } from "../i18n";
import { setOnboarded } from "../lib/storage";
import { ArchiveBox } from "./art";
import PasswordGenerator from "./PasswordGenerator";

interface AppInfo { version: string; format_version: number; }

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4 py-1">
      <span className="text-ink-faint">{k}</span>
      <span className="text-ink font-medium text-right">{v}</span>
    </div>
  );
}

export default function Settings({
  onBack, onReplayOnboarding,
}: {
  onBack: () => void;
  onReplayOnboarding: () => void;
}) {
  const { t, lang, setLang } = useI18n();
  const [info, setInfo] = useState<AppInfo | null>(null);

  useEffect(() => { invoke<AppInfo>("get_app_info").then(setInfo).catch(() => {}); }, []);

  return (
    <div className="canvas">
      <div className="canvas-body px-8 py-7">
        <div className="max-w-lg mx-auto w-full space-y-8">
          <h2 className="font-serif text-[28px] font-semibold tracking-tight text-ink">{t("settings.title")}</h2>

          {/* Language */}
          <section className="space-y-3">
            <div>
              <h3 className="text-[13px] font-semibold text-ink">{t("settings.language")}</h3>
              <p className="text-[12px] text-ink-faint">{t("settings.languageDesc")}</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {LANGS.map(l => (
                <button
                  key={l.code}
                  onClick={() => setLang(l.code)}
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-[13px] transition-colors
                    ${lang === l.code
                      ? "border-accent bg-accent-soft text-accent-text font-medium"
                      : "border-border-strong bg-surface text-ink hover:bg-hover"}`}
                >
                  <span>{l.native}</span>
                  {lang === l.code && <span className="w-2 h-2 rounded-full bg-accent" />}
                </button>
              ))}
            </div>
          </section>

          {/* Password generator */}
          <section className="space-y-3">
            <h3 className="text-[13px] font-semibold text-ink">{t("generator.title")}</h3>
            <PasswordGenerator />
          </section>

          {/* Replay onboarding */}
          <section>
            <button onClick={() => { setOnboarded(false); onReplayOnboarding(); }} className="btn-secondary text-sm">
              {t("settings.showOnboarding")}
            </button>
          </section>

          {/* About */}
          <section className="space-y-3">
            <h3 className="text-[13px] font-semibold text-ink">{t("settings.about")}</h3>
            <div className="rounded-2xl border border-border-strong bg-surface shadow-card p-5">
              <div className="flex items-center gap-3.5">
                <ArchiveBox variant="sealed" size={58} />
                <div>
                  <p className="font-serif text-[19px] font-semibold text-ink">ANDRII</p>
                  <p className="text-[12px] text-ink-soft">{t("about.tagline")}</p>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-border space-y-0.5 text-[13px]">
                <Row k={t("about.version")} v={info ? `v${info.version}` : "—"} />
                <Row k={t("about.author")} v="Andrii Kozhushko" />
                <Row k={t("about.license")} v="MIT" />
                <Row k={t("about.website")} v={t("about.websiteValue")} />
                <Row k={t("about.formatVersion")} v={info ? t("details.formatVersion", { n: info.format_version }) : "—"} />
              </div>
            </div>
          </section>
        </div>
      </div>

      <div className="bottom-bar">
        <button onClick={onBack} className="btn-ghost text-sm">← {t("common.back")}</button>
      </div>
    </div>
  );
}
