import React, { useEffect, useState } from 'react';
import { ICONOS_LOGRO, nombreLogroSinEmoji } from '../Perfil/Perfil';
import PopupMadera from '../Popup/PopupMadera';

// Popup de "logro desbloqueado" — aparece cuando el usuario vuelve al Lobby después de una
// partida en la que completó algún logro. `logros` es la lista completa que llegó de esa
// partida (puede ser más de uno); se muestran de a uno y "Siguiente" pasa al próximo (o cierra
// si era el último). `onCerrarTodos` avisa al padre (App.js) para que vacíe el estado.
// Pase 325: rediseñado con el pop-up de madera (cinta, medalla con resplandor, botón píldora 3D);
// la X cierra todos de una.
export default function LogroDesbloqueadoPopup({ logros, onCerrarTodos }) {
  const [indice, setIndice] = useState(0);

  // Si llega una lista nueva (otra partida), arrancamos de nuevo desde el primero.
  useEffect(() => {
    setIndice(0);
  }, [logros]);

  if (!logros || logros.length === 0) return null;

  const logro = logros[indice];
  if (!logro) return null;

  const hayMas = indice + 1 < logros.length;
  const avanzar = () => {
    if (hayMas) setIndice(indice + 1);
    else onCerrarTodos?.();
  };

  const icono = ICONOS_LOGRO[logro.tipo];

  return (
    <PopupMadera
      visible
      titulo="¡Logro desbloqueado!"
      cinta="dorada"
      icono={icono || '/assets/images/icono-logros.png'}
      tamIcono={116}
      onCerrar={() => onCerrarTodos?.()}
      onFondo={avanzar}
      botones={[{ texto: hayMas ? 'Siguiente' : 'Aceptar', tipo: 'verde', onClick: avanzar }]}
    >
      {/* Sin el emoji (ver nombreLogroSinEmoji): la medalla ya lo reemplaza. */}
      <div style={{ fontFamily: "'Fredoka', sans-serif", fontWeight: 700, fontSize: 20, color: '#4A2C11', textAlign: 'center', marginBottom: 6 }}>
        {nombreLogroSinEmoji(logro.titulo)}
      </div>
      <div style={{ fontSize: 14, fontWeight: 800, lineHeight: 1.4, color: '#5a4030', textAlign: 'center', marginBottom: 14 }}>
        {logro.descripcion}
      </div>
      {logros.length > 1 && (
        <div style={{ fontSize: 12, fontWeight: 800, color: '#8D7B68', textAlign: 'center', marginBottom: 10 }}>
          {indice + 1} / {logros.length}
        </div>
      )}
    </PopupMadera>
  );
}
