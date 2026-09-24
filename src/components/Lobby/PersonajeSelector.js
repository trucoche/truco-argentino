import React, { useState } from 'react';
import { API_URL as BASE_URL } from '../../config';

const API_URL = `${BASE_URL}/api/auth`;

const C = {
  dorado: '#FFB627', doradoClaro: '#FFD668', doradoOscuro: '#C9860E',
  crema: '#FFF8ED', chocolate: '#4A2C2A'
};

const PERSONAJES = [
  { id: 'gaucho', nombre: 'Gaucho' },
  { id: 'gaucha', nombre: 'Gaucha' },
  { id: 'gaucha2', nombre: 'Gaucha' },
  { id: 'gaucho2', nombre: 'Gaucho' },
];

// Panel para el Lobby: muestra los 4 personajes en grilla, resalta el
// elegido, y al tocar otro llama al backend y avisa al padre (App.js)
// para que refresque el usuario en memoria (así el avatar del header
// también se actualiza, ya que ese vive en AppShell, no acá).
export default function PersonajeSelector({ token, personajeActual, onPersonajeCambiado }) {
  const [guardando, setGuardando] = useState(null); // id del personaje que se está guardando, o null

  const elegirPersonaje = async (id) => {
    if (id === personajeActual || guardando) return;
    setGuardando(id);
    try {
      const res = await fetch(`${API_URL}/personaje`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ personaje: id })
      });
      if (res.ok) {
        onPersonajeCambiado();
      }
    } catch (err) {
      console.error('Error cambiando personaje:', err);
    } finally {
      setGuardando(null);
    }
  };

  return (
    <div style={estilos.panel}>
      <div style={estilos.titulo}>🎭 Tu personaje</div>
      <div style={estilos.grid}>
            {PERSONAJES.map((p) => {
            const activo = p.id === personajeActual;
                return (
                    <button
                    key={p.id}
                    onClick={() => elegirPersonaje(p.id)}
                    disabled={!!guardando}
                    style={{ ...estilos.tarjeta, ...(activo ? estilos.tarjetaActiva : {}) }}
                    >
                    <img src={`/assets/${p.id}-avatar.png`} alt={p.nombre} style={estilos.imagen} />
                    {activo && <span style={estilos.check}>✓</span>}
                    </button>
                );
            })}
      </div>
    </div>
  );
}

const estilos = {
  panel: {
    background: C.crema, border: `4px solid ${C.chocolate}`, borderRadius: 20,
    boxShadow: '0 6px 0 rgba(0,0,0,0.25)', padding: '18px 18px 20px',
    marginBottom: 16, position: 'relative'
  },
  titulo: { fontFamily: "'Fredoka', sans-serif", fontWeight: 600, fontSize: 19, color: C.chocolate, marginBottom: 14 },
  grid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: 12
  },
    tarjeta: {
    position: 'relative', background: '#fff', border: `2.5px solid ${C.chocolate}`,
    borderRadius: 14, padding: '12px 6px', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center'
    },
    tarjetaActiva: {
    background: `linear-gradient(180deg, ${C.doradoClaro}, ${C.dorado})`,
    boxShadow: `0 4px 0 ${C.doradoOscuro}`
    },
    imagen: { width: 72, height: 72, objectFit: 'contain' },
  nombre: { fontFamily: "'Nunito', sans-serif", fontWeight: 700, fontSize: 12, color: C.chocolate },
  check: {
    position: 'absolute', top: 4, right: 6, fontSize: 13, fontWeight: 800, color: C.chocolate
  }
};