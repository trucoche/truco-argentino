import React, { useState } from 'react';
import { API_URL as BASE_URL } from '../../config';

const API_URL = `${BASE_URL}/api/auth`;

const C = {
  verde: '#2D9B4F', verdeOscuro: '#1f7a3c',
  crimson: '#E8483A', crimsonOscuro: '#c2352a',
  dorado: '#FFB627', doradoClaro: '#FFD668', doradoOscuro: '#C9860E',
  crema: '#FFF8ED', chocolate: '#4A2C2A'
};

export default function ResetPassword({ token, onExito }) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const [exito, setExito] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }

    setCargando(true);

    try {
      const res = await fetch(`${API_URL}/resetear-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password })
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Error desconocido');
        setCargando(false);
        return;
      }

      setExito(true);

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
          <h2 style={estilos.titulo}>Elegí tu nueva contraseña</h2>

          {!token ? (
            <div style={estilos.errorBox}>
              Este link no es válido. Pedí uno nuevo desde la pantalla de inicio de sesión.
            </div>
          ) : !exito ? (
            <form onSubmit={handleSubmit}>
              <div style={estilos.field}>
                <label style={estilos.label}>Nueva contraseña</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  style={estilos.input}
                />
              </div>

              <div style={estilos.field}>
                <label style={estilos.label}>Repetir contraseña</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  style={estilos.input}
                />
              </div>

              {error && <div style={estilos.errorBox}>{error}</div>}

              <button type="submit" disabled={cargando} style={estilos.btnPrimary}>
                {cargando ? 'Guardando...' : '✓ Guardar nueva contraseña'}
              </button>
            </form>
          ) : (
            <>
              <div style={estilos.exitoBox}>
                ¡Listo! Tu contraseña fue actualizada correctamente.
              </div>
              <button type="button" onClick={onExito} style={estilos.btnPrimary}>
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
    background: 'radial-gradient(circle at 50% 0%, #379a54 0%, #2D9B4F 45%, #1f7a3c 100%)',
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
    color: C.chocolate, marginTop: 0, marginBottom: 16, textAlign: 'center'
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