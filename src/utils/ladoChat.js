// Pase 681: de qué lado de la mesa va el botón de chat ('izquierda' | 'derecha') en la web del celular, igual que en la app
// (Configuración de la mesa → "Botón de chat"). El botón de señas (guiño) de 2v2 / 3v3 va del mismo lado. Se guarda en el
// navegador; los cambios avisan con un evento de ventana para que el chat y la escena se acomoden al instante.
import { useCallback, useEffect, useState } from 'react';

const CLAVE = 'tc_lado_chat';
export const EVENTO_LADO_CHAT = 'tc-lado-chat';

export function leerLadoChat() {
  try {
    return localStorage.getItem(CLAVE) === 'izquierda' ? 'izquierda' : 'derecha';
  } catch (e) {
    return 'derecha';
  }
}

export function guardarLadoChat(lado) {
  const l = lado === 'izquierda' ? 'izquierda' : 'derecha';
  try { localStorage.setItem(CLAVE, l); } catch (e) { /* sin storage */ }
  try { window.dispatchEvent(new CustomEvent(EVENTO_LADO_CHAT, { detail: l })); } catch (e) { /* sin eventos */ }
}

export function useLadoChat() {
  const [lado, setLado] = useState(leerLadoChat);
  useEffect(() => {
    const alCambiar = () => setLado(leerLadoChat());
    window.addEventListener(EVENTO_LADO_CHAT, alCambiar);
    return () => window.removeEventListener(EVENTO_LADO_CHAT, alCambiar);
  }, []);
  const cambiar = useCallback((nuevo) => guardarLadoChat(nuevo), []);
  return [lado, cambiar];
}
