/**
 * ANDRII 04C — deterministic error mapping (04A trust rules in real code).
 *
 * Every backend failure maps to exactly one human cause via i18n. Same cause →
 * same words, always. No raw strings, no generic "something went wrong".
 */
import type { TFn } from "../i18n";

export function mapError(raw: string, t: TFn): string {
  const s = String(raw).toLowerCase();
  if (s.includes("invalid password") || s.includes("invalidpassword")) return t("open.errIncorrect");
  if (s.includes("invalidmagic") || s.includes("magic")) return t("open.errNotArchive");
  if (s.includes("unsupportedversion") || s.includes("unsupported")) return t("open.errVersion");
  if (s.includes("tamper") || s.includes("integrity") || s.includes("corrupt")) return t("open.errCorrupted");
  if (s.includes("os error 2") || s.includes("no such file") || s.includes("not found")) return t("open.errNotFound");
  if (s.includes("os error 5") || s.includes("permission") || s.includes("denied") || s.includes("access is denied"))
    return t("create.errWrite");
  return t("open.errFailed");
}
