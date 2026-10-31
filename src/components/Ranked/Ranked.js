import React, { useState, useEffect, useCallback, useRef } from 'react';
import { API_URL as BASE_URL } from '../../config';
import { rangoUi } from '../Perfil/rangosUi';
import PopupMadera, { PlacaMadera } from '../Popup/PopupMadera';
import { ANILLOS, BANNERS, MAZOS } from '../../constants/personalizacion';

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

// Pase 634: pergamino de la app (#F4E2C2) en vez del casi blanco del kit.
const PERGAMINO = '#F4E2C2';

const C = {
  crema: '#FFF8ED', chocolate: '#4A2C2A', dorado: '#F5B041', doradoClaro: '#FFD668',
  verdeOscuro: '#1f7a3c', crimsonOscuro: '#c2352a',
};

// Pase 613: enfriamiento por abandonos (mismo criterio que la app).
function textoEspera(seg) {
  if (seg >= 3600) return `${Math.floor(seg / 3600)} h ${String(Math.floor((seg % 3600) / 60)).padStart(2, '0')} min`;
  return `${String(Math.floor(seg / 60)).padStart(2, '0')}:${String(seg % 60).padStart(2, '0')}`;
}
// Cuánto dura el próximo enfriamiento según los abandonos recientes (el siguiente abandono cuenta como n + 1).
function proximoEnfriamiento(n) {
  const siguiente = n + 1;
  return siguiente >= 4 ? '24 horas' : siguiente === 3 ? '30 minutos' : siguiente === 2 ? '5 minutos' : '';
}

export default function Ranked({token, onEntrarAPartida, usuario }) {
  const [resumen, setResumen] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [modo, setModo] = useState('1v1');
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState('');
  const [historial, setHistorial] = useState(null);   // Pase 612
  const [lineaRangos, setLineaRangos] = useState(null);   // Pase 620
  const [altoVentana, setAltoVentana] = useState(typeof window !== 'undefined' ? window.innerHeight : 900);   // Pase 624
  useEffect(() => {
    const alRedimensionar = () => setAltoVentana(window.innerHeight);
    window.addEventListener('resize', alRedimensionar);
    return () => window.removeEventListener('resize', alRedimensionar);
  }, []);
  const [popup, setPopup] = useState(null);   // Pase 622: 'rangos' | 'temporada' | 'partidas' | 'hitos' | 'reglas' (tarjetas secundarias en popup)
  const [partidaAbierta, setPartidaAbierta] = useState(null);
  const [bloqueoFin, setBloqueoFin] = useState(0);   // Pase 613: hora (ms) en que termina el enfriamiento por abandonos
  const [ahora, setAhora] = useState(Date.now());

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

  // Pase 613: cuenta regresiva del enfriamiento por abandonos.
  useEffect(() => {
    setBloqueoFin(resumen?.bloqueo?.bloqueado ? Date.now() + resumen.bloqueo.segundos * 1000 : 0);
    setAhora(Date.now());
  }, [resumen]);
  useEffect(() => {
    if (!bloqueoFin) return undefined;
    const t = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(t);
  }, [bloqueoFin]);
  const segundosBloqueo = Math.max(0, Math.ceil((bloqueoFin - ahora) / 1000));
  const bloqueado = bloqueoFin > 0 && segundosBloqueo > 0;
  const abandonosRecientes = resumen?.bloqueo?.abandonosRecientes ?? 0;

  // Pase 612: últimas partidas de Liga (accesorio: si falla, la pantalla sigue sin ese panel).
  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const res = await fetch(`${API_SALAS}/ranked/historial?limite=10`, { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        if (vivo && res.ok && Array.isArray(data.partidas)) setHistorial(data);
      } catch (err) { console.error('Error cargando historial de la Liga:', err); }
    })();
    return () => { vivo = false; };
  }, [token]);

  // Pase 620: línea de tiempo de rangos y eventos de inauguración (accesorio: si falla, el panel no se muestra).
  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const res = await fetch(`${API_SALAS}/ranked/rangos`, { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        if (vivo && res.ok && Array.isArray(data.rangos)) setLineaRangos(data);
      } catch (err) { console.error('Error cargando la línea de rangos:', err); }
    })();
    return () => { vivo = false; };
  }, [token]);

  const buscarPartida = async () => {
    if (buscando || bloqueado) return;
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

  // Pase 624: con la ventana alta se muestra abierta la información principal; con la ventana chica quedan las tarjetas que abren carteles.
  const nivelEspacio = altoVentana >= 1240 ? 2 : altoVentana >= 1000 ? 1 : 0;

  if (cargando) return <div style={estilos.cargando}>Cargando…</div>;

  // Pase 624: el contenido de Rangos / Temporada / Hitos se usa en el cartel y, si la ventana es alta, directamente en la página.
  const renderRangos = () => (
          <div>
            <div style={estilos.rangosIntro}>
              {`Arrastrá hacia los costados. Cada vez que llegás a un rango nuevo cobrás mates una sola vez (hasta ${lineaRangos.totalMates} en total).`}
            </div>
            <LineaRangos data={lineaRangos} />
          </div>
  );
  const renderTemporada = () => (
          <div>
            {resumen?.clasificacion && !resumen.clasificacion.completa && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ ...estilos.serieEtiqueta, textAlign: 'center', marginBottom: 8 }}>{`Clasificando ${resumen.clasificacion.jugadas}/${resumen.clasificacion.total}`}</div>
                <Circulos total={resumen.clasificacion.total} verdes={resumen.clasificacion.victorias} rojos={Math.max(0, resumen.clasificacion.jugadas - resumen.clasificacion.victorias)} />
                <div style={estilos.serieNota}>
                  {`Tus primeras ${resumen.clasificacion.total} partidas de Liga no mueven puntos: al terminar la última te asignamos tu rango según las victorias.`}
                </div>
              </div>
            )}
            {resumen?.serie && resumen.serie.activa && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ ...estilos.serieEtiqueta, textAlign: 'center', marginBottom: 8 }}>{`Serie de ascenso${resumen.serie.objetivo ? ` a ${resumen.serie.objetivo}` : ''}`}</div>
                <div style={estilos.serieFila}><span style={estilos.serieEtiqueta}>Victorias</span><Circulos total={resumen.serie.ganarPara} verdes={resumen.serie.victorias} rojos={0} /></div>
                <div style={estilos.serieFila}><span style={estilos.serieEtiqueta}>Derrotas</span><Circulos total={resumen.serie.perderPara} verdes={0} rojos={resumen.serie.derrotas} /></div>
                <div style={estilos.serieNota}>
                  {`Ganá ${Math.max(0, resumen.serie.ganarPara - resumen.serie.victorias)} más para subir. Con ${resumen.serie.perderPara} derrotas la serie se cae y volvés al 75 % de tu barra.`}
                </div>
              </div>
            )}
            <div style={estilos.statsGrid}>
              <Stat label="Jugadas" valor={resumen?.jugadas ?? 0} />
              <Stat label="% Victorias" valor={`${resumen?.porcentajeVictorias ?? 0}%`} color={C.verdeOscuro} />
              <Stat label="Racha" valor={resumen?.rachaVictorias ?? 0} color={C.crimsonOscuro} />
            </div>
            <div style={estilos.notaStats}>
              {`Racha máxima: ${resumen?.rachaMaxima ?? 0}`}
              {(resumen?.escudos ?? 0) > 0 ? ` · Escudos de liga: ${resumen.escudos}` : ''}
            </div>
          </div>
  );
  // Pase 645: en la página (ventana alta) la lista de hitos muestra ~3 a la vista y el resto se desliza (`alto` = alto máximo en px).
  const renderHitos = (alto) => (
    (resumen?.hitos?.length ?? 0) > 0 ? (
          <div style={alto ? { ...estilos.hitosGrid, maxHeight: alto, overflowY: 'auto', paddingRight: 6, scrollbarWidth: 'thin' } : estilos.hitosGrid}>
            {resumen.hitos.map((h) => (
              <div key={h.id} style={estilos.hitoFila}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ ...estilos.hitoTexto, ...(h.cobrado ? { color: '#6B4A34' } : {}) }}>{h.texto}</div>
                  <div style={estilos.hitoBarraFila}>
                    <div style={estilos.hitoBarraPista}>
                      <div style={{ ...estilos.hitoBarraRelleno, ...(h.cobrado ? { background: C.verdeOscuro } : {}), width: `${Math.round((h.actual / h.meta) * 100)}%` }} />
                    </div>
                    <span style={estilos.hitoBarraTexto}>{h.actual}/{h.meta}</span>
                  </div>
                </div>
                <div style={{ ...estilos.hitoPremio, ...(h.cobrado ? { background: C.verdeOscuro, borderColor: '#14532d', color: '#fff' } : {}) }}>
                  <div style={{ fontSize: 15, lineHeight: 1.1 }}>{h.cobrado ? '✓' : `+${h.mates}`}</div>
                  {!h.cobrado && <div style={{ fontSize: 9, fontWeight: 700 }}>mates</div>}
                </div>
              </div>
            ))}
          </div>
    ) : (
      <div style={estilos.notaStats}>Todavía no hay hitos para mostrar.</div>
    )
  );

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
              <div style={estilos.barraFondo}>
                <div style={{ ...estilos.barraRelleno, width: `${Math.round(progreso * 100)}%` }} />
              </div>
              <div style={estilos.barraTexto}>
                {rango.esTop500 ? `${rango.puntos} pts · rango máximo` : `${rango.puntos} / ${rango.rangoMax + 1} pts`}
              </div>
              {resumen?.clasificacion && !resumen.clasificacion.completa && (
                <div style={estilos.miniSerie}>{`Clasificando ${resumen.clasificacion.jugadas}/${resumen.clasificacion.total}`}</div>
              )}
              {resumen?.serie?.activa && (
                <div style={estilos.miniSerie}>{`Serie de ascenso: ${resumen.serie.victorias}/${resumen.serie.ganarPara} ✓ · ${resumen.serie.derrotas}/${resumen.serie.perderPara} ✕`}</div>
              )}
            </div>
          )}
        </PlacaMadera>

        {/* B + C. Modalidad y búsqueda */}
        <PlacaMadera style={{ display: 'flex', flexDirection: 'column', flex: '1 1 340px', minWidth: 0 }} colorInterior={PERGAMINO} interiorStyle={{ padding: 18, flex: 1 }}>
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

          <button onClick={buscarPartida} disabled={buscando || bloqueado} style={{ ...estilos.btnBuscar, ...(bloqueado ? { opacity: 0.6, cursor: 'not-allowed' } : {}) }}>
            {buscando ? 'Buscando...' : bloqueado ? `ESPERÁ ${textoEspera(segundosBloqueo)}` : 'BUSCAR PARTIDA DE LIGA'}
          </button>

          {/* Pase 613: aviso de abandonos (enfriamiento activo o advertencia del próximo) */}
          {bloqueado ? (
            <div style={estilos.error}>{`Abandonaste partidas de Liga seguido: podés volver a buscar en ${textoEspera(segundosBloqueo)}.`}</div>
          ) : abandonosRecientes > 0 ? (
            <div style={estilos.avisoAbandono}>
              {`Abandonaste ${abandonosRecientes} ${abandonosRecientes === 1 ? 'partida' : 'partidas'} de Liga en los últimos ${resumen?.penalidadAbandono?.diasVentana ?? 7} días.`
                + (proximoEnfriamiento(abandonosRecientes) ? ` Otro abandono te deja ${proximoEnfriamiento(abandonosRecientes)} sin poder buscar Liga.` : '')}
            </div>
          ) : null}

          <div style={estilos.hintBuscando}>
            {salasBuscando > 0
              ? `Hay ${salasBuscando} ${salasBuscando === 1 ? 'sala esperando' : 'salas esperando'} en ${modo}`
              : `Nadie esperando en ${modo} ahora: ¡creá una sala y sé el primero!`}
          </div>
        </PlacaMadera>
        </div>


        {/* Pase 624: ventana alta → Rangos abierto en la página */}
        {nivelEspacio >= 1 && lineaRangos && (
          <PlacaMadera style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }} colorInterior={PERGAMINO} interiorStyle={{ padding: 14 }}>
            <div style={{ ...estilos.panelTitulo, marginBottom: 4 }}>Rangos y premios</div>
            {renderRangos()}
          </PlacaMadera>
        )}

        {/* Pase 624: ventana muy alta → Temporada y Hitos abiertos también */}
        {nivelEspacio >= 2 && (
          <div style={estilos.fila}>
            {/* Pase 643: Temporada más baja y, en el espacio que sobra debajo, las tarjetas de Partidas y Reglas (la página queda más corta) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, flex: '1 1 300px', minWidth: 0 }}>
              <PlacaMadera style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }} colorInterior={PERGAMINO} interiorStyle={{ padding: '10px 14px' }}>
                <div style={{ ...estilos.panelTitulo, marginBottom: 6 }}>Tu temporada</div>
                {renderTemporada()}
              </PlacaMadera>
              <div style={{ display: 'flex', gap: 14, flex: 1 }}>
                <TileLiga chica icono="/assets/images/icono-rango.png" titulo="Partidas" sub={`${Math.min(10, historial?.partidas?.length ?? 0)} últimas`} onClick={() => setPopup('partidas')} />
                <TileLiga chica icono="/assets/images/icono-misiones.png" titulo="Reglas" sub="Cómo sumás" onClick={() => setPopup('reglas')} />
              </div>
            </div>
            <PlacaMadera style={{ display: 'flex', flexDirection: 'column', flex: '1 1 300px', minWidth: 0 }} colorInterior={PERGAMINO} interiorStyle={{ padding: 14, flex: 1 }}>
              <div style={{ ...estilos.panelTitulo, marginBottom: 8 }}>{`Hitos de la Liga · ${(resumen?.hitos ?? []).filter((h) => h.cobrado).length}/${resumen?.hitos?.length ?? 0}`}</div>
              {renderHitos(205)}
            </PlacaMadera>
          </div>
        )}

        {/* Pase 622: una sola pantalla sin scroll: las tarjetas secundarias abren su cartel (igual que en la app) */}
        <div style={estilos.tilesFila}>
          {(nivelEspacio < 1 || !lineaRangos) && <TileLiga icono={ui.logo} titulo="Rangos" sub="Premios" onClick={() => setPopup('rangos')} />}
          {nivelEspacio < 2 && <TileLiga icono="/assets/images/icono-rendimiento.png" titulo="Temporada" sub={`${resumen?.porcentajeVictorias ?? 0}% victorias`} onClick={() => setPopup('temporada')} />}
          {nivelEspacio < 2 && <TileLiga icono="/assets/images/icono-rango.png" titulo="Partidas" sub={`${Math.min(10, historial?.partidas?.length ?? 0)} últimas`} onClick={() => setPopup('partidas')} />}
          {nivelEspacio < 2 && <TileLiga icono="/assets/images/icono-logros.png" titulo="Hitos" sub={`${(resumen?.hitos ?? []).filter((h) => h.cobrado).length}/${resumen?.hitos?.length ?? 0}`} onClick={() => setPopup('hitos')} />}
          {nivelEspacio < 2 && <TileLiga icono="/assets/images/icono-misiones.png" titulo="Reglas" sub="Cómo sumás" onClick={() => setPopup('reglas')} />}
        </div>

        <PopupMadera
          visible={!!popup}
          colorInterior={PERGAMINO}
          titulo={popup === 'rangos' ? 'Rangos y premios' : popup === 'temporada' ? 'Tu temporada' : popup === 'partidas' ? 'Últimas partidas'
            : popup === 'hitos' ? `Hitos de la Liga · ${(resumen?.hitos ?? []).filter((h) => h.cobrado).length}/${resumen?.hitos?.length ?? 0}` : 'Cómo se suma'}
          anchoMax={popup === 'rangos' ? 1000 : popup === 'partidas' || popup === 'hitos' ? 760 : 520}
          scroll
          centrado={false}
          onCerrar={() => setPopup(null)}
          botones={[{ texto: 'Cerrar', tipo: 'carmesi', onClick: () => setPopup(null) }]}
        >
          {popup === 'rangos' && lineaRangos && renderRangos()}
          {popup === 'rangos' && !lineaRangos && <div style={estilos.notaStats}>No se pudo cargar la línea de rangos. Volvé a intentar en un momento.</div>}

          {popup === 'temporada' && renderTemporada()}

          {popup === 'partidas' && ((historial?.partidas?.length ?? 0) > 0 ? (
            <div>
              <CurvaPuntos curva={historial.curva} />
              <div style={estilos.partidasLista}>
                {historial.partidas.slice(0, 10).map((p) => {
                  const gano = p.resultado === 'victoria';
                  const abierta = partidaAbierta === p.id;
                  const e = p.estadisticas || {};
                  const envidos = (e.envidos || 0) + (e.reales_envido || 0) + (e.faltas_envido || 0);
                  return (
                    <button key={p.id} type="button" onClick={() => setPartidaAbierta(abierta ? null : p.id)} style={estilos.partidaFila}>
                      <div style={estilos.partidaPrincipal}>
                        <span style={{ ...estilos.partidaInsignia, ...(gano ? estilos.partidaGano : estilos.partidaPerdio) }}>{gano ? 'V' : 'D'}</span>
                        <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                          <div style={estilos.partidaTitulo}>{p.modo}{p.rival ? ` · vs ${p.rival}` : ''}</div>
                          <div style={estilos.partidaSub}>{`${p.tantosPropios} - ${p.tantosRival}${p.abandono ? ' · abandono' : ''} · ${fechaCorta(p.fecha)}`}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ ...estilos.partidaDelta, color: p.delta > 0 ? C.verdeOscuro : p.delta < 0 ? C.crimsonOscuro : C.chocolate }}>{p.delta > 0 ? `+${p.delta}` : `${p.delta}`}</div>
                          <div style={estilos.partidaSub}>{p.puntosDespues} pts</div>
                        </div>
                      </div>
                      {abierta && (
                        <div style={estilos.partidaDetalle}>
                          {`Trucos ${e.trucos || 0} · Envidos ${envidos} · Flores ${e.flores || 0} · Al mazo ${e.mazos || 0} · Amagues ${e.faroles || 0}`}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
              {historial.mejorVictoria && (
                <div style={estilos.notaStats}>{`Mejor victoria: ${historial.mejorVictoria.rival} (${historial.mejorVictoria.rivalPuntos} pts)`}</div>
              )}
            </div>
          ) : (
            <div style={estilos.notaStats}>Todavía no jugaste partidas de Liga. Cuando juegues, las vas a ver acá con tu curva de puntos.</div>
          ))}

          {popup === 'hitos' && renderHitos()}

          {popup === 'reglas' && (
            <ul style={estilos.lista}>
              <li>Ganarle a alguien de mayor rango suma más; ganarle a uno de menor rango suma menos.</li>
              <li>Perder contra alguien de menor rango resta más.</li>
              <li>3 victorias seguidas dan +10 pts extra por victoria.</li>
              <li>Al ascender de rango ganás escudos que te protegen de bajar de liga.</li>
              <li>En Mancebo las derrotas no restan puntos.</li>
              <li>Solo las partidas de Liga Criolla mueven tu rango: las salas casuales no.</li>
              <li>Abandonar una partida de Liga resta 10 pts de más; si abandonás seguido, no podés buscar Liga por un rato. Si querés irte, rendite (1v1): es una derrota normal.</li>
            </ul>
          )}
        </PopupMadera>
      </div>
    </div>
  );
}

// Pase 622: tarjeta chica del kit (cuero + filo de bronce) que abre un cartel.
function TileLiga({ icono, titulo, sub, onClick, chica }) {
  return (
    <button type="button" onClick={onClick} style={chica ? { ...estilos.tile, ...estilos.tileChica } : estilos.tile}>
      <img src={icono} alt="" draggable={false} style={chica ? { ...estilos.tileIcono, ...estilos.tileIconoChico } : estilos.tileIcono} />
      <div style={estilos.tileTitulo}>{titulo}</div>
      <div style={estilos.tileSub}>{sub}</div>
    </button>
  );
}

// Pase 620: línea de tiempo de rangos. Se arrastra con el mouse o el dedo (y con la rueda/trackpad); al abrir queda centrada en el rango actual.
const ANCHO_NODO = 132;

// Pase 641: imagen de la pieza del set Sol de Mayo que se desbloquea en cada rango (dorso, banner o anillo).
const MEDIDAS_PIEZA = { dorso: { w: 32, h: 44 }, banner: { w: 78, h: 43 }, anillo: { w: 46, h: 46 } };
function imagenPieza(tipo) {
  const lista = tipo === 'dorso' ? MAZOS : tipo === 'banner' ? BANNERS : tipo === 'anillo' ? ANILLOS : null;
  const item = lista && lista.find((x) => x.id === 'pionero');
  return item ? (tipo === 'dorso' ? item.dorso : item.imagen) : null;
}
function LineaRangos({ data }) {
  const ref = useRef(null);
  const arrastre = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.scrollLeft = Math.max(0, (data.rangoActual - 1) * ANCHO_NODO + ANCHO_NODO / 2 - el.clientWidth / 2);
  }, [data.rangoActual]);
  const ultimo = data.rangos.length - 1;
  const empezar = (e) => {
    if (e.pointerType === 'touch') return;   // el dedo ya desplaza solo
    arrastre.current = { x: e.clientX, left: ref.current.scrollLeft };
    ref.current.setPointerCapture?.(e.pointerId);
  };
  const mover = (e) => { if (arrastre.current) ref.current.scrollLeft = arrastre.current.left - (e.clientX - arrastre.current.x); };
  const soltar = () => { arrastre.current = null; };
  return (
    <div ref={ref} style={estilos.lineaCaja} onPointerDown={empezar} onPointerMove={mover} onPointerUp={soltar} onPointerCancel={soltar} role="list" aria-label="Rangos de la Liga Criolla">
      {data.rangos.map((r, i) => {
        const ui = rangoUi({ id: r.id });
        const siguienteAlcanzado = !!data.rangos[i + 1]?.alcanzado;
        return (
          <div key={r.id} style={estilos.nodo} role="listitem">
            <div style={{ ...estilos.nodoPuntos, ...(r.actual ? { color: '#B9770E' } : {}) }}>{`${r.min} pts`}</div>
            <div style={estilos.nodoLineaFila}>
              <div style={{ ...estilos.nodoLinea, ...(i === 0 ? { background: 'transparent' } : r.alcanzado ? { background: C.dorado } : {}) }} />
              <div style={{ ...estilos.nodoPunto, ...(r.alcanzado ? { background: C.dorado, borderColor: '#B9770E' } : {}), ...(r.actual ? estilos.nodoPuntoActual : {}) }} />
              <div style={{ ...estilos.nodoLinea, ...(i === ultimo ? { background: 'transparent' } : siguienteAlcanzado ? { background: C.dorado } : {}) }} />
            </div>
            <img src={ui.logo} alt="" draggable={false} style={{ ...estilos.nodoLogo, ...(r.alcanzado ? {} : { opacity: 0.45 }) }} />
            <div style={{ ...estilos.nodoNombre, ...(r.actual ? { color: '#B9770E' } : {}) }}>{r.nombre}</div>
            {r.mates > 0 ? (
              <div style={{ ...estilos.nodoMates, ...(r.cobrado ? { background: C.verdeOscuro, borderColor: '#14532d', color: '#fff' } : {}) }}>
                {r.cobrado ? `✓ +${r.mates}` : `+${r.mates} mates`}
              </div>
            ) : (
              <div style={estilos.nodoInicio}>Inicio</div>
            )}
            {r.cosmetico ? (
              <div style={{ ...estilos.nodoCosmetico, ...(r.cosmetico.disponible && r.alcanzado ? { borderStyle: 'solid', borderColor: C.verdeOscuro } : {}) }}>
                {imagenPieza(r.cosmetico.tipo) && (
                  <img src={imagenPieza(r.cosmetico.tipo)} alt="" draggable={false}
                    style={{ ...(MEDIDAS_PIEZA[r.cosmetico.tipo] ? { width: MEDIDAS_PIEZA[r.cosmetico.tipo].w, height: MEDIDAS_PIEZA[r.cosmetico.tipo].h } : {}), objectFit: 'contain', marginBottom: 3, ...(r.alcanzado ? {} : { opacity: 0.55, filter: 'grayscale(0.6)' }) }} />
                )}
                <div style={estilos.nodoCosmeticoTexto}>{r.cosmetico.texto}</div>
                <div style={estilos.nodoCosmeticoSub}>{r.cosmetico.disponible ? (r.alcanzado ? 'Desbloqueado' : 'Se desbloquea acá') : 'Próximamente'}</div>
              </div>
            ) : <div style={estilos.nodoCosmeticoVacio} />}
            {r.actual ? <div style={estilos.nodoAqui}>ESTÁS ACÁ</div> : <div style={{ height: 22 }} />}
          </div>
        );
      })}
    </div>
  );
}

function fechaCorta(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// Pase 612: fila de círculos (series y clasificación): verdes = victorias, rojos = derrotas, vacíos = pendientes.
function Circulos({ total, verdes, rojos }) {
  return (
    <div style={estilos.circulosFila}>
      {Array.from({ length: total }, (_, i) => {
        const estado = i < verdes ? 'v' : i < verdes + rojos ? 'd' : 'p';
        return (
          <span key={i} style={{ ...estilos.circulo, ...(estado === 'v' ? estilos.circuloVerde : estado === 'd' ? estilos.circuloRojo : {}) }}>
            {estado === 'v' ? '✓' : estado === 'd' ? '✕' : ''}
          </span>
        );
      })}
    </div>
  );
}

// Pase 612: curva de puntos de las últimas partidas (de la más vieja a la más nueva).
function CurvaPuntos({ curva }) {
  if (!curva || curva.length < 2) return null;
  const W = 600, H = 90, pad = 12;
  const min = Math.min(...curva), max = Math.max(...curva);
  const rango = Math.max(max - min, 1);
  const x = (i) => pad + (i * (W - pad * 2)) / (curva.length - 1);
  const y = (v) => pad + (1 - (v - min) / rango) * (H - pad * 2);
  const puntos = curva.map((v, i) => `${x(i)},${y(v)}`).join(' ');
  return (
    <div style={estilos.curvaCaja}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }} role="img" aria-label="Curva de puntos de tus últimas partidas">
        <line x1={pad} x2={W - pad} y1={H - pad} y2={H - pad} stroke="#C9A66B" strokeWidth="1" />
        <polyline points={puntos} fill="none" stroke="#B9770E" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={x(curva.length - 1)} cy={y(curva[curva.length - 1])} r="6" fill="#F5B041" stroke="#4A2C2A" strokeWidth="2.5" />
      </svg>
      <div style={estilos.curvaEjes}><span>{min} pts</span><span>{max} pts</span></div>
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

const estilos = {
  tilesFila: { display: 'flex', flexWrap: 'wrap', gap: 14, justifyContent: 'center' },
  tile: {
    flex: '1 1 150px', maxWidth: 260, minHeight: 150, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
    background: '#3B1A12', border: '3px solid #8C6239', borderRadius: 16, cursor: 'pointer', padding: '12px 8px', boxShadow: '0 4px 0 #000',
  },
  tileIcono: { width: 76, height: 76, objectFit: 'contain' },
  tileChica: { flex: '1 1 0', maxWidth: 'none', minHeight: 100, minWidth: 0 },
  tileIconoChico: { width: 56, height: 56 },
  tileTitulo: { fontFamily: "'Fredoka', sans-serif", fontWeight: 600, fontSize: 19, color: C.doradoClaro },
  tileSub: { fontFamily: "'Nunito', sans-serif", fontWeight: 700, fontSize: 13, color: C.crema, opacity: 0.85 },
  miniSerie: { fontFamily: "'Nunito', sans-serif", fontWeight: 800, fontSize: 12.5, color: C.crema, marginTop: 6 },
  rangosIntro: { fontFamily: "'Nunito', sans-serif", fontWeight: 700, fontSize: 13, color: '#6B4A34', textAlign: 'center', margin: '4px 0 10px', lineHeight: 1.35 },
  lineaCaja: { display: 'flex', overflowX: 'auto', cursor: 'grab', userSelect: 'none', touchAction: 'pan-x pan-y', paddingBottom: 8, scrollbarWidth: 'thin' },
  nodo: { flex: `0 0 ${ANCHO_NODO}px`, width: ANCHO_NODO, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 },
  nodoPuntos: { fontFamily: "'Nunito', sans-serif", fontWeight: 800, fontSize: 13, color: '#6B4A34' },
  nodoLineaFila: { display: 'flex', alignItems: 'center', alignSelf: 'stretch', height: 18 },
  nodoLinea: { flex: 1, height: 5, background: 'rgba(110,75,40,0.35)' },
  nodoPunto: { width: 14, height: 14, borderRadius: '50%', border: '2px solid #6E4B28', background: '#E8D5AE', boxSizing: 'border-box', flexShrink: 0 },
  nodoPuntoActual: { width: 20, height: 20, border: '3px solid #4A2C2A', background: C.doradoClaro },
  nodoLogo: { width: 84, height: 84, objectFit: 'contain', pointerEvents: 'none' },
  nodoNombre: { fontFamily: "'Fredoka', sans-serif", fontWeight: 700, fontSize: 16, color: C.chocolate },
  nodoMates: { padding: '2px 10px', borderRadius: 12, background: C.dorado, border: '2px solid #B9853F', fontFamily: "'Nunito', sans-serif", fontWeight: 800, fontSize: 13, color: C.chocolate },
  nodoInicio: { padding: '2px 10px', border: '2px solid transparent', fontFamily: "'Nunito', sans-serif", fontWeight: 700, fontSize: 13, color: '#6B4A34' },
  nodoCosmetico: { width: ANCHO_NODO - 18, height: 112, boxSizing: 'border-box', borderRadius: 10, border: '2px dashed #A07A45', background: 'rgba(255,249,234,0.7)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 6px', textAlign: 'center' },
  nodoCosmeticoVacio: { height: 112 },
  nodoCosmeticoTexto: { fontFamily: "'Nunito', sans-serif", fontWeight: 800, fontSize: 12, color: C.chocolate, lineHeight: 1.15 },
  nodoCosmeticoSub: { fontFamily: "'Nunito', sans-serif", fontWeight: 700, fontSize: 11, color: '#8A6A44', marginTop: 2 },
  nodoAqui: { background: C.chocolate, color: C.doradoClaro, borderRadius: 8, padding: '2px 10px', fontFamily: "'Fredoka', sans-serif", fontWeight: 700, fontSize: 11.5, letterSpacing: 0.5 },
  circulosFila: { display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' },
  circulo: { width: 32, height: 32, borderRadius: '50%', border: '2.5px solid #6E4B28', background: 'rgba(110,75,40,0.18)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: "'Fredoka', sans-serif", fontWeight: 700, fontSize: 16, boxSizing: 'border-box' },
  circuloVerde: { background: C.verdeOscuro, borderColor: '#14532d' },
  circuloRojo: { background: C.crimsonOscuro, borderColor: '#7f1d1d' },
  serieFila: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 8 },
  serieEtiqueta: { fontFamily: "'Nunito', sans-serif", fontWeight: 800, fontSize: 14, color: C.chocolate },
  serieNota: { fontFamily: "'Nunito', sans-serif", fontWeight: 700, fontSize: 13, color: '#6B4A34', textAlign: 'center', marginTop: 10, lineHeight: 1.35 },
  curvaCaja: { marginBottom: 12, background: '#FFF9EA', borderRadius: 12, border: '2px solid #C9A66B', padding: '6px 8px 4px' },
  curvaEjes: { display: 'flex', justifyContent: 'space-between', fontFamily: "'Nunito', sans-serif", fontWeight: 700, fontSize: 11, color: '#6B4A34' },
  partidasLista: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 8, alignItems: 'start' },
  partidaFila: { background: '#FFF9EA', borderRadius: 12, border: '2px solid #C9A66B', padding: '8px 12px', cursor: 'pointer', width: '100%', font: 'inherit', display: 'block' },
  partidaPrincipal: { display: 'flex', alignItems: 'center', gap: 12 },
  partidaInsignia: { width: 30, height: 30, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: '2px solid', fontFamily: "'Fredoka', sans-serif", fontWeight: 700, fontSize: 15, color: '#fff', flex: '0 0 auto', boxSizing: 'border-box' },
  partidaGano: { background: C.verdeOscuro, borderColor: '#14532d' },
  partidaPerdio: { background: C.crimsonOscuro, borderColor: '#7f1d1d' },
  partidaTitulo: { fontFamily: "'Nunito', sans-serif", fontWeight: 800, fontSize: 14, color: C.chocolate, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  partidaSub: { fontFamily: "'Nunito', sans-serif", fontWeight: 700, fontSize: 12, color: '#6B4A34' },
  partidaDelta: { fontFamily: "'Fredoka', sans-serif", fontWeight: 700, fontSize: 18 },
  partidaDetalle: { fontFamily: "'Nunito', sans-serif", fontWeight: 700, fontSize: 12.5, color: '#6B4A34', marginTop: 8, textAlign: 'center' },
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
  avisoAbandono: { fontFamily: "'Nunito', sans-serif", fontWeight: 700, fontSize: 12, color: '#9A3412', textAlign: 'center', marginTop: 10 },
  hintBuscando: { fontFamily: "'Nunito', sans-serif", fontWeight: 700, fontSize: 12, color: '#8c8078', textAlign: 'center', marginTop: 10 },
  btnReglas: {
    alignSelf: 'center', padding: '8px 22px', borderRadius: 999, border: '3px solid #B9770E', background: C.dorado, color: C.chocolate,
    fontFamily: "'Fredoka', sans-serif", fontWeight: 700, fontSize: 15, cursor: 'pointer', boxShadow: '0 3px 0 #B9770E',
  },
  statsGrid: { display: 'flex', gap: 10 },
  statTile: {
    flex: 1, textAlign: 'center', padding: '8px 6px', borderRadius: 12, border: '2px solid rgba(26,20,16,0.35)', background: '#FFF3D6',
  },
  statValor: { fontFamily: "'Fredoka', sans-serif", fontWeight: 700, fontSize: 22, color: C.chocolate },
  statLabel: { fontFamily: "'Nunito', sans-serif", fontWeight: 700, fontSize: 11.5, color: '#7a6660', marginTop: 2 },
  notaStats: { fontFamily: "'Nunito', sans-serif", fontWeight: 700, fontSize: 12, color: '#7a6660', textAlign: 'center', marginTop: 12 },
  hitosGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10 },
  hitoFila: { display: 'flex', alignItems: 'center', gap: 10, background: '#F4E2C2', borderRadius: 12, border: '2px solid #C9A66B', padding: '8px 10px' },
  hitoTexto: { fontFamily: "'Nunito', sans-serif", fontWeight: 800, fontSize: 13, color: C.chocolate },
  hitoBarraFila: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 5 },
  hitoBarraPista: { flex: 1, height: 10, borderRadius: 6, background: 'rgba(110,75,40,0.22)', border: '1px solid #6E4B28', overflow: 'hidden' },
  hitoBarraRelleno: { height: '100%', background: C.dorado },
  hitoBarraTexto: { fontFamily: "'Nunito', sans-serif", fontWeight: 800, fontSize: 11.5, color: '#6B4A34', minWidth: 30, textAlign: 'right' },
  hitoPremio: { minWidth: 52, textAlign: 'center', padding: '4px 6px', borderRadius: 10, background: C.dorado, border: '2px solid #B9853F', color: C.chocolate, fontFamily: "'Fredoka', sans-serif", fontWeight: 700 },
  lista: { margin: 0, paddingLeft: 20, fontFamily: "'Nunito', sans-serif", fontWeight: 600, fontSize: 13, color: '#5a4a45', lineHeight: 1.5 },
};
