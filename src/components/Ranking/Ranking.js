import React, { useState, useEffect } from 'react';
import PerfilRivalModal from '../PerfilRival/PerfilRivalModal';
import PantallaCarga from '../PantallaCarga/PantallaCarga';
import { API_URL as BASE_URL } from '../../config';

const API_URL = `${BASE_URL}/api/ranking`;

// Centésimo noveno pase: Ranking nunca mostró avatares reales — el
// backend (`routes/ranking.js`) ya manda personaje/foto_perfil_url/
// avatar_tipo desde el nonagésimo segundo pase (se agregó para la barra
// de "Top jugadores" de Perfil), pero esta pantalla seguía usando un
// 🎴 fijo. Mismo criterio de avatar que ya usan Perfil/PerfilRivalModal/
// el header.
function avatarSrcDe(u) {
  return u?.avatar_tipo === 'foto' && u?.foto_perfil_url
    ? u.foto_perfil_url
    : `/assets/${u?.personaje || 'gaucho'}-avatar.png`;
}

const C = {
  verde: '#2D9B4F', verdeOscuro: '#1f7a3c',
  dorado: '#FFB627', doradoClaro: '#FFD668', doradoOscuro: '#C9860E',
  plata: '#C7CDD6', plataOscuro: '#8B95A3',
  bronce: '#D08A4E', bronceOscuro: '#A05F2C',
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

// Ya NO recibe onVolver — navegación de vuelta la maneja el AppShell.
// Recibe usuarioActual (username) para resaltar tu propia fila en la lista.
export default function Ranking({ token, usuarioActual }) {
  const [ranking, setRanking] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  // Nonagésimo octavo pase: click en cualquier fila (o en el podio) abre
  // el popup de perfil público de ese jugador.
  const [perfilAbierto, setPerfilAbierto] = useState(null);

  useEffect(() => {
    const cargarRanking = async () => {
      try {
        const res = await fetch(API_URL, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        if (!res.ok) {
          setError(data.error || 'Error al cargar el ranking');
          return;
        }
        setRanking(data);
      } catch (err) {
        console.error('Error de conexión:', err);
        setError('No se pudo conectar con el servidor');
      } finally {
        setCargando(false);
      }
    };
    cargarRanking();
  }, [token]);

  // Centésimo cuadragésimo sexto pase: ver PantallaCarga — mismo fondo
  // temático que el resto de las pantallas, en vez del texto suelto.
  if (cargando) {
    return <PantallaCarga />;
  }

  if (error) {
    return <div style={estilos.errorBox}>{error}</div>;
  }

  if (ranking.length === 0) {
    return <p style={{ color: C.crema, textAlign: 'center' }}>Todavía no hay partidas jugadas.</p>;
  }

  const podio = ranking.slice(0, 3);
  const resto = ranking.slice(3);

  // El podio se arma visualmente en orden 2°-1°-3° (el primero más alto,
  // al medio), pero seguimos usando el puesto real de cada uno para
  // colores/tamaños — por eso vamos a buscarlos por índice del array
  // original en vez de asumir que "el del medio siempre es index 0".
  const [p1, p2, p3] = podio;

  return (
    <>
      <div style={estilos.sectionTitle}>🏅 Ranking</div>
      <div style={estilos.sectionSubtitle}>Los mejores jugadores de TrucoChe</div>

      <div style={estilos.podioPanel}>
        <Filigrana />
        <div style={estilos.podio}>
          {p2 && (
            <div style={{ ...estilos.puesto, cursor: 'pointer' }} onClick={() => setPerfilAbierto(p2.username)}>
              <div style={estilos.medallionP2}><img src={avatarSrcDe(p2)} alt="" style={estilos.medallionImg} /></div>
              <div style={estilos.puestoNombre}>{p2.username}</div>
              <div style={estilos.puestoStat}>{p2.partidas_ganadas} victorias</div>
              <div style={{ ...estilos.base, ...estilos.baseP2 }}>2</div>
            </div>
          )}
          {p1 && (
            <div style={{ ...estilos.puesto, cursor: 'pointer' }} onClick={() => setPerfilAbierto(p1.username)}>
              <div style={{ fontSize: 20, marginBottom: -4 }}>👑</div>
              <div style={estilos.medallionP1Halo}>
                <div style={estilos.medallionP1}><img src={avatarSrcDe(p1)} alt="" style={estilos.medallionImg} /></div>
              </div>
              <div style={{ ...estilos.puestoNombre, fontSize: 15, color: C.doradoOscuro }}>{p1.username}</div>
              <div style={estilos.puestoStat}>{p1.partidas_ganadas} victorias</div>
              <div style={{ ...estilos.base, ...estilos.baseP1 }}>1</div>
            </div>
          )}
          {p3 && (
            <div style={{ ...estilos.puesto, cursor: 'pointer' }} onClick={() => setPerfilAbierto(p3.username)}>
              <div style={estilos.medallionP3}><img src={avatarSrcDe(p3)} alt="" style={estilos.medallionImg} /></div>
              <div style={estilos.puestoNombre}>{p3.username}</div>
              <div style={estilos.puestoStat}>{p3.partidas_ganadas} victorias</div>
              <div style={{ ...estilos.base, ...estilos.baseP3 }}>3</div>
            </div>
          )}
        </div>
      </div>

      {resto.length > 0 && (
        <div style={estilos.listaPanel}>
          {resto.map((r, i) => {
            const puesto = i + 4; // arranca en el puesto 4, después del podio
            const esYo = r.username === usuarioActual;
            return (
              <div
                key={r.username}
                style={{
                  ...estilos.fila,
                  ...(i % 2 === 1 ? estilos.filaImpar : {}),
                  ...(esYo ? estilos.filaYo : {}),
                  cursor: 'pointer'
                }}
                onClick={() => setPerfilAbierto(r.username)}
              >
                <div style={estilos.filaPuesto}>{puesto}</div>
                <div style={estilos.filaAvatar}><img src={avatarSrcDe(r)} alt="" style={estilos.filaAvatarImg} /></div>
                <div style={estilos.filaNombre}>{esYo ? 'Vos' : r.username}</div>
                <div style={estilos.filaStat}>{r.partidas_ganadas} victorias</div>
              </div>
            );
          })}
        </div>
      )}

      {perfilAbierto && (
        <PerfilRivalModal
          username={perfilAbierto}
          token={token}
          onClose={() => setPerfilAbierto(null)}
        />
      )}
    </>
  );
}

const estilos = {
  errorBox: {
    background: '#ffe0dd', border: '2px solid #E8483A', color: '#c2352a',
    borderRadius: 10, padding: '8px 12px', fontWeight: 700, fontSize: 13
  },
  // Mismo criterio que el "Historial de partidas" de Historial.js — antes
  // Ranking arrancaba directo en el banner de torneo/podio, sin ningún
  // título propio de la pantalla.
  sectionTitle: { fontFamily: "'Fredoka', sans-serif", fontWeight: 600, fontSize: 16, color: C.crema, margin: '4px 0 2px 4px' },
  sectionSubtitle: { fontSize: 12.5, color: 'rgba(255,248,237,0.75)', fontWeight: 700, margin: '0 0 10px 4px' },
  podioPanel: {
    background: C.crema, border: `4px solid ${C.chocolate}`, borderRadius: 20,
    boxShadow: '0 6px 0 rgba(0,0,0,0.25)', padding: '26px 16px 18px',
    marginBottom: 18, position: 'relative', overflow: 'hidden'
  },
  podio: { display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 10 },
  puesto: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 },
  medallionBase: {
    borderRadius: '50%', background: C.verdeOscuro,
    display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative'
  },
  // Halo dorado detrás del medallion del 1° puesto — lo destaca del resto
  // del podio de un vistazo, sin depender solo de que sea "el del medio".
  medallionP1Halo: {
    width: 84, height: 84, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: `radial-gradient(circle, rgba(255,214,104,0.55) 0%, rgba(255,214,104,0) 70%)`
  },
  medallionP1: {
    width: 68, height: 68, borderRadius: '50%', background: C.verdeOscuro,
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30,
    boxShadow: `0 0 0 3px ${C.dorado}`, overflow: 'hidden'
  },
  medallionP2: {
    width: 54, height: 54, borderRadius: '50%', background: C.verdeOscuro,
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
    boxShadow: `0 0 0 2.5px ${C.plata}`, overflow: 'hidden'
  },
  medallionP3: {
    width: 54, height: 54, borderRadius: '50%', background: C.verdeOscuro,
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
    boxShadow: `0 0 0 2.5px ${C.bronce}`, overflow: 'hidden'
  },
  // Centésimo noveno pase: avatar real dentro del medallion/fila (antes
  // era el 🎴 fijo) — mismo criterio en los tres tamaños del podio y en
  // la lista.
  medallionImg: { width: '100%', height: '100%', objectFit: 'cover' },
  puestoNombre: { fontFamily: "'Fredoka', sans-serif", fontWeight: 600, fontSize: 13, color: C.chocolate, textAlign: 'center' },
  puestoStat: { fontSize: 11, fontWeight: 800, color: '#a89a90' },
  base: {
    borderRadius: '8px 8px 0 0', border: `2.5px solid ${C.chocolate}`,
    display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 4,
    fontFamily: "'Fredoka', sans-serif", fontWeight: 700, fontSize: 15, color: C.crema
  },
  baseP1: { height: 60, width: 74, background: `linear-gradient(180deg, ${C.doradoClaro}, ${C.doradoOscuro})` },
  baseP2: { height: 42, width: 64, background: `linear-gradient(180deg, ${C.plata}, ${C.plataOscuro})` },
  baseP3: { height: 30, width: 64, background: `linear-gradient(180deg, ${C.bronce}, ${C.bronceOscuro})` },
  listaPanel: {
    background: C.crema, border: `4px solid ${C.chocolate}`, borderRadius: 20,
    boxShadow: '0 6px 0 rgba(0,0,0,0.25)', padding: '6px 6px'
  },
  fila: {
    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 10px',
    borderBottom: '2px dashed rgba(74,44,42,0.12)'
  },
  // Cebreado sutil — antes todas las filas eran del mismo blanco/crema
  // parejo, con listas largas (siempre hay al menos 20+ jugadores) costaba
  // seguir la fila con la vista.
  filaImpar: { background: 'rgba(74,44,42,0.03)' },
  filaYo: { background: '#fff2d6', borderRadius: 12, borderBottom: 'none' },
  filaPuesto: { fontFamily: "'Fredoka', sans-serif", fontWeight: 700, fontSize: 14, color: '#a89a90', width: 22, textAlign: 'center' },
  filaAvatar: {
    width: 34, height: 34, borderRadius: '50%', background: C.verdeOscuro,
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0,
    boxShadow: `0 0 0 1.5px ${C.dorado}`, overflow: 'hidden'
  },
  filaAvatarImg: { width: '100%', height: '100%', objectFit: 'cover' },
  filaNombre: { flex: 1, fontWeight: 700, fontSize: 14, color: C.chocolate },
  filaStat: { fontFamily: "'Fredoka', sans-serif", fontWeight: 600, fontSize: 14, color: C.verdeOscuro },
};