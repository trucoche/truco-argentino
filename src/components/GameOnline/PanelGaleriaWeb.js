import React, { useState } from 'react';
import { ESCENAS_FOTO, getConfigFoto, guardarConfigFoto } from '../../constants/modoFoto';
import { IDS_PACK, PACKS, leerPackMesa, guardarPackMesa } from '../../constants/packsMesa';

// Pase 728: GALERÍA de la web (solo admin; se abre desde Ajustes → Admin → Modo foto → "Abrir galería").
// Panel flotante sobre la mesa simulada (/?preview=<modo>&foto=1&galeria=1) para cambiar en vivo lo que pasa en la partida y revisar cómo se ve:
// modo, escena (cantos), cartas jugadas de cada grupo, turno, mano, flor, señas, marcador, objetivo y puntos. Guarda la configuración en
// localStorage (misma clave del formulario) y le pide a la escena que rearme el estado simulado (`recargarEstadoFoto`). Mismas variantes que la
// galería de la app (Pase 727).

const NOMBRE_CORTO = {
  mesa: 'Mesa en juego', truco: 'Resp. Truco', retruco: 'Resp. Retruco', 'vale-cuatro': 'Resp. Vale 4', envido: 'Resp. Envido', 'real-envido': 'Resp. Real',
  'falta-envido': 'Resp. Falta', flor: 'Resp. Flor', 'contra-flor': 'Resp. Contra flor', 'contra-flor-resto': 'Resp. C. flor al resto',
  'declarar-envido': 'Declarar: ¿cuánto?', 'declarar-van': 'Declarar: van 24', 'esperando-declaracion': 'Esperando declaración',
  'esperando-truco': 'Mi truco esperando', 'esperando-envido': 'Mi envido esperando', 'esperando-flor': 'Mi flor esperando',
};

const estilos = {
  abrir: { position: 'fixed', right: 6, top: '46%', zIndex: 96, background: 'rgba(20,12,8,0.88)', border: '1.5px solid #FFB627', borderRadius: 10, padding: '6px 8px', color: '#FFD668', fontWeight: 800, fontSize: 11, letterSpacing: 0.5, cursor: 'pointer', fontFamily: "'Fredoka', sans-serif" },
  panel: { position: 'fixed', left: 6, right: 6, zIndex: 96, maxWidth: 520, margin: '0 auto', maxHeight: '52vh', overflowY: 'auto', background: 'rgba(20,12,8,0.94)', border: '1.5px solid rgba(255,182,39,0.6)', borderRadius: 14, padding: '8px 10px 12px', boxSizing: 'border-box' },
  cabecera: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, position: 'sticky', top: 0, background: 'rgba(20,12,8,0.97)', padding: '2px 0 4px', zIndex: 1 },
  titulo: { flex: 1, color: '#FFD668', fontWeight: 800, fontSize: 14, fontFamily: "'Fredoka', sans-serif" },
  seccion: { marginTop: 8 },
  etiqueta: { color: '#F3E3C3', fontWeight: 700, fontSize: 11, marginBottom: 4 },
  fila: { display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  chip: { padding: '6px 10px', borderRadius: 999, background: 'rgba(60,40,24,0.9)', border: '1.5px solid rgba(255,182,39,0.3)', color: '#F3E3C3', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: "'Nunito', sans-serif" },
  chipActivo: { borderColor: '#FFB627', background: 'rgba(130,78,22,0.98)', color: '#FFD668' },
  numero: { color: '#FFF8ED', fontWeight: 800, fontSize: 16, minWidth: 22, textAlign: 'center' },
};

function Chip({ texto, activo, onClick }) {
  return <button type="button" style={{ ...estilos.chip, ...(activo ? estilos.chipActivo : {}) }} onClick={onClick}>{texto}</button>;
}
function Seccion({ titulo, children }) {
  return (
    <div style={estilos.seccion}>
      <div style={estilos.etiqueta}>{titulo}</div>
      <div style={estilos.fila}>{children}</div>
    </div>
  );
}

export default function PanelGaleriaWeb({ escenaRef, marcadorEstilo, onCambiarMarcadorEstilo }) {
  const [cfg, setCfg] = useState(() => getConfigFoto());
  const [abierto, setAbierto] = useState(false);
  const [abajo, setAbajo] = useState(false);
  const esEquipos = cfg.modo !== '1v1';
  const nCompas = cfg.modo === '2v2' ? 1 : cfg.modo === '3v3' ? 2 : 0;
  const nRivales = cfg.modo === '1v1' ? 1 : cfg.modo === '2v2' ? 2 : 3;
  const asientos = [
    ...Array.from({ length: nCompas }, (_, i) => ({ id: `comp-${i + 1}`, nombre: cfg.compas[i] || `Compa ${i + 1}` })),
    ...Array.from({ length: nRivales }, (_, i) => ({ id: `riv-${i + 1}`, nombre: cfg.rivales[i] || `Rival ${i + 1}` })),
  ];
  const cambiar = (p) => {
    const nueva = { ...cfg, ...p };
    guardarConfigFoto(nueva);
    setCfg(nueva);
    const escena = escenaRef && escenaRef();
    if (escena && escena.recargarEstadoFoto) escena.recargarEstadoFoto();
  };
  const puntos = (campo, delta) => cambiar({ [campo]: Math.max(0, Math.min(30, (cfg[campo] || 0) + delta)) });
  const cambiarModo = (m) => {
    if (m === cfg.modo) return;
    guardarConfigFoto({ ...cfg, modo: m, turno: 'yo', mano: null });
    window.location.href = `/?preview=${m}&foto=1&galeria=1`;   // la mesa cambia de forma: se vuelve a abrir en el modo nuevo
  };
  const cantidades = (clave) => [null, 0, 1, 2, 3].map((n) => (
    <Chip key={String(n)} texto={n === null ? 'Auto' : String(n)} activo={cfg[clave] === n} onClick={() => cambiar({ [clave]: n })} />
  ));

  if (!abierto) return <button type="button" style={estilos.abrir} onClick={() => setAbierto(true)}>GALERÍA</button>;

  return (
    <div style={{ ...estilos.panel, ...(abajo ? { bottom: 10 } : { top: 70 }) }}>
      <div style={estilos.cabecera}>
        <span style={estilos.titulo}>Galería · {cfg.modo}</span>
        <Chip texto={abajo ? 'Mover arriba' : 'Mover abajo'} activo={false} onClick={() => setAbajo((a) => !a)} />
        <Chip texto="Cerrar" activo onClick={() => setAbierto(false)} />
      </div>
      <Seccion titulo="Modo de mesa">
        {['1v1', '2v2', '3v3'].map((m) => <Chip key={m} texto={m} activo={cfg.modo === m} onClick={() => cambiarModo(m)} />)}
      </Seccion>
      <Seccion titulo="Escena (cantos)">
        {ESCENAS_FOTO.map((e) => <Chip key={e.id} texto={NOMBRE_CORTO[e.id] || e.nombre} activo={cfg.escena === e.id} onClick={() => cambiar({ escena: e.id })} />)}
      </Seccion>
      <Seccion titulo="Cartas jugadas: yo">{cantidades('jugadasMias')}</Seccion>
      {esEquipos && <Seccion titulo="Cartas jugadas: cada compañero">{cantidades('jugadasCompas')}</Seccion>}
      <Seccion titulo={nRivales > 1 ? 'Cartas jugadas: cada rival' : 'Cartas jugadas: el rival'}>{cantidades('jugadasRivales')}</Seccion>
      <Seccion titulo="De quién es el turno">
        <Chip texto="Yo" activo={cfg.turno === 'yo'} onClick={() => cambiar({ turno: 'yo' })} />
        {asientos.map((a) => <Chip key={a.id} texto={a.nombre} activo={cfg.turno === a.id} onClick={() => cambiar({ turno: a.id })} />)}
      </Seccion>
      <Seccion titulo="Quién es mano">
        <Chip texto="Nadie" activo={!cfg.mano} onClick={() => cambiar({ mano: null })} />
        <Chip texto="Yo" activo={cfg.mano === 'yo'} onClick={() => cambiar({ mano: 'yo' })} />
        {asientos.map((a) => <Chip key={a.id} texto={a.nombre} activo={cfg.mano === a.id} onClick={() => cambiar({ mano: a.id })} />)}
      </Seccion>
      <Seccion titulo="Tengo flor (cartas del mismo palo)">
        <Chip texto="Según escena" activo={cfg.tengoFlor === null} onClick={() => cambiar({ tengoFlor: null })} />
        <Chip texto="Sí" activo={cfg.tengoFlor === true} onClick={() => cambiar({ tengoFlor: true })} />
        <Chip texto="No" activo={cfg.tengoFlor === false} onClick={() => cambiar({ tengoFlor: false })} />
      </Seccion>
      {esEquipos && (
        <Seccion titulo="Señas: mostrar mis cartas al compañero">
          <Chip texto="No" activo={!cfg.senias} onClick={() => cambiar({ senias: false })} />
          <Chip texto="Sí" activo={!!cfg.senias} onClick={() => cambiar({ senias: true })} />
        </Seccion>
      )}
      <Seccion titulo="Marcador (cambia tu preferencia del navegador)">
        <Chip texto="Números" activo={marcadorEstilo !== 'fosforos'} onClick={() => onCambiarMarcadorEstilo('numeros')} />
        <Chip texto="Fósforos" activo={marcadorEstilo === 'fosforos'} onClick={() => onCambiarMarcadorEstilo('fosforos')} />
      </Seccion>
      <Seccion titulo="Pack de la mesa (prueba, solo admin; recarga la mesa)">
        {IDS_PACK.map((id) => (
          <Chip key={id} texto={id === 'ninguno' ? 'Ninguno' : PACKS[id].nombre} activo={leerPackMesa() === id}
            onClick={() => { if (leerPackMesa() === id) return; guardarPackMesa(id); window.location.reload(); }} />
        ))}
      </Seccion>
      <Seccion titulo="Objetivo de la mesa">
        <Chip texto="Auto" activo={cfg.objetivo === null} onClick={() => cambiar({ objetivo: null })} />
        <Chip texto="15" activo={cfg.objetivo === 15} onClick={() => cambiar({ objetivo: 15 })} />
        <Chip texto="30" activo={cfg.objetivo === 30} onClick={() => cambiar({ objetivo: 30 })} />
      </Seccion>
      <Seccion titulo="Puntos">
        <Chip texto="Nosotros −" activo={false} onClick={() => puntos('puntosYo', -1)} />
        <span style={estilos.numero}>{cfg.puntosYo}</span>
        <Chip texto="+" activo={false} onClick={() => puntos('puntosYo', 1)} />
        <Chip texto="Ellos −" activo={false} onClick={() => puntos('puntosRival', -1)} />
        <span style={estilos.numero}>{cfg.puntosRival}</span>
        <Chip texto="+" activo={false} onClick={() => puntos('puntosRival', 1)} />
      </Seccion>
    </div>
  );
}
