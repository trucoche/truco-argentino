// services/tiendaPacks.js — Pase 768: tienda de packs completos (paño + marcador + adorno + dorso + carteles) en la WEB.
// Misma lógica que hooks/useTiendaPacks.ts de la app (Pase 767). Todo lo decide el servidor (TIENDA_PACKS_ACTIVA en Railway): con la tienda
// apagada `activa` viene en false y el juego se ve exactamente como siempre. El estado se guarda en memoria y en sessionStorage (por usuario)
// para que la escena del juego lo tenga disponible apenas se crea, aunque la página se recargue dentro de una partida.
import { API_URL } from '../config';

export const PIEZAS_MESA = ['pano', 'marcador', 'adorno', 'cartel', 'dorso'];
const EVENTO = 'tc-tienda-packs';
const CLAVE = (id) => `tc_tienda_packs_${id}`;
const VACIO = { cargado: false, activa: false, precio: 600, saldo: 0, packs: [], mesa: {} };

let estado = VACIO;
let usuarioDelEstado = null;

function publicar(nuevo, usuarioId) {
  estado = nuevo;
  if (usuarioId != null) {
    try { window.sessionStorage.setItem(CLAVE(usuarioId), JSON.stringify(nuevo)); } catch (e) { /* sin almacenamiento */ }
  }
  try { window.dispatchEvent(new CustomEvent(EVENTO, { detail: nuevo })); } catch (e) { /* sin eventos */ }
}

// Estado actual para ese usuario (lo último guardado si todavía no se consultó al servidor en esta carga).
export function estadoTienda(usuarioId) {
  if (usuarioId == null) return VACIO;
  if (usuarioDelEstado !== usuarioId) {
    usuarioDelEstado = usuarioId;
    try {
      const guardado = JSON.parse(window.sessionStorage.getItem(CLAVE(usuarioId)) || 'null');
      estado = guardado && typeof guardado === 'object' ? { ...VACIO, ...guardado } : VACIO;
    } catch (e) { estado = VACIO; }
  }
  return estado;
}

export function suscribirTienda(fn) {
  const oyente = (e) => fn(e.detail);
  window.addEventListener(EVENTO, oyente);
  return () => window.removeEventListener(EVENTO, oyente);
}

export function limpiarTiendaPacks() {
  usuarioDelEstado = null;
  estado = VACIO;
  try { Object.keys(window.sessionStorage).filter((k) => k.startsWith('tc_tienda_packs_')).forEach((k) => window.sessionStorage.removeItem(k)); } catch (e) { /* nada */ }
  try { window.dispatchEvent(new CustomEvent(EVENTO, { detail: VACIO })); } catch (e) { /* nada */ }
}

const cab = (token) => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` });

let ultimaCarga = 0;
// Pase 773: lo que cada cuenta armó puede cambiar desde otro dispositivo, así que se vuelve a preguntar al cambiar de pantalla (máx. una vez cada 10 s salvo `forzar`).
export async function cargarTiendaPacks(token, usuarioId, forzar = false) {
  if (!token || usuarioId == null) return estado;
  estadoTienda(usuarioId);
  if (!forzar && Date.now() - ultimaCarga < 10000) return estado;
  ultimaCarga = Date.now();
  try {
    const res = await fetch(`${API_URL}/api/tienda/packs`, { headers: cab(token) });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data && data.activa) {
      publicar({
        cargado: true, activa: true,
        precio: Number(data.precio) || 600,
        saldo: Number(data.saldo) || 0,
        packs: Array.isArray(data.packs) ? data.packs : [],
        mesa: data.mesa && typeof data.mesa === 'object' ? data.mesa : {},
      }, usuarioId);
    } else if (res.ok) {
      publicar({ ...VACIO, cargado: true }, usuarioId);   // tienda apagada para este jugador
    }
  } catch (e) { /* sin red: queda lo que había */ }
  return estado;
}

export async function comprarPackTienda(token, usuarioId, packId) {
  try {
    const res = await fetch(`${API_URL}/api/tienda/packs/${encodeURIComponent(packId)}/comprar`, { method: 'POST', headers: cab(token) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, mensaje: data.error || 'No se pudo comprar el pack. Probá de nuevo.' };
    await cargarTiendaPacks(token, usuarioId, true);
    return { ok: true, mensaje: data.mensaje || 'Pack comprado' };
  } catch (e) {
    return { ok: false, mensaje: 'Sin conexión. Probá de nuevo en un rato.' };
  }
}

export async function guardarMesaTienda(token, usuarioId, parcial) {
  const antes = estado;
  publicar({ ...estado, mesa: { ...estado.mesa, ...parcial } }, usuarioId);   // se ve al instante; si el servidor la rechaza se vuelve atrás
  try {
    const res = await fetch(`${API_URL}/api/tienda/mesa`, { method: 'PUT', headers: cab(token), body: JSON.stringify(parcial) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { publicar(antes, usuarioId); return { ok: false, mensaje: data.error || 'No se pudo guardar tu mesa.' }; }
    if (data.mesa && typeof data.mesa === 'object') publicar({ ...estado, mesa: data.mesa }, usuarioId);
    return { ok: true, mensaje: data.mensaje || 'Mesa guardada' };
  } catch (e) {
    publicar(antes, usuarioId);
    return { ok: false, mensaje: 'Sin conexión. No se guardó el cambio.' };
  }
}
