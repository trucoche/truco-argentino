import React, { useEffect, useState } from 'react';
import PopupMadera from '../Popup/PopupMadera';
import { API_URL } from '../../config';
import { useToast } from '../../contexts/ToastContext';
import { anilloPorId, bannerPorId, mazoPorId } from '../../constants/personalizacion';

// Pase 577 (paridad con la app, Pase 523): tarjeta de bienvenida del Kit de Fundador / Beta Tester.
// Aparece UNA vez en el lobby para las cuentas con `usuario.kit_fundador && !usuario.kit_fundador_visto`
// (el backend decide, ver truco-backend/src/personalizacion.js).
// "Equipar todo" deja puestos el anillo, el banner y el mazo `tester`; "Después", la X o tocar fuera solo cierran
// (se avisa al backend con /visto para no volver a mostrarla).

const ANILLO = anilloPorId('tester');
const BANNER = bannerPorId('tester');
const MAZO = mazoPorId('tester');

const TAM_ANILLO = 70;
const ANCHO_BANNER = 112;
const ALTO_DORSO = 66;

function encabezados(token) {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

export function KitFundadorModal({ visible, equipando = false, onEquipar, onCerrar }) {
  const hueco = ANILLO.hueco || 0.63;
  return (
    <PopupMadera
      visible={visible}
      scroll
      titulo="¡Bienvenido, Beta Tester!"
      cinta="dorada"
      anchoMax={400}
      mensaje="Gracias por ser de los primeros en jugar TrucoChe. Tu ayuda en esta etapa de pruebas es clave para dejar el juego bien pulido, y por eso te regalamos el Kit de Fundador: tres diseños exclusivos que solo tienen los primeros jugadores."
      onCerrar={onCerrar}
      botones={[
        { texto: equipando ? 'Equipando…' : 'Equipar todo', tipo: 'dorado', onClick: onEquipar, disabled: equipando },
        { texto: 'Después', tipo: 'neutro', onClick: onCerrar },
      ]}
    >
      <div style={estilos.fila}>
        <div style={estilos.item}>
          <div style={{ position: 'relative', width: TAM_ANILLO, height: TAM_ANILLO }}>
            <div style={{ position: 'absolute', top: '50%', left: '50%', width: TAM_ANILLO * hueco, height: TAM_ANILLO * hueco, marginLeft: -(TAM_ANILLO * hueco) / 2, marginTop: -(TAM_ANILLO * hueco) / 2, borderRadius: '50%', background: '#D9B98A' }} />
            {!!ANILLO.imagen && <img src={ANILLO.imagen} alt="" style={{ position: 'absolute', inset: 0, width: TAM_ANILLO, height: TAM_ANILLO, objectFit: 'contain' }} />}
          </div>
          <span style={estilos.etiqueta}>Anillo</span>
        </div>
        <div style={estilos.item}>
          <div style={{ height: TAM_ANILLO, display: 'flex', alignItems: 'center' }}>
            <img src={BANNER.imagen} alt="" style={{ width: ANCHO_BANNER, height: ANCHO_BANNER / BANNER.proporcion, objectFit: 'contain' }} />
          </div>
          <span style={estilos.etiqueta}>Banner</span>
        </div>
        <div style={estilos.item}>
          <div style={{ height: TAM_ANILLO, display: 'flex', alignItems: 'center' }}>
            <img src={MAZO.dorso} alt="" style={{ width: ALTO_DORSO * MAZO.proporcionDorso, height: ALTO_DORSO, objectFit: 'contain', transform: 'rotate(-6deg)' }} />
          </div>
          <span style={estilos.etiqueta}>Mazo</span>
        </div>
      </div>

      <div style={estilos.aviso}>
        <div style={estilos.avisoTitulo}>🐞 ¿Algo falla o tenés una idea?</div>
        <div style={estilos.avisoTexto}>
          Entrá a Ajustes y tocá «Reportar bug / sugerencia». Contanos qué pasó y en qué pantalla: cuanto más detalle, más rápido lo arreglamos.
        </div>
      </div>
      <div style={estilos.nota}>Podés cambiar tus diseños cuando quieras desde Ajustes.</div>
    </PopupMadera>
  );
}

// Anfitrión: decide cuándo mostrarlo y habla con el backend. Va dentro de <ToastProvider>.
export default function KitFundadorHost({ usuario, token, pantalla, onPerfilActualizado }) {
  const { mostrarToast } = useToast();
  const [cerrado, setCerrado] = useState(false);
  const [equipando, setEquipando] = useState(false);

  // Si cambia de cuenta, vuelve a evaluarse.
  useEffect(() => { setCerrado(false); }, [usuario?.id]);

  const corresponde = !!(usuario && token && usuario.kit_fundador && !usuario.kit_fundador_visto && pantalla === 'lobby' && !cerrado);

  const marcarVisto = async () => {
    try {
      await fetch(`${API_URL}/api/usuarios/kit-fundador/visto`, { method: 'POST', headers: encabezados(token) });
    } catch (err) {
      console.error('Error marcando el kit como visto:', err);
    }
  };

  const cerrar = async () => {
    setCerrado(true);
    await marcarVisto();
    if (onPerfilActualizado) onPerfilActualizado();
  };

  const equipar = async () => {
    if (equipando) return;
    setEquipando(true);
    try {
      const res = await fetch(`${API_URL}/api/usuarios/kit-fundador/equipar`, { method: 'POST', headers: encabezados(token) });
      if (res.ok) {
        mostrarToast('¡Kit de Fundador equipado!', 'exito');
      } else {
        const data = await res.json().catch(() => ({}));
        mostrarToast(data.error || 'No se pudo equipar el kit. Probá desde Ajustes.', 'error');
      }
    } catch (err) {
      mostrarToast('No se pudo conectar. Probá desde Ajustes.', 'error');
    } finally {
      setEquipando(false);
      await cerrar();
    }
  };

  return <KitFundadorModal visible={corresponde} equipando={equipando} onEquipar={equipar} onCerrar={cerrar} />;
}

const estilos = {
  fila: { display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 14, marginBottom: 12, flexWrap: 'wrap' },
  item: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 },
  etiqueta: { fontWeight: 800, fontSize: 12, color: '#4A2C2A' },
  aviso: { width: '100%', boxSizing: 'border-box', background: 'rgba(74,44,42,0.10)', borderRadius: 10, border: '1.5px solid rgba(74,44,42,0.35)', padding: '10px 12px', marginBottom: 8 },
  avisoTitulo: { fontWeight: 800, fontSize: 14, color: '#2C160E', textAlign: 'center', marginBottom: 4 },
  avisoTexto: { fontWeight: 700, fontSize: 13, lineHeight: '18px', color: '#4A2C2A', textAlign: 'center' },
  nota: { fontWeight: 700, fontSize: 12, color: '#7a5a3a', textAlign: 'center', marginBottom: 10 },
};
