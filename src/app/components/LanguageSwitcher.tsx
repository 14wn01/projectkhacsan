import { Languages } from "lucide-react";
import { Lang, useI18n } from "../lib/i18n";

const OPTIONS: Array<{ value: Lang; label: string; short: string }> = [
  { value: "vi", label: "Tiếng Việt", short: "VI" },
  { value: "en", label: "English", short: "EN" },
];

/**
 * Bộ chuyển ngôn ngữ Việt / Anh.
 * Lựa chọn được lưu lại nên khách nước ngoài quay lại không phải chọn lại.
 */
export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { lang, setLang } = useI18n();

  if (compact) {
    return (
      <div className="lux-lang" role="group" aria-label="Ngôn ngữ">
        {OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => setLang(o.value)}
            aria-label={o.label}
            aria-pressed={lang === o.value}
          >
            {o.short}
          </button>
        ))}
      </div>
    );
  }

  return (
    <label className="inline-flex items-center gap-2 text-sm">
      <Languages className="size-4 text-muted-foreground" />
      <select
        value={lang}
        onChange={(e) => setLang(e.target.value as Lang)}
        className="rounded-lg border bg-white px-2 py-1.5 text-sm"
      >
        {OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
