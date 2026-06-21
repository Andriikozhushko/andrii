import { useT } from "../i18n";
import { setOnboarded } from "../lib/storage";
import { ArchiveBox, WaxSeal, PaperBundle } from "./art";

/** First-run welcome — three steps, then "Get started". */
export default function Onboarding({ onDone }: { onDone: () => void }) {
  const t = useT();
  const finish = () => { setOnboarded(true); onDone(); };

  const steps = [
    { art: <ArchiveBox variant="open" size={66} />, title: t("onboarding.step1Title"), desc: t("onboarding.step1Desc") },
    { art: <WaxSeal size={62} />,                   title: t("onboarding.step2Title"), desc: t("onboarding.step2Desc") },
    { art: <PaperBundle size={62} />,               title: t("onboarding.step3Title"), desc: t("onboarding.step3Desc") },
  ];

  return (
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center px-8 bg-bg animate-fade-in"
      style={{
        backgroundImage:
          "radial-gradient(1100px 520px at 18% -8%, rgba(46,94,115,0.07), transparent 60%)," +
          "radial-gradient(900px 480px at 100% 0%, rgba(178,58,53,0.04), transparent 58%)",
      }}>
      <div className="w-full max-w-md text-center animate-scale-in">
        <h1 className="font-serif text-[34px] font-semibold text-ink leading-tight">{t("onboarding.welcome")}</h1>
        <p className="text-ink-soft mt-2">{t("onboarding.subtitle")}</p>

        <div className="mt-9 space-y-5 text-left">
          {steps.map((s, i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="shrink-0 w-16 h-16 flex items-center justify-center">{s.art}</div>
              <div className="min-w-0">
                <p className="font-semibold text-ink">{i + 1}. {s.title}</p>
                <p className="text-[13px] text-ink-soft leading-relaxed">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <button onClick={finish} className="btn-primary mt-10 w-full justify-center py-3">
          {t("onboarding.getStarted")}
        </button>
      </div>
    </div>
  );
}
