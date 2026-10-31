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
// Nonagésimo quinto pase: el usuario mandó un asset nuevo que ya trae el
// botón COMPLETO horneado (círculo de madera + tuerca dorada + contorno
// negro vectorial, todo en un solo PNG) — reemplaza el engranaje suelto
// de antes. Pedido explícito: "sin sombras difusas en CSS, utilizando
// únicamente el contorno negro del propio asset", así que se saca el
// `filter: drop-shadow(...)` que era lo único que le daba presencia al
// engranaje plano anterior — ya no hace falta, el asset nuevo tiene su
// propio relieve/contorno horneado.
export default function ConfiguracionMesaBoton({ onAbrir }) {
  return (
    <>
      {/* Pase 664: con la pantalla final abierta (el juego marca #game-container[data-final]) el engranaje se oculta. */}
      <style>{'#game-container[data-final="1"] ~ .cfg-mesa-btn { display: none !important; }'}</style>
      <button
        className="cfg-mesa-btn"
        onClick={onAbrir}
        style={estilos.boton}
        title="Configuración de la partida"
      >
        <img src="/assets/images/boton-configuracion-madera.png" alt="Configuración" style={estilos.icono} />
      </button>
    </>
  );
}

const estilos = {
  boton: {
    // Pase 441: el engranaje pasa a la barra de arriba, a la izquierda del botón de chat (que mide 52 px
    // y está a 12 px del borde). zIndex 999: si el chat se abre, su panel queda por encima.
    position: 'absolute', top: 14, right: 72,
    width: 48, height: 48, padding: 0, border: 'none', background: 'none',
    cursor: 'pointer', zIndex: 999,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  icono: { width: '100%', height: '100%', objectFit: 'contain' },
};
