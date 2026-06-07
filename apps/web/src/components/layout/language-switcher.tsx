import { Languages } from "lucide-react";
import { useTranslation } from "react-i18next";

import { changeLanguage } from "../../lib/i18n";

const languages = [
  { code: "en", label: "EN" },
  { code: "hi", label: "HI" },
  { code: "mr", label: "MR" },
  { code: "ta", label: "TA" }
] as const;

export const LanguageSwitcher = () => {
  const { i18n } = useTranslation();

  return (
    <label className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2 py-1 text-sm dark:border-slate-800 dark:bg-slate-950">
      <Languages className="h-4 w-4 text-teal-600" />
      <select
        className="bg-transparent text-sm outline-none"
        value={i18n.language}
        onChange={(event) => void changeLanguage(event.target.value as "en" | "hi" | "mr" | "ta")}
      >
        {languages.map((language) => (
          <option key={language.code} value={language.code}>
            {language.label}
          </option>
        ))}
      </select>
    </label>
  );
};
