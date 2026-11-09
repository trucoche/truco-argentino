import React, { useEffect, useState } from 'react';
import PopupMadera from '../Popup/PopupMadera';
import { API_URL } from '../../config';
import { useToast } from '../../contexts/ToastContext';
import { anilloPorId, bannerPorId, mazoPorId } from '../../constants/personalizacion';

// Pase 707: cartel de gracias del "Pack Primera Compra". Aparece UNA vez en el lobby cuando se le acredita a la cuenta su primera compra
// de mates (Mercado Pago o Google Play): `usuario.primera_compra && usuario.primera_compra_visto === false`. Muestra los tres objetos que
// obtuvo (anillo, banner y dorso). "Equipar todo" los deja puestos; "Después" / X / tocar fuera solo cierran (se avisa al backend con
// /primera-compra/visto para no volver a mostrarlo). Mismo molde que el cartel de Sponsor.

const ANILLO = anilloPorId('primera-compra');
const BANNER = bannerPorId('primera-compra');
const MAZO = mazoPorId('primera-compra');

const TAM_ANILLO = 56;
const ANCHO_BANNER = 92;
const ALTO_DORSO = 54;

function encabezados(token) {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

export function PrimeraCompraGraciasModal({ visible, equipando = false, onEquipar, onCerrar }) {
  const hueco = ANILLO.hueco || 0.75;
  return (
    <PopupMadera
      visible={visible}
      scroll
      titulo="¡Gracias por tu compra!"
      cinta="dorada"
      anchoMax={400}
      mensaje="Gracias por tu primera compra de mates: te llevás el Pack Primera Compra, tres diseños exclusivos."
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
          <span style={estilos.etiqueta}>Dorso</span>
        </div>
      </div>
      <div style={estilos.nota}>Cambialos cuando quieras desde Ajustes → Perfil → Personalización.</div>
    </PopupMadera>
  );
}

// Anfitrión: decide cuándo mostrarlo y habla con el backend. Va dentro de <ToastProvider>.
export default function PrimeraCompraGraciasHost({ usuario, token, pantalla, onPerfilActualizado }) {
  const { mostrarToast } = useToast();
  const [cerrado, setCerrado] = useState(false);
  const [equipando, setEquipando] = useState(false);

  // Si cambia de cuenta, vuelve a evaluarse.
  useEffect(() => { setCerrado(false); }, [usuario?.id]);

  // Si además tiene pendiente el cartel del Kit de Beta Tester o el de Sponsor, primero se muestran esos (de a uno por vez).
  const otroPendiente = !!(usuario && ((usuario.kit_fundador && !usuario.kit_fundador_visto) || (usuario.es_sponsor && usuario.sponsor_visto === false)));
  const corresponde = !!(usuario && token && usuario.primera_compra && usuario.primera_compra_visto === false && !otroPendiente && pantalla === 'lobby' && !cerrado);

  const cerrar = async () => {
    setCerrado(true);
    try {
      await fetch(`${API_URL}/api/usuarios/primera-compra/visto`, { method: 'POST', headers: encabezados(token) });
    } catch (err) {
      console.error('Error marcando el cartel de Primera Compra como visto:', err);
    }
    if (onPerfilActualizado) onPerfilActualizado();
  };

  const equipar = async () => {
    if (equipando) return;
    setEquipando(true);
    try {
      const res = await fetch(`${API_URL}/api/usuarios/primera-compra/equipar`, { method: 'POST', headers: encabezados(token) });
      if (res.ok) {
        mostrarToast('¡Pack Primera Compra equipado!', 'exito');
      } else {
        const data = await res.json().catch(() => ({}));
        mostrarToast(data.error || 'No se pudo equipar el pack. Probá desde Ajustes.', 'error');
      }
    } catch (err) {
      mostrarToast('No se pudo conectar. Probá desde Ajustes.', 'error');
    } finally {
      setEquipando(false);
      await cerrar();
    }
  };

  return <PrimeraCompraGraciasModal visible={corresponde} equipando={equipando} onEquipar={equipar} onCerrar={cerrar} />;
}

const estilos = {
  fila: { display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 12, margin: '16px 0 14px', flexWrap: 'nowrap' },
  item: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 },
  etiqueta: { fontWeight: 800, fontSize: 11.5, color: '#4A2C2A' },
  nota: { fontWeight: 700, fontSize: 12, color: '#7a5a3a', textAlign: 'center', marginBottom: 12, lineHeight: '17px' },
};
