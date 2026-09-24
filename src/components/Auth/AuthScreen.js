import React, { useState, useEffect, useRef } from 'react';
import { API_URL as BASE_URL } from '../../config';

const API_URL = `${BASE_URL}/api/auth`;
const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID;
const FACEBOOK_APP_ID = process.env.REACT_APP_FACEBOOK_APP_ID;

const C = {
  verde: '#2D9B4F', verdeOscuro: '#1f7a3c',
  crimson: '#E8483A', crimsonOscuro: '#c2352a',
  dorado: '#FFB627', doradoClaro: '#FFD668', doradoOscuro: '#C9860E',
  crema: '#FFF8ED', chocolate: '#4A2C2A'
};

function Filigrana() {
  const path = (
    <>
      <path d="M2 44 C2 20 20 2 44 2" stroke={C.doradoOscuro} strokeWidth="1.5" />
      <path d="M2 34 C2 16 16 2 34 2" stroke={C.dorado} strokeWidth="1.2" />
      <circle cx="2" cy="44" r="3" fill={C.dorado} />
      <path d="M8 44 C8 24 24 8 44 8" stroke={C.dorado} strokeWidth="0.8" opacity="0.7" />
    </>
  );
  const base = { position: 'absolute', width: 44, height: 44, opacity: 0.55, pointerEvents: 'none' };
  return (
    <>
      <svg style={{ ...base, top: 6, left: 6 }} viewBox="0 0 46 46" fill="none">{path}</svg>
      <svg style={{ ...base, top: 6, right: 6, transform: 'scaleX(-1)' }} viewBox="0 0 46 46" fill="none">{path}</svg>
      <svg style={{ ...base, bottom: 6, left: 6, transform: 'scaleY(-1)' }} viewBox="0 0 46 46" fill="none">{path}</svg>
      <svg style={{ ...base, bottom: 6, right: 6, transform: 'scale(-1,-1)' }} viewBox="0 0 46 46" fill="none">{path}</svg>
    </>
  );
}

export default function AuthScreen({ onLoginExitoso, onOlvidoPassword, musicaMuteada, onToggleMusica }) {
  const [modo, setModo] = useState('login');
  const [form, setForm] = useState({ username: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const botonGoogleRef = useRef(null);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setCargando(true);

    const endpoint = modo === 'login' ? '/login' : '/registro';
    const body = modo === 'login'
      ? { email: form.email, password: form.password }
      : form;

    try {
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Error desconocido');
        setCargando(false);
        return;
      }

      localStorage.setItem('truco_token', data.token);
      localStorage.setItem('truco_usuario', JSON.stringify(data.usuario));

      onLoginExitoso(data.usuario, data.token);

    } catch (err) {
      console.error('Error de conexión:', err);
      setError('No se pudo conectar con el servidor');
    } finally {
      setCargando(false);
    }
  };

  const handleCredentialResponse = async (response) => {
    setError('');
    setCargando(true);
    try {
      const res = await fetch(`${API_URL}/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: response.credential })
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Error al iniciar sesión con Google');
        setCargando(false);
        return;
      }

      localStorage.setItem('truco_token', data.token);
      localStorage.setItem('truco_usuario', JSON.stringify(data.usuario));

      onLoginExitoso(data.usuario, data.token);

    } catch (err) {
      console.error('Error de conexión con Google:', err);
      setError('No se pudo conectar con el servidor');
      setCargando(false);
    }
  };

const handleFacebookResponse = (response) => {
  if (response.status !== 'connected') {
    // El usuario canceló o no autorizó — no es un error real, no mostramos nada
    return;
  }

  setError('');
  setCargando(true);

  fetch(`${API_URL}/facebook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accessToken: response.authResponse.accessToken })
  })
    .then(res => res.json().then(data => ({ ok: res.ok, data })))
    .then(({ ok, data }) => {
      if (!ok) {
        setError(data.error || 'Error al iniciar sesión con Facebook');
        setCargando(false);
        return;
      }
      localStorage.setItem('truco_token', data.token);
      localStorage.setItem('truco_usuario', JSON.stringify(data.usuario));
      onLoginExitoso(data.usuario, data.token);
    })
    .catch(err => {
      console.error('Error de conexión con Facebook:', err);
      setError('No se pudo conectar con el servidor');
      setCargando(false);
    });
};

const iniciarSesionFacebook = () => {
  if (!window.FB) {
    console.error('El SDK de Facebook no cargó a tiempo');
    return;
  }
  window.FB.login(handleFacebookResponse, { scope: 'email' });
};

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) {
      console.warn('Falta REACT_APP_GOOGLE_CLIENT_ID');
      return;
    }

    let intentos = 0;
    const intentar = () => {
      if (window.google && botonGoogleRef.current) {
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleCredentialResponse
        });
        window.google.accounts.id.renderButton(botonGoogleRef.current, {
          theme: 'outline',
          size: 'large',
          width: 300,
          text: 'continue_with'
        });
      } else if (intentos < 20) {
        intentos++;
        setTimeout(intentar, 200);
      } else {
        console.error('El script de Google no cargó a tiempo');
      }
    };

    intentar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

useEffect(() => {
  if (!FACEBOOK_APP_ID) {
    console.warn('Falta REACT_APP_FACEBOOK_APP_ID');
    return;
  }

  // El SDK de Facebook necesita este div específico en el documento
  if (!document.getElementById('fb-root')) {
    const fbRoot = document.createElement('div');
    fbRoot.id = 'fb-root';
    document.body.prepend(fbRoot);
  }

  window.fbAsyncInit = function () {
    window.FB.init({
      appId: FACEBOOK_APP_ID,
      cookie: true,
      xfbml: false,
      version: 'v21.0'
    });
  };

  if (!document.getElementById('facebook-jssdk')) {
    const script = document.createElement('script');
    script.id = 'facebook-jssdk';
    script.src = 'https://connect.facebook.net/es_LA/sdk.js';
    script.async = true;
    document.body.appendChild(script);
  }
}, []);

  return (
  <div style={estilos.pagina}>
    <button
      type="button"
      onClick={onToggleMusica}
      style={estilos.botonMusica}
      title={musicaMuteada ? 'Activar música' : 'Silenciar música'}
    >
      {musicaMuteada ? '🔇' : '🎵'}
    </button>

    <div style={estilos.app}>

        <div style={estilos.logoWrap}>
          <img src="/assets/trucoche-logo.png" alt="TrucoChe" style={estilos.logoCompleto} />
          <div style={estilos.logoSub}>che, ¿un truquito?</div>
        </div>

        <div style={estilos.panel}>
          <Filigrana />

          <div style={estilos.tabs}>
            <button
              type="button"
              onClick={() => { setModo('login'); setError(''); }}
              style={{ ...estilos.tab, ...(modo === 'login' ? estilos.tabActivo : {}) }}
            >
              Iniciar sesión
            </button>
            <button
              type="button"
              onClick={() => { setModo('registro'); setError(''); }}
              style={{ ...estilos.tab, ...(modo === 'registro' ? estilos.tabActivo : {}) }}
            >
              Registrarme
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            {modo === 'registro' && (
              <div style={estilos.field}>
                <label style={estilos.label}>Usuario</label>
                <input
                  type="text"
                  name="username"
                  placeholder="catrielquin01"
                  value={form.username}
                  onChange={handleChange}
                  required
                  style={estilos.input}
                />
              </div>
            )}

            <div style={estilos.field}>
              <label style={estilos.label}>Email</label>
              <input
                type="email"
                name="email"
                placeholder="tu@email.com"
                value={form.email}
                onChange={handleChange}
                required
                style={estilos.input}
              />
            </div>

            <div style={estilos.field}>
              <label style={estilos.label}>Contraseña</label>
              <input
                type="password"
                name="password"
                placeholder="••••••••"
                value={form.password}
                onChange={handleChange}
                required
                style={estilos.input}
              />
            </div>

            {error && <div style={estilos.errorBox}>{error}</div>}

          <button type="submit" disabled={cargando} style={estilos.btnPrimary}>
              {cargando ? 'Cargando...' : (modo === 'login' ? '✓ Entrar' : '✓ Registrarme')}
            </button>

            {modo === 'login' && (
              <button
                type="button"
                onClick={onOlvidoPassword}
                style={estilos.linkOlvide}
              >
                ¿Olvidaste tu contraseña?
              </button>
            )}
          </form>

          <div style={estilos.divider}><span style={estilos.dividerTexto}>o</span></div>

          <div style={estilos.googleBox}>
            <div ref={botonGoogleRef} />
          </div>

          <button type="button" onClick={iniciarSesionFacebook} style={estilos.btnFacebook} disabled={cargando}>
            <img src="/assets/facebook-icon.png" alt="Facebook" style={{ width: 20, height: 20 }} />
            Continuar con Facebook
          </button>
          </div>
          {/* ← este es el cierre del div panel, que antes quedaba antes del botón FB */}

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
  tabs: {
    display: 'flex', background: '#eee2d0', border: `2.5px solid ${C.chocolate}`,
    borderRadius: 14, padding: 4, marginBottom: 18, gap: 4
  },
  botonMusica: {
  position: 'absolute',
  top: 20,
  right: 20,
  width: 44,
  height: 44,
  borderRadius: '50%',
  background: 'rgba(255,248,237,0.9)',
  border: `2.5px solid ${C.chocolate}`,
  fontSize: 20,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 10,
},
  tab: {
    flex: 1, textAlign: 'center', padding: 9, fontFamily: "'Fredoka', sans-serif",
    fontWeight: 600, fontSize: 14, borderRadius: 10, color: C.chocolate,
    cursor: 'pointer', border: 'none', background: 'none'
  },
  tabActivo: {
    background: `linear-gradient(180deg, ${C.doradoClaro}, ${C.dorado})`,
    boxShadow: `0 3px 0 ${C.doradoOscuro}`
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
  btnPrimary: {
    fontFamily: "'Fredoka', sans-serif", fontWeight: 600, fontSize: 16,
    background: `linear-gradient(180deg, ${C.doradoClaro}, ${C.dorado})`, color: C.chocolate,
    border: `3px solid ${C.chocolate}`, borderRadius: 14, padding: 13,
    width: '100%', boxShadow: `0 5px 0 ${C.doradoOscuro}`, marginTop: 4, cursor: 'pointer'
  },
  btnFacebook: {
  fontFamily: "'Fredoka', sans-serif", fontWeight: 600, fontSize: 15,
  background: '#0866ff', color: '#fff',
  border: `3px solid ${C.chocolate}`, borderRadius: 14, padding: 12,
  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
  cursor: 'pointer', marginTop: 12
},
botonGoogle: {
  backgroundColor: '#fff',
  borderWidth: 3,
  borderColor: C.chocolate,
  borderRadius: 14,
  paddingVertical: 12,
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  marginBottom: 12,
},
botonGoogleTexto: {
  fontSize: 15,
  fontWeight: '700',
  color: C.chocolate,
},
  divider: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, margin: '20px 0 16px' },  dividerTexto: { fontWeight: 800, fontSize: 12, color: '#a09085', textTransform: 'uppercase' },
  googleBox: { display: 'flex', justifyContent: 'center' },
  footerHint: { textAlign: 'center', marginTop: 16, fontSize: 12, color: 'rgba(255,248,237,0.75)', fontWeight: 700 },
linkOlvide: {
    fontFamily: "'Fredoka', sans-serif", fontWeight: 600, fontSize: 13,
    background: 'none', color: C.chocolate, border: 'none',
    width: '100%', textAlign: 'center', marginTop: 12, cursor: 'pointer',
    textDecoration: 'underline', opacity: 0.85
  },
};