import React from 'react';

// Botón que abre el panel de configuración de la partida (volumen de
// música y de voces, y más adelante otras opciones). Es la única
// esquina de la mesa que no usa ya otro botón flotante (arriba-izquierda:
// compartir mano, abajo-izquierda: audio de sala privada, arriba-derecha:
// chat) — antes compartía esta esquina con el botón de mutear música
// (bottom:60), pero ese botón se sacó porque quedó redundante con el
// slider de música de este mismo panel, así que ahora ocupa el lugar
// que dejó libre (bottom:12).
// Trigésimo pase: reemplazado el emoji ⚙️ (placeholder) por el ícono
// ilustrado del usuario — un cuadrado redondeado de madera con un
// engranaje bronce, que ya traía su propio marco/relieve horneado. Por eso
// se sacó el degradé pergamino + aro dorado que tenía el botón viejo (que
// era el "marco" para el emoji): dejarlos los dos apilados se hubiera
// visto como un marco adentro de otro marco.
// Trigésimo cuarto pase: el usuario pidió sacar el marco de madera y dejar
// solo el engranaje (mismo archivo que usa el título del panel de
// configuración) — sigue sin marco propio, la sombra por drop-shadow es lo
// único que le da presencia de botón.
export default function ConfiguracionMesaBoton({ onAbrir }) {
  return (
    <button
      onClick={onAbrir}
      style={estilos.boton}
      title="Configuración de la partida"
    >
      <img src="/assets/images/icono-engranaje.png" alt="Configuración" style={estilos.icono} />
    </button>
  );
}

const estilos = {
  boton: {
    position: 'absolute', bottom: 12, right: 12,
    width: 48, height: 48, padding: 0, border: 'none', background: 'none',
    cursor: 'pointer', zIndex: 1000,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    filter: 'drop-shadow(0 3px 5px rgba(0,0,0,0.4))',
  },
  icono: { width: '100%', height: '100%', objectFit: 'contain' },
};
