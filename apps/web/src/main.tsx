import { QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import ReactDOM from "react-dom/client";
import { Toaster } from "sonner";

import { AppRouter } from "./app/router";
import { queryClient } from "./lib/query-client";
import { ThemeProvider } from "./lib/theme";
import "./lib/i18n";
import "./styles/global.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AppRouter />
      </ThemeProvider>
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  </React.StrictMode>
);
