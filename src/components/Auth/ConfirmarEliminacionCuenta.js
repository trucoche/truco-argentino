import React, { useState, useEffect, useRef } from 'react';
import { API_URL as BASE_URL } from '../../config';

const API_URL = `${BASE_URL}/api/auth`;

const C = {
  verde: '#2D9B4F', verdeOscuro: '#1f7a3c',
  crimson: '#E8483A', crimsonOscuro: '#c2352a',
  dorado: '#FFB627', doradoClaro: '#FFD668', doradoOscuro: '#C9860E',
  crema: '#FFF8ED', chocolate: '#4A2C2A'
};

// Pantalla pública (sin login) a la que llega el link del mail de
// confirmación de eliminación de cuenta — mismo patrón que
// VerificarEmail.js: sin formulario, apenas se monta confirma el token
// solo, contra POST /api/auth/confirmar-eliminacion.
export default function ConfirmarEliminacionCuenta({ token, onIrALogin }) {
  const [estado, setEstado] = useState('cargando'); // 'cargando' | 'exito' | 'error'
  const [mensaje, setMensaje] = useState('');
  const yaIntento = useRef(false);

  useEffect(() => {
    if (!token) {
      setEstado('error');
      setMensaje('Este link no es válido. Pedilo de nuevo desde la página de eliminación de cuenta.');
      return;
    }
    if (yaIntento.current) return;
    yaIntento.current = true;

    const confirmar = async () => {
      try {
        const res = await fetch(`${API_URL}/confirmar-eliminacion`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token })
        });
        const data = await res.json();

        if (!res.ok) {
          setMensaje(data.error || 'No pudimos confirmar la eliminación de tu cuenta.');
          setEstado('error');
          return;
        }

        setMensaje(data.mensaje);
        setEstado('exito');
      } catch (err) {
        console.error('Error de conexión:', err);
        setMensaje('No se pudo conectar con el servidor');
        setEstado('error');
      }
    };
    confirmar();
  }, [token]);

  return (
    <div style={estilos.pagina}>
      <div style={estilos.app}>

        <div style={estilos.logoWrap}>
          <img src="/assets/trucoche-logo.png" alt="TrucoChe" style={estilos.logoCompleto} />
          <div style={estilos.logoSub}>che, ¿un truquito?</div>
        </div>

        <div style={estilos.panel}>
          {estado === 'cargando' && (
            <>
              <h2 style={estilos.titulo}>Confirmando la eliminación...</h2>
              <div style={estilos.spinner} />
            </>
          )}

          {estado === 'exito' && (
            <>
              <h2 style={estilos.titulo}>Cuenta desactivada</h2>
              <div style={estilos.exitoBox}>{mensaje}</div>
              <button type="button" onClick={onIrALogin} style={estilos.btnPrimary}>
                Ir a iniciar sesión
              </button>
            </>
          )}

          {estado === 'error' && (
            <>
              <h2 style={estilos.titulo}>No pudimos confirmar la eliminación</h2>
              <div style={estilos.errorBox}>{mensaje}</div>
              <button type="button" onClick={onIrALogin} style={estilos.btnPrimary}>
                Ir a iniciar sesión
              </button>
            </>
          )}
        </div>

        <div style={estilos.footerHint}>
          Un juego de truco argentino
        </div>

      </div>
    </div>
  );
}

const estilos = {
  pagina: {
    minHeight: '100vh',
    backgroundImage: 'linear-gradient(rgba(20,20,15,0.55), rgba(20,20,15,0.55)), url(/assets/images/fondo-login.jpeg)',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    display: 'flex', justifyContent: 'center', alignItems: 'center',
    padding: '30px 12px', fontFamily: "'Nunito', sans-serif"
  },
  app: { width: '100%', maxWidth: 400 },
  logoWrap: { textAlign: 'center', marginBottom: 22 },
  logoCompleto: { width: '100%', maxWidth: 320, height: 'auto', display: 'block', margin: '0 auto' },
  logoSub: { fontFamily: "'Nunito', sans-serif", fontWeight: 800, fontStyle: 'italic', fontSize: 20, color: C.crema, marginTop: -6 },
  panel: {
    background: C.crema, border: `4px solid ${C.chocolate}`, borderRadius: 20,
    boxShadow: '0 6px 0 rgba(0,0,0,0.25)', padding: '20px 20px 24px',
    position: 'relative', overflow: 'hidden', textAlign: 'center'
  },
  titulo: {
    fontFamily: "'Fredoka', sans-serif", fontWeight: 600, fontSize: 20,
    color: C.chocolate, marginTop: 0, marginBottom: 16, textAlign: 'center'
  },
  spinner: {
    width: 34, height: 34, margin: '4px auto 6px', borderRadius: '50%',
    border: `4px solid rgba(74,44,42,0.15)`, borderTopColor: C.crimson,
    animation: 'ce-girar 0.8s linear infinite'
  },
  errorBox: {
    background: '#ffe0dd', border: `2px solid ${C.crimson}`, color: C.crimsonOscuro,
    borderRadius: 10, padding: '10px 12px', marginBottom: 12, fontWeight: 700, fontSize: 13,
    textAlign: 'center'
  },
  exitoBox: {
    background: '#e2f5e6', border: `2px solid ${C.verde}`, color: C.verdeOscuro,
    borderRadius: 10, padding: '14px', marginBottom: 14, fontWeight: 700, fontSize: 14,
    textAlign: 'center', lineHeight: 1.4
  },
  btnPrimary: {
    fontFamily: "'Fredoka', sans-serif", fontWeight: 600, fontSize: 16,
    background: `linear-gradient(180deg, ${C.doradoClaro}, ${C.dorado})`, color: C.chocolate,
    border: `3px solid ${C.chocolate}`, borderRadius: 14, padding: 13,
    width: '100%', boxShadow: `0 5px 0 ${C.doradoOscuro}`, marginTop: 4, cursor: 'pointer'
  },
  footerHint: { textAlign: 'center', marginTop: 16, fontSize: 12, color: 'rgba(255,248,237,0.75)', fontWeight: 700 }
};

if (typeof document !== 'undefined' && !document.getElementById('confirmar-eliminacion-keyframes')) {
  const style = document.createElement('style');
  style.id = 'confirmar-eliminacion-keyframes';
  style.textContent = `
    @keyframes ce-girar {
      to { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);
}
