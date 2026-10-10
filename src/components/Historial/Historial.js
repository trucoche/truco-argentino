import React, { useState, useEffect, useCallback } from 'react';
import { API_URL as BASE_URL } from '../../config';
import PantallaCarga from '../PantallaCarga/PantallaCarga';

const API_URL = `${BASE_URL}/api/historial`;

const C = {
  verde: '#2D9B4F', verdeOscuro: '#1f7a3c', verdeProfundo: '#163f24', verdeEsmeralda: '#1e8f4e',
  crimson: '#E8483A', crimsonOscuro: '#c2352a', crimsonClaro: '#ff6b5c',
  dorado: '#FFB627', doradoClaro: '#FFD668', doradoOscuro: '#C9860E',
  celeste: '#4FB3E8',
  crema: '#FFF8ED', cremaSutil: '#FFFCF6', chocolate: '#4A2C2A',
  // Ducentésimo quincuagésimo cuarto pase: paleta del panel de madera+bronce
  // exterior (mismos tonos que Chat Global — ver ChatGlobal.js).
  maderaClara: '#6b4a34', maderaMedia: '#4a3226', maderaOscura: '#2a1c14',
  bronce: '#c9973e', bronceClaro: '#f0d9a0', bronceOscuro: '#7a5322',
  negroPulido: '#1a1410',
};

const MODO_LABEL = { '1v1': '1 vs 1', '2v2': '2 vs 2', '3v3': '3 vs 3' };

// Ducentésimo quincuagésimo octavo pase: proporción real (ancho/alto) de
// cada asset ilustrado, medida sobre el PNG ya recortado a su contenido
// visible (sin el margen transparente de sobra que traía el archivo
// generado) — se usan para que cada `<img>` reserve el alto/ancho
// correcto sin depender de que el navegador ya haya cargado el archivo
// (evita el "salto" de layout mientras carga).
// Ducentésimo sexagésimo primer pase: la chapita de resultado deja de usar
// `historial-placa.png` como fondo (ver el comentario grande junto a
// `placaResultado`), así que `ASPECTO_PLACA` ya no hace falta — solo queda
// `ASPECTO_CINTA` para la cinta de modo, que sigue ilustrada.
const ASPECTO_CINTA = 250 / 84;

function formatearFecha(fechaISO) {
  const f = new Date(fechaISO);
  return f.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' }) +
    ' · ' + f.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

// Sin recibe onVolver: al igual que Lobby/Torneos/Ranking, la navegación
// vive en el AppShell — esta pantalla solo renderiza contenido.
export default function Historial({ token }) {
  const [partidas, setPartidas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [filtro, setFiltro] = useState('todas'); // 'todas' | 'normal' | 'torneo' | 'liga'

  const cargarHistorial = useCallback(async () => {
    try {
      const res = await fetch(API_URL, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Error al cargar el historial');
        return;
      }
      setPartidas(data);
      setError('');
    } catch (err) {
      console.error('Error de conexión:', err);
      setError('No se pudo conectar con el servidor');
    } finally {
      setCargando(false);
    }
  }, [token]);

  useEffect(() => {
    cargarHistorial();
  }, [cargarHistorial]);

  const partidasFiltradas = partidas.filter(p => filtro === 'todas' || p.tipo === filtro);

  // Ducentésimo quincuagésimo octavo pase: se reemplazan los íconos/placa/
  // cinta armados en CSS (pase 254) por los assets ilustrados que pasó el
  // usuario — ver el comentario grande junto a `estilos.fila` más abajo
  // para el porqué del cambio de layout (la placa ya NO estira a todo el
  // ancho de la fila, es una "chapita" de tamaño fijo).
  return (
    <div style={estilos.panelExterior}>
      <span style={{ ...estilos.remache, top: 10, left: 10 }} />
      <span style={{ ...estilos.remache, top: 10, right: 10 }} />
      <span style={{ ...estilos.remache, bottom: 10, left: 10 }} />
      <span style={{ ...estilos.remache, bottom: 10, right: 10 }} />

      <div style={estilos.interiorFieltro}>
        {error && <div style={estilos.errorBox}>{error}</div>}

        <div style={estilos.sectionTitle}>Historial de partidas</div>

        <div style={estilos.filtros}>
          {[
            { id: 'todas', label: 'Todas' },
            { id: 'normal', label: 'Normales' },
            { id: 'torneo', label: 'Torneos' },
            { id: 'liga', label: 'Liga Criolla' }
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setFiltro(f.id)}
              style={filtro === f.id ? estilos.filtroActivo : estilos.filtroInactivo}
            >
              {f.label}
            </button>
          ))}
        </div>

        {cargando ? (
          // Centésimo cuadragésimo sexto pase: ver PantallaCarga.
          <PantallaCarga completa={false} conLogo={false} />
        ) : partidasFiltradas.length === 0 ? (
          <p style={estilos.sinResultados}>
            {filtro === 'todas' ? 'Todavía no jugaste ninguna partida.' : filtro === 'liga' ? 'Todavía no jugaste partidas de Liga Criolla.' : 'No hay partidas de este tipo.'}
          </p>
        ) : (
          partidasFiltradas.map((p) => {
            return (
              <div key={p.salaId} style={estilos.fila}>
                <div style={{ ...estilos.filaPrincipal, ...(p.gane ? estilos.filaPrincipalVictoria : estilos.filaPrincipalDerrota) }}>
                  {/* Ducentésimo sexagésimo primer pase: se sacó
                      `historial-placa.png` como fondo de la chapita — el
                      usuario no quedó convencido con la placa ilustrada
                      (ver el comentario grande junto a `placaResultado`
                      más abajo) y pidió volver al fondo crema plano de
                      antes, con el ícono y el texto más grandes, y un
                      marco propio prolijo por tarjeta. */}
                  <div style={{ ...estilos.placaResultado, ...(p.gane ? estilos.placaResultadoVictoria : estilos.placaResultadoDerrota) }}>
                    <img
                      src={p.gane ? '/assets/images/historial-trofeo.png' : '/assets/images/historial-cruz.png'}
                      alt=""
                      style={estilos.placaIcono}
                    />
                    <span style={{ ...estilos.placaTexto, ...(p.gane ? estilos.placaTextoVictoria : estilos.placaTextoDerrota) }}>
                      {p.gane ? 'Victoria' : 'Derrota'}
                    </span>
                  </div>

                  <div style={estilos.filaContenido}>
                    <div style={estilos.filaContenidoTop}>
                      {p.tipo === 'torneo' ? (
                        <div style={estilos.torneoNombre}>
                          {p.torneo.titulo}
                          {p.torneo.esCampeon && <span style={estilos.coronaTag}> 👑 Campeón del torneo</span>}
                        </div>
                      ) : <span />}

                      {/* Cinta de modo ilustrada (`historial-cinta.png`) —
                          reemplaza el badge plano de antes. */}
                      <div style={estilos.cintaModoWrap}>
                        <img src="/assets/images/historial-cinta.png" alt="" style={estilos.cintaModoImg} />
                        <span style={estilos.cintaModoTexto}>
                          {p.tipo === 'torneo' ? 'Torneo' : p.tipo === 'liga' ? 'Liga' : 'Normal'}
                        </span>
                      </div>
                    </div>

                    <div style={estilos.cardInfo}>
                      {MODO_LABEL[p.modo] || p.modo} · {formatearFecha(p.fecha)}
                    </div>
                  </div>

                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

const estilos = {
  // ─────────────────────────────────────────────────────────────────────
  // A. Panel contenedor principal (sin cambios respecto al pase 254 — ver
  // ese pase para el porqué: tablero de madera con remaches de bronce +
  // fieltro verde "hundido" adentro).
  panelExterior: {
    position: 'relative',
    background: `linear-gradient(160deg, ${C.maderaClara} 0%, ${C.maderaMedia} 55%, ${C.maderaOscura} 100%)`,
    border: `3px solid ${C.negroPulido}`,
    borderRadius: 20,
    padding: 16,
    boxShadow: [
      'inset 0 2px 0 rgba(255,255,255,0.10)',
      'inset 0 -4px 10px rgba(0,0,0,0.5)',
      `0 8px 0 ${C.negroPulido}`,
      '0 16px 26px rgba(0,0,0,0.4)',
    ].join(', '),
  },
  remache: {
    position: 'absolute', width: 13, height: 13, borderRadius: '50%',
    background: `radial-gradient(circle at 35% 30%, ${C.bronceClaro} 0%, ${C.bronce} 45%, ${C.bronceOscuro} 78%, #3a2610 100%)`,
    boxShadow: '0 1px 2px rgba(0,0,0,0.65), inset 0 1px 1px rgba(255,255,255,0.4)',
    zIndex: 2,
  },
  interiorFieltro: {
    background: `linear-gradient(180deg, ${C.verdeProfundo}, ${C.verdeOscuro})`,
    borderRadius: 14,
    padding: '16px 16px 18px',
    boxShadow: `inset 0 3px 10px rgba(0,0,0,0.55), inset 0 0 0 2px rgba(0,0,0,0.22)`,
  },
  errorBox: {
    background: '#ffe0dd', border: `2px solid ${C.crimson}`, color: C.crimsonOscuro,
    borderRadius: 10, padding: '8px 12px', marginBottom: 12, fontWeight: 700, fontSize: 13
  },
  sectionTitle: {
    fontFamily: "'Fredoka', sans-serif", fontWeight: 700, fontSize: 17, color: C.crema,
    letterSpacing: 0.3, margin: '2px 0 12px 2px', textShadow: '-1.5px -1.5px 0 #2C160E, 1.5px -1.5px 0 #2C160E, -1.5px 1.5px 0 #2C160E, 1.5px 1.5px 0 #2C160E, 0px -1.5px 0 #2C160E, 0px 1.5px 0 #2C160E, -1.5px 0px 0 #2C160E, 1.5px 0px 0 #2C160E',
    paddingBottom: 8, borderBottom: `2px solid rgba(255,182,39,0.25)`,
  },
  sinResultados: { color: C.crema, textAlign: 'center', opacity: 0.85, marginTop: 8 },

  // ─────────────────────────────────────────────────────────────────────
  // B. Pestañas de filtro (sin cambios respecto al pase 254).
  filtros: { display: 'flex', gap: 8, marginBottom: 14 },
  filtroActivo: {
    fontFamily: "'Fredoka', sans-serif", fontWeight: 700, fontSize: 13,
    background: `linear-gradient(180deg, ${C.doradoClaro}, ${C.dorado})`, color: C.chocolate,
    border: `3px solid ${C.negroPulido}`, borderRadius: 12, padding: '9px 16px',
    boxShadow: [
      '0 0 14px 2px rgba(255,182,39,0.55)',
      `0 4px 0 ${C.negroPulido}`,
      '0 6px 10px rgba(0,0,0,0.35)',
    ].join(', '),
    cursor: 'pointer', transform: 'translateY(-1px)',
  },
  filtroInactivo: {
    fontFamily: "'Fredoka', sans-serif", fontWeight: 600, fontSize: 13,
    background: `linear-gradient(180deg, ${C.maderaMedia}, #241811)`, color: '#c9a668',
    border: `2.5px solid ${C.negroPulido}`, borderRadius: 12, padding: '9px 16px',
    boxShadow: 'inset 0 3px 6px rgba(0,0,0,0.55), inset 0 -1px 0 rgba(255,255,255,0.05)',
    cursor: 'pointer',
  },

  // ─────────────────────────────────────────────────────────────────────
  // C. Filas de partida — Ducentésimo quincuagésimo octavo pase: la
  // "chapita" (`placaResultado`) se dejó SUELTA sobre el fieltro verde,
  // con el resto de la fila (texto, cinta de modo, flecha) apoyado
  // directo encima del fieltro sin ninguna caja alrededor. El usuario
  // reportó que esto se veía desarmado — la chapita quedaba como un
  // elemento chico y aislado, con todo el texto "flotando" suelto al
  // lado sin ninguna tarjeta que lo contenga.
  // Ducentésimo quincuagésimo noveno pase: se vuelve a envolver la fila
  // ENTERA (chapita + texto + cinta + flecha) en una sola tarjeta
  // (`filaPrincipal` pasa a tener fondo/borde/sombra propios) — la
  // chapita sigue con su tamaño fijo (no se estira, mismo motivo que
  // antes: detalles tallados a proporción fija), pero ahora vive ADENTRO
  // de esa tarjeta más grande en vez de sola sobre el fieltro.
  // Ducentésimo sexagésimo pase: ese arreglo resolvió el texto flotando,
  // pero generó un problema nuevo que reportó el usuario — la chapita YA
  // era una ilustración con su propio marco (madera + pergamino,
  // tornillos dibujados adentro del PNG) y `filaPrincipal` ADEMÁS tenía
  // su propio borde negro grueso + degradé + sombra biselada — dos
  // "tarjetas enmarcadas" una dentro de la otra. Se probó dejar
  // `filaPrincipal` como único elemento con marco (sacándole borde y
  // degradé) y la chapita ilustrada como único punto focal.
  // Ducentésimo sexagésimo primer pase: el usuario no quedó convencido
  // con esa chapita ilustrada — pidió sacar `historial-placa.png` por
  // completo, volver al fondo crema plano que tenía antes (pase 254),
  // agrandar el ícono y el texto de Victoria/Derrota, y ponerle a CADA
  // tarjeta (la fila entera y la chapita) un marco propio prolijo pero
  // chico, en vez del extremo de "sin borde" o "borde grueso biselado"
  // de los pases anteriores. `filaPrincipal` pasa a tener un borde fino
  // neutro (no compite con nada porque ya no hay ninguna ilustración con
  // marco adentro) y la chapita (`placaResultado`) vuelve a ser 100% CSS
  // — fondo crema + borde fino de color según resultado — para que el
  // marco de cada una se lea como una decisión de diseño coherente, no
  // como dos estilos distintos peleando.
  fila: {
    marginBottom: 10,
  },
  filaPrincipal: {
    display: 'flex', alignItems: 'center', gap: 12,
    background: C.cremaSutil,
    border: '1.5px solid rgba(74,44,42,0.28)',
    borderRadius: 12,
    padding: '10px 14px 10px 6px',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.5), 0 2px 6px rgba(0,0,0,0.15)',
  },
  filaPrincipalVictoria: { borderLeft: `6px solid ${C.verdeEsmeralda}` },
  filaPrincipalDerrota: { borderLeft: `6px solid ${C.crimsonOscuro}` },
  // Ducentésimo sexagésimo primer pase: chapita 100% CSS otra vez (sin
  // `historial-placa.png` de fondo) — fondo crema plano, ancho según el
  // contenido (ya no depende de la proporción de ningún PNG, por eso se
  // sacó `ASPECTO_PLACA`), con un marco fino propio cuyo color distingue
  // Victoria/Derrota (ver `placaResultadoVictoria`/`placaResultadoDerrota`
  // más abajo) — el mismo criterio de "marco chico prolijo" que
  // `filaPrincipal`, pero en su propio color.
  placaResultado: {
    position: 'relative', flexShrink: 0,
    height: 68,
    display: 'flex', alignItems: 'center', gap: 8,
    background: C.crema,
    borderRadius: 10,
    padding: '0 16px',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.6), 0 2px 4px rgba(0,0,0,0.18)',
  },
  placaResultadoVictoria: { border: `2px solid ${C.verdeEsmeralda}` },
  placaResultadoDerrota: { border: `2px solid ${C.crimsonOscuro}` },
  // Ducentésimo sexagésimo primer pase: 42 → 46 — el usuario volvió a
  // pedir que la copa/cruz se agrande. Ya no hace falta posicionarlo
  // absoluto sobresaliendo del borde (eso era para compensar que estaba
  // "perdido" contra el tallado de la placa ilustrada) — ahora vive en el
  // flujo normal de la chapita, con un `drop-shadow` liviano para que se
  // despegue un poco del fondo crema plano.
  placaIcono: {
    width: 56, height: 56, objectFit: 'contain', flexShrink: 0,
    filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.25))',
  },
  // Ducentésimo sexagésimo primer pase: 15 → 19 — el usuario pidió
  // agrandar más la palabra "Victoria"/"Derrota"; ya no hay un ancho fijo
  // de chapita que la pueda cortar (ahora la chapita mide lo que necesita
  // el contenido), así que hay margen de sobra.
  placaTexto: {
    fontFamily: "'Fredoka', sans-serif", fontWeight: 800, fontSize: 19,
    letterSpacing: 0.2, textTransform: 'uppercase', lineHeight: 1.05,
    whiteSpace: 'nowrap',
  },
  // Mismo truco de contorno con `text-shadow` que ya se usaba en el pase
  // 254 (4 sombras desplazadas simulando un trazo, no hay
  // `-webkit-text-stroke` confiable a este tamaño de letra en todos los
  // navegadores todavía).
  placaTextoVictoria: {
    color: '#3fd374',
    textShadow: '-1px -1px 0 #123a1f, 1px -1px 0 #123a1f, -1px 1px 0 #123a1f, 1px 1px 0 #123a1f',
  },
  placaTextoDerrota: {
    color: C.crimsonClaro,
    textShadow: '-1px -1px 0 #3a0f0a, 1px -1px 0 #3a0f0a, -1px 1px 0 #3a0f0a, 1px 1px 0 #3a0f0a',
  },
  filaContenido: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 },
  filaContenidoTop: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
  // Ducentésimo quincuagésimo noveno pase: color oscuro (era doradoClaro,
  // pensado para el fieltro verde) — ahora la fila entera vive sobre
  // pergamino claro (ver `filaPrincipal`), doradoClaro casi no se leía ahí.
  torneoNombre: { fontFamily: "'Fredoka', sans-serif", fontWeight: 600, fontSize: 13, color: C.doradoOscuro },
  coronaTag: { color: C.crimsonOscuro, fontWeight: 800 },
  // Cinta de modo — mismo criterio que `placaResultado`: tamaño fijo
  // calculado a partir de la proporción real del PNG (`ASPECTO_CINTA`),
  // con el texto centrado ENCIMA de la cinta ilustrada.
  cintaModoWrap: {
    position: 'relative', flexShrink: 0,
    height: 24, width: 24 * ASPECTO_CINTA,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  cintaModoImg: { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' },
  cintaModoTexto: {
    position: 'relative', top: -2, fontSize: 10.5, fontWeight: 800, color: '#3A1E0A',
    textTransform: 'uppercase', letterSpacing: 0.3, fontFamily: "'Fredoka', sans-serif", lineHeight: 1,
  },

  // "Detalles de partida en marrón café legible" — color oscuro (era
  // `cremaFieltro`, pensado para el fieltro verde) ahora que la fila
  // entera vive sobre pergamino claro. Un solo color sirve para Victoria
  // y Derrota porque las dos comparten el mismo fondo de tarjeta.
  cardInfo: { fontSize: 12.5, fontWeight: 700, color: '#7a6660' },
};
