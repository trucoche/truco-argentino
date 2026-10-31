import { useState, useEffect, useCallback } from 'react';
import { API_URL as BASE_URL } from '../../config';

// Pase 659: tarjetitas de eventos (Temporada Inaugural, Pack de inauguración, Pionero). Viven en el LOBBY: cada una abre un cartel
// grande con toda la información (estilo "evento" de los juegos móviles). Los textos vienen del backend
// (GET /api/salas/ranked/rangos → eventos); acá solo se les da color e ícono.

const C = { crema: '#FFF8ED', chocolate: '#4A2C2A', dorado: '#F5B041', doradoClaro: '#FFD668' };

export const EVENTO_ESTILO = {
  temporada_inaugural: { fondo: 'linear-gradient(135deg, #1B3A6B, #10244A)', borde: '#9CD3F5', color: '#9CD3F5', icono: '/assets/images/evento-temporada-inaugural.png', etiqueta: 'TEMPORADA', completa: true, sol: true },
  pionero: { fondo: 'linear-gradient(135deg, #1E4E7A, #12304D)', borde: '#9CD3F5', color: '#9CD3F5', icono: '/assets/images/icono-logros.png', etiqueta: 'PIONERO' },
  pack_inauguracion: { fondo: 'linear-gradient(135deg, #8A3B12, #5E2408)', borde: '#F5B041', color: '#F5B041', icono: '/assets/images/caja-inauguracion.png', etiqueta: 'OFERTA' },
};
const EVENTO_POR_DEFECTO = { fondo: 'linear-gradient(135deg, #4A3226, #2E1F17)', borde: '#C9A66B', color: '#C9A66B', icono: '/assets/images/icono-misiones.png', etiqueta: 'EVENTO' };

export const CSS_EVENTOS = `
  @keyframes ev-flota { 0%, 100% { transform: translateY(2px); } 50% { transform: translateY(-4px); } }
  @keyframes ev-brillo { 0% { transform: translateX(-130%) skewX(-20deg); } 55%, 100% { transform: translateX(260%) skewX(-20deg); } }
  @keyframes ev-entrada { from { opacity: 0; transform: translateY(14px) scale(0.96); } to { opacity: 1; transform: none; } }
  .ev-card { position: relative; overflow: hidden; cursor: pointer; transition: transform 0.15s ease, filter 0.15s ease; animation: ev-entrada 0.5s cubic-bezier(0.2, 0.8, 0.2, 1) both; }
  .ev-card:hover { transform: translateY(-2px) scale(1.02); filter: brightness(1.08); }
  .ev-card:active { transform: scale(0.98); }
  .ev-card::after { content: ''; position: absolute; top: 0; bottom: 0; left: 0; width: 38%; background: linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,0.22), rgba(255,255,255,0)); animation: ev-brillo 4.2s ease-in-out infinite; pointer-events: none; }
  .ev-icono { animation: ev-flota 3s ease-in-out infinite; }
  /* Pase 660: botón CUADRADO de evento (la Temporada Inaugural es una imagen con su propio marco; las demás llevan fondo de color). */
  @keyframes ev-destello { 0%, 55%, 100% { opacity: 0; transform: scale(0.4) rotate(0deg); } 70% { opacity: 1; transform: scale(1.1) rotate(45deg); } }
  .ev-tile { position: relative; flex: 0 0 104px; width: 104px; height: 104px; padding: 0; border: 0; background: none; cursor: pointer; font-family: 'Nunito', sans-serif; transition: transform 0.15s ease, filter 0.15s ease; animation: ev-entrada 0.5s cubic-bezier(0.2, 0.8, 0.2, 1) both; }
  .ev-tile:hover { transform: translateY(-2px) scale(1.05); filter: brightness(1.08); }
  .ev-tile:active { transform: scale(0.97); }
  .ev-tile-fondo { border: 2.5px solid; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 0 rgba(0,0,0,0.35); }
  .ev-tile-fondo::after { content: ''; position: absolute; top: 0; bottom: 0; left: 0; width: 38%; background: linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,0.24), rgba(255,255,255,0)); animation: ev-brillo 4.2s ease-in-out infinite; pointer-events: none; }
  .ev-tile-img { position: absolute; object-fit: contain; animation: ev-flota 3s ease-in-out infinite; filter: drop-shadow(0 3px 2px rgba(0,0,0,0.35)); }
  .ev-destello { position: absolute; z-index: 3; pointer-events: none; color: #FFE9A0; text-shadow: 0 0 6px rgba(255, 190, 40, 0.95); animation: ev-destello 3.2s ease-in-out infinite; opacity: 0; font-size: 17px; line-height: 1; }
  @media (prefers-reduced-motion: reduce) { .ev-card, .ev-icono, .ev-card::after, .ev-tile, .ev-tile-img, .ev-tile-fondo::after { animation: none; } .ev-card::after, .ev-tile-fondo::after { display: none; } .ev-destello { display: none; } }
`;

export function fechaCorta(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function faltaEvento(iso, abierto) {
  const ms = new Date(iso).getTime() - Date.now();
  if (!abierto || !(ms > 0)) return 'Cerrado';
  const d = Math.floor(ms / 86400000);
  if (d >= 2) return `Faltan ${d} días`;
  const h = Math.floor(ms / 3600000);
  return h >= 1 ? `Faltan ${h} h` : 'Cierra hoy';
}

// Trae los eventos vigentes. Es accesorio: si falla, devuelve una lista vacía y el lobby queda con su diseño normal.
export function useEventosLiga(token, activo = true) {
  const [eventos, setEventos] = useState([]);
  const recargar = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${BASE_URL}/api/salas/ranked/rangos`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (res.ok && Array.isArray(data.eventos)) setEventos(data.eventos);
    } catch (err) { console.error('Error cargando los eventos:', err); }
  }, [token]);
  useEffect(() => { if (activo) recargar(); }, [activo, recargar]);
  return { eventos, recargar };
}

export function EventoCard({ e, indice = 0, onClick }) {
  const est = EVENTO_ESTILO[e.id] || EVENTO_POR_DEFECTO;
  const completa = !!est.completa;
  const d = indice * 0.15;
  return (
    <button
      type="button"
      className={`ev-tile${completa ? '' : ' ev-tile-fondo'}`}
      onClick={onClick}
      aria-label={`Evento ${e.titulo}`}
      style={{ animationDelay: `${indice * 0.09}s`, ...(completa ? {} : { background: est.fondo, borderColor: est.borde }), ...(e.abierto ? {} : { opacity: 0.55 }) }}
    >
      {!completa && <span style={{ ...estilos.tileEtiqueta, color: est.color }}>{est.etiqueta}</span>}
      <img
        src={est.icono}
        alt=""
        draggable={false}
        className="ev-tile-img"
        style={completa ? { inset: 0, width: '100%', height: '100%', animationDelay: `${indice * 0.3}s` } : { left: '14%', top: '14%', width: '72%', height: '56%', animationDelay: `${indice * 0.3}s` }}
      />
      <span style={estilos.tileChipCaja}><span style={estilos.tileChip}>{faltaEvento(e.hasta, e.abierto).replace('Faltan ', '')}</span></span>
      {e.abierto && (
        <>
          <span className="ev-destello" aria-hidden="true" style={{ left: '6%', top: '12%', animationDelay: `${d}s` }}>✦</span>
          <span className="ev-destello" aria-hidden="true" style={{ left: '80%', top: '8%', fontSize: 14, animationDelay: `${0.9 + d}s` }}>✦</span>
          <span className="ev-destello" aria-hidden="true" style={{ left: '76%', top: '52%', fontSize: 15, animationDelay: `${1.7 + d}s` }}>✦</span>
        </>
      )}
    </button>
  );
}

export function EventoDetalle({ e }) {
  const est = EVENTO_ESTILO[e.id] || EVENTO_POR_DEFECTO;
  const prog = e.meta ? Math.min(1, (e.actual || 0) / e.meta) : null;
  // Temporada Inaugural: rayos de sol dorados detrás del ícono y franjas celeste / blanco / celeste (la bandera) arriba y abajo.
  const sol = !!est.sol;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ ...estilos.eventoHeroe, background: sol ? `repeating-conic-gradient(from 0deg at 16% 50%, rgba(255, 214, 102, 0.20) 0deg 7.5deg, rgba(255, 214, 102, 0) 7.5deg 15deg), ${est.fondo}` : est.fondo, borderColor: est.borde, ...(sol ? { padding: '24px 16px' } : {}) }}>
        {sol && <span aria-hidden="true" style={{ ...estilos.bandera, top: 0 }} />}
        {sol && <span aria-hidden="true" style={{ ...estilos.bandera, bottom: 0 }} />}
        <img src={est.icono} alt="" draggable={false} className="ev-icono" style={estilos.eventoHeroeIcono} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ ...estilos.eventoCardEtiqueta, color: est.color }}>{est.etiqueta}</div>
          <div style={estilos.eventoHeroeTitulo}>{e.titulo}</div>
          <div style={estilos.eventoCardChip}>{e.abierto ? `Hasta ${fechaCorta(e.hasta)} · ${faltaEvento(e.hasta, true)}` : 'Evento cerrado'}</div>
        </div>
        {e.abierto && <span className="ev-destello" aria-hidden="true" style={{ left: '9%', top: '16%' }}>✦</span>}
        {e.abierto && <span className="ev-destello" aria-hidden="true" style={{ left: '88%', top: '30%', fontSize: 14, animationDelay: '1.2s' }}>✦</span>}
      </div>
      <div style={estilos.cuerpoPergamino}>
        <div style={estilos.eventoDetalleTexto}>{e.texto}</div>
        {prog !== null && (
          <div>
            <div style={estilos.eventoDetalleBarra}><div style={{ ...estilos.eventoDetalleBarraRelleno, width: `${Math.round(prog * 100)}%` }} /></div>
            <div style={estilos.eventoProgreso}>{`${e.actual || 0}/${e.meta} partidas de Liga`}</div>
          </div>
        )}
        {e.premio && <div style={estilos.eventoPremio}>{`Premio: ${e.premio}${e.premioDisponible === false ? ' (se suma pronto)' : ''}`}</div>}
        {e.como && e.como.length > 0 && (
          <div>
            <div style={estilos.eventosTitulo}>Cómo participar</div>
            <ul style={estilos.lista}>
              {e.como.map((l) => <li key={l}>{l}</li>)}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

const estilos = {
  eventoCard: { width: '100%', flex: '1 1 0', minHeight: 78, display: 'flex', alignItems: 'center', gap: 12, padding: '8px 14px', borderRadius: 14, border: '2px solid', color: '#FFF8ED', fontFamily: "'Nunito', sans-serif", boxShadow: '0 4px 0 rgba(0,0,0,0.35)' },
  eventoCardIcono: { width: 54, height: 54, objectFit: 'contain', flexShrink: 0 },
  eventoCardEtiqueta: { fontFamily: "'Fredoka', sans-serif", fontWeight: 700, fontSize: 11, letterSpacing: 1.2 },
  eventoCardTitulo: { fontFamily: "'Fredoka', sans-serif", fontWeight: 700, fontSize: 16, lineHeight: 1.15, color: '#FFF8ED', margin: '1px 0 4px' },
  tileEtiqueta: { position: 'absolute', top: 5, left: 0, right: 0, textAlign: 'center', fontFamily: "'Fredoka', sans-serif", fontWeight: 700, fontSize: 10, letterSpacing: 1.1 },
  // Pase 664: chip compacto ("32 días") igual en todos los botones de evento: ya no tapa la imagen del Pack.
  tileChip: { display: 'inline-block', padding: '1px 7px', borderRadius: 7, background: C.dorado, border: '1.5px solid #B9853F', fontFamily: "'Nunito', sans-serif", fontWeight: 800, fontSize: 11, lineHeight: '14px', color: C.chocolate },
  tileChipCaja: { position: 'absolute', left: 0, right: 0, bottom: 4, display: 'flex', justifyContent: 'center', pointerEvents: 'none' },
  eventoCardChip: { display: 'inline-block', padding: '2px 9px', borderRadius: 8, background: C.dorado, border: '2px solid #B9853F', fontFamily: "'Nunito', sans-serif", fontWeight: 800, fontSize: 12, color: C.chocolate },
  eventoCardBarra: { height: 6, borderRadius: 5, background: 'rgba(0,0,0,0.4)', overflow: 'hidden', marginTop: 5 },
  eventoCardBarraRelleno: { height: '100%', background: C.doradoClaro },
  cuerpoPergamino: { display: 'flex', flexDirection: 'column', gap: 12, padding: 14, borderRadius: 12, border: '2px solid #C9A66B', background: '#F3E4C0' },
  bandera: { position: 'absolute', left: 0, right: 0, height: 9, background: 'linear-gradient(to bottom, #75AADB 0 33%, #FFFFFF 33% 66%, #75AADB 66% 100%)' },
  eventoHeroe: { position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', gap: 16, padding: 16, borderRadius: 16, border: '2.5px solid' },
  eventoHeroeIcono: { width: 100, height: 100, objectFit: 'contain', flexShrink: 0 },
  eventoHeroeTitulo: { fontFamily: "'Fredoka', sans-serif", fontWeight: 700, fontSize: 24, lineHeight: 1.1, color: '#FFF8ED', margin: '2px 0 8px' },
  eventoDetalleTexto: { fontFamily: "'Nunito', sans-serif", fontWeight: 700, fontSize: 14, lineHeight: 1.4, color: '#4A3226' },
  eventoDetalleBarra: { height: 14, borderRadius: 9, border: '2px solid #000', background: '#2a1c14', overflow: 'hidden' },
  eventoDetalleBarraRelleno: { height: '100%', background: C.dorado },
  eventoPremio: { fontFamily: "'Nunito', sans-serif", fontWeight: 800, fontSize: 14, color: '#B9770E' },
  eventosTitulo: { fontFamily: "'Fredoka', sans-serif", fontWeight: 700, fontSize: 16, color: C.chocolate, marginBottom: 8 },
  eventoProgreso: { fontFamily: "'Nunito', sans-serif", fontWeight: 800, fontSize: 12.5, color: '#B9770E', marginTop: 3 },
  lista: { margin: 0, paddingLeft: 20, fontFamily: "'Nunito', sans-serif", fontWeight: 600, fontSize: 13, color: '#5a4a45', lineHeight: 1.5 },
};
