import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Auto-reload jika Vite gagal memuat chunk (chunk stale setelah server restart)
window.addEventListener("vite:preloadError", () => {
  window.location.reload();
});

createRoot(document.getElementById("root")!).render(<App />);
