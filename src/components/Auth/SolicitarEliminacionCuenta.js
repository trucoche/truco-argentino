import React, { useState } from 'react';
import { API_URL as BASE_URL } from '../../config';

const API_URL = `${BASE_URL}/api/auth`;

const C = {
  verde: '#2D9B4F', verdeOscuro: '#1f7a3c',
  crimson: '#E8483A', crimsonOscuro: '#c2352a',
  dorado: '#FFB627', doradoClaro: '#FFD668', doradoOscuro: '#C9860E',
  crema: '#FFF8ED', chocolate: '#4A2C2A'
};

// Pase siguiente: página pública (sin login, accesible directo desde
// www.trucoche.com.ar/eliminar-cuenta) para cumplir el campo "URL de
// eliminación de cuenta" que pide la Play Console (Seguridad de los
// datos) — mismo criterio de ruta pública que /privacidad,
// /olvidar-password, /reset-password y /verificar-email (ver App.js).
// El texto de esta pantalla repite, resumido, lo mismo que ya promete el
// punto 10 de la Política de Privacidad, para que el reviewer de Google
// no tenga que ir a buscarlo a otro lado — los 3 requisitos que pide
// Google (nombrar la app, los pasos a seguir, y qué datos se borran o
// conservan) están cubiertos directo en esta misma pantalla.
export default function SolicitarEliminacionCuenta({ onVolverLogin }) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [mensaje, setMensaje] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setCargando(true);

    try {
      const res = await fetch(`${API_URL}/solicitar-eliminacion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Error desconocido');
        setCargando(false);
        return;
      }

      setMensaje(data.mensaje);
      setEnviado(true);

    } catch (err) {
      console.error('Error de conexión:', err);
      setError('No se pudo conectar con el servidor');
    } finally {
      setCargando(false);
    }
  };

  return (
    <div style={estilos.pagina}>
      <div style={estilos.app}>

        <div style={estilos.logoWrap}>
          <img src="/assets/trucoche-logo.png" alt="TrucoChe" style={estilos.logoCompleto} />
          <div style={estilos.logoSub}>che, ¿un truquito?</div>
        </div>

        <div style={estilos.panel}>
          <h2 style={estilos.titulo}>Eliminar tu cuenta de TrucoChe</h2>

          {!enviado ? (
            <>
              <p style={estilos.texto}>
                Ingresá el email con el que te registraste en TrucoChe. Te vamos a mandar un
                link para confirmar el pedido — nadie puede eliminar tu cuenta solo escribiendo
                tu email acá, necesitamos que lo confirmes desde tu propia casilla.
              </p>

              <div style={estilos.infoBox}>
                <strong>Qué pasa después de confirmar:</strong>
                <ol style={estilos.listaInfo}>
                  <li>Tu cuenta se desactiva de inmediato: deja de aparecer en rankings, búsquedas y salas, y no vas a poder iniciar sesión con normalidad.</li>
                  <li>Tenés 30 días para cambiar de opinión: si volvés a iniciar sesión con tu email y contraseña dentro de ese plazo, tu cuenta y tus datos (estadísticas, personaje, historial) se restauran solos.</li>
                  <li>Pasados los 30 días sin que vuelvas a entrar, borramos de forma definitiva tu nombre de usuario, foto de perfil, estadísticas e historial de partidas. Podemos conservar tu email por un tiempo extra solo para evitar cuentas duplicadas o la reincidencia de usuarios suspendidos.</li>
                </ol>
                <span style={estilos.infoFooter}>
                  Más detalle en nuestra <a href="/privacidad" style={estilos.link}>Política de Privacidad</a> (punto 10), o escribinos directo a trucoargentino.dev@gmail.com.
                </span>
              </div>

              <form onSubmit={handleSubmit}>
                <div style={estilos.field}>
                  <label style={estilos.label}>Email</label>
                  <input
                    type="email"
                    name="email"
                    placeholder="tu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    style={estilos.input}
                  />
                </div>

                {error && <div style={estilos.errorBox}>{error}</div>}

                <button type="submit" disabled={cargando} style={estilos.btnPrimary}>
                  {cargando ? 'Enviando...' : 'Solicitar eliminación de cuenta'}
                </button>
              </form>
            </>
          ) : (
            <div style={estilos.exitoBox}>
              {mensaje}
            </div>
          )}

          <button type="button" onClick={onVolverLogin} style={estilos.btnVolver}>
            ← Volver a iniciar sesión
          </button>
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
  app: { width: '100%', maxWidth: 440 },
  logoWrap: { textAlign: 'center', marginBottom: 22 },
  logoCompleto: { width: '100%', maxWidth: 320, height: 'auto', display: 'block', margin: '0 auto' },
  logoSub: { fontFamily: "'Nunito', sans-serif", fontWeight: 800, fontStyle: 'italic', fontSize: 20, color: C.crema, marginTop: -6 },
  panel: {
    background: C.crema, border: `4px solid ${C.chocolate}`, borderRadius: 20,
    boxShadow: '0 6px 0 rgba(0,0,0,0.25)', padding: '20px 20px 24px',
    position: 'relative', overflow: 'hidden'
  },
  titulo: {
    fontFamily: "'Fredoka', sans-serif", fontWeight: 600, fontSize: 20,
    color: C.chocolate, marginTop: 0, marginBottom: 10, textAlign: 'center'
  },
  texto: {
    fontFamily: "'Nunito', sans-serif", fontSize: 14, color: C.chocolate,
    textAlign: 'center', marginBottom: 14, lineHeight: 1.4
  },
  infoBox: {
    background: '#fff', border: `2px solid ${C.chocolate}33`, borderRadius: 12,
    padding: '12px 14px', marginBottom: 16, fontSize: 13, color: C.chocolate, lineHeight: 1.45
  },
  listaInfo: { margin: '6px 0 8px', paddingLeft: 18 },
  infoFooter: { fontSize: 12, color: '#7a6660' },
  link: { color: C.doradoOscuro, fontWeight: 700 },
  field: { marginBottom: 14 },
  label: { display: 'block', fontWeight: 700, fontSize: 12, color: C.chocolate, marginBottom: 5, textTransform: 'uppercase' },
  input: {
    width: '100%', fontFamily: "'Nunito', sans-serif", fontWeight: 700, fontSize: 15,
    color: C.chocolate, background: '#fff', border: `2.5px solid ${C.chocolate}`,
    borderRadius: 12, padding: '11px 12px'
  },
  errorBox: {
    background: '#ffe0dd', border: `2px solid ${C.crimson}`, color: C.crimsonOscuro,
    borderRadius: 10, padding: '8px 12px', marginBottom: 12, fontWeight: 700, fontSize: 13
  },
  exitoBox: {
    background: '#e2f5e6', border: `2px solid ${C.verde}`, color: C.verdeOscuro,
    borderRadius: 10, padding: '14px', marginBottom: 14, fontWeight: 700, fontSize: 14,
    textAlign: 'center', lineHeight: 1.4
  },
  btnPrimary: {
    fontFamily: "'Fredoka', sans-serif", fontWeight: 600, fontSize: 15,
    background: `linear-gradient(180deg, #f08b80, ${C.crimson})`, color: '#fff',
    border: `3px solid ${C.chocolate}`, borderRadius: 14, padding: 13,
    width: '100%', boxShadow: `0 5px 0 ${C.crimsonOscuro}`, marginTop: 4, cursor: 'pointer'
  },
  btnVolver: {
    fontFamily: "'Fredoka', sans-serif", fontWeight: 600, fontSize: 13,
    background: 'none', color: C.chocolate, border: 'none',
    width: '100%', textAlign: 'center', marginTop: 16, cursor: 'pointer',
    textDecoration: 'underline'
  },
  footerHint: { textAlign: 'center', marginTop: 16, fontSize: 12, color: 'rgba(255,248,237,0.75)', fontWeight: 700 }
};
