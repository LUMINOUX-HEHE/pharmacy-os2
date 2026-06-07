import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import { resources } from "../locales/resources";

const savedLanguage = localStorage.getItem("pharmacy-os-language") ?? "en";

void i18n.use(initReactI18next).init({
  resources,
  lng: savedLanguage,
  fallbackLng: "en",
  interpolation: {
    escapeValue: false
  }
});

export const changeLanguage = async (language: "en" | "hi" | "mr" | "ta"): Promise<void> => {
  localStorage.setItem("pharmacy-os-language", language);
  await i18n.changeLanguage(language);
};

export { i18n };
