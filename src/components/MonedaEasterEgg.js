import React, { useState, useEffect } from 'react';

const API_URL = 'http://localhost:3001/api/easter-eggs';

const POSICIONES_POR_PANTALLA = {
  lobby: { bottom: 20, right: 20 },
  torneos: { top: 90, left: 16 },
  ranking: { bottom: 80, left: 16 },
  historial: { top: 90, right: 16 },
  perfil: { bottom: 20, left: 16 },
  config: { top: 90, right: 16 },
};

// Moneda flotante en la esquina inferior derecha — aparece solo si el
// backend confirma que hay una disponible para esta pantalla hoy
// (día 1 de cada mes, hasta 5 por día en total). Al tocarla, se reclama
// y desaparece con un pequeño "+N" antes de esfumarse del todo.
export default function MonedaEasterEgg({ token, pantalla, onEncontrada }) {
  const [visible, setVisible] = useState(false);
  const [reclamando, setReclamando] = useState(false);
  const [montoGanado, setMontoGanado] = useState(null);

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  useEffect(() => {
    if (!token || !pantalla) return;

    // Al cambiar de pantalla, limpiamos cualquier resto del estado
    // anterior (el componente no se desmonta entre pantallas, así que
    // sin esto quedaba "pegado" el +N de la moneda de la pantalla previa).
    setVisible(false);
    setMontoGanado(null);
    setReclamando(false);

    const chequear = async () => {
      try {
        const res = await fetch(`${API_URL}/estado?pantalla=${pantalla}`, { headers });
        const data = await res.json();
        if (res.ok && data.disponible) setVisible(true);
      } catch (err) {
        console.error('Error consultando easter egg:', err);
      }
    };
    chequear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, pantalla]);
  

  const reclamar = async () => {
    if (reclamando) return;
    setReclamando(true);
    try {
      const res = await fetch(`${API_URL}/reclamar`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ pantalla })
      });
      const data = await res.json();

      if (!res.ok) {
        setVisible(false);
        return;
      }

      setMontoGanado(data.monto);
      if (onEncontrada) onEncontrada();

      setTimeout(() => setVisible(false), 650);
    } catch (err) {
      console.error('Error reclamando easter egg:', err);
      setVisible(false);
    }
  };

  if (!visible) return null;

const posicion = POSICIONES_POR_PANTALLA[pantalla] || { bottom: 20, right: 20 };

return (
    <button
      onClick={reclamar}
      style={{ ...(montoGanado !== null ? estilos.botonGanado : estilos.boton), ...posicion }}
      disabled={reclamando}
    >
      {montoGanado !== null ? (
        <span style={estilos.montoTexto}>+{montoGanado}</span>
      ) : (
        <img src="/assets/images/moneda.png" alt="" style={estilos.imagen} />
      )}
    </button>
  );
}

const estilos = {
boton: {
    position: 'fixed',
    width: 50,
    height: 50,
    borderRadius: '50%',
    background: 'rgba(255,248,237,0.65)',
    border: '2.5px solid rgba(74,44,42,0.6)',
    boxShadow: '0 3px 8px rgba(0,0,0,0.25)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    zIndex: 500,
    opacity: 0.8,
    animation: 'moneda-flotar 1.4s ease-in-out infinite',
    transition: 'opacity 0.2s ease'
  },
  botonGanado: {
    position: 'fixed',
    width: 50,
    height: 50,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'default',
    zIndex: 500,
    background: 'none',
    border: 'none'
  },
  imagen: { width: 42, height: 42, objectFit: 'contain' },
  montoTexto: {
    fontFamily: "'Fredoka', sans-serif", fontWeight: 800, fontSize: 20, color: '#C9860E',
    textShadow: '0 1px 3px rgba(0,0,0,0.5)'
  }
};

// Inyecta el @keyframes una sola vez en el documento (no hay forma de
// poner @keyframes en un objeto de estilos inline de React).
if (typeof document !== 'undefined' && !document.getElementById('moneda-flotar-keyframes')) {
  const style = document.createElement('style');
  style.id = 'moneda-flotar-keyframes';
  style.textContent = `
    @keyframes moneda-flotar {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-8px); }
    }
  `;
  document.head.appendChild(style);
}