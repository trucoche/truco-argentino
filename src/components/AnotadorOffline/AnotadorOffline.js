import React, { useCallback, useEffect, useRef, useState } from 'react';
import './anotador-offline.css';

// Pase 404 — "Anotador de Asado" (Anotador Offline): tablero de truco para anotar a mano en la
// mesa, SIN conexión y SIN iniciar sesión. Dos columnas ("Nosotros" / "Ellos") sobre paño verde
// con marco de madera; cada una lleva su cartel (el nombre se edita tocándolo), los cuadritos
// de a 5 (MALAS 1-15, y BUENAS 16-30 si se juega a 30) y los botones grandes + / −.
// El estado se guarda en localStorage, así que sobrevive a cerrar la pestaña.

const CLAVE = 'tc_anotador_offline_v1';
const BASE = '/assets/images/juego/fosforos/';
// Un PNG por cantidad (1 a 5). "En cruz" usa los palitos parados con el 5.º cruzado en diagonal.
const FRAMES_ELEMENTO = {
  fosforos: [null, '1_fosforo.png', '2_fosforos.png', '3_fosforos.png', '4_fosforos.png', '5_fosforos_cruz.png'],
  cruz: [null, 'cruz_1.png', 'cruz_2.png', 'cruz_3.png', 'cruz_4.png', 'cruz_5.png'],
};
const NOMBRES_BASE = { a: 'Nosotros', b: 'Ellos' };
const ELEMENTOS = [
  { id: 'fosforos', texto: 'Fósforos' },
  { id: 'porotos', texto: 'Porotos' },
  { id: 'cruz', texto: 'En cruz' },
];
const ESTADO_INICIAL = { modo: 15, elemento: 'fosforos', nombres: NOMBRES_BASE, puntos: { a: 0, b: 0 } };

const aEntero = (v, max) => Math.max(0, Math.min(max, Math.round(Number(v) || 0)));

function leerEstado() {
  try {
    const crudo = JSON.parse(localStorage.getItem(CLAVE) || 'null');
    if (!crudo || typeof crudo !== 'object') return ESTADO_INICIAL;
    const modo = crudo.modo === 30 ? 30 : 15;
    return {
      modo,
      elemento: ELEMENTOS.some((e) => e.id === crudo.elemento) ? crudo.elemento : 'fosforos',
      nombres: {
        a: String(crudo.nombres?.a || NOMBRES_BASE.a).slice(0, 14),
        b: String(crudo.nombres?.b || NOMBRES_BASE.b).slice(0, 14),
      },
      puntos: { a: aEntero(crudo.puntos?.a, modo), b: aEntero(crudo.puntos?.b, modo) },
    };
  } catch (e) {
    return ESTADO_INICIAL;
  }
}

// Cantidad de elementos que le tocan a la caja `indice` (0 a 5) con `puntos` en total.
export function elementosEnCaja(puntos, indice) {
  return Math.max(0, Math.min(5, (Number(puntos) || 0) - indice * 5));
}

// ---- Dibujo de cada elemento -------------------------------------------------------------

// Porotos: 5 pocitos en la tablita (4 esquinas + el del medio) y un poroto por punto.
const POCITOS = [[28, 28], [72, 28], [28, 72], [72, 72], [50, 50]];
function CajaPorotos({ n, nuevo }) {
  return (
    <svg viewBox="0 0 100 100" className="ao-svg" aria-hidden="true">
      {POCITOS.map(([x, y], i) => (
        <g key={i}>
          <ellipse cx={x} cy={y} rx="15" ry="14" fill="#2e1b0f" />
          <ellipse cx={x} cy={y + 1.5} rx="13" ry="11.5" fill="#150b05" opacity="0.55" />
          {i < n && (
            <g className={nuevo && i === n - 1 ? 'ao-item-nuevo' : undefined}>
              <ellipse cx={x} cy={y} rx="13.5" ry="10.5" transform={`rotate(${-28 + i * 17} ${x} ${y})`} fill="#f3e6c8" stroke="#6b4a2c" strokeWidth="2.2" />
              <ellipse cx={x - 3.5} cy={y - 3.5} rx="4.5" ry="2.4" transform={`rotate(${-28 + i * 17} ${x} ${y})`} fill="#fffaf0" opacity="0.9" />
              <circle cx={x + 4} cy={y + 2} r="1.8" fill="#9a6a3c" />
            </g>
          )}
        </g>
      ))}
    </svg>
  );
}

// Una caja de 5: se anima SOLO cuando gana elementos (fade-in + escala 1.2 → 1).
function Caja({ elemento, n, retraso = 0 }) {
  const [info, setInfo] = useState({ n, desde: n, version: 0 });
  if (info.n !== n) setInfo({ n, desde: info.n, version: info.version + 1 });
  const sube = n > info.desde;

  return (
    <div className={`ao-caja ao-caja-${elemento}`} role="img" aria-label={`${n} de 5`}>
      {elemento !== 'porotos' && (() => {
        // Un solo dibujo por cuadro (nunca capas apiladas): vacio = cuadrito fantasma; con elementos = el PNG de su cantidad.
        const frames = FRAMES_ELEMENTO[elemento] || FRAMES_ELEMENTO.fosforos;
        return n === 0 ? (
          <img className="ao-img ao-fantasma" src={BASE + frames[4]} alt="" draggable={false} />
        ) : (
          <img
            key={`${n}-${info.version}`}
            className={`ao-img${sube ? ' ao-aparece' : ''}`}
            style={sube ? { animationDelay: `${retraso}ms` } : undefined}
            src={BASE + frames[n]}
            alt=""
            draggable={false}
          />
        );
      })()}
      {elemento === 'porotos' && <CajaPorotos key={`p${info.version}`} n={n} nuevo={sube} />}
    </div>
  );
}

// ---- Sonido -----------------------------------------------------------------------------

// Un grupito de reproductores por sonido, para que dos toques seguidos no se corten entre sí.
function crearPool(url, volumen) {
  try {
    return [0, 1, 2].map(() => {
      const a = new Audio(url);
      a.preload = 'auto';
      a.volume = volumen;
      return a;
    });
  } catch (e) {
    return [];
  }
}
function useSonidos() {
  const pools = useRef({ add: [], remove: [] });
  const idx = useRef({ add: 0, remove: 0 });
  useEffect(() => {
    pools.current = {
      add: crearPool('/assets/sounds/sfx_fosforo_add.mp3', 0.7),
      remove: crearPool('/assets/sounds/sfx_fosforo_remove.mp3', 0.6),
    };
  }, []);
  const sonar = useCallback((clave) => {
    const pool = pools.current[clave] || [];
    if (!pool.length) return;
    const a = pool[idx.current[clave]++ % pool.length];
    try { a.currentTime = 0; const p = a.play(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* sin audio */ }
  }, []);
  return {
    sonarSuma: useCallback(() => sonar('add'), [sonar]),
    sonarResta: useCallback(() => sonar('remove'), [sonar]),
  };
}

// ---- Pantalla ---------------------------------------------------------------------------

function Cartel({ lado, nombre, editando, onEditar, onGuardar }) {
  const ref = useRef(null);
  useEffect(() => { if (editando && ref.current) { ref.current.focus(); ref.current.select(); } }, [editando]);
  const guardar = (e) => onGuardar(lado, e.target.value);
  return (
    <div className="ao-cartel">
      <span className="ao-tacha ao-tacha-i" /><span className="ao-tacha ao-tacha-d" />
      {editando ? (
        <input
          id={`ao-nombre-${lado}`}
          ref={ref}
          className="ao-cartel-input"
          defaultValue={nombre}
          maxLength={14}
          onBlur={guardar}
          onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') { e.target.value = nombre; e.target.blur(); } }}
          aria-label="Nombre del equipo"
        />
      ) : (
        <button type="button" className="ao-cartel-btn" onClick={() => onEditar(lado)} title="Tocá para cambiar el nombre">
          <span className="ao-cartel-texto">{nombre}</span>
          <span className="ao-lapiz" aria-hidden="true">✎</span>
        </button>
      )}
    </div>
  );
}

function SeccionCajas({ titulo, rango, elemento, puntos, desde }) {
  return (
    <section className="ao-seccion">
      {titulo && <div className="ao-seccion-titulo"><b>{titulo}</b><span>{rango}</span></div>}
      <div className="ao-grilla">
        {[0, 1, 2].map((i) => (
          <Caja key={i} elemento={elemento} n={elementosEnCaja(puntos, desde + i)} retraso={i * 200} />
        ))}
      </div>
    </section>
  );
}

function Columna({ lado, estado, editando, onEditar, onGuardar, onMas, onMenos }) {
  const [flash, setFlash] = useState(null);
  const tocarZona = (ev) => {
    const r = ev.currentTarget.getBoundingClientRect();
    const arriba = ev.clientY - r.top < r.height / 2;
    if (arriba && estado.puntos[lado] >= estado.modo) return;
    if (!arriba && estado.puntos[lado] <= 0) return;
    setFlash({ t: arriba ? 'mas' : 'menos', k: Date.now() });
    if (arriba) onMas(lado); else onMenos(lado);
  };
  const puntos = estado.puntos[lado];
  const gano = puntos >= estado.modo;
  const nombre = estado.nombres[lado];
  return (
    <div className={`ao-col${gano ? ' ao-gano' : ''}`}>
      <Cartel lado={lado} nombre={nombre} editando={editando === lado} onEditar={onEditar} onGuardar={onGuardar} />
      <div className="ao-total" aria-live="polite">
        <span className="ao-total-num">{puntos}</span>
        <span className="ao-total-de">/ {estado.modo}</span>
      </div>
      {gano && <div className="ao-gano-cinta">¡Ganó {nombre}!</div>}
      {/* Zonas táctiles invisibles: tocar la mitad de arriba del tablero suma 1; la de abajo, resta 1. */}
      <div className="ao-zona" onClick={tocarZona} title="Arriba: sumar · Abajo: restar">
        <div className="ao-tablero">
          <SeccionCajas titulo="Malas" rango="1 a 15" elemento={estado.elemento} puntos={puntos} desde={0} />
          {estado.modo === 30 && (
            <>
              <div className="ao-cinta" role="separator" aria-label="Desde acá, las buenas">
                <span className="ao-cinta-placa">Buenas 16–30</span>
              </div>
              <SeccionCajas elemento={estado.elemento} puntos={puntos} desde={3} />
            </>
          )}
        </div>
        {flash && <div key={flash.k} className={`ao-flash ao-flash-${flash.t}`} aria-hidden="true" />}
      </div>
      <div className="ao-botones">
        <button type="button" className="ao-btn ao-btn-menos" onClick={() => onMenos(lado)} disabled={puntos <= 0} aria-label={`Restar un punto a ${nombre}`}><span className="ao-ico ao-ico-menos" aria-hidden="true" /></button>
        <button type="button" className="ao-btn ao-btn-mas" onClick={() => onMas(lado)} disabled={gano} aria-label={`Sumar un punto a ${nombre}`}><span className="ao-ico ao-ico-mas" aria-hidden="true" /></button>
      </div>
    </div>
  );
}

export default function AnotadorOffline({ onVolver }) {
  const [estado, setEstado] = useState(leerEstado);
  const [editando, setEditando] = useState(null);
  const [deshacer, setDeshacer] = useState(null); // { mensaje, previo }
  const temporizador = useRef(null);
  const { sonarSuma, sonarResta } = useSonidos();

  useEffect(() => {
    try { localStorage.setItem(CLAVE, JSON.stringify(estado)); } catch (e) { /* sin storage */ }
  }, [estado]);
  useEffect(() => () => clearTimeout(temporizador.current), []);

  const avisarDeshacer = (mensaje, previo) => {
    clearTimeout(temporizador.current);
    setDeshacer({ mensaje, previo });
    temporizador.current = setTimeout(() => setDeshacer(null), 6000);
  };

  const sumar = (lado) => {
    if (estado.puntos[lado] >= estado.modo) return;
    sonarSuma();
    setEstado((e) => ({ ...e, puntos: { ...e.puntos, [lado]: Math.min(e.modo, e.puntos[lado] + 1) } }));
  };
  const restar = (lado) => {
    if (estado.puntos[lado] <= 0) return;
    sonarResta();
    setEstado((e) => ({ ...e, puntos: { ...e.puntos, [lado]: Math.max(0, e.puntos[lado] - 1) } }));
  };

  const limpiar = () => {
    if (estado.puntos.a === 0 && estado.puntos.b === 0) return;
    avisarDeshacer('Tablero limpio', estado);
    setEstado((e) => ({ ...e, puntos: { a: 0, b: 0 } }));
  };
  const cambiarModo = (modo) => {
    if (modo === estado.modo) return;
    const recorta = modo === 15 && (estado.puntos.a > 15 || estado.puntos.b > 15);
    if (recorta) avisarDeshacer('Pasaste a 15: se recortó el puntaje', estado);
    setEstado((e) => ({ ...e, modo, puntos: { a: aEntero(e.puntos.a, modo), b: aEntero(e.puntos.b, modo) } }));
  };
  const guardarNombre = (lado, valor) => {
    const limpio = String(valor || '').trim().slice(0, 14);
    setEstado((e) => ({ ...e, nombres: { ...e.nombres, [lado]: limpio || NOMBRES_BASE[lado] } }));
    setEditando(null);
  };
  const deshacerAccion = () => {
    if (deshacer) setEstado(deshacer.previo);
    clearTimeout(temporizador.current);
    setDeshacer(null);
  };

  const maximo = Math.max(estado.puntos.a, estado.puntos.b);
  const enBuenas = estado.modo === 30 && maximo > 15;

  return (
    <div className="ao-pagina">
      <div className="ao-marco">
        <header className="ao-cabecera">
          <div className="ao-fila-titulo">
            {onVolver && (
              <button type="button" className="ao-volver" onClick={onVolver} aria-label="Volver">←</button>
            )}
            <h1 className="ao-titulo">
              <img src="/assets/images/icono-anotador.png" alt="" className="ao-titulo-icono" />
              Anotador de Asado
            </h1>
            <button type="button" className="ao-limpiar" onClick={limpiar}>Limpiar</button>
          </div>
          <div className="ao-fila-controles">
            <div className={`ao-estado ${enBuenas ? 'ao-estado-buenas' : ''}`} aria-live="polite">
              <span className="ao-estado-fase">{enBuenas ? 'Buenas' : 'Malas'}</span>
              <span className="ao-estado-limite">Límite {estado.modo}</span>
            </div>
            <div className="ao-segmento" role="radiogroup" aria-label="Puntos de la partida">
              {[15, 30].map((m) => (
                <button key={m} type="button" role="radio" aria-checked={estado.modo === m}
                  className={estado.modo === m ? 'ao-seg-activo' : ''} onClick={() => cambiarModo(m)}>A {m}</button>
              ))}
            </div>
            <div className="ao-segmento" role="radiogroup" aria-label="Con qué contar">
              {ELEMENTOS.map((el) => (
                <button key={el.id} type="button" role="radio" aria-checked={estado.elemento === el.id}
                  className={estado.elemento === el.id ? 'ao-seg-activo' : ''}
                  onClick={() => setEstado((e) => ({ ...e, elemento: el.id }))}>{el.texto}</button>
              ))}
            </div>
          </div>
        </header>

        <p className="ao-pista">Tocá arriba de una columna para sumar · abajo para restar</p>

        <main className="ao-cols">
          {['a', 'b'].map((lado) => (
            <Columna
              key={lado}
              lado={lado}
              estado={estado}
              editando={editando}
              onEditar={setEditando}
              onGuardar={guardarNombre}
              onMas={sumar}
              onMenos={restar}
            />
          ))}
        </main>
      </div>

      {deshacer && (
        <div className="ao-toast" role="status">
          <span>{deshacer.mensaje}</span>
          <button type="button" onClick={deshacerAccion}>Deshacer</button>
        </div>
      )}
    </div>
  );
}
