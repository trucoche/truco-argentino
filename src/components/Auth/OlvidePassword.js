import React, { useState } from 'react';
import { API_URL as BASE_URL } from '../../config';

const API_URL = `${BASE_URL}/api/auth`;

const C = {
  verde: '#2D9B4F', verdeOscuro: '#1f7a3c',
  crimson: '#E8483A', crimsonOscuro: '#c2352a',
  dorado: '#FFB627', doradoClaro: '#FFD668', doradoOscuro: '#C9860E',
  crema: '#FFF8ED', chocolate: '#4A2C2A'
};

export default function OlvidePassword({ onVolverLogin }) {
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
      const res = await fetch(`${API_URL}/solicitar-recuperacion`, {
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
          <h2 style={estilos.titulo}>Recuperar contraseña</h2>

          {!enviado ? (
            <>
              <p style={estilos.texto}>
                Ingresá el email con el que te registraste y te mandamos un link para restablecer tu contraseña.
              </p>

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
                  {cargando ? 'Enviando...' : '✓ Enviar link de recuperación'}
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
  app: { width: '100%', maxWidth: 400 },
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
    textAlign: 'center', marginBottom: 18, lineHeight: 1.4
  },
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
    fontFamily: "'Fredoka', sans-serif", fontWeight: 600, fontSize: 16,
    background: `linear-gradient(180deg, ${C.doradoClaro}, ${C.dorado})`, color: C.chocolate,
    border: `3px solid ${C.chocolate}`, borderRadius: 14, padding: 13,
    width: '100%', boxShadow: `0 5px 0 ${C.doradoOscuro}`, marginTop: 4, cursor: 'pointer'
  },
  btnVolver: {
    fontFamily: "'Fredoka', sans-serif", fontWeight: 600, fontSize: 13,
    background: 'none', color: C.chocolate, border: 'none',
    width: '100%', textAlign: 'center', marginTop: 16, cursor: 'pointer',
    textDecoration: 'underline'
  },
  footerHint: { textAlign: 'center', marginTop: 16, fontSize: 12, color: 'rgba(255,248,237,0.75)', fontWeight: 700 }
};