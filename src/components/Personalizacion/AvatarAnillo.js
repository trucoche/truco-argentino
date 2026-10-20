import React, { useEffect, useState } from 'react';

// Pase 578 (paridad con la app, Pase 526): foto/personaje + anillo elegido, con tamaño único (`tam` = lado del anillo).
// Se usa igual en Perfil y en el pop-up de perfil ajeno. Si la foto subida falla al cargar, cae al personaje.
// - hueco: fracción del lado del anillo que ocupa el agujero (rangosUi / personalizacion).
// - children: p.ej. el badge de "cambiar foto" (queda posicionado respecto de este contenedor).
export default function AvatarAnillo({ tam, hueco, anilloImagen, fuente, fallback, children }) {
  const [fallo, setFallo] = useState(false);
  useEffect(() => { setFallo(false); }, [fuente]);
  const diam = Math.round(tam * hueco) + 2;   // +2: la foto queda apenas debajo del borde del aro
  return (
    <div style={{ position: 'relative', width: tam, height: tam, flexShrink: 0 }}>
      <div
        style={{
          position: 'absolute', left: (tam - diam) / 2, top: (tam - diam) / 2, width: diam, height: diam,
          borderRadius: '50%', overflow: 'hidden', background: 'rgba(255,255,255,0.25)',
        }}
      >
        <img
          src={fallo ? fallback : fuente}
          alt="Avatar"
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          onError={() => setFallo(true)}
        />
      </div>
      <img
        src={anilloImagen}
        alt=""
        style={{ position: 'absolute', left: 0, top: 0, width: tam, height: tam, pointerEvents: 'none' }}
      />
      {children}
    </div>
  );
}
