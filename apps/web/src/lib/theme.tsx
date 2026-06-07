import type { ReactNode } from "react";
import { useEffect } from "react";

import { applyTheme, currentTheme } from "./theme-mode";

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  useEffect(() => {
    const sync = () => applyTheme(currentTheme());
    sync();
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  return <>{children}</>;
};
