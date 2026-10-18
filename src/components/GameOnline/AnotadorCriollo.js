import React, { useState } from 'react';
import PopupMadera from '../Popup/PopupMadera';
import './anotador-criollo.css';

// Pase 403 — "Anotador Criollo": el popup de madera que se abre al tocar las placas
// VOS / RIVAL de la mesa. Muestra los cuadritos de fósforos de cada lado, de a 5
// (1 fósforo, "L", "Π", cuadrado, cuadrado con la cruz = 5), primero las MALAS
// (1 a 15) y, si la partida es a 30, las BUENAS (16 a 30).
// Los 5 PNG están en /assets/images/juego/fosforos/. Cuando suma un punto, el fósforo
// nuevo aparece con fade-in + escala 1.2 → 1.0 (la imagen anterior queda debajo).

const BASE = '/assets/images/juego/fosforos/';
const FRAMES = [null, '1_fosforo.png', '2_fosforos.png', '3_fosforos.png', '4_fosforos.png', '5_fosforos_cruz.png'];

// Cantidad de fósforos que le tocan a la caja `indice` (0 a 5) con `puntos` en total.
export function fosforosEnCaja(puntos, indice) {
  return Math.max(0, Math.min(5, (Number(puntos) || 0) - indice * 5));
}

function CajaFosforos({ n, retraso = 0 }) {
  // Se recuerda el valor anterior para animar SOLO cuando la caja gana fósforos
  // (al abrir el popup, o al bajar a 0 en una revancha, no se anima nada).
  const [info, setInfo] = useState({ n, desde: n, version: 0 });
  if (info.n !== n) setInfo({ n, desde: info.n, version: info.version + 1 });
  const sube = n > info.desde;

  return (
    <div className="ac-caja" aria-label={`${n} fósforos`}>
      {/* Un solo dibujo por cuadro (nunca capas apiladas): vacio = cuadrito fantasma; con fosforos = el PNG de su cantidad. */}
      {n === 0 ? (
        <img className="ac-fantasma" src={BASE + FRAMES[4]} alt="" draggable={false} />
      ) : (
        <img
          key={`${n}-${info.version}`}
          className={`ac-fosforos${sube ? ' ac-aparece' : ''}`}
          style={sube ? { animationDelay: `${retraso}ms` } : undefined}
          src={BASE + FRAMES[n]}
          alt=""
          draggable={false}
        />
      )}
    </div>
  );
}

function FilaCajas({ puntos, desde, titulo }) {
  return (
    <div className="ac-bloque">
      <div className="ac-titulo-fila">{titulo}</div>
      <div className="ac-fila">
        {[0, 1, 2].map((i) => (
          <CajaFosforos key={i} n={fosforosEnCaja(puntos, desde + i)} retraso={i * 220} />
        ))}
      </div>
    </div>
  );
}

function Tablita({ nombre, puntos, buenas }) {
  return (
    <div className="ac-tablita">
      <div className="ac-cabecera">
        <span className="ac-nombre">{nombre}</span>
        <span className="ac-puntos">{puntos}</span>
      </div>
      <FilaCajas puntos={puntos} desde={0} titulo="Malas" />
      {buenas && <FilaCajas puntos={puntos} desde={3} titulo="Buenas" />}
    </div>
  );
}

export default function AnotadorCriollo({ visible, onCerrar, yo = 0, rival = 0, objetivo = 15, esEquipos = false }) {
  if (!visible) return null;
  const buenas = Number(objetivo) >= 30 || yo > 15 || rival > 15;
  return (
    <PopupMadera
      visible
      absoluto
      titulo="Anotador Criollo"
      cinta="madera"
      anchoMax={340}
      centrado={false}
      onCerrar={onCerrar}
      botones={[{ texto: 'Cerrar', tipo: 'dorado', onClick: onCerrar }]}
    >
      <Tablita nombre={esEquipos ? 'Nosotros' : 'Vos'} puntos={yo} buenas={buenas} />
      <Tablita nombre={esEquipos ? 'Ellos' : 'Rival'} puntos={rival} buenas={buenas} />
    </PopupMadera>
  );
}
