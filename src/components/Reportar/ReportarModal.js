import React, { useEffect, useState } from 'react';
import PopupMadera from '../Popup/PopupMadera';
import { API_URL } from '../../config';

// Pase 577 (paridad con la app, Pase 523): formulario "Reportar bug / sugerencia".
// Manda el reporte a POST /api/reportes-app; un admin lo ve en el panel de Administración (Ajustes → Cuenta).
// Junta solo plataforma, navegador y pantalla para que el reporte llegue con contexto.

const MIN = 10;
const MAX = 1000;
const TIPOS = [
  { id: 'bug', texto: '🐞 Error' },
  { id: 'sugerencia', texto: '💡 Sugerencia' },
];

function dispositivoWeb() {
  try {
    const ua = navigator.userAgent || '';
    const pantalla = `${window.screen?.width || 0}x${window.screen?.height || 0}`;
    return `${ua.slice(0, 160)} (${pantalla})`.slice(0, 200);
  } catch {
    return 'web';
  }
}

export default function ReportarModal({ visible, onCerrar, token, pantalla = 'ajustes' }) {
  const [tipo, setTipo] = useState('bug');
  const [mensaje, setMensaje] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [enviado, setEnviado] = useState(false);

  // Cada vez que se abre, el formulario arranca limpio.
  useEffect(() => {
    if (visible) { setTipo('bug'); setMensaje(''); setError(''); setEnviado(false); setEnviando(false); }
  }, [visible]);

  const largo = mensaje.trim().length;
  const puedeEnviar = largo >= MIN && !enviando;

  const enviar = async () => {
    if (!puedeEnviar) return;
    setEnviando(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/reportes-app`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          tipo,
          mensaje: mensaje.trim(),
          plataforma: 'web',
          version: 'web',
          dispositivo: dispositivoWeb(),
          pantalla,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setError(data?.error || 'No se pudo enviar. Probá de nuevo.');
      else setEnviado(true);
    } catch {
      setError('No se pudo conectar. Revisá tu internet y probá de nuevo.');
    } finally {
      setEnviando(false);
    }
  };

  if (!visible) return null;

  if (enviado) {
    return (
      <PopupMadera
        visible={visible}
        titulo="¡Gracias!"
        emojiIcono="🙌"
        tamIcono={64}
        mensaje="Recibimos tu reporte. Lo vamos a revisar, gracias a esto TrucoChe mejora todos los días."
        onCerrar={onCerrar}
        botones={[{ texto: 'Cerrar', tipo: 'carmesi', onClick: onCerrar }]}
      />
    );
  }

  return (
    <PopupMadera
      visible={visible}
      scroll
      anchoMax={420}
      titulo="Reportar bug / sugerencia"
      cinta="madera"
      onCerrar={onCerrar}
      botones={[
        { texto: enviando ? 'Enviando…' : 'Enviar', tipo: 'verde', onClick: enviar, disabled: !puedeEnviar },
        { texto: 'Cancelar', tipo: 'carmesi', onClick: onCerrar },
      ]}
    >
      <div style={estilos.chips}>
        {TIPOS.map((t) => (
          <button
            key={t.id}
            type="button"
            style={{ ...estilos.chip, ...(tipo === t.id ? estilos.chipActivo : null) }}
            onClick={() => setTipo(t.id)}
          >
            {t.texto}
          </button>
        ))}
      </div>
      <textarea
        id="reporte-mensaje"
        style={estilos.input}
        value={mensaje}
        onChange={(e) => setMensaje(e.target.value.slice(0, MAX))}
        maxLength={MAX}
        placeholder={tipo === 'bug' ? 'Contanos qué pasó, en qué pantalla estabas y qué esperabas que pasara…' : 'Contanos tu idea o qué mejorarías…'}
      />
      <div style={estilos.contador}>{largo < MIN ? `Escribí al menos ${MIN} caracteres` : `${largo}/${MAX}`}</div>
      {!!error && <div style={estilos.error}>{error}</div>}
    </PopupMadera>
  );
}

const estilos = {
  chips: { display: 'flex', gap: 8, marginBottom: 10, justifyContent: 'center' },
  chip: {
    padding: '7px 14px', borderRadius: 18, border: '2px solid rgba(74,44,42,0.45)', background: 'rgba(255,255,255,0.35)',
    fontWeight: 800, fontSize: 13, color: '#4A2C2A', cursor: 'pointer', fontFamily: 'inherit',
  },
  chipActivo: { background: '#FFB627', borderColor: '#4A2C2A', color: '#2C160E' },
  input: {
    width: '100%', boxSizing: 'border-box', minHeight: 120, maxHeight: 190, resize: 'vertical', borderRadius: 10,
    border: '2px solid rgba(74,44,42,0.55)', background: '#FFF8ED', padding: '10px 12px', fontFamily: 'inherit',
    fontWeight: 700, fontSize: 14, color: '#2C160E',
  },
  contador: { textAlign: 'right', marginTop: 4, marginBottom: 6, fontWeight: 700, fontSize: 11.5, color: '#7a5a3a' },
  error: { width: '100%', textAlign: 'center', marginBottom: 8, fontWeight: 800, fontSize: 12.5, color: '#B3261E' },
};
