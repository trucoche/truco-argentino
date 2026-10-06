import React, { useState, useEffect, useRef } from 'react';
import { API_URL as BASE_URL } from '../../config';

const API_URL = `${BASE_URL}/api/auth`;
const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID;
const FACEBOOK_APP_ID = process.env.REACT_APP_FACEBOOK_APP_ID;

const C = {
  verde: '#2D9B4F', verdeOscuro: '#1f7a3c',
  crimson: '#E8483A', crimsonOscuro: '#c2352a',
  dorado: '#FFB627', doradoClaro: '#FFD668', doradoOscuro: '#C9860E',
  crema: '#FFF8ED', chocolate: '#4A2C2A',
  cremaSutil: '#FFFCF6',
  // Pase de rediseño de la pantalla de login/registro — mismos tonos de
  // madera+bronce que el resto de la app (Ranking/Historial/Lobby/etc.),
  // para que la placa del formulario pase a ser "Placa de Madera de
  // Caoba" con remaches en vez de la caja crema plana que tenía.
  maderaClara: '#6b4a34', maderaMedia: '#4a3226', maderaOscura: '#2a1c14',
  remacheClaro: '#f0d9a0', remache: '#c9973e', remacheOscuro: '#7a5322',
  negroPulido: '#1a1410',
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
  // Pase 313: aceptación de Términos de Servicio + Política de Privacidad al registrarse.
  const [aceptaTerminos, setAceptaTerminos] = useState(false);
  const botonGoogleRef = useRef(null);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (modo === 'registro' && !aceptaTerminos) {
      setError('Para registrarte tenés que aceptar los Términos de Servicio y la Política de Privacidad');
      return;
    }
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

        {/* Pase de rediseño: placa de madera de caoba con remaches de
            bronce en las 4 esquinas envolviendo el pergamino interior
            (antes era una sola caja crema plana con borde chocolate). */}
        <div style={estilos.panelExterior}>
          <span style={{ ...estilos.remache, top: 10, left: 10 }} />
          <span style={{ ...estilos.remache, top: 10, right: 10 }} />
          <span style={{ ...estilos.remache, bottom: 10, left: 10 }} />
          <span style={{ ...estilos.remache, bottom: 10, right: 10 }} />
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
                  placeholder="truquero99"
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

            {modo === 'registro' && (
              <label style={estilos.aceptaFila}>
                <input
                  type="checkbox"
                  checked={aceptaTerminos}
                  onChange={(e) => { setAceptaTerminos(e.target.checked); setError(''); }}
                  style={estilos.aceptaCheckbox}
                />
                <span>
                  Acepto los{' '}
                  <a href="/terminos" target="_blank" rel="noopener noreferrer" style={estilos.aceptaLink}>Términos de Servicio</a>
                  {' '}y la{' '}
                  <a href="/privacidad" target="_blank" rel="noopener noreferrer" style={estilos.aceptaLink}>Política de Privacidad</a>
                </span>
              </label>
            )}

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
          <div style={estilos.avisoSocial}>
            Al continuar con Google o Facebook aceptás los{' '}
            <a href="/terminos" target="_blank" rel="noopener noreferrer" style={estilos.aceptaLink}>Términos de Servicio</a>
            {' '}y la{' '}
            <a href="/privacidad" target="_blank" rel="noopener noreferrer" style={estilos.aceptaLink}>Política de Privacidad</a>.
          </div>
          </div>
          {/* ← este es el cierre del div panel, que antes quedaba antes del botón FB */}
        </div>
        {/* ← cierre de panelExterior (marco de madera) */}

          <div style={estilos.footerHint}>
            Un juego de truco argentino
          </div>
          <div style={estilos.footerLinkWrap}>
            <a href="/terminos" style={estilos.footerLink}>Términos de Servicio</a>
            <span style={estilos.footerSeparador}>·</span>
            <a href="/privacidad" style={estilos.footerLink}>Política de privacidad</a>
          </div>

      </div>
    </div>
  );
}

const estilos = {
  // A pedido del usuario: mismo fondo que usa el resto de la app después
  // del login (Lobby/Torneos/Ranking/Historial/Config, vía `.ts-shell` en
  // AppShell.js) — `fondo-lobby.jpeg` con el mismo velo oscuro (0.38) —
  // en vez del fondo propio que tenía esta pantalla (`fondo-login.jpeg`,
  // con cartas/monedas flotantes y un velo más oscuro, 0.55).
  pagina: {
    minHeight: '100vh',
    backgroundImage: 'linear-gradient(rgba(20,20,15,0.38), rgba(20,20,15,0.38)), url(/assets/images/fondo-lobby.jpeg)',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    display: 'flex', justifyContent: 'center', alignItems: 'center',
    padding: '30px 12px', fontFamily: "'Nunito', sans-serif"
  },
  // Ajuste fino: +18% de ancho máximo (400→472) para que la placa
  // respire mejor en pantallas anchas — a pedido del usuario.
  app: { width: '100%', maxWidth: 472 },
  logoWrap: { textAlign: 'center', marginBottom: 22 },
  // Pase de rediseño: +15% de tamaño (320→368). Ajuste fino: +20%
  // adicional (368→442) a pedido del usuario, para que sea el elemento
  // que capture la atención de inmediato al entrar. Sombra proyectada
  // dura sin cambios.
  logoCompleto: {
    width: '100%', maxWidth: 442, height: 'auto', display: 'block', margin: '0 auto',
    filter: 'drop-shadow(0 8px 12px rgba(0,0,0,0.55))'
  },
  logoSub: { fontFamily: "'Nunito', sans-serif", fontWeight: 800, fontStyle: 'italic', fontSize: 20, color: C.crema, marginTop: -6 },
  // Exterior de madera de caoba con remaches — contorno negro grueso
  // (3px) + un aro blanco fino tipo sticker por fuera del contorno negro
  // (mismo recurso que el logo, para que la placa se sienta parte del
  // mismo "universo sticker" que el resto de la pantalla).
  panelExterior: {
    position: 'relative',
    background: `linear-gradient(160deg, ${C.maderaClara} 0%, ${C.maderaMedia} 55%, ${C.maderaOscura} 100%)`,
    border: `3px solid ${C.negroPulido}`, borderRadius: 24, padding: 12,
    boxShadow: [
      '0 0 0 4px #fff',
      'inset 0 2px 0 rgba(255,255,255,0.10)',
      'inset 0 -4px 10px rgba(0,0,0,0.5)',
      `0 10px 0 ${C.negroPulido}`,
      '0 20px 32px rgba(0,0,0,0.45)'
    ].join(', ')
  },
  remache: {
    position: 'absolute', width: 12, height: 12, borderRadius: '50%',
    background: `radial-gradient(circle at 35% 30%, ${C.remacheClaro} 0%, ${C.remache} 45%, ${C.remacheOscuro} 78%, #3a2610 100%)`,
    boxShadow: '0 1px 2px rgba(0,0,0,0.6)', zIndex: 2
  },
  // Interior de pergamino cálido — antes era la caja de nivel superior
  // (fondo crema plano); ahora vive adentro del marco de madera.
  panel: {
    background: [
      'radial-gradient(ellipse at 18% 18%, rgba(210,182,130,0.35) 0%, transparent 50%)',
      'radial-gradient(ellipse at 82% 82%, rgba(190,160,115,0.3) 0%, transparent 55%)',
      `linear-gradient(180deg, ${C.cremaSutil}, ${C.crema})`
    ].join(', '),
    border: `2px solid rgba(26,20,16,0.3)`, borderRadius: 16,
    boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.15)', padding: '24px 24px 28px',
    position: 'relative', overflow: 'hidden'
  },
  // Barra de pestañas — ahuecada, estilo cuero/madera oscura (antes un
  // tostado claro plano sin relieve).
  tabs: {
    display: 'flex',
    background: 'linear-gradient(180deg, #2a1c12, #1a100a)',
    border: `2px solid ${C.negroPulido}`,
    boxShadow: 'inset 0 3px 6px rgba(0,0,0,0.6), inset 0 -1px 0 rgba(255,255,255,0.05)',
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
  // Inactiva: tono cuero/madera oscura hundida, opacidad reducida.
  // Activa: madera clara/dorado brillante con relieve 3D (abajo).
  tab: {
    flex: 1, textAlign: 'center', padding: 9, fontFamily: "'Fredoka', sans-serif",
    fontWeight: 700, fontSize: 14, borderRadius: 10, color: 'rgba(255,248,237,0.55)',
    cursor: 'pointer', border: 'none', background: 'none', opacity: 0.85
  },
  tabActivo: {
    background: `linear-gradient(160deg, ${C.doradoClaro} 0%, ${C.dorado} 100%)`,
    color: C.chocolate, border: '2px solid #000',
    boxShadow: '0 3px 0 #000, inset 0 1px 0 rgba(255,255,255,0.5)',
    opacity: 1
  },
  field: { marginBottom: 14 },
  // Ajuste fino: +1pt de tamaño (12→13), ya en negrita marrón oscuro.
  label: { display: 'block', fontWeight: 800, fontSize: 13, color: C.chocolate, marginBottom: 5, textTransform: 'uppercase' },
  // Pergamino/cuero ahuecado — sombra interior + contorno negro bien
  // definido (antes un rectángulo blanco plano con borde chocolate).
  // Ajuste fino: +15% de tamaño de fuente (15→17) y más padding vertical
  // para que el texto tipeado se centre mejor y no se vea chico.
  input: {
    width: '100%', fontFamily: "'Nunito', sans-serif", fontWeight: 700, fontSize: 17,
    color: C.chocolate, background: 'linear-gradient(180deg, #f2e6c8, #e9d8ae)',
    border: `2.5px solid ${C.negroPulido}`,
    borderRadius: 12, padding: '14px 12px',
    boxShadow: 'inset 0 2px 5px rgba(0,0,0,0.25)'
  },
  errorBox: {
    background: '#ffe0dd', border: `2px solid ${C.crimson}`, color: C.crimsonOscuro,
    borderRadius: 10, padding: '8px 12px', marginBottom: 12, fontWeight: 700, fontSize: 13
  },
  // Botón 3D pill dorado — brillo superior + sombra dura inferior, texto
  // centrado con un leve relieve (antes un rectángulo redondeado chico,
  // sin bisel real). Ajuste fino: más alto (padding 14→17) y tipografía
  // más gruesa (800→900) para reforzar que es la acción principal.
  btnPrimary: {
    fontFamily: "'Fredoka', sans-serif", fontWeight: 900, fontSize: 17,
    background: `linear-gradient(180deg, ${C.doradoClaro}, ${C.dorado})`, color: C.chocolate,
    textShadow: '0 1px 0 rgba(255,255,255,0.35)',
    border: '2.5px solid #000', borderRadius: 999, padding: 17,
    width: '100%', textAlign: 'center',
    boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.55), 0 5px 0 #000',
    marginTop: 4, cursor: 'pointer'
  },
  // Botón 3D azul con bisel + sombra dura inferior (antes un rectángulo
  // azul plano sin relieve).
  // Ajuste fino: el margen con el botón de Google ahora lo da
  // `googleBox.marginBottom` (10px) en vez de este `marginTop` (que se
  // suma al padding propio del botón de Google y terminaba viéndose
  // más pegado de lo que parece en el código) — ver `googleBox`.
  btnFacebook: {
  fontFamily: "'Fredoka', sans-serif", fontWeight: 700, fontSize: 15,
  background: 'linear-gradient(180deg, #2f7dff, #0857e0)', color: '#fff',
  border: '2.5px solid #000', borderRadius: 14, padding: 12,
  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
  cursor: 'pointer', marginTop: 0,
  boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.35), 0 5px 0 #000'
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
  // Contorno negro marcado de 2px + esquinas redondeadas alrededor del
  // botón de Google (que renderiza su propio SDK), a pedido del usuario —
  // se mantiene el fondo blanco original del botón.
  // Ajuste fino: +10px de margen inferior explícito para separarlo bien
  // del botón de Facebook (antes dependía solo del `marginTop` del botón
  // de FB, que se sentía pegado).
  googleBox: {
    display: 'flex', justifyContent: 'center',
    background: '#fff', border: `2px solid ${C.negroPulido}`, borderRadius: 14,
    padding: 4, boxShadow: '0 3px 0 rgba(0,0,0,0.3)', marginBottom: 10
  },
  // Ajuste fino: de un gris crema semitransparente a un amarillo cálido
  // suave con sombra sutil, para que se lea bien sobre el paño verde.
  footerHint: {
    textAlign: 'center', marginTop: 16, fontSize: 12, color: C.doradoClaro,
    fontWeight: 700, textShadow: '0 1px 3px rgba(0,0,0,0.6)'
  },
  footerLinkWrap: { textAlign: 'center', marginTop: 6 },
  footerLink: {
    fontSize: 11, color: C.doradoClaro, fontWeight: 700, textDecoration: 'underline',
    textShadow: '0 1px 3px rgba(0,0,0,0.6)'
  },
linkOlvide: {
    fontFamily: "'Fredoka', sans-serif", fontWeight: 600, fontSize: 13,
    background: 'none', color: C.chocolate, border: 'none',
    width: '100%', textAlign: 'center', marginTop: 12, cursor: 'pointer',
    textDecoration: 'underline', opacity: 0.85
  },
  aceptaFila: {
    display: 'flex', alignItems: 'flex-start', gap: 10, marginTop: 14,
    fontSize: 12.5, lineHeight: 1.45, fontWeight: 700, color: C.chocolate, cursor: 'pointer',
    textAlign: 'left',
  },
  aceptaCheckbox: { width: 18, height: 18, marginTop: 1, flexShrink: 0, accentColor: '#2D9B4F', cursor: 'pointer' },
  aceptaLink: { color: '#8a4b0f', fontWeight: 800, textDecoration: 'underline' },
  avisoSocial: {
    marginTop: 12, textAlign: 'center', fontSize: 11.5, lineHeight: 1.4,
    fontWeight: 700, color: '#6b4a34',
  },
  footerSeparador: { margin: '0 8px', fontSize: 11, color: C.doradoClaro, textShadow: '0 1px 3px rgba(0,0,0,0.6)' },
};
