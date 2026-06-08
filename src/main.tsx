import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Catch and suppress benign sandboxed environment Vite WebSocket or network-dependent HMR connection errors/rejections
if (typeof window !== "undefined") {
  const isViteWSError = (msg: string | undefined | null) => {
    if (!msg) return false;
    const lower = msg.toLowerCase();
    return (
      lower.includes("websocket") ||
      lower.includes("web socket") ||
      lower.includes("vite") ||
      lower.includes("hmr") ||
      lower.includes("connection refused") ||
      lower.includes("socket") ||
      lower.includes("ws://") ||
      lower.includes("wss://") ||
      lower.includes("unopened") ||
      lower.includes("closed without opened")
    );
  };

  window.addEventListener("error", (event) => {
    const msg = event.message || (event.error && event.error.message);
    if (isViteWSError(msg)) {
      event.stopImmediatePropagation();
      event.preventDefault();
    }
  }, true);

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    if (!reason) return;

    const msg = reason instanceof Error ? reason.message : (typeof reason === "string" ? reason : (reason as any).message || String(reason));
    const stack = reason instanceof Error && reason.stack ? reason.stack : "";

    if (isViteWSError(msg) || isViteWSError(stack)) {
      event.stopImmediatePropagation();
      event.preventDefault();
      return;
    }

    try {
      const str = JSON.stringify(reason);
      if (isViteWSError(str)) {
        event.stopImmediatePropagation();
        event.preventDefault();
      }
    } catch (_) {}
  }, true);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

