// Pase 313: assets ilustrados del sistema de rangos (anillo de la foto, panel del
// header y logo del rango), en /assets/images/rangos/. Fondo transparente y
// recortados (los originales venían con fondo blanco). Espejo de
// trucoche_app/constants/rangos.ts.
//
// - panel: reemplaza a tarjeta-perfil.png en el header (círculo de foto, placa
//   del nombre, medallón de saldo y botón "+").
// - anillo: aro que rodea la foto de perfil; `hueco` = proporción del diámetro
//   del aro que ocupa su agujero.
// - logo: emblema del rango.
// Los paneles claros (madera clara, plata, oro) llevan texto oscuro.

const TEXTO_CLARO = '#FFF8ED';
const HALO_OSCURO = '#4A2C2A';
const TEXTO_OSCURO = '#3A1E0A';
const HALO_CLARO = '#FFF3D6';
const SALDO_CLARO = '#FFE7B3';

const BASE = '/assets/images/rangos';
const ficha = (slug, hueco, nombreOscuro, saldoOscuro) => ({
  panel: `${BASE}/rango-${slug}-panel.png`,
  anillo: `${BASE}/rango-${slug}-anillo.png`,
  logo: `${BASE}/rango-${slug}-logo.png`,
  hueco,
  nombreColor: nombreOscuro ? TEXTO_OSCURO : TEXTO_CLARO,
  nombreHalo: nombreOscuro ? HALO_CLARO : HALO_OSCURO,
  saldoColor: saldoOscuro ? TEXTO_OSCURO : SALDO_CLARO,
});

export const RANGOS_UI = {
  1: ficha('01-mancebo', 0.628, true, false),
  2: ficha('02-paisano', 0.579, false, false),
  3: ficha('03-resero', 0.629, false, false),
  4: ficha('04-gaucho', 0.644, false, false),
  5: ficha('05-capataz', 0.651, false, false),
  6: ficha('06-baqueano', 0.654, false, false),
  7: ficha('07-payador', 0.652, true, false),
  8: ficha('08-caudillo', 0.702, true, false),
  9: ficha('09-don-segundo', 0.763, true, true),
  10: ficha('10-martin-fierro', 0.756, true, false),
};

// `usuario.rango` lo calcula el backend (src/rangos.js) en GET /api/auth/perfil.
// Mientras no llegó, se usa el rango 1.
export function rangoUi(rango) {
  return RANGOS_UI[Number(rango && rango.id)] || RANGOS_UI[1];
}
