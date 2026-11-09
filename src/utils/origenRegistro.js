// Pase 706: origen del registro. Si la primera visita viene con ?utm_source=...&utm_medium=... (por ejemplo desde la bio de
// Instagram) se guarda en el navegador y se manda al crear la cuenta. Sin scripts de terceros: solo localStorage propio.
const CLAVE = 'truco_origen';

function limpiar(valor) {
  if (typeof valor !== 'string') return null;
  const s = valor.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 40);
  return s || null;
}

// Se llama una vez al arrancar. Solo guarda el PRIMER origen que ve el navegador; no pisa uno ya guardado.
export function guardarOrigenInicial() {
  try {
    if (localStorage.getItem(CLAVE)) return;
    const p = new URLSearchParams(window.location.search);
    const utm_source = limpiar(p.get('utm_source'));
    const utm_medium = limpiar(p.get('utm_medium'));
    if (!utm_source && !utm_medium) return;
    localStorage.setItem(CLAVE, JSON.stringify({ utm_source, utm_medium }));
  } catch (_) { /* navegador sin almacenamiento: no pasa nada */ }
}

// Devuelve { utm_source, utm_medium } (o {} si no hay) para sumar al cuerpo de registro / login social.
export function leerOrigen() {
  try {
    const crudo = localStorage.getItem(CLAVE);
    if (!crudo) return {};
    const o = JSON.parse(crudo) || {};
    const salida = {};
    if (limpiar(o.utm_source)) salida.utm_source = limpiar(o.utm_source);
    if (limpiar(o.utm_medium)) salida.utm_medium = limpiar(o.utm_medium);
    return salida;
  } catch (_) { return {}; }
}
