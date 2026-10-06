import React, { useEffect, useState } from 'react';
import './popup-madera.css';

// Pase 325 — sistema unificado de placas y pop-ups de madera (versión web).
// Equivalente a components/PlacaMadera.tsx + PopupMadera.tsx + alertaMadera.tsx de la app nativa.
//
//  • <PlacaMadera>  → placa de caoba con 4 tachas doradas e interior de pergamino (#FFFBEB).
//                     La usan las tarjetas del Perfil y la caja de los pop-ups.
//  • <PopupMadera>  → modal: overlay oscuro con blur, placa central, cinta 3D con el título,
//                     icono central con resplandor, botones píldora 3D y botón X.
//  • mostrarAviso() / confirmarPopup() → versiones imperativas (reemplazan alert/confirm).
//    Hay que montar <AvisoMaderaHost /> una sola vez (App.js) y llamar instalarAlertaMadera().

export function PlacaMadera({ children, style, interiorStyle, colorInterior, className = '', remaches = true, ...resto }) {
  return (
    <div className={`pm-placa ${className}`} style={style} {...resto}>
      {remaches && (
        <>
          <span className="pm-remache tl" />
          <span className="pm-remache tr" />
          <span className="pm-remache bl" />
          <span className="pm-remache br" />
        </>
      )}
      <div className="pm-pergamino" style={{ ...(colorInterior ? { background: colorInterior } : null), ...interiorStyle }}>
        {children}
      </div>
    </div>
  );
}

function Cola({ lado }) {
  // Cola con corte en "V" hacia afuera; la derecha es el espejo de la izquierda.
  const pts = lado === 'izq' ? '27,3 3,3 12,18 3,33 27,33' : '3,3 27,3 18,18 27,33 3,33';
  return (
    <svg className="pm-cola" viewBox="0 0 30 36" aria-hidden="true">
      <polygon points={pts} />
    </svg>
  );
}

export function Cinta({ titulo, cinta = 'dorada' }) {
  const largo = (titulo || '').length;
  const clase = largo > 26 ? 'muylarga' : largo > 15 ? 'larga' : '';
  return (
    <div className={`pm-cinta pm-cinta-${cinta} ${clase}`}>
      <Cola lado="izq" />
      <div className="pm-cinta-cuerpo"><span className="pm-cinta-texto">{titulo}</span></div>
      <Cola lado="der" />
    </div>
  );
}

function BotonX({ onClick }) {
  return (
    <button type="button" className="pm-cerrar" onClick={onClick} aria-label="Cerrar">
      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
        <path d="M2.5 2.5 L11.5 11.5 M11.5 2.5 L2.5 11.5" stroke="#000" strokeWidth="5" strokeLinecap="round" />
        <path d="M2.5 2.5 L11.5 11.5 M11.5 2.5 L2.5 11.5" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
      </svg>
    </button>
  );
}

// botones: [{ texto, onClick, tipo: 'dorado'|'verde'|'carmesi'|'neutro', disabled, contenido }]
export default function PopupMadera({
  visible = true,
  titulo,
  cinta = 'dorada',
  icono,
  emojiIcono,
  tamIcono = 84,
  mensaje,
  children,
  botones = [],
  filaBotones = false,
  onCerrar,
  onFondo,
  anchoMax = 360,
  scroll = false,
  centrado = true,
  absoluto = false,
  colorInterior,
}) {
  useEffect(() => {
    if (!visible || !onCerrar) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') (onFondo || onCerrar)(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible, onCerrar, onFondo]);

  if (!visible) return null;
  const alTocarFondo = onFondo || onCerrar;

  return (
    <div className={`pm-overlay${absoluto ? ' pm-absoluto' : ''}`} onClick={alTocarFondo}>
      <div className="pm-caja" style={{ maxWidth: anchoMax }} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={titulo}>
        {!!titulo && <Cinta titulo={titulo} cinta={cinta} />}
        {onCerrar && <BotonX onClick={onCerrar} />}
        <PlacaMadera colorInterior={colorInterior}>
          {(icono || emojiIcono) && (
            <div className="pm-icono-wrap" style={{ width: tamIcono, height: tamIcono }}>
              <div className="pm-resplandor" />
              {icono ? (
                <img className="pm-icono" src={icono} alt="" style={{ width: tamIcono, height: tamIcono }} />
              ) : (
                <span className="pm-emoji" style={{ fontSize: tamIcono * 0.8 }}>{emojiIcono}</span>
              )}
            </div>
          )}
          {!!mensaje && <p className="pm-mensaje">{mensaje}</p>}
          {children && <div className={`pm-cuerpo${centrado ? ' pm-centrado' : ''}${scroll ? ' pm-scroll' : ''}`}>{children}</div>}
          {botones.length > 0 && (
            <div className={`pm-botones${filaBotones ? ' fila' : ''}`}>
              {botones.map((b, i) => (
                <button
                  key={i}
                  type="button"
                  className={`pm-boton ${b.tipo && b.tipo !== 'dorado' ? b.tipo : ''}`}
                  disabled={b.disabled}
                  onClick={b.onClick}
                >
                  {b.contenido || b.texto}
                </button>
              ))}
            </div>
          )}
        </PlacaMadera>
      </div>
    </div>
  );
}

// ---------------- Avisos imperativos (reemplazan alert / confirm) ----------------
let oyente = null;
const colaPendiente = [];

export function mostrarAviso(opts) {
  if (oyente) oyente(opts);
  else colaPendiente.push(opts);
}

// Devuelve una promesa: true si el usuario aprieta el botón de confirmar, false si cancela/cierra.
export function confirmarPopup({ titulo = 'Confirmar', mensaje, textoSi = 'Aceptar', textoNo = 'Cancelar', cinta = 'dorada', icono, tipoSi = 'verde' }) {
  return new Promise((resolver) => {
    mostrarAviso({
      titulo, mensaje, cinta, icono,
      alCerrar: () => resolver(false),
      botones: [
        { texto: textoSi, tipo: tipoSi, onClick: () => resolver(true) },
        { texto: textoNo, tipo: 'neutro', onClick: () => resolver(false) },
      ],
    });
  });
}

const ES_ERROR = /no se pudo|no pudimos|error|no ten[eé]s|no se complet|fall[oó]|inv[aá]lid|incorrect|no existe|insuficiente/i;

export function instalarAlertaMadera() {
  if (typeof window === 'undefined' || window.__alertaMaderaInstalada) return;
  window.__alertaMaderaInstalada = true;
  window.alert = (mensaje) => {
    const texto = String(mensaje ?? '');
    const error = ES_ERROR.test(texto);
    mostrarAviso({
      titulo: error ? 'Aviso' : '¡Listo!',
      cinta: error ? 'roja' : 'dorada',
      mensaje: texto,
      botones: [{ texto: 'Aceptar', tipo: error ? 'dorado' : 'verde' }],
    });
  };
}

export function AvisoMaderaHost() {
  const [cola, setCola] = useState([]);

  useEffect(() => {
    oyente = (opts) => setCola((c) => [...c, opts]);
    if (colaPendiente.length) {
      const pendientes = colaPendiente.splice(0);
      setCola((c) => [...c, ...pendientes]);
    }
    return () => { oyente = null; };
  }, []);

  const actual = cola[0];
  if (!actual) return null;

  const cerrar = (extra) => {
    setCola((c) => c.slice(1));
    if (extra) extra();
  };

  const botones = (actual.botones && actual.botones.length ? actual.botones : [{ texto: 'Aceptar', tipo: 'verde' }]).map((b) => ({
    ...b,
    onClick: () => cerrar(b.onClick),
  }));

  return (
    <PopupMadera
      visible
      titulo={actual.titulo}
      cinta={actual.cinta}
      icono={actual.icono}
      emojiIcono={actual.emojiIcono}
      mensaje={actual.mensaje}
      botones={botones}
      onCerrar={() => cerrar(actual.alCerrar)}
    />
  );
}
