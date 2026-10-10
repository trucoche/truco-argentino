import React, { useState, useEffect, useRef } from 'react';
import PerfilRivalModal from '../PerfilRival/PerfilRivalModal';
import PantallaCarga from '../PantallaCarga/PantallaCarga';
import { PlacaMadera } from '../Popup/PopupMadera';
import { API_URL as BASE_URL } from '../../config';

const API_URL = `${BASE_URL}/api/ranking`;

// Ducentésimo sexagésimo quinto pase: el recorte "busto" del pase
// anterior salía de escalar el PNG de cuerpo entero — no es el asset
// correcto. El usuario señaló que ya existe un sticker de cara/busto
// limpio por personaje, el mismo que usa el chat para las expresiones
// (`public/assets/expresionesGaucho/<personaje>_victorioso.png`, etc.) —
// se usa la variante "victorioso" (tiene sentido temático para una
// pantalla de ranking) recortada a su bbox real y reexportada como
// `<personaje>-avatar-cara.png`. Esta función se usa tanto en el podio
// como en la lista (4°-13°) — antes la lista seguía usando el cuerpo
// entero. Con foto de perfil real no cambia nada, esa ya es un primer
// plano de por sí.
function avatarSrcCaraDe(u) {
  return u?.avatar_tipo === 'foto' && u?.foto_perfil_url
    ? u.foto_perfil_url
    : `/assets/${u?.personaje || 'gaucho'}-avatar-cara.png`;
}

// Ducentésimo sexagésimo segundo pase: rediseño completo de la pantalla —
// se agregan los tonos de madera+bronce del marco exterior (mismos que ya
// usan Historial/Chat Global) para reemplazar los contenedores blancos/
// crema planos por placas de madera de taberna. `bronce`/`bronceOscuro` NO
// se tocan — son el color de la medalla de 3er puesto, un tono distinto
// (más anaranjado) del bronce de los remaches (`remache`/`remacheOscuro`),
// por eso van con nombres separados.
const C = {
  verde: '#2D9B4F', verdeOscuro: '#1f7a3c', verdeEsmeralda: '#1e8f4e',
  dorado: '#FFB627', doradoClaro: '#FFD668', doradoOscuro: '#C9860E',
  plata: '#C7CDD6', plataOscuro: '#8B95A3', plataClaro: '#EDEFF2',
  bronce: '#D08A4E', bronceOscuro: '#A05F2C',
  crema: '#FFF8ED', cremaSutil: '#FFFCF6', chocolate: '#4A2C2A',
  maderaClara: '#6b4a34', maderaMedia: '#4a3226', maderaOscura: '#2a1c14',
  remacheClaro: '#f0d9a0', remache: '#c9973e', remacheOscuro: '#7a5322',
  negroPulido: '#1a1410',
};

// Ducentésimo sexagésimo tercer pase: geometría real del podio ilustrado
// (`ranking-podio.png`) medida sobre el PNG ya recortado a su bbox — el
// usuario decidió usar la imagen de referencia completa (los 3 pedestales
// juntos en un solo archivo) como fondo único del podio, en vez de 3
// pedestales separados. Estas fracciones (0 a 1) marcan, para cada
// columna, el centro horizontal y el borde superior de su "marco" — se
// usan para plantar el cluster de avatar+nombre+stat de cada puesto
// exactamente arriba de su columna, sin importar a qué tamaño se termine
// mostrando la imagen en pantalla (son fracciones, no píxeles fijos).
// Medido con Pillow escaneando el canal alpha columna por columna para
// encontrar el primer píxel opaco de arriba hacia abajo en cada pedestal.
// OJO: el orden de columnas en la imagen es bronce-izquierda / oro-centro
// / plata-derecha (no el 2°-1°-3° que tenía el podio viejo armado en CSS).
const ASPECTO_PODIO = 451 / 250;
// Ducentésimo septuagésimo pase: el ajuste a ojo del pase anterior
// (0.512 → 0.53) se pasó de largo — el usuario pidió alinear el círculo
// con el centro real de la "I" dorada tallada en la puerta del podio, así
// que esta vez se midió con Pillow el glyph de la "I" en sí (aislando su
// tallo, sin contar el marco dorado de la puerta que lo rodea, que tiene
// el mismo tono de oro y contaminaba la medición): su tallo cae en
// x≈222-231 sobre 445px de ancho recortado → centro ≈0.51. `oro.x` vuelve
// a ese valor medido.
const PUESTO_FRACCIONES = {
  bronce: { x: 0.163, top: 0.236 },
  oro: { x: 0.51, top: 0.016 },
  plata: { x: 0.845, top: 0.18 },
};

// Ducentésimo sexagésimo cuarto pase: geometría (también medida con
// Pillow, mismo método que arriba) del RECUADRO DE MADERA DE LA BASE de
// cada pedestal — el bloque/zócalo ancho de la parte de ABAJO de cada
// columna (no la placa angosta de arriba, que ya tiene el número I/II/III
// tallado). El usuario pidió sacar el nombre/victorias de flotar sobre el
// podio y ponerlos centrados adentro de este recuadro. `xCentro`/
// `mitadAncho` dan el rango horizontal, `yArriba`/`yAbajo` el rango
// vertical — todo en fracciones del PNG recortado.
// Ducentésimo sexagésimo sexto pase: re-medido a mano escaneando el ancho
// opaco columna por columna — el zócalo de cada pedestal ENSANCHA (es un
// bloque 3D con bisel) recién cerca del final; el "bloque plano" real
// donde el texto se ve prolijo arranca bastante más abajo de lo que
// tenían las fracciones anteriores (por eso el usuario pedía "bajar" los
// 3 textos), y el borde inferior real del PNG está más abajo de lo que se
// estaba usando (`yAbajo` viejo se quedaba ~9px cortos) — subir `yAbajo`
// hasta ahí da el aire de sobra que faltaba para que nombre y victorias
// no se corten entre sí. `xCentro`/`mitadAncho` también se corrigieron
// con el ancho real del bloque plano (el de oro estaba notoriamente
// angosto: 0.166 vs. el 0.189 real, por eso el texto se cortaba en los
// bordes ahí).
// Ducentésimo sexagésimo séptimo pase: el usuario pidió directamente
// agrandar la "plaqueta" de madera ~25% en alto (además de agrandar la
// tipografía — ver `podioBaseNombre`/`Victorias` — y darle padding
// explícito al bloque de texto). Se sube el rango vertical de las 3
// columnas a un valor único (antes cada una tenía su propio recorte
// ajustado al zócalo real, que quedaba muy angosto) — `yArriba` sube
// hasta donde cada pedestal empieza a ensancharse hacia la base (el
// arranque del bisel) y `yAbajo` se deja con el mismo margen de sobra que
// ya se había validado contra el borde real del PNG.
// Ducentésimo sexagésimo noveno pase: `oro.xCentro` corrido a la derecha
// (0.488 → 0.518) — la placa quedaba notoriamente a la izquierda de la
// columna de 1er puesto (bronce y plata no se tocan, están bien).
const BASE_FRACCIONES = {
  bronce: { xCentro: 0.155, mitadAncho: 0.137, yArriba: 0.81, yAbajo: 0.98 },
  oro: { xCentro: 0.518, mitadAncho: 0.189, yArriba: 0.81, yAbajo: 0.98 },
  plata: { xCentro: 0.851, mitadAncho: 0.14, yArriba: 0.81, yAbajo: 0.98 },
};

// Pase 370: pestañas de alcance del ranking. El orden NO cambia (victorias),
// solo cambia a quién se compara: todos, mi provincia o mi localidad.
const ALCANCES = [
  { clave: 'global', texto: 'Global' },
  { clave: 'provincia', texto: 'Provincia' },
  { clave: 'localidad', texto: 'Mi Localidad' },
];

// "4d 12h" mientras falten días; "5h 20m" el último día; null si ya cerró.
function textoCuentaRegresiva(finISO, ahora) {
  if (!finISO) return '';
  const ms = new Date(finISO).getTime() - ahora;
  if (!(ms > 0)) return 'cerrando';
  const min = Math.floor(ms / 60000);
  const d = Math.floor(min / 1440);
  const h = Math.floor((min % 1440) / 60);
  const m = min % 60;
  return d > 0 ? `${d}d ${h}h` : `${h}h ${m}m`;
}

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

// Ya NO recibe onVolver — navegación de vuelta la maneja el AppShell.
// Recibe usuarioActual (username) para resaltar tu propia fila en la lista.
export default function Ranking({ token, usuarioActual }) {
  const [ranking, setRanking] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [cargandoLista, setCargandoLista] = useState(false);
  const [error, setError] = useState('');
  // Nonagésimo octavo pase: click en cualquier fila (o en el podio) abre
  // el popup de perfil público de ese jugador.
  const [perfilAbierto, setPerfilAbierto] = useState(null);
  // Pase 370: alcance (Global/Provincia/Mi Localidad), datos de temporada +
  // "Tu posición" (GET /api/ranking/info) y reloj para la cuenta regresiva.
  const [alcance, setAlcance] = useState('global');
  const [info, setInfo] = useState(null);
  const [ahora, setAhora] = useState(() => Date.now());
  // Pase 370: 2 columnas (podio+estado | pestañas+lista) cuando el contenedor es ancho.
  const layoutRef = useRef(null);
  const [esAncho, setEsAncho] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 860);
  useEffect(() => {
    const el = layoutRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(([entrada]) => setEsAncho(entrada.contentRect.width >= 760));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let vigente = true;
    const cargarRanking = async () => {
      setCargandoLista(true);
      try {
        const headers = { 'Authorization': `Bearer ${token}` };
        const [res, resInfo] = await Promise.all([
          fetch(`${API_URL}?alcance=${alcance}`, { headers }),
          fetch(`${API_URL}/info?alcance=${alcance}`, { headers }),
        ]);
        const data = await res.json();
        if (!vigente) return;

        if (!res.ok) {
          setError(data.error || 'Error al cargar el ranking');
          return;
        }
        setRanking(data);
        setError('');
        if (resInfo.ok) setInfo(await resInfo.json());
      } catch (err) {
        console.error('Error de conexión:', err);
        if (vigente) setError('No se pudo conectar con el servidor');
      } finally {
        if (vigente) { setCargando(false); setCargandoLista(false); }
      }
    };
    cargarRanking();
    return () => { vigente = false; };
  }, [token, alcance]);

  // Centésimo cuadragésimo sexto pase: ver PantallaCarga — mismo fondo
  // temático que el resto de las pantallas, en vez del texto suelto.
  if (cargando) {
    return <PantallaCarga />;
  }

  if (error) {
    return <div style={estilos.errorBox}>{error}</div>;
  }

  const podio = ranking.slice(0, 3);
  const resto = ranking.slice(3);

  // El podio se arma visualmente en orden 2°-1°-3° (el primero más alto,
  // al medio), pero seguimos usando el puesto real de cada uno para
  // colores/tamaños — por eso vamos a buscarlos por índice del array
  // original en vez de asumir que "el del medio siempre es index 0".
  const [p1, p2, p3] = podio;

  const zonaTexto = info?.yo?.localidad || info?.yo?.provincia || '';
  const cuenta = textoCuentaRegresiva(info?.temporada?.fin, ahora);

  // Pase 370: timer sutil de la temporada (solo cuenta regresiva por ahora).
  const bloqueTimer = info?.temporada ? (
    <div style={estilos.timerTemporada} title={info.temporada.nombre}>
      <span style={estilos.timerEtiqueta}>Fin de Temporada:</span>
      <span style={estilos.timerValor}>{cuenta}</span>
    </div>
  ) : null;

  const bloquePodio = (
    <>
      {/* Ducentésimo sexagésimo segundo pase: el marco blanco/crema plano
          pasa a ser la misma "gran placa de madera de taberna" que ya usan
          Historial/Chat Global — madera oscura + remaches de bronce por
          fuera, pergamino cálido por dentro (en vez del fieltro verde de
          las otras pantallas, para que se sienta como una vitrina de
          trofeos y no como una mesa de juego).
          Ducentésimo sexagésimo cuarto pase: el usuario mandó los 3
          marcos de avatar definitivos (oro/plata/bronce, mismo diseño
          "ojo de buey" de madera+metal con remaches) y pidió 3 ajustes:
          (1) agrandar el panel para que el marco de oro (el más alto, casi
          toca el borde superior del PNG del podio) no quede cortado por
          el marco de madera — se resuelve con más padding-top en
          `podioInterior`; (2) sacar el nombre/victorias de flotar sueltos
          y ponerlos DENTRO del recuadro de madera de la base de cada
          pedestal (`BASE_FRACCIONES`, con texto blanco/dorado con
          contorno negro) — así arriba de cada columna queda SOLO el
          marco del avatar, sin texto flotando (se sacó también la corona,
          por lo mismo).
          Ducentésimo sexagésimo quinto pase: 3 ajustes más — (a) el
          recorte de "busto" salía de escalar el PNG de cuerpo entero, que
          no es el asset correcto; ahora usa el sticker de cara limpio que
          ya existe para el chat (`avatarSrcCaraDe`, variante
          "victorioso"), igual en el podio y en la lista de abajo; (b) el
          nombre/victorias de la base ya tenían padding, se ajustó el
          recuadro (`BASE_FRACCIONES`) para que no queden pegados al borde
          inferior de la madera; (c) resplandor dorado (`podioGloriaOro`)
          detrás de la columna de 1er puesto para que el ojo vaya ahí de
          entrada. */}
      <div style={estilos.podioPanelExterior}>
        <span style={{ ...estilos.remache, top: 10, left: 10 }} />
        <span style={{ ...estilos.remache, top: 10, right: 10 }} />
        <span style={{ ...estilos.remache, bottom: 10, left: 10 }} />
        <span style={{ ...estilos.remache, bottom: 10, right: 10 }} />
        <div style={estilos.podioInterior}>
          <Filigrana />
          <div style={estilos.podioImgWrap}>
            <div style={estilos.podioGloriaOro} />
            <img src="/assets/images/ranking-podio.png" alt="" style={estilos.podioImg} />

            {[
              { p: p3, key: 'bronce', wrap: estilos.marcoAvatarWrapChico, foto: estilos.marcoAvatarFoto, marco: 'ranking-marco-bronce.png', colorBorde: C.bronceOscuro, colorGlow: 'rgba(208,138,78,0.38)' },
              { p: p1, key: 'oro', wrap: estilos.marcoAvatarWrapGrande, foto: estilos.marcoAvatarFotoGrande, marco: 'ranking-marco-oro.png', colorBorde: C.doradoOscuro, colorGlow: 'rgba(255,182,39,0.5)' },
              { p: p2, key: 'plata', wrap: estilos.marcoAvatarWrapChico, foto: estilos.marcoAvatarFoto, marco: 'ranking-marco-plata.png', colorBorde: C.plataOscuro, colorGlow: 'rgba(199,205,214,0.42)' },
            ].map(({ p, key, wrap, foto, marco, colorBorde, colorGlow }) => {
              if (!p) return null;
              const fr = PUESTO_FRACCIONES[key];
              const bf = BASE_FRACCIONES[key];
              return (
                <React.Fragment key={key}>
                  <div
                    style={{ ...estilos.podioCluster, left: `${fr.x * 100}%`, top: `${fr.top * 100}%` }}
                    onClick={() => setPerfilAbierto(p.username)}
                  >
                    <div style={wrap}>
                      <img src={`/assets/images/${marco}`} alt="" style={estilos.marcoAvatarImg} />
                      <img src={avatarSrcCaraDe(p)} alt="" style={foto} />
                    </div>
                  </div>
                  {/* Ducentésimo sexagésimo octavo pase: el usuario pidió una
                      "placa" real detrás del nombre/victorias, en vez de que
                      el texto flote directo sobre la textura del podio —
                      mismo criterio de plaquita oscura con borde que ya se
                      usa en otros paneles, pero el borde (y un glow sutil a
                      juego) toma el color de la medalla de cada puesto. */}
                  <div
                    style={{
                      ...estilos.podioBaseTexto,
                      ...estilos.podioBasePlaca,
                      left: `${(bf.xCentro - bf.mitadAncho) * 100}%`,
                      top: `${bf.yArriba * 100}%`,
                      width: `${bf.mitadAncho * 2 * 100}%`,
                      height: `${(bf.yAbajo - bf.yArriba) * 100}%`,
                      border: `1.5px solid ${colorBorde}`,
                      boxShadow: [
                        'inset 0 1px 0 rgba(255,255,255,0.14)',
                        'inset 0 -3px 6px rgba(0,0,0,0.45)',
                        '0 2px 4px rgba(0,0,0,0.4)',
                        `0 0 10px 1px ${colorGlow}`,
                      ].join(', '),
                    }}
                    onClick={() => setPerfilAbierto(p.username)}
                  >
                    <div style={estilos.podioBaseNombre}>{p.username}</div>
                    <div style={estilos.podioBaseVictorias}>{p.partidas_ganadas} victorias</div>
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </div>

    </>
  );

  // Pase 370: "Tu posición" — tarjeta fija con tu avatar, tu puesto en el alcance elegido,
  // tus victorias y el badge zonal (localidad, o provincia si no cargaste localidad).
  const yo = info?.yo;
  const bloqueTuPosicion = yo ? (
    <PlacaMadera style={estilos.tuPosicionPlaca} interiorStyle={estilos.tuPosicionInterior} colorInterior="#FFE9B0">
      <div style={estilos.tuPosicionTitulo}>Tu posición</div>
      <div style={estilos.tuPosicionFila}>
        <div style={estilos.tuPosicionAvatar}><img src={avatarSrcCaraDe(yo)} alt="" style={estilos.filaAvatarImg} /></div>
        <div style={estilos.tuPosicionDatos}>
          <div style={estilos.tuPosicionNombre}>{yo.username}</div>
          {zonaTexto && <div style={estilos.badgeZonal}>{zonaTexto}</div>}
        </div>
        <div style={estilos.tuPosicionPuesto}>
          {yo.puesto ? `#${yo.puesto}` : '—'}
        </div>
      </div>
      <div style={estilos.tuPosicionPie}>
        <img src="/assets/images/historial-trofeo.png" alt="" style={estilos.filaStatIcono} />
        <span style={estilos.filaStatNumero}>{yo.partidas_ganadas}</span>
        <span style={estilos.filaStatLabel}>victorias</span>
        {!yo.puesto && (
          <span style={estilos.tuPosicionAviso}>
            {info.sinUbicacion ? 'Cargá tu zona en el Perfil' : 'Jugá una partida para entrar'}
          </span>
        )}
      </div>
    </PlacaMadera>
  ) : null;

  const mensajeVacio = info?.sinUbicacion
    ? (alcance === 'provincia'
        ? 'Cargá tu provincia en tu Perfil para ver este ranking.'
        : 'Cargá tu provincia y tu localidad en tu Perfil para ver este ranking.')
    : (ranking.length === 0
        ? (alcance === 'global' ? 'Todavía no hay partidas jugadas.' : 'Todavía no hay partidas en tu zona.')
        : '');

  // Pase 370: pestañas de alcance (mismo estilo que Activos/Finalizados de Torneos). En 2 columnas
  // viven arriba de la lista; apiladas van antes del podio, porque filtran podio y lista.
  const bloqueTabs = (
    <div style={estilos.tabs}>
      {ALCANCES.map((a) => (
        <button
          key={a.clave}
          type="button"
          onClick={() => setAlcance(a.clave)}
          style={alcance === a.clave ? estilos.tabActiva : estilos.tabInactiva}
        >
          {a.texto}
        </button>
      ))}
    </div>
  );

  const bloqueLista = (
    <div style={estilos.listaPanelExterior}>
      <span style={{ ...estilos.remache, top: 10, left: 10 }} />
      <span style={{ ...estilos.remache, top: 10, right: 10 }} />
      <span style={{ ...estilos.remache, bottom: 10, left: 10 }} />
      <span style={{ ...estilos.remache, bottom: 10, right: 10 }} />
      <div style={estilos.listaInterior}>
        {esAncho && bloqueTabs}
        <div style={{ opacity: cargandoLista ? 0.55 : 1, transition: 'opacity 0.15s' }}>
          {mensajeVacio && <p style={estilos.listaVacia}>{mensajeVacio}</p>}
          {!mensajeVacio && resto.length === 0 && (
            <p style={estilos.listaVacia}>Los primeros puestos están en el podio.</p>
          )}
          {resto.map((r, i) => {
            const puesto = i + 4; // arranca en el puesto 4, después del podio
            const esYo = r.username === usuarioActual;
            return (
              <div
                key={r.username}
                style={{
                  ...estilos.fila,
                  ...(i % 2 === 1 ? estilos.filaImpar : {}),
                  ...(esYo ? estilos.filaYo : {}),
                  cursor: 'pointer'
                }}
                onClick={() => setPerfilAbierto(r.username)}
              >
                <div style={estilos.filaPuesto}>{puesto}</div>
                <div style={estilos.filaAvatar}><img src={avatarSrcCaraDe(r)} alt="" style={estilos.filaAvatarImg} /></div>
                <div style={estilos.filaNombre}>{esYo ? 'Vos' : r.username}</div>
                <div style={estilos.filaStat}>
                  <span style={estilos.filaStatNumero}>{r.partidas_ganadas}</span>
                  <img src="/assets/images/historial-trofeo.png" alt="" style={estilos.filaStatIcono} />
                  <span style={estilos.filaStatLabel}>victorias</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Ducentésimo sexagésimo segundo pase: el título era texto suelto en
          la esquina, sin marco ni presencia — ahora vive en un cartel de
          madera chico con el trofeo dorado (reutilizamos
          `historial-trofeo.png`, ya tiene el contorno negro grueso tipo
          3D que pedía la instrucción — no hace falta un ícono nuevo). */}
      <div style={estilos.encabezadoBanner}>
        <span style={{ ...estilos.remacheChico, left: 8 }} />
        <span style={{ ...estilos.remacheChico, right: 8 }} />
        <img src="/assets/images/historial-trofeo.png" alt="" style={estilos.encabezadoIcono} />
        <div>
          <div style={estilos.sectionTitle}>Ranking</div>
          <div style={estilos.sectionSubtitle}>Los mejores jugadores de TrucoChe</div>
        </div>
      </div>

      {/* Pase 370: layout de 2 columnas en pantallas anchas (izquierda: temporada, podio y tu
          posición; derecha: pestañas y lista) y apilado en angostas (pestañas antes del podio,
          porque filtran tanto el podio como la lista). */}
      <div ref={layoutRef} style={esAncho ? estilos.layoutAncho : estilos.layoutApilado}>
        {esAncho ? (
          <>
            <div style={estilos.columna}>
              {bloqueTimer}
              {bloquePodio}
              {bloqueTuPosicion}
            </div>
            <div style={estilos.columna}>{bloqueLista}</div>
          </>
        ) : (
          <>
            {bloqueTimer}
            {bloqueTabs}
            {bloquePodio}
            {bloqueTuPosicion}
            {bloqueLista}
          </>
        )}
      </div>

      {perfilAbierto && (
        <PerfilRivalModal
          username={perfilAbierto}
          token={token}
          onClose={() => setPerfilAbierto(null)}
        />
      )}
    </>
  );
}

const estilos = {
  // ---- Pase 370: layout, timer, pestañas y "Tu posición" ----
  layoutAncho: { display: 'grid', gridTemplateColumns: 'minmax(0, 1.15fr) minmax(0, 1fr)', gap: 20, alignItems: 'start' },
  layoutApilado: { display: 'block' },
  columna: { minWidth: 0 },
  timerTemporada: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    background: 'rgba(26,20,16,0.55)', border: `1.5px solid ${C.negroPulido}`, borderRadius: 999,
    padding: '5px 14px', marginBottom: 12,
  },
  timerEtiqueta: { fontFamily: "'Fredoka', sans-serif", fontWeight: 600, fontSize: 13, color: 'rgba(255,248,237,0.85)' },
  timerValor: {
    fontFamily: "'Fredoka', sans-serif", fontWeight: 800, fontSize: 14, color: C.doradoClaro,
    textShadow: '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000',
  },
  tabs: { display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  tabActiva: {
    fontFamily: "'Fredoka', sans-serif", fontWeight: 700, fontSize: 14,
    background: '#FFFBEB', color: '#2C160E', border: '2px solid #000', borderRadius: 999,
    height: 38, boxSizing: 'border-box', padding: '0 16px', marginBottom: 5,
    boxShadow: '0 3px 0 #A8977A, 0 5px 0 #000', cursor: 'pointer',
  },
  tabInactiva: {
    fontFamily: "'Fredoka', sans-serif", fontWeight: 700, fontSize: 14,
    background: '#8B5A2B', color: '#FFFBEB', border: '2px solid #000', borderRadius: 999,
    height: 38, boxSizing: 'border-box', padding: '0 16px', marginBottom: 5,
    boxShadow: 'inset 0 3px 5px rgba(74,44,17,0.55), 0 3px 0 #4A2C11, 0 5px 0 #000', cursor: 'pointer',
  },
  listaVacia: { margin: '14px 6px', textAlign: 'center', color: C.chocolate, fontWeight: 700, fontSize: 13.5 },
  tuPosicionPlaca: { marginBottom: 16 },
  tuPosicionInterior: { padding: '10px 14px 12px' },
  tuPosicionTitulo: {
    fontFamily: "'Fredoka', sans-serif", fontWeight: 700, fontSize: 12.5, letterSpacing: 0.6,
    textTransform: 'uppercase', color: C.chocolate, marginBottom: 6,
  },
  tuPosicionFila: { display: 'flex', alignItems: 'center', gap: 10 },
  tuPosicionAvatar: {
    width: 46, height: 46, borderRadius: '50%', background: C.verdeOscuro, flexShrink: 0,
    boxShadow: `0 0 0 2px ${C.negroPulido}`, overflow: 'hidden',
  },
  tuPosicionDatos: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4 },
  tuPosicionNombre: {
    fontFamily: "'Fredoka', sans-serif", fontWeight: 700, fontSize: 16, color: '#2C160E',
    maxWidth: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
  },
  // Badge zonal (ej. "Paso del Rey") — pastilla de madera cálida.
  badgeZonal: {
    background: '#8B5A2B', color: '#FFFBEB', border: '1.5px solid #000', borderRadius: 999,
    padding: '1px 10px', fontFamily: "'Nunito', sans-serif", fontWeight: 800, fontSize: 11.5,
    maxWidth: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
  },
  tuPosicionPuesto: {
    fontFamily: "'Fredoka', sans-serif", fontWeight: 800, fontSize: 30, color: C.doradoOscuro,
    textShadow: '-1.5px -1.5px 0 #2C160E, 1.5px -1.5px 0 #2C160E, -1.5px 1.5px 0 #2C160E, 1.5px 1.5px 0 #2C160E',
    flexShrink: 0, lineHeight: 1,
  },
  tuPosicionPie: { display: 'flex', alignItems: 'center', gap: 5, marginTop: 8, flexWrap: 'wrap' },
  tuPosicionAviso: { marginLeft: 'auto', fontSize: 11.5, fontWeight: 700, color: C.chocolate },
  errorBox: {
    background: '#ffe0dd', border: '2px solid #E8483A', color: '#c2352a',
    borderRadius: 10, padding: '8px 12px', fontWeight: 700, fontSize: 13
  },
  // Ducentésimo sexagésimo segundo pase: el título pasa de texto suelto a
  // vivir adentro del cartel de madera (`encabezadoBanner`) — ya no hace
  // falta el margen manual, el padding del cartel se encarga del espacio.
  sectionTitle: { fontFamily: "'Fredoka', sans-serif", fontWeight: 700, fontSize: 16, color: C.crema, textShadow: '-1.5px -1.5px 0 #2C160E, 1.5px -1.5px 0 #2C160E, -1.5px 1.5px 0 #2C160E, 1.5px 1.5px 0 #2C160E, 0px -1.5px 0 #2C160E, 0px 1.5px 0 #2C160E, -1.5px 0px 0 #2C160E, 1.5px 0px 0 #2C160E' },
  sectionSubtitle: { fontSize: 12, color: 'rgba(255,248,237,0.75)', fontWeight: 700, marginTop: 1 },
  // Cartel de madera chico para el encabezado — mismo criterio que el
  // panel de madera+bronce grande (ver `podioPanelExterior`), pero sin
  // interior de pergamino adentro (es solo una franja para el título).
  encabezadoBanner: {
    position: 'relative', display: 'flex', alignItems: 'center', gap: 10,
    background: `linear-gradient(160deg, ${C.maderaClara} 0%, ${C.maderaMedia} 55%, ${C.maderaOscura} 100%)`,
    border: `2.5px solid ${C.negroPulido}`, borderRadius: 12,
    padding: '9px 20px', marginBottom: 12,
    boxShadow: [
      'inset 0 2px 0 rgba(255,255,255,0.10)',
      'inset 0 -3px 8px rgba(0,0,0,0.45)',
      `0 4px 0 ${C.negroPulido}`,
      '0 8px 14px rgba(0,0,0,0.35)',
    ].join(', '),
  },
  encabezadoIcono: { width: 30, height: 30 * (237 / 246), objectFit: 'contain', flexShrink: 0 },
  // Remache chico — mismo degradé que `remache`, pero más discreto para
  // una franja angosta (el cartel del encabezado no tiene el tamaño de un
  // panel grande como para llevar 4 remaches en las esquinas).
  remacheChico: {
    position: 'absolute', top: '50%', width: 9, height: 9, borderRadius: '50%', marginTop: -4.5,
    // Pase 360: remache unificado en todo el juego — bola de bronce lisa con borde marrón fino y un brillo claro arriba a la izquierda.
    background: 'radial-gradient(circle at 32% 28%, rgba(255,243,210,0.92) 0, rgba(255,243,210,0.92) 1.1px, transparent 1.7px), #C9973E',
    border: '1.5px solid #5A3A14', boxSizing: 'border-box',
  },
  // Remache grande — mismo criterio que Historial/Chat Global, para las
  // esquinas de los paneles grandes (podio y lista).
  remache: {
    position: 'absolute', width: 13, height: 13, borderRadius: '50%',
    zIndex: 2,
    // Pase 360: remache unificado en todo el juego — bola de bronce lisa con borde marrón fino y un brillo claro arriba a la izquierda.
    background: 'radial-gradient(circle at 32% 28%, rgba(255,243,210,0.92) 0, rgba(255,243,210,0.92) 1.5px, transparent 2.1px), #C9973E',
    border: '1.5px solid #5A3A14', boxSizing: 'border-box',
  },
  // Ducentésimo sexagésimo segundo pase: el marco blanco/crema plano de
  // antes pasa a ser la "gran placa de madera de taberna" que pedía el
  // usuario — exterior de madera oscura con remaches de bronce en las
  // esquinas (`podioPanelExterior`) y un interior de pergamino cálido
  // (`podioInterior`), en vez del fieltro verde que usan las pantallas de
  // partida — el podio es más una vitrina de trofeos que una mesa de
  // juego, el pergamino cálido queda mejor con el oro/plata/bronce.
  podioPanelExterior: {
    position: 'relative',
    background: `linear-gradient(160deg, ${C.maderaClara} 0%, ${C.maderaMedia} 55%, ${C.maderaOscura} 100%)`,
    border: `3px solid ${C.negroPulido}`, borderRadius: 20, padding: 12,
    marginBottom: 16,
    boxShadow: [
      'inset 0 2px 0 rgba(255,255,255,0.10)',
      'inset 0 -4px 10px rgba(0,0,0,0.5)',
      `0 8px 0 ${C.negroPulido}`,
      '0 16px 26px rgba(0,0,0,0.4)',
    ].join(', '),
  },
  // Ducentésimo sexagésimo tercer pase: el usuario reportó que el
  // interior del podio "sigue siendo un bloque crema plano" — se le suma
  // una textura suave tipo pergamino (un par de manchas radiales sutiles,
  // no un patrón repetitivo) y una sombra interior más marcada en los
  // bordes (arriba/abajo, no solo un contorno finito de 2px como antes).
  podioInterior: {
    position: 'relative', overflow: 'hidden',
    background: [
      'radial-gradient(ellipse at 20% 25%, rgba(210,182,130,0.4) 0%, transparent 50%)',
      'radial-gradient(ellipse at 82% 75%, rgba(190,160,115,0.35) 0%, transparent 55%)',
      `linear-gradient(180deg, ${C.cremaSutil}, ${C.crema})`,
    ].join(', '),
    borderRadius: 14,
    // Ducentésimo sexagésimo cuarto pase: padding-top 26 → 96 — el marco
    // de avatar del 1er puesto (el más alto, su punto de anclaje está a
    // solo 1.6% del borde de arriba de `ranking-podio.png`) sobresale por
    // ARRIBA del propio `podioImgWrap` (así es como se planta "coronando"
    // la columna en vez de quedar adentro tapando el número tallado) —
    // sin este padding de sobra, ese sobresaliente quedaba recortado
    // contra el marco de madera de arriba. Sube el alto total del panel
    // ~25-30%, que es lo que pidió el usuario.
    // Ducentésimo sexagésimo sexto pase: 96 → 114 de padding-top — el
    // marco de oro ahora es más grande (ver `marcoAvatarWrapGrande`) y
    // sobresale más por arriba del `podioImgWrap`, necesita más aire para
    // no quedar cortado contra el marco de madera de arriba.
    padding: '114px 18px 20px',
    boxShadow: 'inset 0 4px 14px rgba(74,44,42,0.28), inset 0 -3px 10px rgba(74,44,42,0.22), inset 0 0 0 2px rgba(0,0,0,0.08)',
  },
  // Ducentésimo sexagésimo tercer pase: el podio ya no es un flex de 3
  // columnas con su propio fondo — es un solo contenedor con la imagen
  // ilustrada de fondo (`ranking-podio.png`) y los avatares plantados
  // encima con posición absoluta (ver `podioCluster` y
  // `PUESTO_FRACCIONES`). El `aspectRatio` fija la proporción real del
  // PNG para que las fracciones de posición sigan siendo válidas sin
  // importar el ancho final en pantalla.
  // Ducentésimo sexagésimo sexto pase: 420 → 470 — el usuario reportó que
  // todo el podio se veía chico con aire de sobra arriba/abajo del panel;
  // agrandar la imagen de base (y los marcos de avatar más abajo, en
  // proporción) aprovecha ese espacio.
  podioImgWrap: {
    position: 'relative', width: '100%', maxWidth: 470, margin: '0 auto',
    aspectRatio: `${ASPECTO_PODIO}`,
  },
  // `zIndex:1` para que quede por encima de `podioGloriaOro` (el
  // resplandor vive DETRÁS de la imagen del podio, no encima).
  podioImg: { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', zIndex: 1 },
  // Ducentésimo sexagésimo quinto pase: resplandor dorado detrás de la
  // columna de 1er puesto — un halo radial ancho centrado en la posición
  // horizontal de la columna de oro (`PUESTO_FRACCIONES.oro.x`, mismo
  // dato ya medido), para que el ojo vaya ahí apenas se abre la pantalla.
  // `zIndex:0` (por debajo de `podioImg`) y `pointerEvents:none` para que
  // no interfiera con los clicks del podio.
  podioGloriaOro: {
    position: 'absolute', left: `${PUESTO_FRACCIONES.oro.x * 100}%`, top: '48%',
    width: '58%', height: '120%', transform: 'translate(-50%, -50%)',
    background: 'radial-gradient(ellipse at center, rgba(255,214,104,0.6) 0%, rgba(255,193,39,0.28) 42%, rgba(255,182,39,0) 72%)',
    pointerEvents: 'none', zIndex: 0,
  },
  // `left`/`top` los pone cada puesto en el JSX (vienen de
  // `PUESTO_FRACCIONES`) — el `translate` deja el BORDE INFERIOR del
  // cluster pegado a ese punto, así el marco de avatar queda plantado
  // justo arriba del pedestal en vez de centrado sobre él.
  // Ducentésimo sexagésimo cuarto pase: ya no lleva nombre/stat/corona
  // adentro (se sacó todo el texto flotante) — el cluster ahora es SOLO
  // el marco de avatar.
  podioCluster: {
    position: 'absolute', transform: 'translate(-50%, calc(-100% + 6px))',
    cursor: 'pointer', zIndex: 3,
  },
  // Ducentésimo sexagésimo cuarto pase: marco ilustrado — el PNG del
  // marco (con el hueco transparente en el centro) va encima del wrap, y
  // la foto/busto del jugador va DEBAJO en el mismo cuadro, recortada en
  // círculo a un tamaño un poco menor que el hueco real del marco (medido
  // con Pillow: ~67% del ancho para bronce/plata, ~72% para oro) para que
  // no se vea el borde de la foto por fuera del hueco. El de oro es más
  // grande que plata/bronce — sigue siendo "el" primer puesto.
  // Ducentésimo sexagésimo sexto pase: 64→78 / 78→96 — mismo pedido de
  // agrandar (el usuario notó los círculos de perfil chicos). La foto
  // adentro escala en la misma proporción que ya tenía contra su wrap
  // (0.625 chico, 0.667 grande) para seguir llenando el hueco real del
  // marco sin que se le vea el borde.
  marcoAvatarWrapChico: {
    position: 'relative', width: 78, height: 78,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  marcoAvatarWrapGrande: {
    position: 'relative', width: 96, height: 96,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  marcoAvatarImg: {
    position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', zIndex: 2,
  },
  // Ducentésimo septuagésimo quinto pase: el usuario reportó que los 3
  // bustos quedaban a distancias distintas del borde inferior del hueco
  // de su marco (el centrado por flexbox no compensa que los 3 PNGs de
  // marco -oro/plata/bronce- no tienen el hueco transparente exactamente
  // a la misma altura relativa dentro de su propio canvas). A diferencia
  // del nativo (donde oro/plata/bronce llevan offsets DIFERENTES), acá el
  // pedido es un único valor PAREJO para los 3 puestos: un `translateY`
  // fijo que baja el busto para que el pañuelo/pecho apoye justo en el
  // borde inferior del aro y solo el sombrero sobresalga por arriba.
  marcoAvatarFoto: {
    position: 'relative', width: 49, height: 49, borderRadius: '50%', objectFit: 'cover', zIndex: 1,
    transform: 'translateY(6px)',
  },
  marcoAvatarFotoGrande: {
    position: 'relative', width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', zIndex: 1,
    transform: 'translateY(6px)',
  },
  // Ducentésimo sexagésimo cuarto pase: nombre + victorias, ahora
  // centrados DENTRO del recuadro de madera de la base de cada pedestal
  // (`BASE_FRACCIONES`) en vez de flotar sobre el podio — texto blanco/
  // dorado con contorno negro (mismo truco de 4 `text-shadow`
  // desplazados que ya se usa en Historial) para que se lea bien sobre
  // la madera oscura. `overflow:hidden` + `text-overflow:ellipsis` en
  // el nombre por si el username es largo y no entra en el recuadro.
  // Ducentésimo sexagésimo séptimo pase: el usuario pidió explícitamente
  // (1) padding de 6-8px alrededor del bloque para que no quede pegado a
  // los bordes de la madera — antes era casi nulo (`1px 4px`) — y (2)
  // subir la tipografía del nombre ~25%. El `gap` entre renglones se dejó
  // chico (1px) a propósito: con `BASE_FRACCIONES` ya agrandado un 25% de
  // alto (ver arriba) más este padding y el salto de tamaño de fuente,
  // llenar ese espacio de sobra con más separación entre líneas en vez de
  // más padding hubiera vuelto a arriesgar que se toquen.
  podioBaseTexto: {
    position: 'absolute', overflow: 'hidden', padding: '6px 8px',
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1,
    cursor: 'pointer', zIndex: 3,
  },
  podioBaseNombre: {
    fontFamily: "'Fredoka', sans-serif", fontWeight: 800, fontSize: 15, color: '#fff',
    textShadow: '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000',
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%', lineHeight: 1,
  },
  podioBaseVictorias: {
    fontFamily: "'Fredoka', sans-serif", fontWeight: 700, fontSize: 12, color: C.doradoClaro,
    textShadow: '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000',
    whiteSpace: 'nowrap', lineHeight: 1,
  },
  // Ducentésimo sexagésimo octavo pase: la "placa" que pidió el usuario
  // detrás del nombre/victorias — un fondo bien oscuro (más oscuro que la
  // madera del propio pedestal, para que se note como una placa aparte,
  // no como más madera) con el mismo lenguaje visual que el resto de los
  // paneles de la pantalla. El borde y el glow (color de medalla) se
  // calculan por puesto en el JSX y se mezclan con este estilo base.
  podioBasePlaca: {
    background: 'linear-gradient(165deg, #3d2a1c 0%, #2a1c12 55%, #170f0a 100%)',
    borderRadius: 7,
  },
  // Ducentésimo sexagésimo segundo pase: mismo criterio de "placa de
  // madera de taberna" que el podio — exterior de madera con remaches,
  // pergamino cálido adentro.
  listaPanelExterior: {
    position: 'relative',
    background: `linear-gradient(160deg, ${C.maderaClara} 0%, ${C.maderaMedia} 55%, ${C.maderaOscura} 100%)`,
    border: `3px solid ${C.negroPulido}`, borderRadius: 20, padding: 12,
    boxShadow: [
      'inset 0 2px 0 rgba(255,255,255,0.10)',
      'inset 0 -4px 10px rgba(0,0,0,0.5)',
      `0 8px 0 ${C.negroPulido}`,
      '0 16px 26px rgba(0,0,0,0.4)',
    ].join(', '),
  },
  listaInterior: {
    background: `linear-gradient(180deg, ${C.cremaSutil}, ${C.crema})`,
    borderRadius: 14, padding: 8,
    boxShadow: 'inset 0 3px 10px rgba(0,0,0,0.18), inset 0 0 0 2px rgba(0,0,0,0.06)',
  },
  // Ducentésimo sexagésimo segundo pase: las líneas punteadas finas se
  // perdían contra el fondo claro — cada fila pasa a ser su propia
  // "tarjeta" chica de pergamino (fondo propio + borde marrón suave +
  // contorno negro fino), no solo un cambio de tono de fondo — más
  // parecido a lo que pedía la instrucción ("mini tarjeta de pergamino").
  fila: {
    display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
    borderRadius: 10, marginBottom: 4,
    background: 'linear-gradient(135deg, #fffaf0 0%, #f7e8c8 100%)',
    border: '1.5px solid rgba(74,44,42,0.32)',
    boxShadow: 'inset 0 0 0 1px rgba(26,20,16,0.12), 0 1px 0 rgba(0,0,0,0.08)',
  },
  // Cebreado sutil — un tono más cálido/oscuro que la tarjeta base, en vez
  // del overlay gris parejo de antes (que casi no se notaba sobre pergamino).
  filaImpar: { background: 'linear-gradient(135deg, #f7ead0 0%, #efd9ab 100%)' },
  // Ducentésimo sexagésimo tercer pase: "marco dorado en relieve" — se
  // suma un highlight interior arriba (simula el bisel) además del glow
  // y el borde dorado que ya tenía.
  filaYo: {
    background: 'linear-gradient(135deg, #fff6dd 0%, #ffe9b0 100%)',
    border: `2px solid ${C.doradoOscuro}`,
    boxShadow: [
      'inset 0 1px 0 rgba(255,255,255,0.7)',
      'inset 0 -2px 4px rgba(180,120,20,0.22)',
      `0 0 0 1px ${C.doradoClaro}`,
      '0 0 14px 2px rgba(255,182,39,0.55)',
    ].join(', '),
  },
  // Ducentésimo sexagésimo tercer pase: número de posición dentro de un
  // medallón chico de bronce (CSS por ahora, mismo degradé que los
  // remaches de los paneles) en vez de texto gris plano suelto.
  filaPuesto: {
    width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: `radial-gradient(circle at 35% 30%, ${C.remacheClaro} 0%, ${C.remache} 45%, ${C.remacheOscuro} 78%, #3a2610 100%)`,
    boxShadow: '0 2px 3px rgba(0,0,0,0.4), inset 0 1px 1px rgba(255,255,255,0.35)',
    fontFamily: "'Fredoka', sans-serif", fontWeight: 800, fontSize: 12.5, color: C.crema,
    textShadow: '-1px -1px 0 #2C160E, 1px -1px 0 #2C160E, -1px 1px 0 #2C160E, 1px 1px 0 #2C160E, 0px -1px 0 #2C160E, 0px 1px 0 #2C160E, -1px 0px 0 #2C160E, 1px 0px 0 #2C160E',
  },
  // Ducentésimo sexagésimo segundo pase: aro negro limpio en vez del
  // dorado genérico — se acerca más al "marco circular de madera con
  // contorno negro limpio" que pidió la instrucción, hasta que esté el
  // asset ilustrado (`ranking-marco-madera.png`).
  filaAvatar: {
    width: 34, height: 34, borderRadius: '50%', background: C.verdeOscuro,
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0,
    boxShadow: `0 0 0 1.5px ${C.negroPulido}`, overflow: 'hidden'
  },
  filaAvatarImg: { width: '100%', height: '100%', objectFit: 'cover' },
  filaNombre: { flex: 1, fontWeight: 700, fontSize: 14, color: C.chocolate },
  // Ducentésimo sexagésimo tercer pase: el número de victorias gana
  // jerarquía — más grande y en negrita, con un trofeo mini al lado
  // (reutilizamos `historial-trofeo.png` otra vez) en vez de solo texto
  // parejo "64 victorias".
  filaStat: { display: 'flex', alignItems: 'center', gap: 4 },
  filaStatNumero: { fontFamily: "'Fredoka', sans-serif", fontWeight: 800, fontSize: 16, color: C.verdeEsmeralda },
  filaStatIcono: { width: 13, height: 13 * (237 / 246), objectFit: 'contain', flexShrink: 0 },
  filaStatLabel: { fontSize: 11.5, fontWeight: 600, color: C.verdeOscuro },
};