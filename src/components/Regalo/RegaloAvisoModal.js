import React, { useEffect, useState } from 'react';
import PopupMadera from '../Popup/PopupMadera';
import { API_URL } from '../../config';

// Pase 623: cartel "Regalo de TrucoChe". Cuando un admin le regala mates a una cuenta con un mensaje de agradecimiento
// (panel de Ajustes → administración), la próxima vez que entra al lobby ve este cartel UNA vez.
// GET /api/regalos/pendientes -> { regalos: [{ id, mates, mensaje }], total_mates }; al cerrar, POST /api/regalos/visto.

const MONEDA = (process.env.PUBLIC_URL || '') + '/assets/images/icono-moneda.png';

function encabezados(token) {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

export function RegaloAvisoModal({ visible, regalos, totalMates, onCerrar }) {
  return (
    <PopupMadera
      visible={visible}
      titulo="¡Un regalo de TrucoChe!"
      cinta="dorada"
      anchoMax={400}
      onCerrar={onCerrar}
      botones={[{ texto: '¡Gracias!', tipo: 'dorado', onClick: onCerrar }]}
    >
      <div style={estilos.premio}>
        <img src={MONEDA} alt="" style={estilos.moneda} />
        <span style={estilos.monto}>+{totalMates} mates</span>
      </div>
      {regalos.map((r) => (
        <p key={r.id} style={estilos.mensaje}>{`“${r.mensaje}”`}</p>
      ))}
    </PopupMadera>
  );
}

// Anfitrión: pide los regalos pendientes al entrar al lobby y habla con el backend.
export default function RegaloAvisoHost({ usuario, token, pantalla, onPerfilActualizado }) {
  const [datos, setDatos] = useState(null);   // { regalos, total_mates } | null

  useEffect(() => {
    if (!usuario || !token || pantalla !== 'lobby') return undefined;
    let cancelado = false;
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/regalos/pendientes`, { headers: encabezados(token) });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelado && data && Array.isArray(data.regalos) && data.regalos.length > 0) setDatos(data);
      } catch (err) {
        console.error('Error leyendo regalos pendientes:', err);
      }
    })();
    return () => { cancelado = true; };
  }, [usuario && usuario.id, token, pantalla]); // eslint-disable-line react-hooks/exhaustive-deps

  const cerrar = async () => {
    setDatos(null);
    try {
      await fetch(`${API_URL}/api/regalos/visto`, { method: 'POST', headers: encabezados(token) });
    } catch (err) {
      console.error('Error marcando regalos como vistos:', err);
    }
    if (onPerfilActualizado) onPerfilActualizado();   // refresca el saldo
  };

  // Si hay un cartel de Kit o de Sponsor pendiente, el regalo espera su turno (de a uno por vez).
  const otroPendiente = !!(usuario && ((usuario.kit_fundador && !usuario.kit_fundador_visto) || (usuario.es_sponsor && usuario.sponsor_visto === false)));
  return (
    <RegaloAvisoModal
      visible={!!datos && !otroPendiente}
      regalos={datos ? datos.regalos : []}
      totalMates={datos ? datos.total_mates : 0}
      onCerrar={cerrar}
    />
  );
}

const estilos = {
  premio: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 10 },
  moneda: { width: 40, height: 40, objectFit: 'contain' },
  monto: { fontWeight: 800, fontSize: 26, color: '#4A2C2A' },
  mensaje: { margin: '6px 0', fontFamily: "'Nunito', sans-serif", fontWeight: 700, fontSize: 15, color: '#4A2C2A', textAlign: 'center', lineHeight: 1.35 },
};
