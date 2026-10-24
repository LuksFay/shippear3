import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/fusion-engine.css";
import "./styles/app.css";
import App from "./App.jsx";

// Si hubo un deploy mientras la pestaña estaba abierta, se recarga al volver a ella
// (el chat está guardado en el servidor, no se pierde nada). Evita que una versión vieja hable con la API nueva.
const actual = document.querySelector('script[type="module"][src*="/assets/"]')?.getAttribute("src");
const revisarVersion = async () => {
  if (!actual || document.visibilityState !== "visible" || document.querySelector(".is-recording, .typing")) return;
  try {
    const html = await (await fetch("/", { cache: "no-store" })).text();
    const nuevo = html.match(/<script[^>]+type="module"[^>]+src="([^"]*\/assets\/[^"]+)"/)?.[1];
    if (nuevo && nuevo !== actual) location.reload();
  } catch {
    /* sin red: se reintenta en la próxima vuelta */
  }
};
document.addEventListener("visibilitychange", revisarVersion);
setInterval(revisarVersion, 5 * 60 * 1000);

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
