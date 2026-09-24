import React, { useState, useEffect, useCallback } from 'react';
import { API_URL as BASE_URL } from '../../config';

const API_URL = `${BASE_URL}/api/misiones`;

const C = {
  verde: '#2D9B4F', verdeOscuro: '#1f7a3c',
  dorado: '#FFB627', doradoClaro: '#FFD668', doradoOscuro: '#C9860E',
  celeste: '#4FB3E8',
  crema: '#FFF8ED', chocolate: '#4A2C2A',
  // Cuadragésimo octavo pase — mismo valor que Lobby.js, ver ese archivo.
  cremaSutil: '#FFFCF6'
};

// Mismo mapa de imágenes que el selector de personaje, pero con las
// variantes "escribiendo en la agenda" en vez de los avatares parados.
const IMAGENES_MISION = {
  gaucho: '/assets/images/mision-gaucho.png',
  gaucha: '/assets/images/mision-gaucha.png',
  gaucha2: '/assets/images/mision-gaucha2.png',
  gaucho2: '/assets/images/mision-gaucho2.png',
};

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

export default function MisionesCard({ token, personaje = 'gaucho', onMisionReclamada }) {
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
    <div style={estilos.panel}>
      <div style={estilos.header}>
        <div style={estilos.avatarWrap}>
          <img
            src={IMAGENES_MISION[personaje] || IMAGENES_MISION.gaucho}
            alt=""
            style={estilos.imagenPersonaje}
          />
        </div>
        <div>
          {/* Pase siguiente: el emoji 📋 se reemplaza por el cartelito de
              corcho ilustrado que pasó el usuario, mismo criterio que el
              resto de los reemplazos de emoji del proyecto. */}
          <div style={estilos.panelTitle}>
            <img src="/assets/images/icono-misiones.png" alt="" style={estilos.iconoPanelTitle} /> Misiones semanales
          </div>
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
                <div style={estilos.barraFondo}>
                  <div style={{ ...estilos.barraRelleno, width: `${porcentaje}%` }} />
                </div>

                {m.reclamada ? (
                  <div style={estilos.badgeReclamada}>✓ Recompensa reclamada</div>
                ) : m.completada ? (
                  <button
                    onClick={() => reclamar(m.tipo)}
                    disabled={reclamando === m.tipo}
                    style={estilos.btnReclamar}
                  >
                    {reclamando === m.tipo ? 'Reclamando...' : `🪙 Reclamar +${datos.recompensa}`}
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
  );
}

const estilos = {
  // Cuadragésimo octavo pase — punto 2: mismo criterio que el resto de los
  // paneles de Lobby.js (borde más fino, radio unificado a 18, fondo más
  // sutil, sombra menos marcada).
  panel: {
    backgroundColor: C.cremaSutil,
    backgroundImage: 'url(/assets/images/textura-tarjeta.png)', backgroundRepeat: 'repeat',
    border: `2px solid ${C.chocolate}`, borderRadius: 18,
    boxShadow: '0 3px 0 rgba(0,0,0,0.15)', padding: '16px 18px 18px',
    position: 'relative', overflow: 'hidden'
  },
  header: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 },
  // Quincuagésimo segundo pase — punto 4 del feedback de diseño ("Misiones
  // semanales"): el avatar antes flotaba solo, sin nada detrás — ahora
  // tiene un marco circular suave (blanco + borde chocolate muy tenue)
  // para sentirse más "integrado" a la tarjeta en vez de superpuesto.
  avatarWrap: {
    width: 64, height: 64, borderRadius: '50%',
    background: '#fff', border: `2px solid ${C.chocolate}22`,
    boxShadow: '0 2px 0 rgba(0,0,0,0.08)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0
  },
  imagenPersonaje: { width: 46, height: 46, objectFit: 'contain' },
  panelTitle: { fontFamily: "'Fredoka', sans-serif", fontWeight: 600, fontSize: 17, color: C.chocolate, display: 'flex', alignItems: 'center', gap: 6 },
  // Pase siguiente: agrandado (22→34) a pedido del usuario.
  iconoPanelTitle: { height: 34, width: 'auto', objectFit: 'contain' },
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
  // Quincuagésimo segundo pase — punto 4: barra más delgada (8→5px) y con
  // más contraste (el fondo pasó de un tostado claro a un tinte chocolate
  // translúcido, que se nota más contra la tarjeta blanca).
  barraFondo: {
    height: 5, background: 'rgba(74,44,42,0.16)', borderRadius: 4, overflow: 'hidden', marginBottom: 8
  },
  barraRelleno: {
    height: '100%', background: `linear-gradient(90deg, ${C.doradoClaro}, ${C.dorado})`,
    borderRadius: 4, transition: 'width 0.3s ease'
  },
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