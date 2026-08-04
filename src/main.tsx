import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { AppErrorBoundary } from "./components/AppErrorBoundary";
import "./styles.css";

const container = document.getElementById("root");

if (!container) {
  document.body.innerHTML =
    '<div style="font-family:system-ui;padding:2rem;text-align:center">Unable to start the app: root element missing.</div>';
} else {
  createRoot(container).render(
    <StrictMode>
      <AppErrorBoundary>
        <App />
      </AppErrorBoundary>
    </StrictMode>,
  );
}
