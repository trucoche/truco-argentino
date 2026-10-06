import React from 'react';
import { rangoUi } from './rangosUi';

// Pase 316: página de prueba de assets de rangos (ruta /rangos-prueba). Muestra los
// 10 rangos con el MISMO marcado y CSS del header (.ts-tarjeta-perfil), el anillo con
// la foto como en el perfil y el logo, para revisar centrado sin subir de rango.
const NOMBRES = ['Mancebo', 'Paisano', 'Resero', 'Gaucho', 'Capataz', 'Baqueano', 'Payador', 'Caudillo', 'Don Segundo', 'Martín Fierro'];
const TAM_ANILLO = 140;

export default function RangosPrueba({ onVolver }) {
  return (
    <div style={{ minHeight: '100vh', background: '#1B5E32', color: '#FFF8ED', padding: '16px 16px 60px' }}>
      <button onClick={onVolver} style={{ background: 'none', border: 'none', color: '#FFF8ED', fontSize: 16, fontWeight: 700, cursor: 'pointer' }}>← Volver</button>
      <h2 style={{ textAlign: 'center', margin: '8px 0 20px' }}>Prueba de rangos</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 26, alignItems: 'center' }}>
        {NOMBRES.map((nombre, i) => {
          const id = i + 1;
          const ui = rangoUi({ id });
          const diam = Math.round(TAM_ANILLO * ui.hueco) + 2;
          return (
            <div key={id} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 28, borderTop: '1px solid rgba(255,255,255,0.2)', paddingTop: 14, width: '100%', maxWidth: 900 }}>
              <div style={{ width: '100%', textAlign: 'center', color: '#FFD668', fontWeight: 800 }}>{id} · {nombre}</div>
              <div
                className="ts-tarjeta-perfil"
                style={{
                  '--ts-nombre-color': ui.nombreColor,
                  '--ts-nombre-halo': ui.nombreHalo,
                  '--ts-saldo-color': ui.saldoColor,
                  height: 128,
                  cursor: 'default',
                }}
              >
                <img src={ui.panel} alt="" className="ts-tarjeta-perfil-fondo" />
                <div className="ts-tarjeta-perfil-avatar" style={ui.discoEstilo}>
                  <img src="/assets/gaucho-avatar-cara.png" alt="Avatar" />
                </div>
                <div className="ts-tarjeta-perfil-nombre">jugador_{id}</div>
                <div className="ts-tarjeta-perfil-saldo">1593</div>
              </div>
              <div style={{ position: 'relative', width: TAM_ANILLO, height: TAM_ANILLO }}>
                <div style={{ position: 'absolute', left: (TAM_ANILLO - diam) / 2, top: (TAM_ANILLO - diam) / 2, width: diam, height: diam, borderRadius: '50%', overflow: 'hidden', background: '#fff' }}>
                  <img src="/assets/gaucho-avatar-cara.png" alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                </div>
                <img src={ui.anillo} alt="" style={{ position: 'absolute', left: 0, top: 0, width: TAM_ANILLO, height: TAM_ANILLO, pointerEvents: 'none' }} />
              </div>
              <img src={ui.logo} alt="" style={{ width: 112, height: 112, objectFit: 'contain' }} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
