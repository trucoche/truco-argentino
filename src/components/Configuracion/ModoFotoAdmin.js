import React, { useState } from 'react';
import { PlacaMadera } from '../Popup/PopupMadera';
import { MAZOS } from '../../constants/personalizacion';
import { CONFIG_FOTO_INICIAL, ESCENAS_FOTO, guardarConfigFoto, leerConfigGuardada } from '../../constants/modoFoto';

// Pase 611: Modo foto (solo admin; se monta desde Configuracion.js). Elegís modo, escena, nombres, marcador y dorso y abrís la mesa
// simulada (sin servidor ni mates) para sacar capturas. "Interfaz limpia" oculta chat y botones; para salir se hace clic en la esquina
// superior izquierda de la mesa (invisible) o se vuelve atrás en el navegador.
const MODOS = ['1v1', '2v2', '3v3'];

export default function ModoFotoAdmin() {
  const [cfg, setCfg] = useState(() => ({ ...CONFIG_FOTO_INICIAL, ...leerConfigGuardada() }));
  const cambiar = (p) => setCfg((c) => ({ ...c, ...p }));
  const nCompas = cfg.modo === '2v2' ? 1 : cfg.modo === '3v3' ? 2 : 0;
  const nRivales = cfg.modo === '1v1' ? 1 : cfg.modo === '2v2' ? 2 : 3;
  const setNombre = (clave, i, v) => {
    const arr = [...cfg[clave]];
    arr[i] = v;
    cambiar({ [clave]: arr });
  };
  const numero = (t) => Math.max(0, Math.min(30, parseInt(String(t).replace(/[^0-9]/g, ''), 10) || 0));
  const abrir = () => {
    guardarConfigFoto(cfg);
    window.location.href = `/?preview=${cfg.modo}&foto=1`;
  };
  const chip = (activo) => ({ ...estilos.chip, ...(activo ? estilos.chipActivo : {}) });

  return (
    <PlacaMadera>
      <div style={estilos.titulo}>📸 Modo foto (mesa para capturas)</div>
      <p style={estilos.hint}>Mesa simulada: no usa servidor, cuentas ni mates. Sirve para sacar fotos de Instagram, Play Store y eventos.</p>

      <div style={estilos.seccion}>Modo de mesa</div>
      <div style={estilos.fila}>
        {MODOS.map((m) => <button key={m} type="button" style={chip(cfg.modo === m)} onClick={() => cambiar({ modo: m })}>{m}</button>)}
      </div>

      <div style={estilos.seccion}>Escena</div>
      <div style={estilos.fila}>
        {ESCENAS_FOTO.map((e) => <button key={e.id} type="button" style={chip(cfg.escena === e.id)} onClick={() => cambiar({ escena: e.id })}>{e.nombre}</button>)}
      </div>

      <div style={estilos.seccion}>Nombres</div>
      <div style={estilos.grilla}>
        <label style={estilos.campo}>Vos (vacío = “Vos”)
          <input id="foto-yo" style={estilos.input} value={cfg.yo} maxLength={16} onChange={(e) => cambiar({ yo: e.target.value })} />
        </label>
        {Array.from({ length: nCompas }, (_, i) => (
          <label key={`c${i}`} style={estilos.campo}>{nCompas > 1 ? `Compañero ${i + 1}` : 'Compañero'}
            <input id={`foto-comp-${i}`} style={estilos.input} value={cfg.compas[i] || ''} maxLength={16} onChange={(e) => setNombre('compas', i, e.target.value)} />
          </label>
        ))}
        {Array.from({ length: nRivales }, (_, i) => (
          <label key={`r${i}`} style={estilos.campo}>{nRivales > 1 ? `Rival ${i + 1}` : 'Rival'}
            <input id={`foto-riv-${i}`} style={estilos.input} value={cfg.rivales[i] || ''} maxLength={16} onChange={(e) => setNombre('rivales', i, e.target.value)} />
          </label>
        ))}
      </div>

      <div style={estilos.seccion}>Marcador</div>
      <div style={estilos.grilla}>
        <label style={estilos.campo}>Nosotros
          <input id="foto-puntos-yo" style={estilos.input} inputMode="numeric" value={cfg.puntosYo} maxLength={2} onChange={(e) => cambiar({ puntosYo: numero(e.target.value) })} />
        </label>
        <label style={estilos.campo}>Ellos
          <input id="foto-puntos-rival" style={estilos.input} inputMode="numeric" value={cfg.puntosRival} maxLength={2} onChange={(e) => cambiar({ puntosRival: numero(e.target.value) })} />
        </label>
      </div>

      <div style={estilos.seccion}>Dorso de las cartas</div>
      <div style={estilos.fila}>
        {MAZOS.map((m) => (
          <button key={m.id} type="button" style={{ ...chip(cfg.mazo === m.id), display: 'inline-flex', alignItems: 'center', gap: 6 }} onClick={() => cambiar({ mazo: m.id })}>
            <img src={m.dorso} alt="" style={{ width: 20, height: 28, objectFit: 'contain' }} /> {m.nombre}
          </button>
        ))}
      </div>

      <label style={estilos.checkFila}>
        <input id="foto-limpia" type="checkbox" checked={cfg.ocultarUI} onChange={(e) => cambiar({ ocultarUI: e.target.checked })} style={{ width: 20, height: 20 }} />
        <span>Interfaz limpia (sin chat ni botones)</span>
      </label>

      <button type="button" style={estilos.btnAbrir} onClick={abrir}>Abrir mesa</button>
    </PlacaMadera>
  );
}

const estilos = {
  titulo: { fontFamily: "'Fredoka', sans-serif", fontWeight: 600, fontSize: 20, color: '#4A2C2A', marginBottom: 6 },
  hint: { margin: '0 0 8px', fontSize: 13.5, color: '#6b5a50' },
  seccion: { fontWeight: 800, fontSize: 13, color: '#4A2C2A', textTransform: 'uppercase', margin: '14px 0 6px' },
  fila: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  chip: { fontFamily: "'Fredoka', sans-serif", fontWeight: 600, fontSize: 14, color: '#FFFBEB', background: '#8B5A2B', border: '2px solid #1a1410', borderRadius: 999, padding: '7px 12px', cursor: 'pointer', boxShadow: 'inset 0 3px 5px rgba(74,44,17,0.55)' },
  chipActivo: { background: 'linear-gradient(180deg, #F5B041 0%, #EB984E 100%)', color: '#4A2C2A', border: '2px solid #000', boxShadow: '0 3px 0 #000' },
  grilla: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 },
  campo: { display: 'flex', flexDirection: 'column', gap: 4, fontWeight: 700, fontSize: 13, color: '#4A2C2A' },
  input: { background: '#F4E2C2', border: '2px solid #C9A66B', borderRadius: 10, padding: '8px 10px', fontSize: 15, color: '#3A2210', fontFamily: "'Nunito', sans-serif", width: '100%', boxSizing: 'border-box' },
  checkFila: { display: 'flex', alignItems: 'center', gap: 10, marginTop: 16, fontWeight: 700, fontSize: 15, color: '#4A2C2A', cursor: 'pointer' },
  btnAbrir: { marginTop: 18, width: '100%', fontFamily: "'Fredoka', sans-serif", fontWeight: 700, fontSize: 18, color: '#4A2C2A', background: 'linear-gradient(180deg, #FFD147 0%, #E69D00 100%)', border: '2.5px solid #000', borderRadius: 999, padding: '12px 20px', boxShadow: '0 5px 0 #000', cursor: 'pointer' },
};
