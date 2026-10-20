import React, { useEffect, useRef, useState } from 'react';
import { bannerPorId, BANNER_MARCO_SIN_TABLON } from '../../constants/personalizacion';

// Pase 578 (paridad con la app, Pases 524/525/532/533): banner de la tarjeta de perfil (propio y pop-up de perfil ajeno).
// Dibuja la placa elegida por el jugador con la proporción REAL del PNG (480:230) y adentro, respetando el marco de la
// placa (`margenInterior`), pone el contenido (avatar, botones). Con una foto de fondo comprada, la foto va ATRÁS de un
// marco de madera vacío (sin tablón), así el marco tapa los bordes de la foto y se ve siempre.
// `children` puede ser una función ({ ancho, alto, anchoUtil, altoUtil }) para dimensionar el contenido según el banner.

// Zona que ocupa la foto detrás del marco (fracciones del banner): el hueco + ~4 px de solape bajo el marco.
const FOTO = { x0: 27 / 480, x1: 453 / 480, y0: 27 / 230, y1: 204 / 230 };

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
        <div style={{ position: 'absolute', left: mx, right: mx, top: my, bottom: my, display: 'flex', alignItems: 'center', padding: '0 6px', boxSizing: 'border-box' }}>
          {typeof children === 'function' ? children({ ancho, alto, anchoUtil, altoUtil }) : children}
        </div>
      </div>
    </div>
  );
}
