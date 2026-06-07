export type ThemeMode = "light" | "dark" | "system";

export const themeStorageKey = "pharmacy-os-theme";

export const applyTheme = (mode: ThemeMode): void => {
  localStorage.setItem(themeStorageKey, mode);
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.classList.toggle("dark", mode === "dark" || (mode === "system" && prefersDark));
};

export const currentTheme = (): ThemeMode => (localStorage.getItem(themeStorageKey) as ThemeMode | null) ?? "system";
