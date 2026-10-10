import React, { useState } from 'react';
import PopupMadera from '../Popup/PopupMadera';
import { API_URL as BASE_URL } from '../../config';
import { PROVINCIAS } from './provincias';

// Pase 370: popup para cargar/editar la zona del jugador (provincia en lista
// cerrada + localidad en texto libre). Alimenta los filtros "Provincia" y "Mi
// Localidad" del Ranking. Dejar la provincia vacía borra la zona.
export default function ZonaEditor({ token, usuario, onCerrar, onGuardado }) {
  const [provincia, setProvincia] = useState(usuario?.provincia || '');
  const [localidad, setLocalidad] = useState(usuario?.localidad || '');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const guardar = async () => {
    setGuardando(true);
    setError('');
    try {
      const res = await fetch(`${BASE_URL}/api/auth/ubicacion`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ provincia, localidad: provincia ? localidad : '' }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'No se pudo guardar la zona');
        return;
      }
      onGuardado && onGuardado();
      onCerrar();
    } catch (e) {
      setError('No se pudo conectar con el servidor');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <PopupMadera
      titulo="Tu zona"
      cinta="madera"
      anchoMax={340}
      centrado={false}
      onCerrar={onCerrar}
      botones={[
        { texto: guardando ? 'Guardando...' : 'Guardar', tipo: 'verde', onClick: guardar, disabled: guardando },
        { texto: 'Cancelar', tipo: 'neutro', onClick: onCerrar },
      ]}
    >
      <p style={estilos.ayuda}>Con tu zona aparecés en los rankings de tu provincia y de tu localidad.</p>

      <label htmlFor="zona-provincia" style={estilos.label}>Provincia</label>
      <select
        id="zona-provincia"
        value={provincia}
        onChange={(e) => setProvincia(e.target.value)}
        style={estilos.campo}
      >
        <option value="">Sin provincia</option>
        {PROVINCIAS.map((p) => <option key={p} value={p}>{p}</option>)}
      </select>

      <label htmlFor="zona-localidad" style={estilos.label}>Localidad o barrio</label>
      <input
        id="zona-localidad"
        type="text"
        value={localidad}
        maxLength={60}
        disabled={!provincia}
        onChange={(e) => setLocalidad(e.target.value)}
        placeholder={provincia ? 'Ej: Paso del Rey' : 'Elegí primero la provincia'}
        style={{ ...estilos.campo, opacity: provincia ? 1 : 0.55 }}
      />

      {error && <div style={estilos.error}>{error}</div>}
    </PopupMadera>
  );
}

const estilos = {
  ayuda: { margin: '0 0 12px', fontSize: 13, color: '#4A2C2A', fontWeight: 600, lineHeight: 1.35 },
  label: { display: 'block', margin: '8px 0 4px', fontSize: 13, fontWeight: 800, color: '#2C160E' },
  campo: {
    width: '100%', boxSizing: 'border-box', padding: '9px 10px', fontSize: 14, fontWeight: 600,
    color: '#2C160E', background: '#FFF8E3', border: '2px solid #5A3A14', borderRadius: 10,
    fontFamily: 'inherit', outline: 'none',
  },
  error: { marginTop: 10, color: '#c2352a', fontWeight: 700, fontSize: 13 },
};
