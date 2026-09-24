import React, { useState, useEffect, useCallback } from 'react';
import { API_URL as BASE_URL } from '../../config';
import PantallaCarga from '../PantallaCarga/PantallaCarga';

const API_URL = `${BASE_URL}/api/historial`;

const C = {
  verde: '#2D9B4F', verdeOscuro: '#1f7a3c',
  crimson: '#E8483A', crimsonOscuro: '#c2352a',
  dorado: '#FFB627', doradoClaro: '#FFD668', doradoOscuro: '#C9860E',
  celeste: '#4FB3E8',
  crema: '#FFF8ED', chocolate: '#4A2C2A'
};

const MODO_LABEL = { '1v1': '1 vs 1', '2v2': '2 vs 2', '3v3': '3 vs 3' };

function formatearFecha(fechaISO) {
  const f = new Date(fechaISO);
  return f.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' }) +
    ' · ' + f.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

// Sin recibe onVolver: al igual que Lobby/Torneos/Ranking, la navegación
// vive en el AppShell — esta pantalla solo renderiza contenido.
export default function Historial({ token }) {
  const [partidas, setPartidas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [filtro, setFiltro] = useState('todas'); // 'todas' | 'normal' | 'torneo'

  const cargarHistorial = useCallback(async () => {
    try {
      const res = await fetch(API_URL, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Error al cargar el historial');
        return;
      }
      setPartidas(data);
      setError('');
    } catch (err) {
      console.error('Error de conexión:', err);
      setError('No se pudo conectar con el servidor');
    } finally {
      setCargando(false);
    }
  }, [token]);

  useEffect(() => {
    cargarHistorial();
  }, [cargarHistorial]);

  const partidasFiltradas = partidas.filter(p => filtro === 'todas' || p.tipo === filtro);

  return (
    <>
      {error && <div style={estilos.errorBox}>{error}</div>}

      <div style={estilos.sectionTitle}>Historial de partidas</div>

      <div style={estilos.filtros}>
        {[
          { id: 'todas', label: 'Todas' },
          { id: 'normal', label: 'Normales' },
          { id: 'torneo', label: 'Campeonato' }
        ].map(f => (
          <button
            key={f.id}
            onClick={() => setFiltro(f.id)}
            style={filtro === f.id ? estilos.filtroActivo : estilos.filtroInactivo}
          >
            {f.label}
          </button>
        ))}
      </div>

      {cargando ? (
        // Centésimo cuadragésimo sexto pase: ver PantallaCarga.
        <PantallaCarga completa={false} conLogo={false} />
      ) : partidasFiltradas.length === 0 ? (
        <p style={{ color: C.crema, textAlign: 'center' }}>
          {filtro === 'todas' ? 'Todavía no jugaste ninguna partida.' : 'No hay partidas de este tipo.'}
        </p>
      ) : (
        partidasFiltradas.map((p) => (
          <div
            key={p.salaId}
            style={{
              ...estilos.card,
              borderLeft: `6px solid ${p.gane ? C.verde : C.crimson}`
            }}
          >
            <div style={estilos.cardHeader}>
              <div style={estilos.cardTitulo}>
                {p.gane ? '🏅 Victoria' : '❌ Derrota'}
              </div>
              <div style={{
                ...estilos.badge,
                ...(p.tipo === 'torneo' ? estilos.badgeTorneo : estilos.badgeNormal)
              }}>
                {p.tipo === 'torneo' ? '🏆 Campeonato' : '🃏 Normal'}
              </div>
            </div>

            {p.tipo === 'torneo' && (
              <div style={estilos.torneoNombre}>
                {p.torneo.titulo}
                {p.torneo.esCampeon && <span style={estilos.coronaTag}> 👑 Campeón del torneo</span>}
              </div>
            )}

            <div style={estilos.cardInfo}>
              {MODO_LABEL[p.modo] || p.modo} · ${p.apuesta} · {formatearFecha(p.fecha)}
            </div>
          </div>
        ))
      )}
    </>
  );
}

const estilos = {
  errorBox: {
    background: '#ffe0dd', border: `2px solid ${C.crimson}`, color: C.crimsonOscuro,
    borderRadius: 10, padding: '8px 12px', marginBottom: 12, fontWeight: 700, fontSize: 13
  },
  sectionTitle: { fontFamily: "'Fredoka', sans-serif", fontWeight: 600, fontSize: 16, color: C.crema, margin: '4px 0 10px 4px' },
  filtros: { display: 'flex', gap: 8, marginBottom: 14 },
  filtroActivo: {
    fontFamily: "'Fredoka', sans-serif", fontWeight: 600, fontSize: 13,
    background: `linear-gradient(180deg, ${C.doradoClaro}, ${C.dorado})`, color: C.chocolate,
    border: `2.5px solid ${C.chocolate}`, borderRadius: 12, padding: '8px 14px',
    boxShadow: `0 3px 0 ${C.doradoOscuro}`, cursor: 'pointer'
  },
  filtroInactivo: {
    fontFamily: "'Fredoka', sans-serif", fontWeight: 600, fontSize: 13,
    background: C.crema, color: C.chocolate,
    border: `2.5px solid ${C.chocolate}`, borderRadius: 12, padding: '8px 14px',
    boxShadow: '0 3px 0 rgba(74,44,42,0.3)', cursor: 'pointer'
  },
  card: {
    background: C.crema, border: `3px solid ${C.chocolate}`, borderRadius: 16,
    padding: '12px 14px', marginBottom: 10, boxShadow: '0 4px 0 rgba(0,0,0,0.2)'
  },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, gap: 8 },
  cardTitulo: { fontFamily: "'Fredoka', sans-serif", fontWeight: 600, fontSize: 15, color: C.chocolate },
  badge: { fontSize: 11, fontWeight: 800, padding: '3px 9px', borderRadius: 20, textTransform: 'uppercase', whiteSpace: 'nowrap' },
  badgeNormal: { background: '#d8ecf5', color: '#3a91c2' },
  badgeTorneo: { background: '#ffe8c2', color: C.doradoOscuro },
  torneoNombre: { fontFamily: "'Fredoka', sans-serif", fontWeight: 600, fontSize: 13, color: C.doradoOscuro, marginBottom: 4 },
  coronaTag: { color: C.crimsonOscuro, fontWeight: 800 },
  cardInfo: { fontSize: 12.5, color: '#7a6660', fontWeight: 700 },
};