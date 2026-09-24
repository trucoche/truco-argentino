import React, { useState, useEffect, useCallback } from 'react';
import PantallaCarga from '../PantallaCarga/PantallaCarga';
import { API_URL as BASE_URL } from '../../config';

const API_URL = `${BASE_URL}/api/torneos`;
const JUGADORES_POR_EQUIPO = { '1v1': 1, '2v2': 2, '3v3': 3 };

// Pase siguiente: opciones de la tarjeta "Crear torneo", ahora como chips
// tocables en vez de <select> — mismo criterio que ya usa la tarjeta
// "Crear sala" del Lobby (ver MODOS/CUPO_OPCIONES/PUNTOS_OPCIONES/
// TIEMPO_OPCIONES ahí). Se mantienen exactamente los mismos valores que
// ya tenía el <select> de acá (no se sacó "Sin límite" ni el 60s, a
// diferencia de Lobby, que sí los sacó en su propio pase).
const MODOS = ['1v1', '2v2', '3v3'];
const CUPO_OPCIONES = [4, 8, 16];
const PUNTOS_OPCIONES = [15, 30];
const TIEMPO_OPCIONES = [
  { valor: '', label: 'Sin límite' },
  { valor: '15', label: '15s' },
  { valor: '30', label: '30s' },
  { valor: '45', label: '45s' },
  { valor: '60', label: '60s' },
];

const C = {
  verde: '#2D9B4F', verdeOscuro: '#1f7a3c',
  crimson: '#E8483A', crimsonOscuro: '#c2352a',
  dorado: '#FFB627', doradoClaro: '#FFD668', doradoOscuro: '#C9860E',
  celeste: '#4FB3E8',
  crema: '#FFF8ED', chocolate: '#4A2C2A'
};

function Filigrana() {
  const path = (
    <>
      <path d="M2 44 C2 20 20 2 44 2" stroke={C.doradoOscuro} strokeWidth="1.5" />
      <path d="M2 34 C2 16 16 2 34 2" stroke={C.dorado} strokeWidth="1.2" />
      <circle cx="2" cy="44" r="3" fill={C.dorado} />
      <path d="M8 44 C8 24 24 8 44 8" stroke={C.dorado} strokeWidth="0.8" opacity="0.7" />
    </>
  );
  const base = { position: 'absolute', width: 44, height: 44, opacity: 0.55, pointerEvents: 'none' };
  return (
    <>
      <svg style={{ ...base, top: 6, left: 6 }} viewBox="0 0 46 46" fill="none">{path}</svg>
      <svg style={{ ...base, top: 6, right: 6, transform: 'scaleX(-1)' }} viewBox="0 0 46 46" fill="none">{path}</svg>
      <svg style={{ ...base, bottom: 6, left: 6, transform: 'scaleY(-1)' }} viewBox="0 0 46 46" fill="none">{path}</svg>
      <svg style={{ ...base, bottom: 6, right: 6, transform: 'scale(-1,-1)' }} viewBox="0 0 46 46" fill="none">{path}</svg>
    </>
  );
}

// Ya NO recibe onVolver — la navegación de vuelta al Lobby ahora vive en
// la barra del AppShell, no como botón propio de esta pantalla.
export default function Torneos({ token, onVerBracket }) {
  const [torneos, setTorneos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [creando, setCreando] = useState(false);

  const [titulo, setTitulo] = useState('');
  const [modo, setModo] = useState('1v1');
  const [cupoEntradas, setCupoEntradas] = useState(4);
  const [puntosParaGanar, setPuntosParaGanar] = useState(15);
  const [tiempoPorTurno, setTiempoPorTurno] = useState('');

  const [inscribiendoId, setInscribiendoId] = useState(null);
  const [companerosTexto, setCompanerosTexto] = useState('');

  // Pestañas Activos / Finalizados (historial de torneos jugados).
  const [vista, setVista] = useState('activos'); // 'activos' | 'finalizados'
  const [torneosFinalizados, setTorneosFinalizados] = useState([]);
  const [cargandoFinalizados, setCargandoFinalizados] = useState(false);

  const torneoDestacado = torneos.find(
    t => t.estado === 'inscripcion' && Number(t.entradas_actuales) < t.cupo_entradas
  );
  // Pase siguiente: renombrado de "campeonato" a "torneo" en los textos de
  // esta pantalla, a pedido del usuario (mismo concepto, terminología más
  // consistente con el resto de la app).
  const torneosEnJuego = torneos.filter(t => t.estado === 'en-curso').length;
  const jugadoresParticipando = torneos.reduce(
    (acc, t) => acc + Number(t.entradas_actuales) * (JUGADORES_POR_EQUIPO[t.modo] || 1),
    0
  );

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  const cargarTorneos = useCallback(async () => {
    try {
      const res = await fetch(API_URL, { headers });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Error al cargar torneos');
        return;
      }
      setTorneos(data);
      setError('');
    } catch (err) {
      console.error('Error de conexión:', err);
      setError('No se pudo conectar con el servidor');
    } finally {
      setCargando(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    cargarTorneos();
    const intervalo = setInterval(cargarTorneos, 5000);
    return () => clearInterval(intervalo);
  }, [cargarTorneos]);

  // Carga el historial de torneos finalizados solo cuando el usuario
  // entra a esa pestaña por primera vez (no hace falta traerlo de
  // arranque junto con los activos).
  const cargarFinalizados = useCallback(async () => {
    setCargandoFinalizados(true);
    try {
      const res = await fetch(`${API_URL}/historial/mios`, { headers });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Error al cargar el historial de torneos');
        return;
      }
      setTorneosFinalizados(data);
      setError('');
    } catch (err) {
      console.error('Error de conexión:', err);
      setError('No se pudo conectar con el servidor');
    } finally {
      setCargandoFinalizados(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (vista === 'finalizados') cargarFinalizados();
  }, [vista, cargarFinalizados]);

  const handleCrearTorneo = async (e) => {
    e.preventDefault();
    setError('');

    if (!titulo.trim()) {
      setError('Ingresá un título para el torneo');
      return;
    }

    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          titulo,
          modo,
          cupoEntradas: Number(cupoEntradas),
          puntosParaGanar,
          tiempoPorTurno: tiempoPorTurno || null
        })
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Error al crear torneo');
        return;
      }

      setTitulo('');
      setCreando(false);
      cargarTorneos();

    } catch (err) {
      console.error('Error de conexión:', err);
      setError('No se pudo conectar con el servidor');
    }
  };

  const handleInscribirse = async (torneo) => {
    setError('');

    const jugadoresNecesarios = JUGADORES_POR_EQUIPO[torneo.modo];
    let companerosUsernames = [];

    if (jugadoresNecesarios > 1) {
      companerosUsernames = companerosTexto
        .split(',')
        .map(u => u.trim())
        .filter(u => u.length > 0);

      if (companerosUsernames.length !== jugadoresNecesarios - 1) {
        setError(`Este torneo es ${torneo.modo}, necesitás ${jugadoresNecesarios - 1} compañero(s), separados por coma`);
        return;
      }
    }

    try {
      const res = await fetch(`${API_URL}/${torneo.id}/inscribirse`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ companerosUsernames })
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Error al inscribirse');
        return;
      }

      setInscribiendoId(null);
      setCompanerosTexto('');
      cargarTorneos();

    } catch (err) {
      console.error('Error de conexión:', err);
      setError('No se pudo conectar con el servidor');
    }
  };

  const handleDesinscribirse = async (torneo) => {
    setError('');
    try {
      const res = await fetch(`${API_URL}/${torneo.id}/desinscribirse`, {
        method: 'DELETE',
        headers
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Error al desinscribirse');
        return;
      }

      cargarTorneos();
    } catch (err) {
      console.error('Error de conexión:', err);
      setError('No se pudo conectar con el servidor');
    }
  };

return (
    <>
      {error && <div style={estilos.errorBox}>{error}</div>}

      {torneoDestacado && (
        <div style={estilos.destacadoCard}>
          <div style={estilos.destacadoBadge}>🏆 PRÓXIMO TORNEO</div>
          <div style={estilos.destacadoTitulo}>{torneoDestacado.titulo}</div>

          <div style={estilos.destacadoStats}>
            <div style={estilos.destacadoStat}>
              <span style={estilos.destacadoStatValor}>
                {torneoDestacado.entradas_actuales}/{torneoDestacado.cupo_entradas}
              </span>
              <span style={estilos.destacadoStatLabel}>Jugadores</span>
            </div>
            <div style={estilos.destacadoStat}>
              <span style={estilos.destacadoStatValor}>{torneoDestacado.modo}</span>
              <span style={estilos.destacadoStatLabel}>Modo</span>
            </div>
            <div style={estilos.destacadoStat}>
              <span style={estilos.destacadoStatValor}>{torneoDestacado.puntos_para_ganar}</span>
              <span style={estilos.destacadoStatLabel}>Puntos</span>
            </div>
            {/* Pase siguiente: se restauró el costo de inscripción (10 🪙) y
                el premio fijo al campeón (35 🪙, ver PREMIO_CAMPEON_POR_JUGADOR
                en torneoManager.js — no viene del backend, es la misma
                constante que ya paga el sistema) — se muestran acá para que
                se sepa antes de anotarse, mismo criterio que "(cuesta 1 🪙)"
                en salas privadas. */}
            <div style={estilos.destacadoStat}>
              {/* Pase siguiente: Math.round() para que nunca se vean
                  decimales acá (el campo apuesta es numeric en Postgres y
                  puede volver como string tipo "10.00") — a pedido del
                  usuario, "para que sea menos confuso". */}
              <span style={estilos.destacadoStatValor}>🪙 {Math.round(Number(torneoDestacado.apuesta))}</span>
              <span style={estilos.destacadoStatLabel}>Entrada</span>
            </div>
            <div style={estilos.destacadoStat}>
              <span style={estilos.destacadoStatValor}>🪙 35</span>
              <span style={estilos.destacadoStatLabel}>Premio</span>
            </div>
          </div>

          {torneoDestacado.ya_inscripto ? (
            <div style={estilos.destacadoYaInscripto}>✓ Ya estás anotado</div>
          ) : inscribiendoId === torneoDestacado.id ? (
            <div>
              {JUGADORES_POR_EQUIPO[torneoDestacado.modo] > 1 && (
                <input
                  type="text"
                  placeholder={`Usernames de tus ${JUGADORES_POR_EQUIPO[torneoDestacado.modo] - 1} compañero(s), separados por coma`}
                  value={companerosTexto}
                  onChange={(e) => setCompanerosTexto(e.target.value)}
                  style={{ ...estilos.input, marginBottom: 8 }}
                />
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => handleInscribirse(torneoDestacado)} style={{ ...estilos.btnPrimary, flex: 1 }}>
                  Confirmar
                </button>
                <button
                  onClick={() => { setInscribiendoId(null); setCompanerosTexto(''); }}
                  style={estilos.btnSecondary}
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setInscribiendoId(torneoDestacado.id)} style={estilos.destacadoBtn}>
              Anotarme ahora
            </button>
          )}
        </div>
      )}

      <div style={estilos.statsRow}>
        <div style={estilos.statCard}>
          <div style={estilos.statValor}>{jugadoresParticipando}</div>
          <div style={estilos.statLabel}>👥 jugadores participando</div>
        </div>
        <div style={estilos.statCard}>
          <div style={estilos.statValor}>{torneosEnJuego}</div>
          <div style={estilos.statLabel}>🏆 torneos en juego</div>
        </div>
      </div>

      {/* Pase siguiente: la tarjeta "Crear torneo" y la lista de torneos
          disponibles vivían una debajo de la otra (a todo el ancho). A
          pedido del usuario se dividen en 2 columnas — la de crear queda
          más chica (mitad de pantalla) y al lado aparece la lista. Se usa
          CSS grid con auto-fit/minmax en vez de un 50/50 fijo para que en
          pantallas angostas (mobile) las 2 columnas se apilen solas, sin
          necesitar una media query aparte (mismo truco que ya usa
          torneosGrid más abajo). */}
      <div style={estilos.crearYListaWrap}>
      <div style={{ ...estilos.panel, marginBottom: 0 }}>
        <Filigrana />
        <div style={estilos.panelTitle}>🏆 Crear torneo</div>

        {!creando ? (
          <button onClick={() => setCreando(true)} style={estilos.btnSecondary}>+ Nuevo torneo</button>
        ) : (
          <form onSubmit={handleCrearTorneo}>
            <div style={estilos.field}>
              <label style={estilos.label}>Título</label>
              <input
                type="text"
                placeholder="Copa TrucoChe"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                required
                style={estilos.input}
              />
            </div>

            {/* Pase siguiente: los 4 <select> de acá se reemplazan por chips
                tocables — mismo componente visual (opcionesRow/opcionBtn/
                opcionBtnActiva) que ya usa la tarjeta "Crear sala" del
                Lobby, a pedido del usuario para que sea más fácil de
                interactuar (menos abrir/cerrar un dropdown, más tocar
                directo la opción). */}
            <div style={estilos.fieldRow}>
              <div style={estilos.field}>
                <label style={estilos.label}>Modo</label>
                <div style={estilos.opcionesRow}>
                  {MODOS.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setModo(m)}
                      style={{ ...estilos.opcionBtn, ...(modo === m ? estilos.opcionBtnActiva : {}) }}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
              <div style={estilos.field}>
                <label style={estilos.label}>Puntos</label>
                <div style={estilos.opcionesRow}>
                  {PUNTOS_OPCIONES.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPuntosParaGanar(p)}
                      style={{ ...estilos.opcionBtn, ...(puntosParaGanar === p ? estilos.opcionBtnActiva : {}) }}
                    >
                      {p} pts
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div style={estilos.field}>
              <label style={estilos.label}>Cupo de equipos</label>
              <div style={estilos.opcionesRow}>
                {CUPO_OPCIONES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCupoEntradas(c)}
                    style={{ ...estilos.opcionBtn, ...(cupoEntradas === c ? estilos.opcionBtnActiva : {}) }}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div style={estilos.field}>
              <label style={estilos.label}>Tiempo por turno</label>
              <div style={estilos.opcionesRow}>
                {TIEMPO_OPCIONES.map((t) => (
                  <button
                    key={t.valor}
                    type="button"
                    onClick={() => setTiempoPorTurno(t.valor)}
                    style={{ ...estilos.opcionBtn, ...(tiempoPorTurno === t.valor ? estilos.opcionBtnActiva : {}) }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
              <button type="submit" style={{ ...estilos.btnPrimary, flex: 1 }}>✓ Crear torneo</button>
              <button type="button" onClick={() => setCreando(false)} style={{ ...estilos.btnSecondary, width: 'auto', padding: '12px 20px' }}>✕</button>
            </div>
          </form>
        )}
      </div>

      <div style={estilos.listaColumna}>
      <div style={estilos.tabs}>
        <button
          onClick={() => setVista('activos')}
          style={vista === 'activos' ? estilos.tabActiva : estilos.tabInactiva}
        >
          Activos
        </button>
        <button
          onClick={() => setVista('finalizados')}
          style={vista === 'finalizados' ? estilos.tabActiva : estilos.tabInactiva}
        >
          Finalizados
        </button>
      </div>

{vista === 'activos' && (
  <>
    <div style={estilos.sectionTitle}>Torneos disponibles</div>

    {cargando ? (
      // Centésimo cuadragésimo sexto pase: ver PantallaCarga.
      <PantallaCarga completa={false} conLogo={false} />
    ) : torneos.length === 0 ? (
      <p style={{ color: C.crema, textAlign: 'center' }}>No hay torneos activos. ¡Creá uno!</p>
    ) : (
      <div style={estilos.torneosGrid}>
        {torneos.map((t) => {
          const jugadoresNecesarios = JUGADORES_POR_EQUIPO[t.modo];
          const completo = Number(t.entradas_actuales) >= t.cupo_entradas;
          const enCurso = t.estado === 'en-curso';

          return (
            <div key={t.id} style={estilos.torneoCard}>
              <div style={estilos.torneoHeader}>
                <div style={estilos.torneoNombre}>{t.titulo}</div>
                <div style={{ ...estilos.badge, ...(enCurso ? estilos.badgeCurso : estilos.badgeAbierta) }}>
                  {enCurso ? 'En curso' : t.estado === 'inscripcion' ? 'Inscripción abierta' : t.estado}
                </div>
              </div>
              <div style={estilos.torneoInfo}>
                {t.modo} · Cupo {t.entradas_actuales}/{t.cupo_entradas} · {t.puntos_para_ganar} pts · {t.creador_nombre}
              </div>

              {t.estado === 'inscripcion' && !completo && !t.ya_inscripto && (
                inscribiendoId === t.id ? (
                  <div>
                    {jugadoresNecesarios > 1 && (
                      <input
                        type="text"
                        placeholder={`Usernames de tus ${jugadoresNecesarios - 1} compañero(s), separados por coma`}
                        value={companerosTexto}
                        onChange={(e) => setCompanerosTexto(e.target.value)}
                        style={{ ...estilos.input, marginBottom: 8 }}
                      />
                    )}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => handleInscribirse(t)} style={estilos.btnCard}>Confirmar</button>
                      <button onClick={() => { setInscribiendoId(null); setCompanerosTexto(''); }} style={estilos.btnCardSecondary}>
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setInscribiendoId(t.id)} style={estilos.btnCard}>Inscribirse</button>
                )
              )}

              {t.estado === 'inscripcion' && t.ya_inscripto && (
                <button onClick={() => handleDesinscribirse(t)} style={estilos.btnCardCrimson}>
                  Desinscribirme
                </button>
              )}

              {enCurso && (
                <button onClick={() => onVerBracket(t.id)} style={estilos.btnCard}>Ver bracket</button>
              )}
            </div>
          );
        })}
      </div>
    )}
  </>
)}

{vista === 'finalizados' && (
  <>
    <div style={estilos.sectionTitle}>Torneos finalizados</div>

    {cargandoFinalizados ? (
      // Centésimo cuadragésimo sexto pase: ver PantallaCarga.
      <PantallaCarga completa={false} conLogo={false} />
    ) : torneosFinalizados.length === 0 ? (
      <p style={{ color: C.crema, textAlign: 'center' }}>Todavía no jugaste ningún torneo hasta el final.</p>
    ) : (
      <div style={estilos.torneosGrid}>
        {torneosFinalizados.map((t) => (
          <div key={t.id} style={estilos.torneoCard}>
            <div style={estilos.torneoHeader}>
              <div style={estilos.torneoNombre}>{t.titulo}</div>
              {t.soy_campeon && (
                <div style={{ ...estilos.badge, background: '#ffe8c2', color: C.doradoOscuro }}>
                  👑 Campeón
                </div>
              )}
            </div>
            <div style={estilos.torneoInfo}>
              {t.modo} · {t.puntos_para_ganar} pts · {t.creador_nombre}
            </div>
            <button onClick={() => onVerBracket(t.id)} style={estilos.btnCard}>Ver bracket</button>
          </div>
        ))}
      </div>
    )}
  </>
)}
      </div>
      </div>
</>
);
}

const estilos = {
  errorBox: {
    background: '#ffe0dd', border: `2px solid ${C.crimson}`, color: C.crimsonOscuro,
    borderRadius: 10, padding: '8px 12px', marginBottom: 12, fontWeight: 700, fontSize: 13
  },
  panel: {
    background: C.crema, border: `4px solid ${C.chocolate}`, borderRadius: 20,
    boxShadow: '0 6px 0 rgba(0,0,0,0.25)', padding: '18px 18px 20px',
    marginBottom: 18, position: 'relative', overflow: 'hidden'
  },
  destacadoCard: {
    background: `linear-gradient(135deg, ${C.chocolate}, #2e1c15)`,
    border: `4px solid ${C.doradoOscuro}`, borderRadius: 20,
    boxShadow: '0 6px 0 rgba(0,0,0,0.35)', padding: '20px 20px 22px',
    marginBottom: 16, textAlign: 'center'
  },
  destacadoBadge: {
    display: 'inline-block', background: C.dorado, color: C.chocolate,
    fontFamily: "'Fredoka', sans-serif", fontWeight: 700, fontSize: 12,
    padding: '4px 12px', borderRadius: 20, marginBottom: 10, letterSpacing: 0.5
  },
  destacadoTitulo: {
    fontFamily: "'Fredoka', sans-serif", fontWeight: 600, fontSize: 22,
    color: C.crema, marginBottom: 16
  },
  // Pase siguiente: flexWrap agregado — con las 2 stats nuevas (Entrada/
  // Premio) ya son 5 en la fila, y sin wrap podían desbordar en mobile.
  destacadoStats: { display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 18, marginBottom: 18 },
  destacadoStat: { display: 'flex', flexDirection: 'column', alignItems: 'center' },
  destacadoStatValor: {
    fontFamily: "'Fredoka', sans-serif", fontWeight: 700, fontSize: 20,
    color: C.doradoClaro, display: 'flex', alignItems: 'center'
  },
  destacadoStatLabel: { fontSize: 11, color: 'rgba(255,248,237,0.7)', fontWeight: 700, marginTop: 2 },
  destacadoBtn: {
    fontFamily: "'Fredoka', sans-serif", fontWeight: 600, fontSize: 16,
    background: `linear-gradient(180deg, ${C.doradoClaro}, ${C.dorado})`, color: C.chocolate,
    border: `3px solid ${C.chocolate}`, borderRadius: 14, padding: '13px 28px',
    boxShadow: `0 5px 0 ${C.doradoOscuro}`, cursor: 'pointer', width: '100%'
  },
  destacadoYaInscripto: {
    background: 'rgba(255,248,237,0.15)', color: C.doradoClaro,
    fontWeight: 700, fontSize: 14, padding: '10px', borderRadius: 12
  },
  iconoMonedaInline: { width: 16, height: 16, objectFit: 'contain', marginRight: 4 },
  statsRow: { display: 'flex', gap: 12, marginBottom: 16 },
  statCard: {
    flex: 1, background: C.crema, border: `3px solid ${C.chocolate}`,
    borderRadius: 16, padding: '14px', textAlign: 'center'
  },
  statValor: { fontFamily: "'Fredoka', sans-serif", fontWeight: 700, fontSize: 24, color: C.chocolate },
  statLabel: { fontSize: 11, color: '#7a6660', fontWeight: 700, marginTop: 2 },
  panelTitle: { fontFamily: "'Fredoka', sans-serif", fontWeight: 600, fontSize: 19, color: C.chocolate, marginBottom: 14 },
  // Pase siguiente: wrapper de 2 columnas para "Crear torneo" + lista de
  // torneos disponibles (ver comentario arriba de crearYListaWrap en el
  // JSX). minmax(340px,1fr) hace que cada columna use la mitad del ancho
  // disponible cuando entran las 2, y se apilen en una sola columna si no
  // entran (pantallas angostas).
  crearYListaWrap: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
    gap: 18, alignItems: 'start', marginBottom: 18,
  },
  listaColumna: { display: 'flex', flexDirection: 'column', minWidth: 0 },
  field: { marginBottom: 12, flex: 1 },
  fieldRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
  label: { display: 'block', fontWeight: 700, fontSize: 12, color: C.chocolate, marginBottom: 5, textTransform: 'uppercase' },
  select: {
    width: '100%', fontFamily: "'Nunito', sans-serif", fontWeight: 700, fontSize: 14,
    color: C.chocolate, background: '#fff', border: `2.5px solid ${C.chocolate}`,
    borderRadius: 12, padding: '9px 11px'
  },
  // Pase siguiente: chips tocables para "Crear torneo" — mismo estilo que
  // opcionBtn/opcionBtnActiva de Lobby.js (Crear sala), traído acá para
  // que ambas tarjetas se sientan consistentes.
  opcionesRow: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  opcionBtn: {
    flex: 1, minWidth: 56,
    fontFamily: "'Nunito', sans-serif", fontWeight: 700, fontSize: 14,
    color: C.chocolate, background: '#fff', border: `2.5px solid ${C.chocolate}`,
    borderRadius: 12, padding: '9px 6px', cursor: 'pointer', textAlign: 'center',
  },
  opcionBtnActiva: {
    background: C.dorado, boxShadow: `0 3px 0 ${C.doradoOscuro}`,
  },
  input: {
    width: '100%', fontFamily: "'Nunito', sans-serif", fontWeight: 700, fontSize: 14,
    color: C.chocolate, background: '#fff', border: `2.5px solid ${C.chocolate}`,
    borderRadius: 12, padding: '9px 11px'
  },
  btnPrimary: {
    fontFamily: "'Fredoka', sans-serif", fontWeight: 600, fontSize: 15,
    background: `linear-gradient(180deg, ${C.doradoClaro}, ${C.dorado})`, color: C.chocolate,
    border: `3px solid ${C.chocolate}`, borderRadius: 14, padding: '12px 20px',
    boxShadow: `0 5px 0 ${C.doradoOscuro}`, cursor: 'pointer'
  },
  btnSecondary: {
    fontFamily: "'Fredoka', sans-serif", fontWeight: 600, fontSize: 15,
    background: C.crema, color: C.chocolate, border: `3px solid ${C.chocolate}`,
    borderRadius: 14, padding: '12px 20px', boxShadow: '0 5px 0 rgba(74,44,42,0.35)',
    cursor: 'pointer', width: '100%'
  },
  sectionTitle: { fontFamily: "'Fredoka', sans-serif", fontWeight: 600, fontSize: 16, color: C.crema, margin: '4px 0 10px 4px' },
  tabs: { display: 'flex', gap: 8, marginBottom: 14 },
  tabActiva: {
    fontFamily: "'Fredoka', sans-serif", fontWeight: 600, fontSize: 13,
    background: `linear-gradient(180deg, ${C.doradoClaro}, ${C.dorado})`, color: C.chocolate,
    border: `2.5px solid ${C.chocolate}`, borderRadius: 12, padding: '8px 14px',
    boxShadow: `0 3px 0 ${C.doradoOscuro}`, cursor: 'pointer'
  },
  tabInactiva: {
    fontFamily: "'Fredoka', sans-serif", fontWeight: 600, fontSize: 13,
    background: C.crema, color: C.chocolate,
    border: `2.5px solid ${C.chocolate}`, borderRadius: 12, padding: '8px 14px',
    boxShadow: '0 3px 0 rgba(74,44,42,0.3)', cursor: 'pointer'
  },
  torneoCard: {
    background: C.crema, border: `3px solid ${C.chocolate}`, borderRadius: 16,
    padding: '12px 14px', marginBottom: 10, boxShadow: '0 4px 0 rgba(0,0,0,0.2)'
  },
  torneoHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, gap: 8 },
  torneoNombre: { fontFamily: "'Fredoka', sans-serif", fontWeight: 600, fontSize: 15, color: C.chocolate },
  badge: { fontSize: 11, fontWeight: 800, padding: '3px 9px', borderRadius: 20, textTransform: 'uppercase', whiteSpace: 'nowrap' },
  badgeAbierta: { background: '#d8f0da', color: C.verdeOscuro },
  badgeCurso: { background: '#ffe8c2', color: C.doradoOscuro },
  torneoInfo: { fontSize: 12.5, color: '#7a6660', fontWeight: 700, marginBottom: 10 },
  btnCard: {
    fontFamily: "'Fredoka', sans-serif", fontWeight: 600, fontSize: 13,
    background: C.celeste, color: C.chocolate, border: `2px solid ${C.chocolate}`,
    borderRadius: 10, padding: '7px 14px', boxShadow: '0 3px 0 #3a91c2', cursor: 'pointer'
  },
  btnCardSecondary: {
    fontFamily: "'Fredoka', sans-serif", fontWeight: 600, fontSize: 13,
    background: '#fff', color: C.chocolate, border: `2px solid ${C.chocolate}`,
    borderRadius: 10, padding: '7px 14px', boxShadow: '0 3px 0 rgba(74,44,42,0.3)', cursor: 'pointer'
  },
  btnCardCrimson: {
    fontFamily: "'Fredoka', sans-serif", fontWeight: 600, fontSize: 13,
    background: `linear-gradient(180deg, #f06052, ${C.crimson})`, color: C.crema,
    border: `2px solid ${C.chocolate}`, borderRadius: 10, padding: '7px 14px',
    boxShadow: `0 3px 0 ${C.crimsonOscuro}`, cursor: 'pointer'
  },
  torneosGrid: {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
  gap: 12,
},
};