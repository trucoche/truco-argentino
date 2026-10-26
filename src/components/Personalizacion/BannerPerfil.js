import React, { useEffect, useRef, useState } from 'react';
import { bannerPorId, BANNER_MARCO_SIN_TABLON } from '../../constants/personalizacion';

// Pase 578 (paridad con la app, Pases 524/525/532/533): banner de la tarjeta de perfil (propio y pop-up de perfil ajeno).
// Dibuja la placa elegida por el jugador con la proporción REAL del PNG (480:230) y adentro, respetando el marco de la
// placa (`margenInterior`), pone el contenido (avatar, botones). Con una foto de fondo comprada, la foto va ATRÁS de un
// marco de madera vacío (sin tablón), así el marco tapa los bordes de la foto y se ve siempre.
// `children` puede ser una función ({ ancho, alto, anchoUtil, altoUtil }) para dimensionar el contenido según el banner.

// Zona que ocupa la foto detrás del marco (fracciones del banner): el hueco + ~4 px de solape bajo el marco.
const FOTO = { x0: 27 / 480, x1: 453 / 480, y0: 27 / 230, y1: 204 / 230 };

// Pase 631: franja celeste-blanca-celeste (los colores de la bandera) que enmarca la leyenda.
const estiloFranja = (alto) => ({ width: '86%', height: Math.max(4, alto * 0.034), borderRadius: 2, border: '1px solid rgba(74,44,42,0.55)', boxSizing: 'border-box', background: 'linear-gradient(to bottom, #75AADB 0 33%, #FFFFFF 33% 66%, #75AADB 66% 100%)' });

export default function BannerPerfil({ bannerId, fondoUrl, children, style, anchoMax = 480 }) {
  const conFoto = !!fondoUrl;
  const banner = bannerPorId(conFoto ? 'base' : bannerId);
  const contenedorRef = useRef(null);
  const [anchoMedido, setAnchoMedido] = useState(null);

  useEffect(() => {
    const el = contenedorRef.current;
    if (!el) return undefined;
    const medir = () => {
      const w = Math.round(el.getBoundingClientRect().width);
      if (w > 0) setAnchoMedido((prev) => (prev === w ? prev : w));
    };
    medir();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', medir);
      return () => window.removeEventListener('resize', medir);
    }
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const ancho = Math.max(0, Math.min(anchoMedido == null ? anchoMax : anchoMedido, anchoMax));
  const alto = ancho / banner.proporcion;
  const mx = ancho * banner.margenInterior.x;
  const my = alto * banner.margenInterior.y;
  const anchoUtil = ancho - mx * 2;
  const altoUtil = alto - my * 2;

  return (
    <div ref={contenedorRef} style={{ alignSelf: 'stretch', display: 'flex', justifyContent: 'center', width: '100%', ...style }}>
      <div style={{ position: 'relative', width: ancho, height: alto, overflow: 'hidden', flexShrink: 0 }}>
        {conFoto && (
          <div
            style={{
              position: 'absolute', left: ancho * FOTO.x0, top: alto * FOTO.y0, width: ancho * (FOTO.x1 - FOTO.x0), height: alto * (FOTO.y1 - FOTO.y0),
              overflow: 'hidden', pointerEvents: 'none',
            }}
          >
            <img src={fondoUrl} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(20,20,15,0.22)' }} />
          </div>
        )}
        <img
          src={conFoto ? BANNER_MARCO_SIN_TABLON : banner.imagen}
          alt=""
          style={{ position: 'absolute', left: 0, top: 0, width: ancho, height: alto, display: 'block', pointerEvents: 'none' }}
        />
        {/* Pase 631: leyenda escrita en el lado derecho de algunos banners (el Sol de Mayo tenía esa zona vacía). Solo sin foto propia. */}
        {!conFoto && banner.leyenda && (
          <div style={{ position: 'absolute', left: ancho * 0.48, width: ancho * 0.36, top: alto * 0.40, height: alto * 0.34, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', pointerEvents: 'none' }}>
            <div style={estiloFranja(alto)} />
            <div style={{ fontFamily: "'Fredoka', sans-serif", fontWeight: 700, fontSize: ancho * 0.054, lineHeight: 1.05, color: '#4A2C2A', letterSpacing: 0.5, textShadow: '0 1px 0 rgba(255,248,237,0.9)', margin: `${alto * 0.018}px 0 ${alto * 0.006}px`, whiteSpace: 'nowrap' }}>{banner.leyenda.titulo}</div>
            <div style={{ fontFamily: "'Nunito', sans-serif", fontWeight: 800, fontSize: ancho * 0.027, color: '#B9770E', letterSpacing: 2, margin: `0 0 ${alto * 0.018}px`, whiteSpace: 'nowrap' }}>{banner.leyenda.sub}</div>
            <div style={estiloFranja(alto)} />
          </div>
        )}
        <div style={{ position: 'absolute', left: mx, right: mx, top: my, bottom: my, display: 'flex', alignItems: 'center', padding: '0 6px', boxSizing: 'border-box' }}>
          {typeof children === 'function' ? children({ ancho, alto, anchoUtil, altoUtil }) : children}
        </div>
      </div>
    </div>
  );
}
