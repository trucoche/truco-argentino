import React, { useEffect, useState } from 'react';
import { PlacaMadera, confirmarPopup, mostrarAviso } from '../Popup/PopupMadera';
import { PACKS, rutaPack } from '../../constants/packsMesa';
import { estadoTienda, suscribirTienda, cargarTiendaPacks, comprarPackTienda, guardarMesaTienda } from '../../services/tiendaPacks';

// Pase 768: packs de mesa en la Tienda web (paño + marcador + adorno + dorso + carteles) y "Mi mesa".
// Solo se dibuja si el servidor tiene la tienda de packs activa para este jugador (TIENDA_PACKS_ACTIVA); si no, no ocupa lugar.
const NOMBRE_MARCADOR = { 'la-pulperia': 'fósforos', 'noche-camperal': 'ramitas', 'pampa-y-patria': 'porotos' };
const PIEZAS = [
  { clave: 'pano', titulo: 'Paño de la mesa' },
  { clave: 'marcador', titulo: 'Marcador' },
  { clave: 'adorno', titulo: 'Adorno' },
  { clave: 'cartel', titulo: 'Cartel de victoria' },
  { clave: 'dorso', titulo: 'Dorso de las cartas' },
];
const aviso = (titulo, mensaje, cinta = 'dorada') => mostrarAviso({ titulo, mensaje, cinta, botones: [{ texto: 'Entendido', tipo: 'neutro' }] });

export default function PacksMesa({ usuario, token, onPerfilActualizado }) {
  const [t, setT] = useState(() => estadoTienda(usuario?.id));
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    setT(estadoTienda(usuario?.id));
    const baja = suscribirTienda(setT);
    if (token && usuario?.id) cargarTiendaPacks(token, usuario.id);
    return baja;
  }, [token, usuario?.id]);

  if (!t.activa) return null;
  const packs = (t.packs || []).filter((p) => PACKS[p.id]);
  if (packs.length === 0) return null;
  const propios = packs.filter((p) => p.comprado);

  const comprar = async (p) => {
    if (ocupado) return;
    const faltan = Math.max(0, t.precio - t.saldo);
    if (faltan > 0) {
      aviso('Te faltan mates', `Para comprar ${p.nombre} necesitás ${t.precio} mates y tenés ${t.saldo}. Te faltan ${faltan}.`, 'roja');
      return;
    }
    const si = await confirmarPopup({
      titulo: `Comprar ${p.nombre}`,
      mensaje: `Vas a gastar ${t.precio} mates y te quedan ${t.saldo - t.precio}. El pack es tuyo para siempre.`,
      textoSi: 'Comprar',
    });
    if (!si) return;
    setOcupado(true);
    const r = await comprarPackTienda(token, usuario.id, p.id);
    setOcupado(false);
    if (r.ok) { aviso(`¡Ahora tenés ${p.nombre}!`, 'Armá tu mesa más abajo, en "Mi mesa".'); if (onPerfilActualizado) onPerfilActualizado(); }
    else aviso('No se pudo comprar', r.mensaje, 'roja');
  };

  const elegir = async (pieza, valor) => {
    const r = await guardarMesaTienda(token, usuario.id, { [pieza]: valor });
    if (!r.ok) aviso('No se guardó', r.mensaje, 'roja');
    else if (pieza === 'dorso' && onPerfilActualizado) onPerfilActualizado();   // el dorso también se guarda como mazo del jugador
  };

  return (
    <div style={e.contenedor}>
      <div className="tc-titulo" style={e.titulo}>Packs de mesa</div>
      <div className="tc-subtitulo" style={e.subtitulo}>{`Tenés ${t.saldo} mates · cada pack sale ${t.precio}`}</div>
      <div style={e.grilla}>
        {packs.map((p) => {
          const info = PACKS[p.id];
          return (
            <PlacaMadera key={p.id} interiorStyle={e.tarjeta}>
              <img src={`/${rutaPack(p.id, 'mesa-redonda.webp')}`} alt="" style={e.mesa} />
              <div style={e.nombre}>{p.nombre}</div>
              <div style={e.detalle}>{`Paño · Marcador de ${NOMBRE_MARCADOR[p.id]} · ${info.adorno.nombre} · Dorso · Carteles`}</div>
              <div style={e.minis}>
                <img src={`/${rutaPack(p.id, 'marcador-5.webp')}`} alt="" style={e.mini} />
                <img src={`/${rutaPack(p.id, 'adorno-1.webp')}`} alt="" style={e.mini} />
                <img src={`/assets/personalizacion-opt/cartas/${info.dorso}/abanico-frente-1.png`} alt="" style={{ ...e.mini, width: 'auto', maxWidth: 70 }} />
              </div>
              {p.comprado ? (
                <div style={e.tuyo}>✓ Ya es tuyo</div>
              ) : (
                <button type="button" className="tc-precio-boton" style={{ ...e.boton, opacity: ocupado ? 0.6 : 1 }} disabled={ocupado} onClick={() => comprar(p)}>
                  {`Comprar · ${t.precio} mates`}
                </button>
              )}
            </PlacaMadera>
          );
        })}
      </div>

      <PlacaMadera interiorStyle={{ ...e.tarjeta, alignItems: 'stretch', textAlign: 'left' }}>
        <div style={{ ...e.nombre, color: '#4A2C2A' }}>Mi mesa</div>
        {propios.length === 0 ? (
          <div style={e.texto}>Cuando tengas un pack vas a poder elegir qué pieza usar en cada partida: el paño de uno, el marcador de otro, el adorno de un tercero.</div>
        ) : (
          <>
            <div style={e.texto}>Elegí qué pieza usar de cada pack. Tus rivales ven tu dorso y tu cartel de victoria.</div>
            {PIEZAS.map((pz) => {
              const actual = (t.mesa && t.mesa[pz.clave]) || null;
              return (
                <div key={pz.clave} style={e.pieza}>
                  <div style={e.piezaTitulo}>{pz.titulo}</div>
                  <div style={e.chips}>
                    <button type="button" style={chip(!actual || actual === 'base')} onClick={() => elegir(pz.clave, null)}>De siempre</button>
                    {propios.map((p) => (
                      <button key={p.id} type="button" style={chip(actual === p.id)} onClick={() => elegir(pz.clave, p.id)}>{p.nombre}</button>
                    ))}
                  </div>
                </div>
              );
            })}
          </>
        )}
      </PlacaMadera>
    </div>
  );
}

const chip = (activo) => ({
  padding: '6px 12px', borderRadius: 999, cursor: 'pointer', fontWeight: 800, fontSize: 13,
  border: '2px solid #1a0f0a', background: activo ? '#F5B041' : '#6b4a35', color: activo ? '#3B1F0E' : '#FFF8ED',
});

const e = {
  contenedor: { marginTop: 22, display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: 760, marginLeft: 'auto', marginRight: 'auto' },
  titulo: { fontSize: 24, fontWeight: 900, textAlign: 'center', color: '#FFF8ED' },
  subtitulo: { fontSize: 13, textAlign: 'center', color: '#FBE7B0', marginTop: -6 },
  grilla: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12 },
  tarjeta: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: 12, textAlign: 'center' },
  mesa: { width: 130, height: 'auto', objectFit: 'contain' },
  nombre: { fontSize: 19, fontWeight: 900, color: '#8a5a12' },
  detalle: { fontSize: 12, lineHeight: 1.3, color: '#4A2C2A' },
  minis: { display: 'flex', alignItems: 'center', gap: 10 },
  mini: { height: 42, width: 42, objectFit: 'contain' },
  tuyo: { fontSize: 15, fontWeight: 900, color: '#1f7a3c', marginTop: 4 },
  boton: { marginTop: 4, padding: '8px 16px', borderRadius: 999, border: '3px solid #1a0f0a', background: '#10B981', color: '#fff', fontWeight: 900, fontSize: 14, cursor: 'pointer' },
  texto: { fontSize: 13, lineHeight: 1.35, color: '#4A2C2A' },
  pieza: { marginTop: 8 },
  piezaTitulo: { fontSize: 13, fontWeight: 800, color: '#4A2C2A', marginBottom: 4 },
  chips: { display: 'flex', flexWrap: 'wrap', gap: 6 },
};
