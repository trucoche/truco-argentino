import React, { useEffect, useState } from 'react';
import PopupMadera from '../Popup/PopupMadera';
import { API_URL } from '../../config';

// Pase 582: cartel "Revisamos tu reporte". Cuando un admin marca como revisado un reporte de bug / sugerencia del jugador
// (y, si quiere, le regala mates), la próxima vez que el jugador entra al lobby ve este cartel UNA vez.
// GET /api/reportes-app/premios -> { avisos: [{ id, tipo, recompensa }], total_mates }; al cerrar, POST /premios/visto.

const MONEDA = (process.env.PUBLIC_URL || '') + '/assets/images/icono-moneda.png';

function encabezados(token) {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

export function ReporteAvisoModal({ visible, avisos, totalMates, onCerrar }) {
  const cantidad = avisos.length;
  const soloSugerencias = avisos.every((a) => a.tipo === 'sugerencia');
  const queEs = cantidad > 1 ? 'tus reportes' : (soloSugerencias ? 'tu sugerencia' : 'tu reporte');
  const mensaje = totalMates > 0
    ? `Revisamos ${queEs} y, como agradecimiento por ayudarnos a mejorar TrucoChe, te regalamos mates.`
    : `Revisamos ${queEs}. ¡Gracias por ayudarnos a mejorar TrucoChe!`;
  return (
    <PopupMadera
      visible={visible}
      titulo="¡Gracias por reportar!"
      cinta="dorada"
      anchoMax={380}
      mensaje={mensaje}
      onCerrar={onCerrar}
      botones={[{ texto: 'Entendido', tipo: 'dorado', onClick: onCerrar }]}
    >
      {totalMates > 0 && (
        <div style={estilos.premio}>
          <img src={MONEDA} alt="" style={estilos.moneda} />
          <span style={estilos.monto}>+{totalMates} mates</span>
        </div>
      )}
    </PopupMadera>
  );
}

// Anfitrión: pide los avisos pendientes al entrar al lobby y habla con el backend. No necesita ToastProvider.
export default function ReporteAvisoHost({ usuario, token, pantalla, onPerfilActualizado }) {
  const [datos, setDatos] = useState(null);   // { avisos, total_mates } | null

  useEffect(() => {
    if (!usuario || !token || pantalla !== 'lobby') return undefined;
    let cancelado = false;
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/reportes-app/premios`, { headers: encabezados(token) });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelado && data && Array.isArray(data.avisos) && data.avisos.length > 0) setDatos(data);
      } catch (err) {
        console.error('Error leyendo avisos de reportes:', err);
      }
    })();
    return () => { cancelado = true; };
  }, [usuario && usuario.id, token, pantalla]); // eslint-disable-line react-hooks/exhaustive-deps

  const cerrar = async () => {
    setDatos(null);
    try {
      await fetch(`${API_URL}/api/reportes-app/premios/visto`, { method: 'POST', headers: encabezados(token) });
    } catch (err) {
      console.error('Error marcando avisos de reportes como vistos:', err);
    }
    if (onPerfilActualizado) onPerfilActualizado();   // refresca el saldo
  };

  // Si hay un cartel de Kit o de Sponsor pendiente, el de reportes espera su turno (de a uno por vez).
  const otroPendiente = !!(usuario && ((usuario.kit_fundador && !usuario.kit_fundador_visto) || (usuario.es_sponsor && usuario.sponsor_visto === false)));
  return (
    <ReporteAvisoModal
      visible={!!datos && !otroPendiente}
      avisos={datos ? datos.avisos : []}
      totalMates={datos ? datos.total_mates : 0}
      onCerrar={cerrar}
    />
  );
}

const estilos = {
  premio: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 12 },
  moneda: { width: 40, height: 40, objectFit: 'contain' },
  monto: { fontWeight: 800, fontSize: 24, color: '#4A2C2A' },
};
