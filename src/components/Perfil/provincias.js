// Pase 370: las 24 jurisdicciones de Argentina (misma lista que valida el
// backend en truco-backend/src/provincias.js).
export const PROVINCIAS = [
  'Buenos Aires', 'Ciudad Autónoma de Buenos Aires', 'Catamarca', 'Chaco', 'Chubut',
  'Córdoba', 'Corrientes', 'Entre Ríos', 'Formosa', 'Jujuy', 'La Pampa', 'La Rioja',
  'Mendoza', 'Misiones', 'Neuquén', 'Río Negro', 'Salta', 'San Juan', 'San Luis',
  'Santa Cruz', 'Santa Fe', 'Santiago del Estero', 'Tierra del Fuego', 'Tucumán',
];

// "Paso del Rey, Buenos Aires" / "Buenos Aires" / '' según lo que haya cargado.
export function textoZona(u) {
  if (!u?.provincia) return '';
  return u.localidad ? `${u.localidad}, ${u.provincia}` : u.provincia;
}
