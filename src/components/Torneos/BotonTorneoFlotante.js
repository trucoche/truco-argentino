import React, { useCallback, useEffect, useState } from 'react';
import { API_URL as BASE_URL } from '../../config';

// Pase 379: botón flotante "Mi torneo". Aparece (chico, en la esquina inferior izquierda, para que
// no tape nada) mientras el usuario está anotado en un torneo en inscripción o en curso, y lo lleva
// a la sala del torneo (BracketView) para ver cómo va todo: equipos listos, equipos armándose,
// cupos libres y, ya en curso, los cruces. Con más de un torneo abre una listita para elegir.
const API_URL = `${BASE_URL}/api/torneos`;
const REFRESCO_MS = 20000;

export default function BotonTorneoFlotante({ token, pantalla, onAbrir }) {
  const [torneos, setTorneos] = useState([]);
  const [menuAbierto, setMenuAbierto] = useState(false);

  const cargar = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/mios/activos`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return;
      const data = await res.json();
      setTorneos(Array.isArray(data) ? data : []);
    } catch (err) {
      // Sin conexión: se deja lo último que se sabía.
    }
  }, [token]);

  // Se refresca al cambiar de pantalla y cada 20 s.
  useEffect(() => {
    cargar();
    const id = setInterval(cargar, REFRESCO_MS);
    return () => clearInterval(id);
  }, [cargar, pantalla]);

  useEffect(() => { setMenuAbierto(false); }, [pantalla]);

  if (!torneos.length) return null;

  const hayEnCurso = torneos.some((t) => t.estado === 'en-curso');
  const abrir = (t) => { setMenuAbierto(false); onAbrir(t.id); };
  const alTocar = () => {
    if (torneos.length === 1) abrir(torneos[0]);
    else setMenuAbierto((v) => !v);
  };

  return (
    <div style={estilos.contenedor}>
      {menuAbierto && (
        <div style={estilos.menu}>
          <div style={estilos.menuTitulo}>Mis torneos</div>
          {torneos.map((t) => (
            <button key={t.id} type="button" onClick={() => abrir(t)} style={estilos.menuFila}>
              <span style={estilos.menuNombre}>{t.titulo}</span>
              <span style={estilos.menuEstado}>{t.estado === 'en-curso' ? 'En curso' : `${t.entradas_actuales}/${t.cupo_entradas}`}</span>
            </button>
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={alTocar}
        title={torneos.length === 1 ? `Ir a la sala de "${torneos[0].titulo}"` : 'Mis torneos'}
        aria-label="Mi torneo"
        style={{ ...estilos.boton, ...(hayEnCurso ? estilos.botonEnCurso : null) }}
      >
        <img src="/assets/images/trofeo.png" alt="" style={estilos.icono} />
        {torneos.length > 1 && <span style={estilos.contador}>{torneos.length}</span>}
      </button>
    </div>
  );
}

const estilos = {
  contenedor: {
    position: 'fixed', left: 14, bottom: 14, zIndex: 3500,
    display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8,
  },
  boton: {
    position: 'relative', width: 50, height: 50, borderRadius: '50%', cursor: 'pointer',
    background: '#8B5A2B', border: '3px solid #000', boxShadow: '0 3px 0 #4A2C11, 0 5px 0 #000',
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
  },
  botonEnCurso: { background: '#10B981', boxShadow: '0 3px 0 #065F46, 0 5px 0 #000' },
  icono: { width: 30, height: 30, objectFit: 'contain', pointerEvents: 'none' },
  contador: {
    position: 'absolute', top: -6, right: -6, minWidth: 20, height: 20, borderRadius: 10,
    background: '#E74C3C', color: '#fff', border: '2px solid #000', fontFamily: "'Fredoka', sans-serif",
    fontWeight: 700, fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px',
  },
  menu: {
    background: '#FFF8ED', border: '3px solid #4A2C2A', borderRadius: 14, padding: 8, minWidth: 190, maxWidth: 260,
    boxShadow: '0 4px 0 rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column', gap: 6,
  },
  menuTitulo: { fontFamily: "'Fredoka', sans-serif", fontWeight: 700, fontSize: 12, color: '#7a6660', textTransform: 'uppercase', letterSpacing: 0.6, padding: '2px 4px' },
  menuFila: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, cursor: 'pointer',
    background: '#fff', border: '2px solid #4A2C2A', borderRadius: 10, padding: '7px 10px',
    fontFamily: "'Nunito', sans-serif", fontWeight: 800, fontSize: 13, color: '#4A2C2A', textAlign: 'left',
  },
  menuNombre: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  menuEstado: { fontFamily: "'Fredoka', sans-serif", fontWeight: 600, fontSize: 11.5, color: '#7a6660', flexShrink: 0 },
};
