import React, { useEffect, useState } from 'react';
import { tipoAvisoInstalar, suscribirInstalacion, instalarWeb, descartarAvisoInstalar } from '../../utils/instalarWeb';

// Pase 724: cartel chico para instalar la web en el celular. Aparece unos segundos después de entrar al lobby, una sola vez.
const DEMORA_MS = 6000;

export default function AvisoInstalarWeb() {
  const [tipo, setTipo] = useState(null);
  const [listo, setListo] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setListo(true), DEMORA_MS);
    const actualizar = () => setTipo(tipoAvisoInstalar());
    actualizar();
    const baja = suscribirInstalacion(actualizar);
    return () => { clearTimeout(t); baja(); };
  }, []);

  if (!listo || !tipo) return null;

  const cerrar = () => { descartarAvisoInstalar(); setTipo(null); };
  const instalar = async () => { await instalarWeb(); setTipo(null); };

  return (
    <div role="dialog" aria-label="Instalar TrucoChe" style={estilos.caja}>
      <img src="/logo192.png" alt="" width="44" height="44" style={estilos.icono} draggable="false" />
      <div style={estilos.textos}>
        <div style={estilos.titulo}>Jugá más rápido</div>
        <div style={estilos.sub}>
          {tipo === 'ios'
            ? <>Tocá Compartir y elegí «Agregar a inicio».</>
            : <>Agregá TrucoChe a tu pantalla de inicio.</>}
        </div>
      </div>
      {tipo === 'android' && (
        <button type="button" onClick={instalar} style={estilos.boton}>Agregar</button>
      )}
      <button type="button" onClick={cerrar} aria-label="Cerrar aviso" style={estilos.cerrar}>✕</button>
    </div>
  );
}

const estilos = {
  caja: {
    position: 'fixed', left: 12, right: 12, bottom: 'calc(84px + env(safe-area-inset-bottom, 0px))', zIndex: 900,
    maxWidth: 420, margin: '0 auto', boxSizing: 'border-box',
    display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
    background: '#FFF4D6', border: '2px solid #5C3D21', borderRadius: 14,
    boxShadow: '0 6px 16px rgba(0,0,0,0.45)',
  },
  icono: { borderRadius: 10, flexShrink: 0 },
  textos: { flex: 1, minWidth: 0 },
  titulo: { fontFamily: "'Fredoka', sans-serif", fontWeight: 700, fontSize: 16, color: '#2C160E', lineHeight: 1.15 },
  sub: { fontFamily: "'Nunito', sans-serif", fontWeight: 700, fontSize: 13, color: '#6B4A2A', lineHeight: 1.25 },
  boton: {
    flexShrink: 0, border: 'none', borderBottom: '3px solid #8A6414', borderRadius: 10, background: '#D4A030', color: '#3B1F0E',
    padding: '7px 12px', fontFamily: "'Fredoka', sans-serif", fontWeight: 700, fontSize: 14, cursor: 'pointer',
  },
  cerrar: { flexShrink: 0, border: 'none', background: 'transparent', color: '#6B4A2A', fontSize: 18, lineHeight: 1, padding: 6, cursor: 'pointer' },
};
