// Pase 724: aviso de instalar la web en el celular (Agregar a pantalla de inicio).
// - Android/Chrome: se captura `beforeinstallprompt` apenas carga la página (puede dispararse antes de que el aviso exista) y se usa al tocar el botón.
// - iPhone/iPad: no hay evento; se muestra la indicación Compartir → "Agregar a inicio".
// - Solo en web móvil, fuera de modo standalone y una sola vez (el descarte queda en localStorage).
const CLAVE_DESCARTE = 'truco_instalar_web_descartado';

let eventoInstalacion = null;
const oyentes = new Set();
const avisar = () => oyentes.forEach((fn) => { try { fn(); } catch (e) { /* oyente roto */ } });

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    eventoInstalacion = e;
    avisar();
  });
  window.addEventListener('appinstalled', () => {
    eventoInstalacion = null;
    try { localStorage.setItem(CLAVE_DESCARTE, '1'); } catch (e) { /* sin storage */ }
    avisar();
  });
}

export function suscribirInstalacion(fn) {
  oyentes.add(fn);
  return () => oyentes.delete(fn);
}

function esStandalone() {
  try {
    return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
  } catch (e) { return false; }
}

function esMovil() {
  try {
    const ua = window.navigator.userAgent || '';
    return /android|iphone|ipad|ipod/i.test(ua) || (window.matchMedia && window.matchMedia('(pointer: coarse)').matches && window.innerWidth < 900);
  } catch (e) { return false; }
}

export function esIOS() {
  const ua = (window.navigator && window.navigator.userAgent) || '';
  return /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && window.navigator.maxTouchPoints > 1);
}

export function fueDescartado() {
  try { return localStorage.getItem(CLAVE_DESCARTE) === '1'; } catch (e) { return false; }
}

export function descartarAvisoInstalar() {
  try { localStorage.setItem(CLAVE_DESCARTE, '1'); } catch (e) { /* sin storage */ }
}

// 'android' (hay instalación nativa lista), 'ios' (indicación manual) o null (no mostrar).
export function tipoAvisoInstalar() {
  if (typeof window === 'undefined' || window.ReactNativeWebView) return null;
  if (fueDescartado() || esStandalone() || !esMovil()) return null;
  if (esIOS()) return 'ios';
  return eventoInstalacion ? 'android' : null;
}

export async function instalarWeb() {
  if (!eventoInstalacion) return false;
  const e = eventoInstalacion;
  eventoInstalacion = null;
  try {
    e.prompt();
    const r = await e.userChoice;
    if (r && r.outcome === 'accepted') descartarAvisoInstalar();
    return !!(r && r.outcome === 'accepted');
  } catch (err) { return false; }
}
