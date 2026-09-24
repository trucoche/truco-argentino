import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import Toast from '../components/Toast/Toast';

// Pase siguiente (Fase 4 — toasts): sistema de avisos cortos que aparecen
// y desaparecen solos, con la misma estética "pergamino con marco de
// madera" que ya usa el resto de la UI. Pensado para 3 casos, a pedido
// del usuario: logro/misión reclamados, acciones rápidas de sala (copiar
// código, etc.) y errores genéricos de red/servidor — este pase entrega
// el sistema en sí, ya conectado en `reclamarLogro` (Perfil), y deja el
// resto de los call-sites como siguiente paso (ver nota en la respuesta).
const ToastContext = createContext(undefined);

let idSiguiente = 1;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef({});

  const cerrarToast = useCallback((id) => {
    setToasts((actuales) => actuales.filter((t) => t.id !== id));
    if (timersRef.current[id]) {
      clearTimeout(timersRef.current[id]);
      delete timersRef.current[id];
    }
  }, []);

  // tipo: 'exito' | 'error' | 'info' (default 'info')
  // Pase siguiente: `alPresionar` opcional — para toasts que además de
  // avisar tienen una acción propia (ej. "te llegó un mensaje" → tocarlo
  // abre esa conversación). Antes tocar CUALQUIER toast solo lo cerraba.
  const mostrarToast = useCallback((mensaje, tipo = 'info', duracionMs = 3200, alPresionar) => {
    const id = idSiguiente++;
    setToasts((actuales) => [...actuales, { id, mensaje, tipo, alPresionar }]);
    timersRef.current[id] = setTimeout(() => cerrarToast(id), duracionMs);
  }, [cerrarToast]);

  return (
    <ToastContext.Provider value={{ mostrarToast }}>
      {children}
      <div style={estilos.pila}>
        {toasts.map((t) => (
          <Toast
            key={t.id}
            mensaje={t.mensaje}
            tipo={t.tipo}
            onCerrar={() => cerrarToast(t.id)}
            onPresionar={t.alPresionar ? () => { t.alPresionar(); cerrarToast(t.id); } : undefined}
          />
        ))}
      </div>
      <style>{`
        @keyframes toastEntrada {
          from { opacity: 0; transform: translateY(10px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast debe usarse dentro de ToastProvider');
  return ctx;
}

const estilos = {
  pila: {
    position: 'fixed', bottom: 20, right: 20, zIndex: 4000,
    display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-end',
    pointerEvents: 'none',
  },
};