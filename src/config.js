// Config central del frontend. Todo lo que necesite hablar con el backend
// (fetch normal o socket.io) importa esto en vez de hardcodear localhost.
//
// Orden de prioridad:
//   1) REACT_APP_API_URL (en .env de la web) — si está, manda siempre.
//   2) `npm start` (desarrollo): el backend local, en el mismo host desde el
//      que abriste la web + puerto 3001. Así web y celular hablan con el MISMO
//      backend/base de datos y pueden jugar entre sí.
//   3) Build de producción: el backend de Railway.
// (CRA solo expone variables REACT_APP_*; EXPO_PUBLIC_* no llega al navegador.)
const PRODUCCION = "https://truco-backend-production-e5dc.up.railway.app";

function resolverApiUrl() {
  const env = process.env.REACT_APP_API_URL;
  if (env && !env.includes("tu-backend")) return env.replace(/\/+$/, "");
  if (process.env.NODE_ENV === "development" && typeof window !== "undefined") {
    return `http://${window.location.hostname}:3001`;
  }
  return PRODUCCION;
}

export const API_URL = resolverApiUrl();
