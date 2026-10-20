import React, { useEffect, useState } from 'react';
import { API_URL } from '../../config';
import { confirmarPopup, mostrarAviso } from '../Popup/PopupMadera';
import { rangoUi } from '../Perfil/rangosUi';
import { ANILLOS, BANNERS, MAZOS, PERSONALIZACION_POR_DEFECTO, estaDisponible } from '../../constants/personalizacion';

// Pase 578 (paridad con la app, Pases 524/563): selector de anillo, banner y dorso de cartas (Ajustes → Perfil).
// Guarda en la cuenta con PUT /api/usuarios/personalizacion, así los demás jugadores ven tu anillo y tu banner (y tu dorso en la mesa).
// Los diseños exclusivos del Kit de Fundador/Beta Tester se ven con candado si la cuenta no lo tiene; los de Cafecito
// (Sponsor Criollo), hasta que la cuenta sea sponsor (usuario.es_sponsor).

const CATEGORIAS = [
  { campo: 'anillo_id', titulo: 'Anillo del avatar', items: ANILLOS },
  { campo: 'banner_id', titulo: 'Banner del perfil', items: BANNERS },
  { campo: 'mazo_id', titulo: 'Dorso de las cartas', items: MAZOS },
];

function Vista({ campo, item, rangoAssets }) {
  if (campo === 'anillo_id') {
    const imagen = item.imagen || rangoAssets.anillo;
    const hueco = item.hueco || rangoAssets.hueco;
    const T = 58;
    return (
      <div style={{ position: 'relative', width: T, height: T }}>
        <div style={{ position: 'absolute', top: '50%', left: '50%', width: T * hueco, height: T * hueco, marginLeft: -(T * hueco) / 2, marginTop: -(T * hueco) / 2, borderRadius: '50%', background: '#D9B98A' }} />
        <img src={imagen} alt="" style={{ position: 'absolute', inset: 0, width: T, height: T, objectFit: 'contain' }} />
      </div>
    );
  }
  if (campo === 'banner_id') {
    return <img src={item.imagen} alt="" style={{ width: 98, height: 98 / item.proporcion, objectFit: 'contain' }} />;
  }
  return <img src={item.dorso} alt="" style={{ width: 54 * item.proporcionDorso, height: 54, objectFit: 'contain' }} />;
}

export default function SelectorPersonalizacion({ usuario, token, recargarPerfil, onApoyar }) {
  const [sel, setSel] = useState({ ...PERSONALIZACION_POR_DEFECTO });
  const rangoAssets = rangoUi(usuario && usuario.rango);
  const kit = !!(usuario && usuario.kit_fundador);
  const esSponsor = !!(usuario && usuario.es_sponsor);

  // Sincroniza con lo guardado en la cuenta cada vez que llega el perfil.
  useEffect(() => {
    if (!usuario) return;
    setSel({
      anillo_id: usuario.anillo_id || PERSONALIZACION_POR_DEFECTO.anillo_id,
      banner_id: usuario.banner_id || PERSONALIZACION_POR_DEFECTO.banner_id,
      mazo_id: usuario.mazo_id || PERSONALIZACION_POR_DEFECTO.mazo_id,
    });
  }, [usuario && usuario.anillo_id, usuario && usuario.banner_id, usuario && usuario.mazo_id]); // eslint-disable-line react-hooks/exhaustive-deps

  const elegir = async (campo, item) => {
    if (!estaDisponible(item, { kitFundador: kit, esSponsor })) {
      if (item.soloSponsor) {
        const apoyar = await confirmarPopup({
          titulo: 'Diseño de Sponsor',
          mensaje: 'El Anillo, el Banner y el Dorso "Sponsor Criollo" se desbloquean al apoyar el proyecto en Cafecito. Escribí tu nombre de usuario en el mensaje de la donación y en un lapso de 24 hs te llegan a tu inventario.',
          textoSi: 'Apoyar en Cafecito ☕',
          textoNo: 'Cerrar',
          tipoSi: 'celeste',
        });
        if (apoyar && onApoyar) onApoyar();
      } else {
        mostrarAviso({
          titulo: 'Diseño exclusivo',
          mensaje: 'Es parte del Kit de Beta Tester, que se regaló a quienes probaron TrucoChe en la etapa de pruebas.',
          botones: [{ texto: 'Entendido', tipo: 'dorado' }],
        });
      }
      return;
    }
    if (sel[campo] === item.id) return;
    const anterior = sel[campo];
    setSel((s) => ({ ...s, [campo]: item.id }));   // se ve al instante; si el servidor lo rechaza, vuelve atrás
    try {
      const res = await fetch(`${API_URL}/api/usuarios/personalizacion`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ [campo]: item.id }),
      });
      if (!res.ok) throw new Error('guardar');
      if (recargarPerfil) recargarPerfil();
    } catch (err) {
      setSel((s) => ({ ...s, [campo]: anterior }));
      mostrarAviso({
        titulo: 'No se pudo guardar',
        cinta: 'roja',
        mensaje: 'Revisá tu conexión y probá de nuevo.',
        botones: [{ texto: 'Aceptar', tipo: 'dorado' }],
      });
    }
  };

  return (
    <div>
      {CATEGORIAS.map((cat) => (
        <div key={cat.campo} style={estilos.bloque}>
          <div style={estilos.titulo}>{cat.titulo}</div>
          {/* Con un fondo propio activo, el banner se muestra como Madera clásica (ver BannerPerfil). */}
          {cat.campo === 'banner_id' && !!(usuario && usuario.fondo_perfil_url) && (
            <div style={estilos.aviso}>Mientras tengas un fondo propio, tu perfil usa la Madera clásica. Tu banner elegido vuelve si sacás el fondo.</div>
          )}
          <div style={estilos.fila}>
            {cat.items.map((item) => {
              const libre = estaDisponible(item, { kitFundador: kit, esSponsor });
              const activo = sel[cat.campo] === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => elegir(cat.campo, item)}
                  aria-pressed={activo}
                  style={{ ...estilos.tile, ...(activo ? estilos.tileActivo : null), ...(!libre ? estilos.tileBloqueado : null) }}
                >
                  <div style={estilos.vista}>
                    <Vista campo={cat.campo} item={item} rangoAssets={rangoAssets} />
                  </div>
                  <div style={estilos.nombre}>{item.id === 'rango' ? 'Mi rango' : item.nombre}</div>
                  {activo && <span style={estilos.tilde} aria-hidden="true">✓</span>}
                  {!libre && <span style={estilos.candado} aria-hidden="true">🔒</span>}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

const estilos = {
  bloque: { marginBottom: 14 },
  titulo: { fontWeight: 800, fontSize: 14, color: '#4A2C2A', marginBottom: 6 },
  aviso: { fontWeight: 700, fontSize: 11.5, color: '#6B4A2E', marginBottom: 6 },
  fila: { display: 'flex', gap: 10, padding: '8px 6px 6px 2px', overflowX: 'auto' },
  tile: {
    position: 'relative', flex: '0 0 112px', width: 112, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', alignItems: 'center',
    padding: '8px 6px', borderRadius: 12, border: '2px solid rgba(74,44,42,0.35)', background: 'rgba(255,255,255,0.35)', cursor: 'pointer', fontFamily: 'inherit',
  },
  tileActivo: { borderColor: '#C9860E', background: '#FFE9B0', borderWidth: 3, padding: '7px 5px' },
  tileBloqueado: { opacity: 0.55 },
  vista: { height: 62, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  nombre: { marginTop: 4, fontWeight: 800, fontSize: 11.5, color: '#4A2C2A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' },
  tilde: {
    position: 'absolute', top: -7, right: -7, width: 22, height: 22, borderRadius: 11, background: '#3FA34D', border: '2px solid #000',
    color: '#fff', fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box',
  },
  candado: { position: 'absolute', top: 4, right: 6, fontSize: 15 },
};
