import React from 'react';
import './pantalla-carga.css';

// Centésimo cuadragésimo sexto pase — el usuario pidió mejorar las
// pantallas de carga: reemplaza los `<p>Cargando...</p>` sueltos por un
// mismo componente (logo + barra de carga animada + texto) en toda la
// web. Dos variantes, según dónde se usa:
// - `completa` (BracketView, la única pantalla de esta lista que vive
//   FUERA del AppShell y por eso no tenía ya el fondo-lobby detrás):
//   pinta su propio fondo, igual al que usa AppShell.js.
// - Sin `completa` (Ranking/Historial/Lobby, o dentro de un panel ya
//   montado como Torneos/Perfil): no pinta fondo propio porque el de
//   AppShell ya está puesto atrás — solo el widget centrado.
// `conLogo=false` da una versión más chica para loaders DENTRO de un
// panel que ya tiene su propio título arriba (ej. la lista de Logros en
// Perfil, o las pestañas de Torneos) — ahí un logo grande se sentiría
// repetido.
// `tema="oscuro"` (default) es para cuando el widget queda sobre un fondo
// verde oscuro (Ranking/Historial/Lobby/BracketView): texto crema y barra
// clara translúcida. `tema="claro"` es para cuando queda sobre un panel
// crema/blanco (ej. el panel de Logros en Perfil): texto marrón y barra
// tintada en chocolate, igual que el resto del texto de esos paneles.
const C = { chocolate: '#4A2C2A', crema: '#FFF8ED', dorado: '#FFB627', doradoClaro: '#FFD668', textoClaro: '#7a6660' };

export default function PantallaCarga({ mensaje = 'Cargando...', completa = false, conLogo = true, tema = 'oscuro' }) {
  const esClaro = tema === 'claro';
  const contenido = (
    <div style={estilos.contenido}>
      {conLogo && <img src="/assets/trucoche-logo.png" alt="TrucoChe" style={estilos.logo} />}
      <div style={{ ...estilos.barraFondo, ...(esClaro ? estilos.barraFondoClaro : {}) }}>
        <div className="pc-barra-relleno" style={estilos.barraRelleno} />
      </div>
      <div style={{ ...estilos.mensaje, ...(esClaro ? estilos.mensajeClaro : {}) }}>{mensaje}</div>
    </div>
  );

  return (
    <div style={{ ...estilos.envoltorio, ...(completa ? estilos.fondoCompleto : {}), minHeight: conLogo ? 320 : 120 }}>
      {contenido}
    </div>
  );
}

const estilos = {
  envoltorio: { display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 18 },
  fondoCompleto: {
    minHeight: '100vh',
    backgroundImage: 'linear-gradient(rgba(20,20,15,0.38), rgba(20,20,15,0.38)), url(/assets/images/fondo-lobby.jpeg)',
    backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat',
  },
  contenido: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 },
  logo: { width: 190, height: 'auto' },
  barraFondo: {
    width: 220, height: 10, borderRadius: 6, overflow: 'hidden',
    background: 'rgba(255,248,237,0.3)', border: `2px solid ${C.chocolate}`,
  },
  barraFondoClaro: {
    background: 'rgba(74,44,42,0.08)', border: '2px solid rgba(74,44,42,0.25)',
  },
  barraRelleno: { width: 84, height: '100%', borderRadius: 6, background: `linear-gradient(90deg, ${C.doradoClaro}, ${C.dorado})` },
  mensaje: { fontSize: 13.5, fontWeight: 700, color: C.crema, letterSpacing: 0.3, fontFamily: "'Fredoka', sans-serif" },
  mensajeClaro: { color: C.textoClaro },
};
