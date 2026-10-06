import React, { useState, useEffect, useCallback } from 'react';
import { API_URL as BASE_URL } from '../../config';

const API_URL = `${BASE_URL}/api/misiones`;

const C = {
  verde: '#2D9B4F', verdeOscuro: '#1f7a3c',
  dorado: '#FFB627', doradoClaro: '#FFD668', doradoOscuro: '#C9860E',
  celeste: '#4FB3E8',
  crema: '#FFF8ED', chocolate: '#4A2C2A',
  // Cuadragésimo octavo pase — mismo valor que Lobby.js, ver ese archivo.
  cremaSutil: '#FFFCF6',
  // Pase de rediseño estructural de Lobby.js — mismos tonos de madera+
  // bronce que el resto de la pantalla, para que esta tarjeta comparta el
  // mismo marco que "Crear sala"/"Unirse con código"/"Torneo en curso".
  maderaClara: '#6b4a34', maderaMedia: '#4a3226', maderaOscura: '#2a1c14',
  remacheClaro: '#f0d9a0', remache: '#c9973e', remacheOscuro: '#7a5322',
  negroPulido: '#1a1410',
};

// Pase 202: a pedido del usuario, se saca la imagen del personaje
// seleccionado (antes vivía acá, en el círculo de la izquierda) y en su
// lugar se usa el mismo cartelito ilustrado que ya se mostraba chico al
// lado del título "Misiones semanales" — un solo ícono, más grande, en
// vez de dos íconos distintos compitiendo por atención.

// Quincuagésimo octavo pase — la tarjeta muestra de a 2 misiones (antes
// mostraba todas apiladas verticalmente, sin límite de alto) con flechas +
// puntitos para pasar de página, a pedido del usuario. El sistema siempre
// tiene exactamente 3 misiones fijas (racha/partidas/torneo, ver
// truco-backend/src/routes/misiones.js) así que hoy son 2 páginas
// (2+1), pero el cálculo queda genérico por si el número cambia.
// Nonagésimo noveno pase: bajado de 2 a 1 a pedido del usuario — de paso,
// como el panel no tenía ninguna altura fija (se ajusta solo al
// contenido), mostrar una sola misión en vez de dos también achica la
// tarjeta entera, sin tocar ningún otro estilo.
const MISIONES_POR_PAGINA = 1;

export default function MisionesCard({ token, onMisionReclamada }) {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');
  const [reclamando, setReclamando] = useState(null);
  const [pagina, setPagina] = useState(0);

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  const cargarMisiones = useCallback(async () => {
    try {
      const res = await fetch(API_URL, { headers });
      const data = await res.json();
      if (res.ok) setDatos(data);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    } catch (err) {
      console.error('Error cargando misiones:', err);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    cargarMisiones();
  }, [cargarMisiones]);

  const reclamar = async (tipo) => {
    setError('');
    setReclamando(tipo);
    try {
      const res = await fetch(`${API_URL}/reclamar`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ tipo })
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'No se pudo reclamar la misión');
        return;
      }

      await cargarMisiones();
      if (onMisionReclamada) onMisionReclamada();
    } catch (err) {
      console.error('Error reclamando misión:', err);
      setError('No se pudo conectar con el servidor');
    } finally {
      setReclamando(null);
    }
  };

  if (!datos) return null;

  const completadas = datos.misiones.filter(m => m.completada).length;

  // Quincuagésimo octavo pase — paginado de a 2. `paginaSegura` evita
  // quedar en una página vacía si el total de misiones cambiara alguna vez.
  const totalPaginas = Math.max(1, Math.ceil(datos.misiones.length / MISIONES_POR_PAGINA));
  const paginaSegura = Math.min(pagina, totalPaginas - 1);
  const misionesVisibles = datos.misiones.slice(
    paginaSegura * MISIONES_POR_PAGINA,
    paginaSegura * MISIONES_POR_PAGINA + MISIONES_POR_PAGINA
  );
  const esPrimera = paginaSegura === 0;
  const esUltima = paginaSegura === totalPaginas - 1;

  return (
    // Pase de rediseño estructural (siguiendo el mismo criterio ya
    // aplicado al resto de Lobby.js): exterior de madera con remaches en
    // las esquinas envolviendo la "minitabla de pergamino" — antes era
    // una sola caja crema plana, ahora comparte el mismo marco que
    // "Crear sala"/"Unirse con código"/"Torneo en curso".
    <div style={estilos.panelExterior}>
      <span style={{ ...estilos.remache, top: 8, left: 8 }} />
      <span style={{ ...estilos.remache, top: 8, right: 8 }} />
      <span style={{ ...estilos.remache, bottom: 8, left: 8 }} />
      <span style={{ ...estilos.remache, bottom: 8, right: 8 }} />
      <div style={estilos.panel}>
      <div style={estilos.header}>
        <img
          src="/assets/images/icono-misiones.png"
          alt=""
          style={estilos.imagenPersonaje}
        />
        <div>
          <div style={estilos.panelTitle}>Misiones semanales</div>
          <div style={estilos.resumen}>{completadas}/{datos.misiones.length} completadas</div>
        </div>
      </div>

      {error && <div style={estilos.errorBox}>{error}</div>}

      <div style={estilos.listaConSlide}>
        <button
          type="button"
          onClick={() => setPagina((p) => Math.max(0, p - 1))}
          disabled={esPrimera}
          aria-label="Misiones anteriores"
          style={{ ...estilos.flechaSlide, ...(esPrimera ? estilos.flechaSlideDisabled : {}) }}
        >
          ‹
        </button>

        <div style={estilos.lista}>
          {misionesVisibles.map((m) => {
            const porcentaje = Math.round((m.progreso / m.objetivo) * 100);
            return (
              <div key={m.tipo} style={estilos.mision}>
                  <div style={estilos.filaMision}>
                      <span style={estilos.tituloMision}>
                      {m.completada && <span style={estilos.check}>✓</span>} {m.titulo}
                      </span>
                      <span style={estilos.progresoTexto}>{m.progreso}/{m.objetivo}</span>
                  </div>
                {/* Pase de rediseño estructural: barra 3D verde neón (antes
                    un degradé dorado plano) + recompensa en monedas de oro
                    al extremo, visible siempre (no solo dentro del botón
                    de reclamar) — pedido explícito del usuario. */}
                <div style={estilos.filaBarra}>
                  <div style={estilos.barraFondo}>
                    <div style={{ ...estilos.barraRelleno, width: `${porcentaje}%` }} />
                  </div>
                  <span style={estilos.recompensaChip}>
                    <img src="/assets/images/moneda.png" alt="" style={estilos.iconoMonedaChip} />
                    +{datos.recompensa}
                  </span>
                </div>

                {m.reclamada ? (
                  <div style={estilos.badgeReclamada}>✓ Recompensa reclamada</div>
                ) : m.completada ? (
                  <button
                    onClick={() => reclamar(m.tipo)}
                    disabled={reclamando === m.tipo}
                    style={estilos.btnReclamar}
                  >
                    {reclamando === m.tipo ? 'Reclamando...' : (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                        <img src="/assets/images/moneda.png" alt="" style={estilos.iconoMonedaChico} />
                        {`Reclamar +${datos.recompensa}`}
                      </span>
                    )}
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => setPagina((p) => Math.min(totalPaginas - 1, p + 1))}
          disabled={esUltima}
          aria-label="Más misiones"
          style={{ ...estilos.flechaSlide, ...(esUltima ? estilos.flechaSlideDisabled : {}) }}
        >
          ›
        </button>
      </div>

      {totalPaginas > 1 && (
        <div style={estilos.puntosFila}>
          {Array.from({ length: totalPaginas }).map((_, i) => (
            <span key={i} style={{ ...estilos.punto, ...(i === paginaSegura ? estilos.puntoActivo : {}) }} />
          ))}
        </div>
      )}
      </div>
    </div>
  );
}

const estilos = {
  // Pase de rediseño estructural — exterior de madera con 4 remaches de
  // bronce, mismo criterio que `accesoCardExterior` en Lobby.js: esta
  // tarjeta ahora comparte marco con "Crear sala"/"Unirse con
  // código"/"Torneo en curso" en vez de flotar suelta en cuadro crema.
  panelExterior: {
    background: `linear-gradient(160deg, ${C.maderaClara} 0%, ${C.maderaMedia} 55%, ${C.maderaOscura} 100%)`,
    border: `3px solid ${C.negroPulido}`, borderRadius: 20, padding: 9,
    boxShadow: [
      'inset 0 2px 0 rgba(255,255,255,0.10)',
      'inset 0 -4px 10px rgba(0,0,0,0.5)',
      `0 8px 0 ${C.negroPulido}`,
      '0 16px 26px rgba(0,0,0,0.4)'
    ].join(', '),
    position: 'relative'
  },
  remache: {
    position: 'absolute', width: 11, height: 11, borderRadius: '50%',
    background: `radial-gradient(circle at 35% 30%, ${C.remacheClaro} 0%, ${C.remache} 45%, ${C.remacheOscuro} 78%, #3a2610 100%)`,
    boxShadow: '0 1px 2px rgba(0,0,0,0.6)', zIndex: 2
  },
  // Cuadragésimo octavo pase — punto 2: mismo criterio que el resto de los
  // paneles de Lobby.js (borde más fino, radio unificado a 18, fondo más
  // sutil, sombra menos marcada).
  // Pase de rediseño estructural — ahora es la capa interior de pergamino
  // dentro de `panelExterior` (antes era la caja de nivel superior);
  // el borde/sombra pasan a una versión más sutil, tipo "asentado" dentro
  // del marco de madera en vez de flotar con su propio relieve.
  panel: {
    backgroundColor: C.cremaSutil,
    backgroundImage: 'url(/assets/images/textura-tarjeta.png)', backgroundRepeat: 'repeat',
    border: `1.5px solid rgba(26,20,16,0.35)`, borderRadius: 14,
    boxShadow: 'inset 0 1px 4px rgba(0,0,0,0.12)', padding: '16px 18px 18px',
    position: 'relative', overflow: 'hidden'
  },
  header: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 },
  // Pase 204: a pedido del usuario se saca el marco circular blanco que
  // rodeaba el cartelito (quedaba chico y recortado adentro) y la imagen
  // se agranda ocupando ese mismo espacio directo, sin fondo ni borde
  // propio — mismo criterio "sin marco" que ya usa el ícono grande del
  // banner de torneo.
  imagenPersonaje: { maxWidth: 78, maxHeight: 68, objectFit: 'contain', flexShrink: 0 },
  panelTitle: { fontFamily: "'Fredoka', sans-serif", fontWeight: 600, fontSize: 17, color: C.chocolate },
  resumen: { fontSize: 12.5, color: '#7a6660', fontWeight: 700, marginTop: 2 },
  errorBox: {
    background: '#ffe0dd', border: `2px solid #E8483A`, color: '#c2352a',
    borderRadius: 10, padding: '6px 10px', marginBottom: 10, fontWeight: 700, fontSize: 12
  },
  // Quincuagésimo octavo pase — envuelve `lista` con las dos flechas a los
  // costados; `lista` pasó de ser el contenedor de nivel superior a ser
  // solo la columna de misiones visibles (2 por página) entre las flechas.
  listaConSlide: { display: 'flex', alignItems: 'center', gap: 8 },
  lista: { display: 'flex', flexDirection: 'column', gap: 12, flex: 1, minWidth: 0 },
  flechaSlide: {
    flexShrink: 0, width: 30, height: 30, borderRadius: '50%', padding: 0,
    border: `2px solid ${C.chocolate}`, background: '#fff', color: C.chocolate,
    fontSize: 18, fontWeight: 800, lineHeight: 1, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 2px 0 rgba(0,0,0,0.12)'
  },
  flechaSlideDisabled: { opacity: 0.3, cursor: 'not-allowed', boxShadow: 'none' },
  puntosFila: { display: 'flex', justifyContent: 'center', gap: 6, marginTop: 10 },
  punto: { width: 7, height: 7, borderRadius: '50%', background: 'rgba(74,44,42,0.25)' },
  puntoActivo: { width: 9, height: 9, background: C.doradoOscuro },
  mision: {
    background: '#fff', border: `2px solid ${C.chocolate}22`, borderRadius: 12,
    padding: '10px 12px'
  },
  filaMision: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  tituloMision: { fontSize: 13, fontWeight: 700, color: C.chocolate },
  check: { color: C.verdeOscuro, fontWeight: 800, marginRight: 2 },
  progresoTexto: { fontSize: 12, fontWeight: 800, color: C.doradoOscuro },
  // Pase de rediseño estructural — barra "3D verde neón" a pedido del
  // usuario (antes era un degradé dorado plano sin relieve). El fondo pasa
  // a un canal hundido oscuro (misma idea que el "cuero hundido" del resto
  // de la pantalla) y el relleno a un verde neón con brillo superior +
  // sombra de borde, para que se note como una barra con volumen real.
  // Ahora vive dentro de `filaBarra`, junto al chip de recompensa.
  barraFondo: {
    flex: 1, minWidth: 0, height: 9,
    background: 'linear-gradient(180deg, #0f0a06, #1c130c)',
    borderRadius: 6, overflow: 'hidden',
    boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.6), inset 0 0 0 1px rgba(0,0,0,0.4)'
  },
  barraRelleno: {
    height: '100%',
    background: 'linear-gradient(180deg, #7CFF9B 0%, #2ECC71 55%, #17A54A 100%)',
    borderRadius: 6, transition: 'width 0.3s ease',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.55), inset 0 -2px 3px rgba(0,0,0,0.3), 0 0 6px rgba(46,204,113,0.55)'
  },
  // Fila que alinea la barra de progreso con el chip de recompensa "al
  // extremo" — pedido explícito del usuario, visible siempre y no solo
  // dentro del botón de reclamar.
  filaBarra: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 },
  recompensaChip: {
    flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 3,
    fontSize: 11.5, fontWeight: 800, color: C.chocolate,
    background: `linear-gradient(180deg, ${C.doradoClaro}, ${C.dorado})`,
    border: `1.5px solid ${C.doradoOscuro}`, borderRadius: 999,
    padding: '2px 8px 2px 4px',
    boxShadow: '0 2px 0 rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.5)'
  },
  iconoMonedaChip: { width: 14, height: 14, objectFit: 'contain' },
  iconoMonedaChico: { width: 14, height: 14, objectFit: 'contain' },
  // Quincuagésimo segundo pase — punto 4: botón más chico (menos padding/
  // fuente) y alineado a la derecha en vez de ocupar todo el ancho —
  // `width:'fit-content'` + `marginLeft:'auto'` alcanza sin tener que
  // convertir `.mision` en flex (es un div block normal).
  btnReclamar: {
    fontFamily: "'Fredoka', sans-serif", fontWeight: 600, fontSize: 12,
    background: `linear-gradient(180deg, ${C.doradoClaro}, ${C.dorado})`, color: C.chocolate,
    border: `2px solid ${C.chocolate}`, borderRadius: 10, padding: '6px 14px',
    boxShadow: `0 3px 0 ${C.doradoOscuro}`, cursor: 'pointer',
    display: 'block', width: 'fit-content', marginLeft: 'auto'
  },
  badgeReclamada: {
    fontSize: 11.5, fontWeight: 700, color: C.verdeOscuro,
    background: '#d8f0da', borderRadius: 8, padding: '5px 8px', textAlign: 'center'
  },
};