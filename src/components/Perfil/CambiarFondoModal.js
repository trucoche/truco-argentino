import React, { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { API_URL as BASE_URL } from '../../config';

const API_BASE = `${BASE_URL}/api`;

const C = {
  dorado: '#FFB627', doradoClaro: '#FFD668', doradoOscuro: '#C9860E',
  crema: '#FFF8ED', chocolate: '#4A2C2A',
  crimson: '#E8483A'
};

const COSTO_FONDO = 20;
// Relación ancho/alto del recorte — banner horizontal (va detrás de toda
// la tarjeta de encabezado del Perfil, mucho más ancha que alta).
const ASPECTO_RECORTE = 3 / 1;

// Centésimo pase: primera pantalla de "comprar" un cosmético real (no un
// placeholder como "Comprar" en la Tienda) — acá SÍ se descuentan monedas
// de verdad al aceptar. Requiere el paquete `react-easy-crop` (correr
// `npm install react-easy-crop` en este repo antes de probar esto — no
// existía ninguna librería de recorte de imagen en el proyecto todavía).
function crearImagenElement(url) {
  return new Promise((resolve, reject) => {
    const imagen = new Image();
    imagen.addEventListener('load', () => resolve(imagen));
    imagen.addEventListener('error', (err) => reject(err));
    imagen.setAttribute('crossOrigin', 'anonymous');
    imagen.src = url;
  });
}

async function recortarImagen(imagenSrc, areaRecortadaPx) {
  const imagen = await crearImagenElement(imagenSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = areaRecortadaPx.width;
  canvas.height = areaRecortadaPx.height;
  ctx.drawImage(
    imagen,
    areaRecortadaPx.x, areaRecortadaPx.y, areaRecortadaPx.width, areaRecortadaPx.height,
    0, 0, areaRecortadaPx.width, areaRecortadaPx.height
  );
  return canvas.toDataURL('image/jpeg', 0.88);
}

export default function CambiarFondoModal({ token, saldoActual, onCerrar, onFondoActualizado }) {
  const [archivoSrc, setArchivoSrc] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [areaRecortadaPx, setAreaRecortadaPx] = useState(null);
  const [aceptaNormas, setAceptaNormas] = useState(false);
  const [aceptaCosto, setAceptaCosto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  const onCropComplete = useCallback((_areaRecortada, areaRecortadaPxNueva) => {
    setAreaRecortadaPx(areaRecortadaPxNueva);
  }, []);

  const elegirArchivo = (e) => {
    const archivo = e.target.files?.[0];
    if (!archivo) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(archivo.type)) {
      setError('Elegí una imagen PNG, JPG o WEBP');
      return;
    }
    if (archivo.size > 8 * 1024 * 1024) {
      setError('La imagen es demasiado pesada (máximo 8MB)');
      return;
    }
    setError('');
    const reader = new FileReader();
    reader.onload = () => setArchivoSrc(reader.result);
    reader.readAsDataURL(archivo);
  };

  const puedeAceptar = archivoSrc && areaRecortadaPx && aceptaNormas && aceptaCosto && !enviando;
  const saldoInsuficiente = Math.round(Number(saldoActual) || 0) < COSTO_FONDO;

  const confirmar = async () => {
    if (!puedeAceptar) return;
    setEnviando(true);
    setError('');
    try {
      const imagenRecortada = await recortarImagen(archivoSrc, areaRecortadaPx);
      const res = await fetch(`${API_BASE}/usuarios/fondo-perfil`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ imagen: imagenRecortada })
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'No se pudo cambiar el fondo');
        return;
      }

      if (onFondoActualizado) onFondoActualizado(data.fondo_perfil_url);
      onCerrar();
    } catch (err) {
      console.error('Error cambiando fondo de perfil:', err);
      setError('No se pudo conectar con el servidor');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div style={estilos.overlay} onClick={onCerrar}>
      <div style={estilos.modal} onClick={(e) => e.stopPropagation()}>
        <div style={estilos.header}>
          <div style={estilos.titulo}>Cambiar fondo de perfil</div>
          <button style={estilos.btnCerrar} onClick={onCerrar} title="Cerrar">✕</button>
        </div>

        {!archivoSrc ? (
          <label style={estilos.elegirArchivo}>
            <span style={estilos.elegirArchivoIcono}>🖼️</span>
            <span>Elegí una foto de tu dispositivo</span>
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={elegirArchivo} style={{ display: 'none' }} />
          </label>
        ) : (
          <div style={estilos.cropArea}>
            <Cropper
              image={archivoSrc}
              crop={crop}
              zoom={zoom}
              aspect={ASPECTO_RECORTE}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          </div>
        )}

        {archivoSrc && (
          <div style={estilos.zoomFila}>
            <span style={estilos.zoomLabel}>🔍</span>
            <input
              type="range" min={1} max={3} step={0.05} value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              style={estilos.zoomSlider}
            />
          </div>
        )}

        {error && <div style={estilos.errorBox}>{error}</div>}
        {saldoInsuficiente && !error && (
          <div style={estilos.errorBox}>No te alcanzan las monedas — te faltan {COSTO_FONDO - Math.round(Number(saldoActual) || 0)}.</div>
        )}

        <div style={estilos.terminos}>
          <div style={estilos.terminosTitulo}>Debés aceptar estos términos antes de continuar:</div>
          <label style={estilos.checkFila}>
            <input type="checkbox" checked={aceptaNormas} onChange={(e) => setAceptaNormas(e.target.checked)} />
            <span>No infringe las normas: no se permite pornografía, fotos ofensivas, desagradables, ni discursos de odio. Entiendo que mi cuenta será suspendida en caso contrario.</span>
          </label>
          <label style={estilos.checkFila}>
            <input type="checkbox" checked={aceptaCosto} onChange={(e) => setAceptaCosto(e.target.checked)} />
            <span>Acepto que se me descontarán <strong>{COSTO_FONDO} monedas</strong> por cambiar mi fondo.</span>
          </label>
        </div>

        <div style={estilos.botonera}>
          <button style={estilos.btnCancelar} onClick={onCerrar}>Cancelar</button>
          <button
            style={{ ...estilos.btnAceptar, ...(!puedeAceptar || saldoInsuficiente ? estilos.btnAceptarDisabled : {}) }}
            onClick={confirmar}
            disabled={!puedeAceptar || saldoInsuficiente}
          >
            {enviando ? 'Guardando...' : (
              <>
                Aceptar <img src="/assets/images/moneda.png" alt="" style={estilos.monedaIcono} /> {COSTO_FONDO}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

const estilos = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000, padding: 16
  },
  modal: {
    background: C.crema, border: `4px solid ${C.chocolate}`, borderRadius: 20,
    boxShadow: '0 8px 0 rgba(0,0,0,0.3)', padding: '18px 20px 20px',
    width: '100%', maxWidth: 460, maxHeight: '92vh', overflowY: 'auto'
  },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  titulo: { fontFamily: "'Fredoka', sans-serif", fontWeight: 700, fontSize: 19, color: C.chocolate },
  btnCerrar: {
    width: 30, height: 30, borderRadius: 8, border: `2px solid ${C.chocolate}`,
    background: '#fff', color: C.chocolate, fontWeight: 800, cursor: 'pointer'
  },
  elegirArchivo: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    gap: 8, height: 200, border: `3px dashed ${C.chocolate}55`, borderRadius: 14,
    background: '#fff', color: '#7a6660', fontWeight: 700, fontSize: 14,
    cursor: 'pointer', textAlign: 'center', padding: 16
  },
  elegirArchivoIcono: { fontSize: 32 },
  cropArea: {
    position: 'relative', width: '100%', height: 220,
    borderRadius: 14, overflow: 'hidden', border: `2px solid ${C.chocolate}`,
    background: '#222'
  },
  zoomFila: { display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 },
  zoomLabel: { fontSize: 14 },
  zoomSlider: { flex: 1 },
  errorBox: {
    background: '#ffe0dd', border: `2px solid ${C.crimson}`, color: '#c2352a',
    borderRadius: 10, padding: '8px 10px', marginTop: 12, fontWeight: 700, fontSize: 12.5
  },
  terminos: { marginTop: 16 },
  terminosTitulo: { fontWeight: 700, fontSize: 13, color: C.chocolate, marginBottom: 8 },
  checkFila: {
    display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8,
    fontSize: 12, color: '#5a4a45', lineHeight: 1.4, cursor: 'pointer'
  },
  botonera: { display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 },
  btnCancelar: {
    fontFamily: "'Fredoka', sans-serif", fontWeight: 600, fontSize: 14,
    background: '#fff', color: C.chocolate, border: `2px solid ${C.chocolate}`,
    borderRadius: 10, padding: '9px 16px', cursor: 'pointer'
  },
  btnAceptar: {
    fontFamily: "'Fredoka', sans-serif", fontWeight: 700, fontSize: 14,
    background: `linear-gradient(180deg, ${C.doradoClaro}, ${C.dorado})`, color: C.chocolate,
    border: `2px solid ${C.chocolate}`, borderRadius: 10, padding: '9px 18px',
    boxShadow: `0 3px 0 ${C.doradoOscuro}`, cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: 6
  },
  btnAceptarDisabled: {
    background: '#ccc', color: '#888', border: '2px solid #999', boxShadow: 'none', cursor: 'not-allowed'
  },
  monedaIcono: { width: 16, height: 16, objectFit: 'contain' },
};