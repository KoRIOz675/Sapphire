import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import App from "./App";
import "./i18n";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

function removeSplash() {
  const splash = document.getElementById("splash");
  if (!splash) return;
  // Complete the progress bar to 100% before fading out
  const fill = document.getElementById("splash-bar-fill");
  if (fill) {
    fill.style.transition = "width 0.3s ease";
    fill.style.width = "100%";
  }
  setTimeout(() => {
    splash.classList.add("fade-out");
    setTimeout(() => splash.remove(), 420);
  }, 320);
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);

// Remove splash once React has painted its first frame
requestAnimationFrame(() => requestAnimationFrame(removeSplash));
