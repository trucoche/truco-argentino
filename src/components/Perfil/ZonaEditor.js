import React, { useEffect, useState } from 'react';
import PopupMadera from '../Popup/PopupMadera';
import { API_URL as BASE_URL } from '../../config';
import { PROVINCIAS } from './provincias';

// Pase 370: popup para cargar/editar la zona del jugador (provincia en lista
// cerrada + localidad en texto libre). Alimenta los filtros "Provincia" y "Mi
// Localidad" del Ranking. Dejar la provincia vacía borra la zona.
// Pase 530: además se elige qué ven los demás en la tarjeta (solo provincia / provincia y localidad / nada).
const NIVELES_ZONA = [
  { id: 'provincia', titulo: 'Solo mi provincia', detalle: 'Se ve tu provincia. Tu localidad no se muestra, pero seguís en el ranking de tu localidad.' },
  { id: 'completa', titulo: 'Provincia y localidad', detalle: 'Se ven las dos y aparecés en los rankings de tu zona.' },
  { id: 'oculta', titulo: 'Prefiero no decirlo', detalle: 'No se ve nada y no aparecés en los rankings por zona (sí en el global).' },
];

export default function ZonaEditor({ token, usuario, onCerrar, onGuardado }) {
  const [provincia, setProvincia] = useState(usuario?.provincia || '');
  const [localidad, setLocalidad] = useState(usuario?.localidad || '');
  const [nivel, setNivel] = useState(usuario?.zona_visibilidad === 'completa' || usuario?.zona_visibilidad === 'oculta' ? usuario.zona_visibilidad : 'provincia');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  // Pase 372: lista oficial de localidades de la provincia elegida (datalist = autocompletado).
  const [opciones, setOpciones] = useState([]);

  useEffect(() => {
    if (!provincia) { setOpciones([]); return undefined; }
    let vigente = true;
    fetch(`${BASE_URL}/api/auth/localidades?provincia=${encodeURIComponent(provincia)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : []))
      .then((lista) => { if (vigente) setOpciones(Array.isArray(lista) ? lista : []); })
      .catch(() => { if (vigente) setOpciones([]); });
    return () => { vigente = false; };
  }, [provincia, token]);

  const normalizar = (t) => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  // Con la lista cargada, solo se puede guardar una localidad que exista en ella (o vacía).
  const localidadValida = !localidad.trim() || opciones.length === 0
    || opciones.some((o) => normalizar(o) === normalizar(localidad));

  const guardar = async () => {
    setGuardando(true);
    setError('');
    try {
      const res = await fetch(`${BASE_URL}/api/auth/ubicacion`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ provincia, localidad: provincia ? localidad : '', visibilidad: nivel }),
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
        { texto: guardando ? 'Guardando...' : 'Guardar', tipo: 'verde', onClick: guardar, disabled: guardando || !localidadValida },
        { texto: 'Cancelar', tipo: 'neutro', onClick: onCerrar },
      ]}
    >
      <p style={estilos.ayuda}>Con tu zona aparecés en los rankings de tu provincia y de tu localidad.</p>

      <label htmlFor="zona-provincia" style={estilos.label}>Provincia</label>
      <select
        id="zona-provincia"
        value={provincia}
        onChange={(e) => { setProvincia(e.target.value); setLocalidad(''); }}
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
        list="zona-localidades"
        autoComplete="off"
        placeholder={provincia ? 'Escribí y elegí de la lista' : 'Elegí primero la provincia'}
        style={{ ...estilos.campo, opacity: provincia ? 1 : 0.55 }}
      />
      <datalist id="zona-localidades">
        {opciones.map((o) => <option key={o} value={o} />)}
      </datalist>
      {!localidadValida && <div style={estilos.error}>Elegí una localidad de la lista.</div>}

      <div style={estilos.label}>¿Qué ven los demás?</div>
      <div role="radiogroup" aria-label="Visibilidad de tu zona" style={estilos.niveles}>
        {NIVELES_ZONA.map((n) => {
          const activo = n.id === nivel;
          return (
            <label key={n.id} htmlFor={`zona-nivel-${n.id}`} style={{ ...estilos.nivel, ...(activo ? estilos.nivelActivo : null) }}>
              <input
                id={`zona-nivel-${n.id}`}
                type="radio"
                name="zona-nivel"
                checked={activo}
                onChange={() => setNivel(n.id)}
                style={estilos.radio}
              />
              <span>
                <span style={estilos.nivelTitulo}>{n.titulo}</span>
                <span style={estilos.nivelDetalle}>{n.detalle}</span>
              </span>
            </label>
          );
        })}
      </div>

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
  niveles: { display: 'flex', flexDirection: 'column', gap: 6 },
  nivel: {
    display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer',
    border: '2px solid #5A3A14', borderRadius: 10, background: '#FFF8E3', padding: '8px 10px',
  },
  nivelActivo: { background: '#FFE9B0', borderColor: '#2C160E' },
  radio: { marginTop: 3, accentColor: '#2C160E' },
  nivelTitulo: { display: 'block', fontSize: 13.5, fontWeight: 800, color: '#2C160E' },
  nivelDetalle: { display: 'block', fontSize: 11.5, fontWeight: 600, color: '#6B4A2E', marginTop: 1, lineHeight: 1.3 },
  error: { marginTop: 10, color: '#c2352a', fontWeight: 700, fontSize: 13 },
};
