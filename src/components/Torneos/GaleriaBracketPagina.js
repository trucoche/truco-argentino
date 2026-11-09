import React, { useMemo } from 'react';
import BracketView from './BracketView';
import { generarSimulacion } from './bracketSimulado';

// Pase 710: página de la galería de admin (`/?galeria=bracket&modo=2v2&cupo=8&etapa=sala-media`). Dibuja el bracket de torneos con datos
// de EJEMPLO, sin login ni servidor, dentro de un <iframe> del marco de celular: así el diseño de celular (media query del ancho real
// de la ventana) se aplica de verdad, igual que en la web, en vez de heredar el ancho de la compu del admin.
export default function GaleriaBracketPagina({ modo, cupo, etapa }) {
  const datos = useMemo(() => {
    const sim = generarSimulacion({ modo, cupo, etapa, yo: 'vos' });
    return { ...sim, torneo: { ...sim.torneo, titulo: 'Copa Criolla' } };
  }, [modo, cupo, etapa]);
  return (
    <div style={{ minHeight: '100vh', boxSizing: 'border-box', padding: '12px 10px 12px', backgroundImage: 'linear-gradient(rgba(20,20,15,0.38), rgba(20,20,15,0.38)), url(/assets/images/fondo-lobby.jpeg)', backgroundSize: 'cover', backgroundPosition: 'center' }}>
      <BracketView
        torneoId="galeria"
        usuario={{ username: 'vos', id: 1 }}
        token=""
        datosSimulados={datos}
        onVolver={() => {}}
        onEntrarAPartida={() => {}}
        onAnotarme={() => {}}
      />
    </div>
  );
}
