import React, { useState } from 'react';
import { API_URL as BASE_URL } from '../../config';

const API_URL = `${BASE_URL}/api/auth`;

const C = {
  dorado: '#FFB627', doradoClaro: '#FFD668', doradoOscuro: '#C9860E',
  crema: '#FFF8ED', cremaSutil: '#FFFCF6', chocolate: '#4A2C2A'
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
      <div style={estilos.titulo}>
        {/* Ducentésimo cuadragésimo segundo pase: ícono ilustrado del
            gaucho (mismo criterio que los 3 títulos de Configuracion.js
            que ya reemplazaron su emoji por un asset del usuario) en vez
            de 🎭. */}
        <img src="/assets/images/icono-personaje.png" alt="" style={estilos.tituloIcono} />
        Tu personaje
      </div>
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
                    {/* Ducentésimo trigésimo noveno pase: "agregar un pequeño
                        label... que diga el nombre del personaje" — el
                        estilo `nombre` ya existía en este archivo pero
                        nunca se usaba en el JSX. */}
                    <span style={estilos.nombre}>{p.nombre}</span>
                    {activo && <span style={estilos.check}>✓</span>}
                    </button>
                );
            })}
      </div>
    </div>
  );
}

const estilos = {
  // Ducentésimo trigésimo noveno pase: mismo rediseño "premium" que el
  // resto de los paneles de Configuración (ver Configuracion.js) — borde
  // superior dorado más grueso, degradé sutil de fondo, sombra en 2 capas.
  // `marginBottom` se saca — ahora el espacio con los paneles vecinos lo
  // pone el `gap` del contenedor de Configuracion.js (este componente solo
  // se usa ahí).
  panel: {
    background: `linear-gradient(180deg, ${C.cremaSutil} 0%, ${C.crema} 100%)`,
    borderTop: `5px solid ${C.doradoOscuro}`,
    borderRight: `3px solid ${C.chocolate}`,
    borderBottom: `3px solid ${C.chocolate}`,
    borderLeft: `3px solid ${C.chocolate}`,
    borderRadius: 18,
    boxShadow: `0 6px 0 ${C.chocolate}, 0 10px 18px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.5)`,
    padding: '16px 18px 18px',
    position: 'relative',
  },
  titulo: {
    fontFamily: "'Fredoka', sans-serif", fontWeight: 700, fontSize: 20, color: C.chocolate,
    letterSpacing: 0.2, marginBottom: 14, paddingBottom: 10,
    borderBottom: `2px solid ${C.chocolate}1a`,
    // Ducentésimo cuadragésimo segundo pase: fila flex (antes solo texto)
    // para poder meterle el ícono nuevo adelante — mismo criterio que
    // `panelTitulo` en Configuracion.js.
    display: 'flex', alignItems: 'center', gap: 8,
  },
  tituloIcono: { width: 26, height: 26, objectFit: 'contain', flexShrink: 0 },
  // Ducentésimo trigésimo noveno pase: minmax/gap suben un poco (90→100 /
  // 12→14) para hacerle lugar al label de nombre nuevo sin apretar las
  // tarjetas.
  grid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 14
  },
  // Ducentésimo trigésimo noveno pase: "hacer los avatares un poco más
  // grandes" — pasa a columna (imagen + nombre apilados) para hacerle
  // lugar al label nuevo; antes centraba solo la imagen.
  tarjeta: {
    position: 'relative', background: '#fff', border: `2.5px solid ${C.chocolate}`,
    borderRadius: 14, padding: '14px 6px 12px', cursor: 'pointer',
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  // Ducentésimo trigésimo noveno pase: "mejorar el estado seleccionado:
  // borde más grueso o fondo más destacado" — se suma el borde más grueso
  // Y de otro color (antes solo cambiaba el fondo/sombra, el borde seguía
  // siendo el mismo chocolate 2.5px que las tarjetas sin seleccionar).
  tarjetaActiva: {
    background: `linear-gradient(180deg, ${C.doradoClaro}, ${C.dorado})`,
    borderColor: C.doradoOscuro, borderWidth: 3.5,
    boxShadow: `0 4px 0 ${C.doradoOscuro}`,
  },
  // Ducentésimo trigésimo noveno pase: 72→84px.
  imagen: { width: 84, height: 84, objectFit: 'contain' },
  nombre: { fontFamily: "'Nunito', sans-serif", fontWeight: 700, fontSize: 12, color: C.chocolate },
  check: {
    position: 'absolute', top: 4, right: 6, fontSize: 13, fontWeight: 800, color: C.chocolate
  }
};