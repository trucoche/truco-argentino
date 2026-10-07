import React, { useState, useEffect, useCallback } from 'react';
import { API_URL as BASE_URL } from '../../config';
import { rangoUi } from '../Perfil/rangosUi';
import { PlacaMadera } from '../Popup/PopupMadera';

// Pase 336: pantalla de la Liga Criolla (clasificatorio). Datos de GET /api/salas/ranked/resumen,
// búsqueda con POST /api/salas/ranked (cola emparejada por rango; reglas fijas: 15 puntos, sin Flor).
// Las partidas casuales ya no mueven el rango: solo esta cola.

const API_SALAS = `${BASE_URL}/api/salas`;
const MODOS = ['1v1', '2v2', '3v3'];
const ICONOS_MODO = {
  '1v1': { activo: '/assets/images/icono-modo-1v1-activo.png', inactivo: '/assets/images/icono-modo-1v1-inactivo.png' },
  '2v2': { activo: '/assets/images/icono-modo-2v2-activo.png', inactivo: '/assets/images/icono-modo-2v2-inactivo.png' },
  '3v3': { activo: '/assets/images/icono-modo-3v3-activo.png', inactivo: '/assets/images/icono-modo-3v3-inactivo.png' },
};

const C = {
  crema: '#FFF8ED', chocolate: '#4A2C2A', dorado: '#F5B041', doradoClaro: '#FFD668',
  verdeOscuro: '#1f7a3c', crimsonOscuro: '#c2352a',
};

export default function Ranked({token, onEntrarAPartida, usuario }) {
  const [resumen, setResumen] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [modo, setModo] = useState('1v1');
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState('');

  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const cargarResumen = useCallback(async () => {
    try {
      const res = await fetch(`${API_SALAS}/ranked/resumen`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (res.ok) { setResumen(data); setError(''); }
      else setError(data.error || 'No se pudo cargar tu rango');
    } catch (err) {
      console.error('Error cargando resumen ranked:', err);
      setError('No se pudo conectar con el servidor');
    } finally {
      setCargando(false);
    }
  }, [token]);

  useEffect(() => { cargarResumen(); }, [cargarResumen]);

  const buscarPartida = async () => {
    if (buscando) return;
    setError('');
    setBuscando(true);
    try {
      const res = await fetch(`${API_SALAS}/ranked`, { method: 'POST', headers, body: JSON.stringify({ modo }) });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Error al buscar partida de Liga Criolla'); return; }
      onEntrarAPartida(data.codigo);
    } catch (err) {
      console.error('Error buscando partida ranked:', err);
      setError('No se pudo conectar con el servidor');
    } finally {
      setBuscando(false);
    }
  };

  const rango = resumen?.rango || usuario?.rango;
  const ui = rangoUi(rango);
  const tituloRango = rango ? (rango.esTop500 ? rango.nombre : `${rango.nombre} ${rango.division}`) : '';
  const progreso = rango && !rango.esTop500 ? Math.max(0, Math.min(1, rango.progreso || 0)) : 1;
  const salasBuscando = resumen?.buscando?.[modo] ?? 0;

  if (cargando) return <div style={estilos.cargando}>Cargando…</div>;

  return (
    <div style={estilos.pagina}>
      <div style={estilos.columna}>
        {/* Fila 1: rango (angosta) + modalidad y búsqueda */}
        <div style={estilos.fila}>
        {/* A. Rango actual */}
        <PlacaMadera style={{ display: 'flex', flexDirection: 'column', flex: '0 1 300px', minWidth: 240 }} colorInterior="#4A3226" interiorStyle={estilos.rangoInterior}>
          <img src={ui.logo} alt="" style={estilos.rangoLogo} />
          {rango && (
            <div style={{ width: '100%', textAlign: 'center' }}>
              <div style={estilos.rangoNombre}>{tituloRango}</div>
              <div style={estilos.rangoConcepto}>{rango.concepto}</div>
              <div style={estilos.barraFondo}>
                <div style={{ ...estilos.barraRelleno, width: `${Math.round(progreso * 100)}%` }} />
              </div>
              <div style={estilos.barraTexto}>
                {rango.esTop500 ? `${rango.puntos} pts · rango máximo` : `${rango.puntos} / ${rango.rangoMax + 1} pts`}
              </div>
            </div>
          )}
        </PlacaMadera>

        {/* B + C. Modalidad y búsqueda */}
        <PlacaMadera style={{ display: 'flex', flexDirection: 'column', flex: '1 1 340px', minWidth: 0 }} interiorStyle={{ padding: 18, flex: 1 }}>
          <div style={estilos.panelTitulo}>Elegí la modalidad</div>
          <div style={estilos.filaModos}>
            {MODOS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setModo(m)}
                disabled={buscando}
                style={{ ...estilos.modoBtn, ...(modo === m ? estilos.modoBtnActivo : {}) }}
              >
                <img src={modo === m ? ICONOS_MODO[m].activo : ICONOS_MODO[m].inactivo} alt="" style={estilos.modoIcono} />
                {m}
              </button>
            ))}
          </div>

          <div style={estilos.reglas}>
            {`A ${resumen?.reglas.puntosParaGanar ?? 15} puntos · ${resumen?.reglas.conFlor ? 'Con Flor' : 'Sin Flor'} · ${resumen?.reglas.tiempoPorTurno ?? 15} s por turno · Rival de tu nivel`}
          </div>

          {error && <div style={estilos.error}>{error}</div>}

          <button onClick={buscarPartida} disabled={buscando} style={estilos.btnBuscar}>
            {buscando ? 'Buscando...' : 'BUSCAR PARTIDA DE LIGA'}
          </button>

          <div style={estilos.hintBuscando}>
            {salasBuscando > 0
              ? `Hay ${salasBuscando} ${salasBuscando === 1 ? 'sala esperando' : 'salas esperando'} en ${modo}`
              : `Nadie esperando en ${modo} ahora: serás el primero en la cola`}
          </div>
        </PlacaMadera>
        </div>

        {/* Fila 2: temporada + cómo se suma */}
        <div style={estilos.fila}>
        {/* D. Stats */}
        <PlacaMadera style={{ display: 'flex', flexDirection: 'column', flex: '1 1 300px', minWidth: 0 }} interiorStyle={{ padding: 18, flex: 1 }}>
          <div style={estilos.panelTitulo}>Tu temporada</div>
          <div style={estilos.statsGrid}>
            <Stat label="Jugadas" valor={resumen?.jugadas ?? 0} />
            <Stat label="% Victorias" valor={`${resumen?.porcentajeVictorias ?? 0}%`} color={C.verdeOscuro} />
            <Stat label="Racha" valor={resumen?.rachaVictorias ?? 0} color={C.crimsonOscuro} />
          </div>
          <div style={estilos.notaStats}>
            {`Racha máxima: ${resumen?.rachaMaxima ?? 0}`}
            {(resumen?.escudos ?? 0) > 0 ? ` · Escudos de liga: ${resumen.escudos}` : ''}
          </div>
        </PlacaMadera>

        {/* Cómo se puntúa */}
        <PlacaMadera style={{ display: 'flex', flexDirection: 'column', flex: '1 1 300px', minWidth: 0 }} interiorStyle={{ padding: 18, flex: 1 }}>
          <div style={estilos.panelTitulo}>Cómo se suma</div>
          <ul style={estilos.lista}>
            <li>Ganarle a alguien de mayor rango suma más; ganarle a uno de menor rango suma menos.</li>
            <li>Perder contra alguien de menor rango resta más.</li>
            <li>3 victorias seguidas dan +10 pts extra por victoria.</li>
            <li>Al ascender de rango ganás escudos que te protegen de bajar de liga.</li>
            <li>En Mancebo las derrotas no restan puntos.</li>
            <li>Solo las partidas de Liga Criolla mueven tu rango: las salas casuales no.</li>
          </ul>
        </PlacaMadera>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, valor, color }) {
  return (
    <div style={estilos.statTile}>
      <div style={{ ...estilos.statValor, ...(color ? { color } : {}) }}>{valor}</div>
      <div style={estilos.statLabel}>{label}</div>
    </div>
  );
}

const CONTORNO_TEXTO = '-1.5px -1.5px 0 #000, 0 -1.5px 0 #000, 1.5px -1.5px 0 #000, -1.5px 0 0 #000, 1.5px 0 0 #000, -1.5px 1.5px 0 #000, 0 1.5px 0 #000, 1.5px 1.5px 0 #000';

const estilos = {
  pagina: { width: '100%', padding: '8px 12px 40px', boxSizing: 'border-box' },
  columna: { maxWidth: 940, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 18 },
  fila: { display: 'flex', flexWrap: 'wrap', gap: 18, alignItems: 'stretch' },
  cargando: { textAlign: 'center', color: C.crema, fontFamily: "'Fredoka', sans-serif", padding: 40 },
  rangoInterior: { flex: 1, justifyContent: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '20px 18px' },
  rangoLogo: { width: 110, height: 110, objectFit: 'contain' },
  rangoNombre: {
    fontFamily: "'Fredoka', sans-serif", fontWeight: 700, fontSize: 28, color: C.doradoClaro,
    textShadow: '1px 2px 0 #000',
  },
  rangoConcepto: { fontFamily: "'Nunito', sans-serif", fontWeight: 700, fontSize: 13.5, color: C.crema, opacity: 0.9, marginTop: 4, lineHeight: 1.4 },
  barraFondo: { height: 16, borderRadius: 10, border: '2.5px solid #000', background: '#2a1c14', overflow: 'hidden', marginTop: 14 },
  barraRelleno: { height: '100%', background: C.dorado, borderRight: '2px solid #B9770E' },
  barraTexto: { fontFamily: "'Nunito', sans-serif", fontWeight: 800, fontSize: 12.5, color: C.crema, marginTop: 6 },
  panelTitulo: { fontFamily: "'Fredoka', sans-serif", fontWeight: 600, fontSize: 17, color: C.chocolate, marginBottom: 12 },
  filaModos: { display: 'flex', gap: 10 },
  modoBtn: {
    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
    fontFamily: "'Fredoka', sans-serif", fontWeight: 700, fontSize: 14, color: '#FFFBEB',
    background: '#8B5A2B', border: '2px solid #000', borderRadius: 14, padding: '10px 6px', cursor: 'pointer',
    boxShadow: 'inset 0 3px 5px rgba(74,44,17,0.55)',
  },
  modoBtnActivo: {
    background: C.dorado, color: C.chocolate, boxShadow: '0 3px 0 #B9770E, 0 5px 0 #000', marginBottom: 5,
  },
  modoIcono: { height: 30, width: 'auto', objectFit: 'contain' },
  reglas: { fontFamily: "'Nunito', sans-serif", fontWeight: 700, fontSize: 12.5, color: '#7a6660', textAlign: 'center', margin: '14px 0' },
  error: { background: '#ffe0dd', color: '#c2352a', fontWeight: 700, fontSize: 12.5, borderRadius: 10, padding: 8, marginBottom: 12 },
  btnBuscar: {
    width: '100%', height: 54, boxSizing: 'border-box', fontFamily: "'Fredoka', sans-serif", fontWeight: 800, fontSize: 18,
    color: C.chocolate, background: C.dorado, border: '3px solid #000', borderRadius: 999, cursor: 'pointer',
    boxShadow: '0 4px 0 #B9770E, 0 7px 0 #000', marginBottom: 8, letterSpacing: 0.4,
  },
  hintBuscando: { fontFamily: "'Nunito', sans-serif", fontWeight: 700, fontSize: 12, color: '#8c8078', textAlign: 'center', marginTop: 10 },
  statsGrid: { display: 'flex', gap: 10 },
  statTile: {
    flex: 1, textAlign: 'center', padding: '12px 6px', borderRadius: 12, border: '2px solid rgba(26,20,16,0.35)', background: '#FFF3D6',
  },
  statValor: { fontFamily: "'Fredoka', sans-serif", fontWeight: 700, fontSize: 22, color: C.chocolate },
  statLabel: { fontFamily: "'Nunito', sans-serif", fontWeight: 700, fontSize: 11.5, color: '#7a6660', marginTop: 2 },
  notaStats: { fontFamily: "'Nunito', sans-serif", fontWeight: 700, fontSize: 12, color: '#7a6660', textAlign: 'center', marginTop: 12 },
  lista: { margin: 0, paddingLeft: 20, fontFamily: "'Nunito', sans-serif", fontWeight: 600, fontSize: 13, color: '#5a4a45', lineHeight: 1.5 },
};
