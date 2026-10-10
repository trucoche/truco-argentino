import React, { useState } from 'react';
import { API_URL } from '../../config';
import { PlacaMadera } from '../Popup/PopupMadera';

const C = {
  verde: '#2D9B4F', verdeOscuro: '#1f7a3c',
  // Ducentésimo trigésimo primer pase: variantes "vibrante" agregadas para
  // el botón de precio de los dos packs destacados (Mejor Valor/
  // Inauguración) — pedido explícito del usuario en su brief de rediseño
  // ("verde más vibrante", "rojo fuerte"). Los tonos base (`verde`/
  // `crimson`) siguen usándose para el marco del cartelito y el resto de
  // la paleta, sin cambios.
  verdeVibrante: '#3DDD6B',
  crimson: '#E8483A', crimsonOscuro: '#c2352a', crimsonVibrante: '#FF4433',
  dorado: '#FFB627', doradoClaro: '#FFD668', doradoOscuro: '#C9860E',
  celeste: '#4FB3E8', celesteOscuro: '#2f8dbf',
  crema: '#FFF8ED', chocolate: '#4A2C2A',
  cremaSutil: '#FFFCF6'
};

// Centésimo décimo noveno pase: rediseño completo de las tarjetas de la
// tienda sobre los 3 cartelitos de madera colgante que pasó el usuario
// (blanco/base, verde y rojo — el azul queda afuera por ahora, según lo
// pidió explícitamente). Cada tarjeta ahora ES la imagen del cartelito de
// fondo (reemplaza el fondo plano + cinta diagonal que había antes) con el
// contenido superpuesto en las dos zonas que el propio dibujo deja en
// blanco: el letrero chico de arriba (nombre corto del pack) y el panel
// grande de abajo (ilustración + cantidad + precio). Confirmado con el
// usuario:
//  - Los 4 packs sin tag (400/200/100/50) usan el cartelito BASE y su
//    letrero pasa a mostrar directamente la cantidad total de monedas
//    ("500 Monedas", "200 Monedas", etc. — la opción "cantidad directa"
//    que el propio usuario dejó como alternativa en su brief).
//  - El brillo animado (pulso de sombra dorado/crimson) que tenían las
//    tarjetas destacada/inauguración se retira: el marco de color pintado
//    en el cartelito ya cumple esa función, un brillo extra por fuera
//    quedaba recargado sobre la ilustración de madera.
//  - Ya no hay un botón "Comprar" separado abajo de la tarjeta — el precio
//    final (el elemento de mayor contraste, como pide el brief) ES el
//    botón: se le da forma de píldora clickeable con el mismo criterio de
//    color que antes tenía el botón (dorado en los packs base, verde en
//    Mejor Valor, rojo en Inauguración).
// La tarjeta pasa a tener proporción cuadrada (aspectRatio 1/1, igual que
// el PNG del cartelito, 500x500) en vez de la altura variable de antes —
// es una consecuencia directa de usar el dibujo como fondo real de la
// tarjeta en vez de un rectángulo de color.
// Centésimo vigésimo octavo pase: el usuario pasó un diseño nuevo de
// cartelito — mismos 4 colores (base/verde/rojo/azul, el azul sigue sin
// usarse todavía) pero SIN el remate de madera curva de arriba: ahora es
// una placa colgante con un letrerito RECTANGULAR (no una cinta curva), lo
// que deja mucho más ordenada la zona de arriba para el nombre del pack.
// Mismos nombres de archivo que antes (se sobreescriben los PNGs, no hace
// falta tocar este mapa).
const CONTORNO_TEXTO = '-1.5px -1.5px 0 #000, 0 -1.5px 0 #000, 1.5px -1.5px 0 #000, -1.5px 0 0 #000, 1.5px 0 0 #000, -1.5px 1.5px 0 #000, 0 1.5px 0 #000, 1.5px 1.5px 0 #000';

const CARTELES = {
  base: '/assets/images/cartelito-madera.png',
  verde: '/assets/images/cartelito-madera-verde.png',
  rojo: '/assets/images/cartelito-madera-rojo.png',
};

// Nonagésimo primer pase: primera versión de la tienda de monedas — el
// usuario pasó como referencia la vidriera de otro juego similar (5 packs,
// bono extra en los dos más grandes, precio final ya con descuento) y
// pidió que acá salga "un poco más barato" cada pack. Se armaron precios
// nuevos, no una copia de los de referencia, calculados para quedar
// ~10-20% por debajo pack por pack (ver detalle en estado-proyecto.md).
// Todavía NO hay pasarela de pago conectada — Mercado Pago está anotado
// como tarea aparte para más adelante — así que por ahora "Comprar" es un
// placeholder que avisa que está en camino, no cobra nada real.
// Nonagésimo quinto pase: pack de inauguración — edición limitada, a un
// precio de lanzamiento bien por debajo del resto (mismos 100 monedas que
// `pack-100`, pero a $990 en vez de $2.800, ~65% más barato) para dar un
// empujón fuerte a las primeras compras. Va primero en la lista (la
// promoción más notoria, mismo criterio que ya usaba `pack-800` con
// "Mejor precio") y usa el color crimson de la paleta en vez de dorado/
// celeste, para que se distinga a simple vista del resto como algo
// temporal. `notaEspecial` reusa el espacio visual que en los demás packs
// ocupa el tag de bono (acá no hay bono, el pack en sí YA es la oferta).
// Nonagésimo noveno pase: reemplazo de la moneda genérica única por un
// ícono propio por pack (6 PNGs provistos por el usuario) — los 3 packs
// con tag de color usan la imagen que combina con ese mismo color
// (inauguracion=crimson, mejorPrecio=dorado, popular=celeste) y los 3
// packs sin tag usan una imagen que escala visualmente con el tamaño del
// pack (cofre grande → 400, cofre chico → 100, pila de monedas → 50).
// Centésimo pase: el usuario corrigió el mapeo — la imagen que había
// quedado en pack-100 (cofre con monedas "TC" grabadas) va en pack-800
// (que se muestra como "1000 monedas", 800+200 de bono), y viceversa. Los
// nombres de archivo (`moneda-800.png`/`moneda-100.png`) quedaron con el
// nombre viejo por simplicidad — lo que cambió es qué pack apunta a cuál.
// Centésimo décimo cuarto pase: rediseño pedido por el usuario (lista de 7
// puntos) — de los dos tags "destacados" que había (mejorPrecio/pack-800 y
// popular/pack-200), se deja UNO solo como héroe (pack-800, consultado con
// el usuario: es matemáticamente el mejor precio por moneda de todo el
// catálogo — $16,8 cada moneda vs. $30 del pack más chico) y se retira el
// tag "popular" de pack-200 (queda con el tratamiento neutro del resto,
// "más discreto" como se pidió) — así solo un pack compite por atención.
// `precioOriginal` es el precio tachado de arriba: se calcula con el mismo
// criterio en todos — el precio por moneda del pack más chico (pack-50,
// $1.500/50 = $30/moneda) como "precio de lista", excepto en el pack de
// inauguración, que ya tenía un ancla real y más ajustada (el precio actual
// de pack-100 por la misma cantidad, $2.800) — no son descuentos
// inventados, son comparaciones reales contra otro precio que ya existe en
// esta misma tienda. (Mismo criterio y mismos valores que la versión
// nativa, ver tienda.tsx).
// Centésimo décimo noveno pase: se agrega `nombrePack` (texto del letrero
// de madera) y `tipoCartel` (qué PNG de fondo usa cada tarjeta) a cada
// pack.
const PACKS = [
  { id: 'pack-inauguracion', monedas: 100, bono: 0, precio: 990, precioOriginal: 2800, tag: 'inauguracion', nombrePack: 'Inauguración', tipoCartel: 'rojo', notaEspecial: null, icono: '/assets/images/moneda-inauguracion.png' },
  { id: 'pack-800', monedas: 800, bono: 200, precio: 16800, precioOriginal: 30000, tag: 'mejorPrecio', nombrePack: 'Mejor Valor', tipoCartel: 'verde', icono: '/assets/images/moneda-100.png' },
  { id: 'pack-400', monedas: 400, bono: 100, precio: 9500, precioOriginal: 15000, nombrePack: '500 Monedas', tipoCartel: 'base', icono: '/assets/images/moneda-400.png' },
  { id: 'pack-200', monedas: 200, bono: 0, precio: 5000, precioOriginal: 6000, nombrePack: '200 Monedas', tipoCartel: 'base', icono: '/assets/images/moneda-200.png' },
  { id: 'pack-100', monedas: 100, bono: 0, precio: 2800, precioOriginal: 3000, nombrePack: '100 Monedas', tipoCartel: 'base', icono: '/assets/images/moneda-800.png' },
  { id: 'pack-50', monedas: 50, bono: 0, precio: 1500, precioOriginal: null, nombrePack: '50 Monedas', tipoCartel: 'base', icono: '/assets/images/moneda-50.png' },
];

function formatearPrecio(n) {
  return '$' + n.toLocaleString('es-AR');
}

export default function Tienda({ usuario, token }) {
  // Pase 219: reemplaza el placeholder "todavía no está conectado el pago"
  // por la integración real con Mercado Pago (Checkout Pro) — el backend
  // arma la preferencia (ver routes/pagos.js) y acá simplemente se manda al
  // usuario a esa URL de pago. `comprandoPackId` deshabilita SOLO el botón
  // del pack que se está por comprar (no toda la tienda), para que no se
  // pueda hacer doble click y disparar dos preferencias para el mismo pack.
  const [avisoVisible, setAvisoVisible] = useState(false);
  const [mensajeAviso, setMensajeAviso] = useState('');
  const [comprandoPackId, setComprandoPackId] = useState(null);

  const comprar = async (packId) => {
    if (comprandoPackId) return;
    setComprandoPackId(packId);
    try {
      const res = await fetch(`${API_URL}/api/pagos/crear-preferencia`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ packId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMensajeAviso(data.error || 'No se pudo iniciar el pago. Probá de nuevo en un momento.');
        setAvisoVisible(true);
        setComprandoPackId(null);
        return;
      }
      // Pase 220 — se guarda el saldo actual ANTES de mandar al usuario a
      // Mercado Pago. El webhook que acredita las monedas es asíncrono y
      // puede llegar después de que el navegador ya volvió del checkout;
      // App.js usa este valor como referencia para saber si ya se acreditó
      // o si todavía hay que esperar un poco (ver Pase 220 en App.js).
      localStorage.setItem('truco_saldo_antes_de_pagar', String(usuario?.saldo ?? ''));

      // `sandboxInitPoint` solo viene con credenciales de PRUEBA — con las
      // credenciales productivas de verdad, el backend no lo manda y acá
      // se cae directo a `initPoint`.
      window.location.href = data.sandboxInitPoint || data.initPoint;
    } catch (err) {
      console.error('Error iniciando compra:', err);
      setMensajeAviso('No se pudo conectar con el servidor. Probá de nuevo en un momento.');
      setAvisoVisible(true);
      setComprandoPackId(null);
    }
  };

  // Ducentésimo trigésimo primer pase: rediseño de vidriera pedido por el
  // usuario (brief detallado tipo Clash Royale) — se extrae el renderizado
  // de cada tarjeta a esta función (antes vivía inline dentro de un solo
  // `.map()`) porque ahora se arma en DOS filas fijas en vez de una grilla
  // `auto-fill` (ver `estilos.fila`/`tc-fila` y el `<style>` inyectado al
  // final del archivo): fila de arriba = Inauguración | Mejor Valor | 500
  // Monedas, fila de abajo = 200 | 100 | 50 — mismo orden que ya tenía
  // `PACKS`, no hizo falta reordenar el array. `Mejor Valor` (única con
  // `tag==='mejorPrecio'`) recibe la clase `tc-card-hero` — esa clase le
  // da ~18% más ancho DENTRO de su fila (`flex-grow` más alto, ver el
  // CSS) — como la tarjeta es cuadrada (`aspectRatio:'1/1'`), crece en
  // ancho Y alto a la vez, y al ser más alta que sus compañeras de fila
  // con `align-items:'flex-end'` en el contenedor, sobresale hacia arriba
  // (efecto "héroe"). Las zonas internas (`zonaNombre`/`zonaContenido`/
  // `zonaPrecio`) siguen siendo porcentajes de la propia tarjeta, así que
  // escalan solas sin necesitar ningún ajuste especial para el pack más
  // grande.
  // Ducentésimo trigésimo segundo pase: segunda revisión del usuario — "al
  // poner el Mejor Valor más grande y centrado, los packs de los costados
  // (Inauguración y 500) se ven desbalanceados" — se agrega un tercer nivel
  // intermedio, `tc-card-secundario` (~9% más ancho que los normales, menos
  // que el héroe), SOLO para las 2 compañeras de fila del héroe. `fila`
  // (1 o 2) es lo que decide si un pack sin tag usa `tc-card-secundario`
  // (fila 1: Inauguración/500) o `tc-card-normal` (fila 2: 200/100/50).
  // Ducentésimo trigésimo tercer pase: `descuentoPct` — el % real de rebaja
  // (calculado contra el propio `precioOriginal` del pack, no inventado) que
  // ahora se muestra como etiqueta en la tarjeta de Inauguración en vez de
  // repetirse en el banner de texto de arriba (ver `ribbonDescuento` más
  // abajo, y el punto 1 del brief del usuario: "esa información de
  // descuento debe estar integrada dentro del banner/tarjeta de la oferta
  // mediante etiquetas, ej. '-65%'").
  const renderPack = (pack, fila) => {
    const total = pack.monedas + pack.bono;
    const destacado = pack.tag === 'mejorPrecio';
    const inauguracion = pack.tag === 'inauguracion';
    const descuentoPct = pack.precioOriginal ? Math.round((1 - pack.precio / pack.precioOriginal) * 100) : null;
    const claseTamano = destacado ? 'tc-card-hero' : fila === 1 ? 'tc-card-secundario' : 'tc-card-normal';
    return (
      <div
        key={pack.id}
        className={`tc-card ${claseTamano} tc-card-${pack.id}`}
        style={estilos.card}
      >
        {/* Badge extra pedido por el usuario ("debe tener un badge claro:
            Mejor Valor o Mejor precio por moneda") además del nombre que ya
            muestra el letrero de madera — se agrega como una píldora
            flotando por ENCIMA del cartelito (top negativo) para no tocar
            ninguna de las zonas ya medidas a pixel. */}
        {destacado && (
          <div style={estilos.badgeHero}>⭐ MEJOR PRECIO POR MONEDA</div>
        )}
        {/* Ducentésimo trigésimo tercer pase: cinta diagonal de descuento,
            SOLO en la tarjeta de Inauguración — reemplaza al banner de texto
            que estaba arriba de todo el panel (ver el JSX del `return`
            principal más abajo, ya no existe). */}
        {/* Pase 364: el listón diagonal pasa a ser una píldora flotante igual a la de Mejor Valor, en rojo. */}
        {inauguracion && descuentoPct != null && (
          <div style={estilos.badgeInauguracion}>🔥 -{descuentoPct}% OFF</div>
        )}
        <img src={CARTELES[pack.tipoCartel]} alt="" style={estilos.cartelFondo} />

        {/* Centésimo trigésimo pase: el usuario pidió centrar mejor
            el texto del letrero en TODAS las tarjetas salvo la de
            Inauguración (esa ya se ve bien, y de hecho sobra lugar
            para agrandarla un poco — el cartelito rojo tiene más
            aire libre arriba del texto que el resto de los
            colores). */}
        <div style={{
          ...estilos.zonaNombre,
          color: pack.tipoCartel === 'base' ? C.chocolate : '#fff',
          ...(inauguracion ? estilos.zonaNombreTextoGrande : null),
        }}>
          {pack.nombrePack}
        </div>

        {/* Centésimo trigésimo tercer pase: `zonaContenido` y
            `zonaPrecio` vuelven a ser UN SOLO bloque (el pase 129
            las había separado en 2 cajas fijas con un hueco fijo
            entre ellas — eso fue lo que generó el "espacio de más"
            que reportó el usuario en Inauguración/100/200, porque
            ese hueco es SIEMPRE el mismo tamaño sin importar cuánto
            contenido tenga cada pack). Con un solo bloque
            `justifyContent:'center'` y una caja bien grande (ver
            `zonaContenido` más abajo), el contenido se centra solo
            según lo que tenga cada pack — ni deja hueco de más en
            los packs livianos (Inauguración/100/200/50), ni se
            desborda en el pack más cargado (Mejor Valor, con badge
            Y precio tachado). */}
        <div style={estilos.zonaContenido}>
          <img
            src={pack.icono}
            alt=""
            style={pack.id === 'pack-200' || pack.id === 'pack-100' ? estilos.iconoGrande : estilos.icono}
          />
          {/* Centésimo vigésimo octavo pase: cantidad + "monedas"
              agrupados en su propio div, sin espacio entre ellos —
              el `gap` de `zonaContenido` (el padre) separa GRUPOS
              (ícono / este par / badge / precio), no cada línea
              suelta, para que el número y su etiqueta se sigan
              leyendo pegados. */}
          <div style={estilos.cantidadGrupo}>
            <div style={estilos.cantidad}>{total.toLocaleString('es-AR')}</div>
            <div style={estilos.cantidadLabel}>monedas</div>
          </div>

          {pack.bono > 0 ? (
            <div style={estilos.bonoTag}>+{pack.bono} de regalo</div>
          ) : pack.notaEspecial ? (
            <div style={estilos.notaEspecialTag}>{pack.notaEspecial}</div>
          ) : null}

          <div style={estilos.zonaPrecio}>
            {pack.precioOriginal != null ? (
              <div style={estilos.precioOriginal}>{formatearPrecio(pack.precioOriginal)}</div>
            ) : (
              // Centésimo trigésimo cuarto pase: "50 Monedas" es el
              // ÚNICO pack sin `precioOriginal` — con todo centrado
              // en un solo bloque (pase 133), eso lo hace más corto
              // que los demás y su botón terminaba un poco más
              // arriba que el resto ("como referencia... la
              // tarjeta de Mejor Valor" quedó bien). Un placeholder
              // invisible (mismo tamaño que el texto real, pero sin
              // mostrarse) ocupa el mismo lugar sin agregar texto
              // fantasma, así el botón cae a la misma altura que
              // en las demás tarjetas.
              <div style={{ ...estilos.precioOriginal, visibility: 'hidden' }}>$0</div>
            )}
            <button
              className="tc-precio-boton"
              style={{
                ...estilos.precioBoton,
                ...(destacado ? estilos.precioBotonVerde : inauguracion ? estilos.precioBotonRojo : estilos.precioBotonDorado),
                // Ducentésimo trigésimo séptimo pase: el usuario reportó que
                // al comprar un pack, TODOS los botones de las demás tarjetas
                // se transparentaban también (no solo el que se está
                // comprando). La comparación estaba mal: usaba el valor
                // truthy de `comprandoPackId` en vez de compararlo contra
                // `pack.id` de esta tarjeta puntual — se corrige para que
                // solo se atenúe el botón del pack que realmente se compra.
                ...(comprandoPackId === pack.id ? estilos.precioBotonDeshabilitado : null),
              }}
              disabled={comprandoPackId === pack.id}
              onClick={() => comprar(pack.id)}
            >
              {comprandoPackId === pack.id ? 'Redirigiendo…' : formatearPrecio(pack.precio)}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <div style={estilos.sectionTitle}>
        {/* Pase 366: la bolsita de monedas del pack de 100 reemplaza al 🛒. */}
        <img src="/assets/images/moneda-800.png" alt="" style={estilos.sectionTitleIcono} />
        Comprá monedas
      </div>
      <div style={estilos.sectionSubtitle}>Se acreditan al instante en tu cuenta</div>

      {/* Ducentésimo trigésimo tercer pase: se retira el banner rojo de
          texto que iba acá ("🔥 Pack Inauguración: $990 en vez de $2.800 —
          edición limitada") — el usuario lo marcó como "exceso de texto
          descriptivo e informativo" redundante con la propia tarjeta. Ese
          mismo descuento ahora se muestra como una etiqueta "-65% OFF"
          integrada en la tarjeta de Inauguración (ver `ribbonDescuento` en
          `renderPack`), no como un cartel aparte. */}

      {avisoVisible && (
        <div style={estilos.aviso}>
          <span>⚠️ {mensajeAviso}</span>
          <button style={estilos.avisoCerrar} onClick={() => setAvisoVisible(false)} title="Cerrar">✕</button>
        </div>
      )}

      {/* Pase 364: el panel de packs usa el marco de madera con remaches del resto del juego (antes un borde marrón liso). */}
      <PlacaMadera interiorStyle={estilos.panelInterior}>
        {/* Centésimo trigésimo cuarto pase: el usuario pidió sacar "Tu
            saldo actual" de la Tienda WEB (el saldo ya se ve en el
            header/topbar general de la app) y aprovechar ese espacio para
            centrar y agrandar un poco las tarjetas — SOLO en web, en
            nativo se mantiene (pedido explícito: "en el nativo no saquemos
            el texto de saldo actual"). */}
        {/* Ducentésimo trigésimo primer pase: la grilla `auto-fill` de una
            sola pieza se reemplaza por DOS filas fijas (mismo criterio que
            ya usaba nativo desde el pase 127, ver tienda.tsx) — es lo que
            permite que la fila de arriba tenga un pack más grande que sus
            compañeras sin afectar el tamaño de la fila de abajo. En mobile
            (`@media max-width:680px` en el `<style>` de más abajo) cada
            fila pasa a apilarse en columna y las tarjetas ocupan el ancho
            completo — el pedido explícito del usuario de "lista vertical,
            no una sola tarjeta con dots". */}
        <div className="tc-filas" style={estilos.filas}>
          <div className="tc-fila" style={estilos.fila}>
            {PACKS.slice(0, 3).map((pack) => renderPack(pack, 1))}
          </div>
          {/* Ducentésimo trigésimo octavo pase: clase extra `tc-fila-inferior`
              (ver el CSS inyectado al final del archivo) — el usuario notó
              que esta fila se ve "más separada y con más aire" que la de
              arriba; como sus 3 tarjetas son todas del mismo tamaño chico
              (`tc-card-normal`), el mismo gap de 14px en px absolutos pesa
              proporcionalmente más que en la fila de arriba (con tarjetas
              más grandes) — se achica un poco solo para esta fila. */}
          <div className="tc-fila tc-fila-inferior" style={estilos.fila}>
            {PACKS.slice(3, 6).map((pack) => renderPack(pack, 2))}
          </div>
        </div>
      </PlacaMadera>

      {/* Ducentésimo trigésimo octavo pase: "el texto legal sigue siendo
          bastante largo y se lee con dificultad" — se parte en 2 líneas
          más cortas (en el guion medio, un corte natural de la oración) en
          vez de un solo párrafo largo, y se achica/atenúa un poco más
          (ver `estilos.notaPie`). */}
      <div style={estilos.notaPie}>
        Las monedas son de uso exclusivo dentro de TrucoChe (mesas, torneos y futuros cosméticos)
        <br />
        No representan dinero real y no se pueden retirar ni transferir.
      </div>
    </>
  );
}

const estilos = {
  sectionTitle: { fontFamily: "'Fredoka', sans-serif", fontWeight: 600, fontSize: 16, color: C.crema, margin: '4px 0 2px 4px', display: 'flex', alignItems: 'center', gap: 8 },
  sectionTitleIcono: { width: 30, height: 30, objectFit: 'contain', flexShrink: 0 },
  // Mismo criterio que el subtítulo agregado en Ranking.js — la tienda
  // tampoco tenía ninguna bajada de línea, solo el título suelto.
  sectionSubtitle: { fontSize: 12.5, color: 'rgba(255,248,237,0.75)', fontWeight: 700, margin: '0 0 10px 4px' },
  aviso: {
    display: 'flex', alignItems: 'center', gap: 10,
    background: C.doradoClaro, border: `2px solid ${C.doradoOscuro}`, color: C.chocolate,
    borderRadius: 12, padding: '10px 12px', marginBottom: 12, fontWeight: 700, fontSize: 13,
    boxShadow: '0 3px 0 rgba(0,0,0,0.12)'
  },
  avisoCerrar: {
    marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer',
    fontSize: 14, fontWeight: 800, color: C.chocolate, flexShrink: 0, padding: 4
  },
  // Ducentésimo trigésimo tercer pase: el fondo crema plano se reemplaza
  // por la textura de fieltro/madera oscura que pasó el usuario ("el fondo
  // crema... apaga el estilo gaucho/taberna que venimos trabajando con
  // madera y cuero") — mismo marco chocolate y misma sombra de antes,
  // `backgroundColor` queda como color de respaldo mientras carga la
  // imagen (tono oscuro de la propia textura, no crema).
  // Pase 364: el marco lo pone <PlacaMadera>; acá queda solo el hueco con el paño verde (fieltro) de siempre.
  panelInterior: {
    backgroundImage: 'url(/assets/images/fondo-panel-tienda.jpg)',
    backgroundSize: 'cover', backgroundPosition: 'center', backgroundColor: '#1f3d2c',
    padding: '26px 18px 20px',
    boxShadow: 'inset 0 4px 14px rgba(0,0,0,0.55), inset 0 -3px 10px rgba(0,0,0,0.35), inset 0 0 0 2px rgba(0,0,0,0.25)',
  },
  // Centésimo trigésimo cuarto pase: `saldoActual`/`saldoIcono` (el
  // "Tu saldo actual: X" que iba acá) sacados — el usuario pidió
  // eliminarlo en la web (ya se ve en el header general de la app) para
  // ganar espacio vertical y centrar/agrandar un poco las tarjetas.
  // Centésimo vigésimo pase: 190→230px de mínimo. Centésimo vigésimo
  // primer pase: 230→280px. Centésimo vigésimo segundo pase: 280→330px.
  // Centésimo vigésimo tercer pase: 330→380px. Centésimo vigésimo cuarto
  // pase: el usuario avisó que esta última se pasó de grande — 380→345px.
  // Centésimo vigésimo sexto pase: el usuario avisó que 345 TODAVÍA se
  // sentía "muy grande" — como ningún tamaño entre 280 y 330 llegó a
  // recibir esa misma queja, se baja directo a 300px (por debajo de esos
  // dos) en vez de otro recorte chico, para no necesitar una tercera
  // vuelta de "un poco menos".
  // Centésimo trigésimo cuarto pase: "si es posible agrandarlas un poco"
  // — con el espacio ganado al sacar "Tu saldo actual" de arriba, mínimo
  // de columna 300px→320px (tarjetas un poco más grandes, ya que son
  // cuadradas — `aspectRatio: '1 / 1'` en `card` — el ancho de columna
  // determina también su alto).
  // Ducentésimo trigésimo primer pase: reemplaza a la vieja `grid` de una
  // sola pieza (`display:'grid'` con `auto-fill`) — `filas` es el
  // contenedor columna de las 2 filas fijas, `fila` es cada fila en sí.
  // Las propiedades que necesitan cambiar en mobile (`flex-direction`,
  // `align-items`, el `flex-grow` de cada tarjeta) NO van acá — un estilo
  // inline de React siempre le gana a una media query de un `<style>`
  // inyectado, así que esas viven SOLO en el CSS del final del archivo
  // (clases `tc-filas`/`tc-fila`/`tc-card-normal`/`tc-card-hero`). Acá
  // queda nada más el `gap` vertical entre las 2 filas, que no cambia con
  // el ancho de pantalla.
  // Ducentésimo trigésimo segundo pase: "reducir el espacio vertical entre
  // la fila superior y la inferior, que se sienta más compacta" — gap
  // 14→9.
  filas: {
    display: 'flex', flexDirection: 'column', gap: 9,
  },
  fila: {},
  // Centésimo décimo noveno pase: la tarjeta deja de ser un rectángulo de
  // color con cinta diagonal — ahora ES el cartelito de madera (imagen de
  // fondo, `cartelFondo`) con el contenido superpuesto en las dos zonas
  // claras que el propio dibujo deja libres. `aspectRatio: '1 / 1'` porque
  // el PNG del cartelito es cuadrado (500x500) — forzar la tarjeta a esa
  // misma proporción es lo que hace que el fondo se vea completo y sin
  // deformarse, sea cual sea el ancho real de columna que le toque en el
  // grid.
  // Ducentésimo trigésimo primer pase: `width:'100%'` sacado a propósito —
  // ahora el ancho de cada tarjeta lo determina el `flex-grow` de su clase
  // CSS (`tc-card-normal`/`tc-card-hero`, ver el `<style>` del final), no
  // un porcentaje fijo del contenedor. `aspectRatio` se mantiene: sigue
  // siendo lo que hace que, sea cual sea el ancho que le toque a cada
  // tarjeta (normal o héroe), el cartelito de fondo se vea completo y sin
  // deformarse.
  card: {
    position: 'relative',
    aspectRatio: '1 / 1',
  },
  // Ducentésimo trigésimo primer pase: badge flotante del pack héroe
  // ("Mejor Valor"), pedido explícito del usuario en su brief además del
  // nombre que ya muestra el letrero de madera. Vive por ENCIMA del borde
  // superior de la tarjeta (`top` negativo) para no invadir ninguna de las
  // zonas ya medidas a pixel sobre el cartelito.
  // Pase 364: mismo listón que `badgeHero`, en rojo (Inauguración).
  badgeInauguracion: {
    position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
    zIndex: 3, whiteSpace: 'nowrap',
    background: `linear-gradient(180deg, #FF7A6B, ${C.crimson})`,
    color: '#fff', fontFamily: "'Fredoka', sans-serif", fontWeight: 800,
    fontSize: 11, letterSpacing: 0.2, padding: '4px 11px', borderRadius: 999,
    border: `2px solid ${C.crimsonOscuro}`, boxShadow: '0 3px 0 rgba(0,0,0,0.25)',
    textShadow: '-1px -1px 0 #7a1f17, 1px -1px 0 #7a1f17, -1px 1px 0 #7a1f17, 1px 1px 0 #7a1f17',
  },
  badgeHero: {
    position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
    zIndex: 3, whiteSpace: 'nowrap',
    background: `linear-gradient(180deg, ${C.doradoClaro}, ${C.dorado})`,
    color: C.chocolate, fontFamily: "'Fredoka', sans-serif", fontWeight: 800,
    fontSize: 11, letterSpacing: 0.2, padding: '4px 11px', borderRadius: 999,
    border: `2px solid ${C.doradoOscuro}`, boxShadow: '0 3px 0 rgba(0,0,0,0.25)',
  },
  // Ducentésimo trigésimo tercer pase: cinta diagonal de descuento (SOLO
  // Inauguración) — reemplaza al banner de texto que iba arriba de todo el
  // panel. Clavada en la esquina superior izquierda de la propia tarjeta
  // (no flotando por fuera, como `badgeHero`) con un `left` negativo chico
  // para que la rotación de -45° quede centrada justo sobre el vértice.
  // Ducentésimo trigésimo quinto pase: el usuario reportó el texto "-65%
  // OFF" muy chico dentro de la cinta — 11→15px, con un poco más de padding
  // para que la cinta lo acompañe sin apretarlo.
  // Ducentésimo trigésimo octavo pase: el usuario reportó que la cinta "se
  // superpone un poco con el borde de la placa". Medido con PIL sobre
  // `cartelito-madera-rojo.png`: el vértice achaflanado real de la placa
  // (el corte a 45° donde termina el borde de madera) va de (110,50) a
  // (75,98) sobre el lienzo de 500×500 — es decir, empieza recién a ~10-15%
  // de inset, más adentro de lo que dejaba la cinta en su posición vieja.
  // Se la corre un poco hacia arriba/izquierda (top 14→9, left -6→-11) para
  // que quede apoyada sobre el vértice sin pisar el trazo del marco.
  ribbonDescuento: {
    position: 'absolute', top: 9, left: -11, zIndex: 4,
    transform: 'rotate(-45deg)', transformOrigin: 'center',
    background: `linear-gradient(180deg, ${C.crimsonVibrante}, ${C.crimsonOscuro})`,
    border: `2px solid ${C.crimsonOscuro}`, padding: '4px 28px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.35)',
  },
  ribbonDescuentoTexto: {
    color: '#fff', fontFamily: "'Fredoka', sans-serif", fontWeight: 800,
    fontSize: 15, letterSpacing: 0.3, whiteSpace: 'nowrap',
  },
  cartelFondo: {
    position: 'absolute', inset: 0, width: '100%', height: '100%',
    objectFit: 'contain', pointerEvents: 'none', zIndex: 0,
  },
  // Zona del letrero chico de madera clara (arriba del todo) — el nombre
  // corto del pack. Centésimo vigésimo pase: el usuario reportó que el
  // texto se salía del letrero hacia el marco oscuro — el letrero NO es un
  // rectángulo, es una cinta con curva (más angosta en las puntas, más
  // ancha en el medio), así que el primer cálculo (a ojo, sobre todo el
  // ancho aparente del dibujo) dejaba una caja mucho más ancha que la parte
  // realmente segura para texto. Se remidió con un barrido de píxeles fila
  // por fila (buscando el color de relleno del letrero) y se tomó la
  // INTERSECCIÓN de los rangos horizontales en la franja central de la
  // curva (la parte más ancha) en vez del rango de una sola fila — de ahí
  // `left/right` mucho más angostos que antes (19%/17% → 30%/30%).
  // `overflow: hidden` es una red de seguridad: si un nombre puntual queda
  // en el límite, se recorta en vez de derramarse sobre el marco.
  // Centésimo vigésimo segundo pase: el usuario pidió bajar unos píxeles el
  // texto del letrero, para que quede mejor centrado sobre esa parte curva
  // de la imagen — `top` 14%→16.5%. Centésimo vigésimo tercer pase: quedó
  // un poquito de más — el usuario pidió subirlo "un pelin" — 16.5%→15.3%.
  // Centésimo vigésimo cuarto pase: confirmado que la posición ya quedó
  // perfecta — el usuario pidió agrandar el texto en sí, ya que incluso
  // "Inauguración" (el nombre más largo de los 6) todavía tiene lugar de
  // sobra en esa parte del letrero — 13.5px→16px.
  // Centésimo vigésimo octavo pase: con el cartelito NUEVO (sin remate
  // curvo, letrerito rectangular) esta zona se remidió de cero con PIL
  // sobre las 4 imágenes nuevas (barrido de píxeles, igual criterio que
  // siempre) — el letrero nuevo es más angosto en alto (una placa recta,
  // no una cinta curva con más aire) así que `height` baja bastante
  // (16%→10%); `top`/`left`/`width` quedan en valores muy parecidos a
  // antes por coincidencia de diseño (18%/30%/38%).
  // Centésimo vigésimo noveno pase: el usuario pidió "bajar los textos un
  // poco para que queden centrados" dentro del letrero — `paddingTop`
  // chico en vez de tocar la caja entera (que ya está bien medida).
  // Centésimo trigésimo pase: "todavía hay que centrar mejor" — el
  // `paddingTop` de 4px no alcanzaba, se sube a 6px. Esto aplica a las 5
  // tarjetas sin tocar (Mejor Valor/500/200/100/50); la de Inauguración
  // usa `zonaNombreTextoGrande` además (ver más abajo), que pisa el
  // `fontSize`/`lineHeight` de acá con valores más grandes.
  // Centésimo trigésimo primer pase: ajuste fino de ubicación del texto,
  // pedido explícito del usuario ("los otros textos bajarlos unos
  // pixeles y hacia la derecha un poco") — `paddingTop` 6→9, y
  // `paddingLeft` nuevo (4px) para correr el texto centrado un poco a la
  // derecha (con `justifyContent:'center'`, un padding asimétrico corre
  // el contenido hacia el lado con menos padding).
  zonaNombre: {
    position: 'absolute', top: '18%', height: '10%', left: '30%', width: '38%',
    zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
    textAlign: 'center', fontFamily: "'Fredoka', sans-serif", fontWeight: 700,
    fontSize: 16, lineHeight: 1.05, letterSpacing: 0.1, overflow: 'hidden',
    paddingTop: 9, paddingLeft: 4,
  },
  // Centésimo trigésimo pase: SOLO la tarjeta de Inauguración — el usuario
  // confirmó que esa se ve bien centrada y que sobra lugar en su letrero
  // (el cartelito rojo, medido de forma conservadora junto con los otros
  // 3 colores, en la práctica tiene más aire libre) para agrandar el
  // texto. 16px→19px.
  // Centésimo trigésimo primer pase: pedido explícito — "subilo uno o dos
  // pixeles" (esta tarjeta específicamente había quedado un poco más
  // abajo de lo ideal al agrandar el texto) — `paddingTop` 5→3 (sube 2px
  // respecto del pase anterior); el corrimiento a la derecha ya lo hereda
  // de `zonaNombre` (`paddingLeft:4`, no se pisa acá).
  zonaNombreTextoGrande: { fontSize: 19, paddingTop: 3 },
  // Zona grande de madera clara (el panel principal) — ilustración,
  // cantidad y precio, todo apilado y centrado. Mismo criterio que arriba:
  // porcentajes calculados sobre el PNG, dejando el marco de madera oscura
  // (y el de color, en los cartelitos verde/rojo) afuera del contenido.
  // Centésimo vigésimo octavo pase: remedido de cero sobre el cartelito
  // NUEVO — el panel claro nuevo es más angosto que el viejo en ancho
  // (bordes más gruesos a los costados) pero un poco más alto: `left`
  // 21%→28%, `width` 58%→44%, `height` 48%→50% (`top` se mantiene en 33%,
  // coincide con la medición nueva). También se cambia el criterio de
  // alineación: en vez de `marginTop:'auto'` en `zonaPrecio` para empujarlo
  // al fondo de la caja (dejaba un hueco grande en los packs sin tag —
  // "el precio final está demasiado separado del contenido"), todo el
  // bloque se CENTRA (`justifyContent:'center'`) con un `gap` fijo y chico
  // entre cada grupo.
  // Centésimo vigésimo noveno pase: BUG REAL encontrado tras ver capturas
  // del usuario — con el precio metido adentro de este mismo bloque
  // centrado, la suma de alturas (ícono + cantidad+etiqueta + badge +
  // precio tachado + botón, con sus gaps) pasó a ser MÁS ALTA que el 50%
  // de caja disponible en varios packs (sobre todo los que tienen badge
  // de regalo, o precio tachado) — con `justifyContent:'center'`, ese
  // exceso se reparte mitad arriba/mitad abajo de la caja, así que el
  // ícono terminaba empujado por ARRIBA del propio letrero del nombre
  // ("los dibujos están tapando... el nombre del pack"). Se resuelve
  // sacando el precio de acá — ver `zonaPrecio` más abajo, ahora es su
  // propia zona absoluta e independiente — así este bloque (ícono +
  // cantidad + badge, sin precio) sí entra cómodo en su caja y no empuja
  // nada hacia el letrero de arriba. `height` baja de 50%→34% (ya no
  // necesita lugar para el precio) y `top` baja un pelín (33%→34%) para
  // dejar más aire respecto del letrero.
  // Centésimo trigésimo pase: el usuario reportó que el badge ("+200 de
  // regalo") todavía quedaba pegado/encima del precio tachado — el 34% de
  // alto seguía sin alcanzar para ícono+cantidad+badge en los packs con
  // badge. El usuario autorizó explícitamente bajar el precio aún más
  // "aunque tape la parte de abajo de las tarjetas" (las imágenes no
  // tienen espacio) — así que en vez de seguir apretando el ícono, se le
  // da más aire a este bloque (34%→38%) y se compensa empujando
  // `zonaPrecio` más abajo (ver ese estilo), aceptando que el botón de
  // precio invada el marco oscuro inferior si hace falta.
  // Centésimo trigésimo primer pase: "agrandemos un poco las imágenes" —
  // se sube otro poco (38%→40%), mismo criterio de seguir empujando el
  // precio hacia abajo para hacerle lugar (ver `zonaPrecio`).
  // Centésimo trigésimo segundo pase: BUG REAL encontrado con la captura
  // del usuario — `justifyContent:'center'` hace que la posición del
  // ícono dependa de CUÁNTO contenido tenga cada tarjeta: con badge (3
  // elementos) el bloque es más alto y arranca más arriba dentro de la
  // caja; sin badge (2 elementos, como "50 Monedas") el bloque es más
  // bajo y arranca más abajo — de ahí "el dibujo y texto de 50 monedas
  // quedó un poco arriba" (en realidad las demás tarjetas arrancan más
  // arriba por tener más contenido, no al revés, pero el efecto visible
  // es el mismo: inconsistencia entre tarjetas). Encima, en los packs con
  // precio tachado, ese mismo contenido más alto llegó a desbordar el
  // 40% de esta caja hacia ABAJO, pisando el precio tachado de
  // `zonaPrecio` ("MONEDAS" tapado por "$3.000" en 100/200 Monedas).
  // Se cambia `justifyContent:'center'` → `'flex-start'`: así el ícono
  // arranca SIEMPRE en el mismo punto (el techo de la caja), sea cual sea
  // la cantidad de contenido de cada pack — cantidad+etiqueta+badge caen
  // en cascada debajo, en vez de reacomodar todo el bloque centrado.
  // Centésimo trigésimo tercer pase: DA VUELTA el criterio del pase
  // anterior — `flex-start` resolvía el desborde, pero generaba un
  // problema nuevo: en "50 Monedas" (el pack más liviano, sin badge ni
  // precio tachado) el bloque quedaba pegado arriba con un hueco enorme
  // debajo antes del precio ("falta centrar la imagen... están un poco
  // por arriba del centro"), y en Inauguración/100/200 (con precio
  // tachado pero sin badge) quedaba un "espacio de más" entre la cantidad
  // y el precio — porque `zonaPrecio` había pasado a ser una caja FIJA
  // aparte con un hueco fijo antes de ella, sin importar cuánto contenido
  // hubiera arriba. Se vuelve a `justifyContent:'center'`, pero esta vez
  // con una caja mucho más generosa en alto (40%→60%, `zonaPrecio` vuelve
  // a vivir ADENTRO de este mismo bloque, ver el JSX) — así el contenido
  // de cada pack se centra según lo que realmente tiene, sin hueco fijo
  // de más en los packs livianos, y sin desbordar en el pack más cargado
  // (Mejor Valor, único con badge Y precio tachado a la vez).
  zonaContenido: {
    position: 'absolute', top: '34%', height: '64%', left: '28%', width: '44%',
    zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', gap: 5,
  },
  // Centésimo pase: 48→68px. Centésimo primer pase: seguimos agrandando,
  // 68→90px, a pedido del usuario ("vamos a seguir agrandando las
  // imágenes de las tarjetas"). Centésimo décimo noveno pase: pasa a ser
  // un tamaño relativo (no un px fijo) porque ahora vive dentro de la zona
  // clara del cartelito — así la ilustración sigue siendo el elemento más
  // grande del panel (pedido explícito del usuario) sea cual sea el ancho
  // final de la tarjeta.
  // Centésimo vigésimo pase: textos e ícono agrandados acorde a la
  // tarjeta más grande (pedido explícito del usuario, "agrandemos... y
  // acomodemos los textos").
  // Centésimo vigésimo primer pase: el usuario pidió seguir agrandando todo
  // en la web. Centésimo vigésimo segundo pase: `maxHeight` → `height` fijo
  // — con `maxHeight` cada ícono ocupaba una altura distinta según su
  // propia proporción (un cofre ancho rendía más bajo que una pila
  // vertical), y como todo lo de abajo depende de esa altura para saber
  // dónde empieza, el precio terminaba a una altura distinta según el pack
  // (el motivo real de "la tarjeta de 50 hay que bajar el dibujo... y el
  // botón hay que bajarlo"). Con `height` fijo, todos los íconos reservan
  // el MISMO espacio (y `objectFit:contain` centra la imagen real adentro,
  // más chica o más grande según su propia proporción) — así el resto del
  // contenido arranca siempre a la misma altura, sea cual sea el pack.
  // Centésimo vigésimo quinto pase: `height` 36%→38% — con `zonaContenido`
  // más bajo (ver arriba), un 36% literal habría achicado el dibujo más de
  // la cuenta; 38% lo deja prácticamente igual de grande que antes.
  // Centésimo vigésimo octavo pase: `zonaContenido` es más angosto ahora
  // (58%→44% de ancho) pero un poco más alto (48%→50%) — para que el
  // dibujo no se achique de golpe solo por ese cambio de proporción, y de
  // paso cumplir el pedido explícito de "aumentar el tamaño de los dibujos
  // aprovechando el espacio libre", se compensa subiendo bastante el
  // ancho relativo (54%→74%) y un poco el alto (38%→40%).
  // Centésimo vigésimo noveno pase: con `zonaContenido` más bajo ahora
  // (34% en vez de 50%, ver arriba), `height` baja proporcionalmente
  // 40%→50% DEL NUEVO 34% (es decir, sigue siendo ~17% de la tarjeta en
  // términos absolutos — prácticamente el mismo tamaño real de dibujo que
  // antes, no se achica, solo se recalcula sobre la caja nueva más chica).
  // `marginBottom` sacado — el espacio lo pone el `gap` del padre.
  // Centésimo trigésimo primer pase: "agrandemos un poco las imágenes" —
  // width 70%→76%, height 50%→55% (de la caja `zonaContenido`, que
  // también creció este pase, así que el tamaño real del dibujo sube en
  // las dos dimensiones a la vez).
  // Centésimo trigésimo tercer pase: `zonaContenido` volvió a crecer
  // mucho en alto (40%→64%, ver arriba, para que entre TODO el contenido
  // — ícono, cantidad, badge Y precio, todo junto de nuevo). `width` se
  // mantiene en 76% (el ANCHO de `zonaContenido` no cambió, sigue dando
  // el mismo tamaño real de dibujo); `height` baja 55%→35% para que el
  // dibujo mantenga prácticamente el mismo tamaño real de antes (~22% de
  // la tarjeta) sobre la caja nueva, más alta — no se achica.
  // Ducentésimo trigésimo primer pase: "agrandar monedas y cofres" (punto
  // explícito del brief) — 76%→84% / 35%→40%, mismo criterio de siempre
  // (porcentaje relativo a `zonaContenido`, no un px fijo).
  // Ducentésimo trigésimo segundo pase: segunda revisión — "siguen
  // viéndose un poco pequeñas... se pueden agrandar un 15-20% más" —
  // 84%→92% / 40%→46%.
  icono: { width: '92%', height: '46%', objectFit: 'contain' },
  // Ducentésimo trigésimo octavo pase: el usuario notó que los packs 200 y
  // 100 (los dos únicos con ilustración de "bolsa", vs. los cofres del
  // resto de las tarjetas con tag/destacadas) se sienten "más pobres"
  // visualmente al lado de esos cofres — se les da a esos dos, puntualmente,
  // un poco más de tamaño de ícono para compensar sin tocar el resto.
  iconoGrande: { width: '100%', height: '52%', objectFit: 'contain' },
  cantidadGrupo: { display: 'flex', flexDirection: 'column', alignItems: 'center' },
  // Centésimo vigésimo quinto pase: el usuario pidió agrandar "los textos
  // de los valores" ya que sobraba lugar — cantidad 22→24, etiqueta 12→13
  // (ver también `precioOriginal`/`precioBoton` más abajo).
  cantidad: { fontFamily: "'Fredoka', sans-serif", fontWeight: 700, fontSize: 24, color: C.chocolate, lineHeight: 1.1 },
  cantidadLabel: { fontSize: 13, fontWeight: 700, color: '#8c8078', textTransform: 'uppercase', letterSpacing: 0.3 },
  // Centésimo vigésimo octavo pase: `marginTop` sacado — ahora el espacio
  // entre este badge y lo de arriba/abajo lo pone el `gap` de
  // `zonaContenido` (el padre), no un margen propio (hubiera duplicado el
  // espacio).
  bonoTag: {
    fontSize: 12, fontWeight: 800, color: C.verdeOscuro, background: '#d8f0da',
    borderRadius: 8, padding: '3px 9px'
  },
  // Centésimo vigésimo octavo pase: `marginTop` sacado, mismo motivo que
  // `bonoTag` de arriba — el espacio ya lo pone el `gap` del padre.
  notaEspecialTag: {
    fontSize: 12, fontWeight: 800, color: C.crimsonOscuro, background: '#ffe1de',
    borderRadius: 8, padding: '3px 9px'
  },
  // Centésimo décimo noveno pase: ya no hay un botón "Comprar" separado —
  // este bloque (precio tachado + precio final) va agrupado con el resto
  // del contenido.
  // Centésimo vigésimo octavo pase: sacado `marginTop: 'auto'` — ese truco
  // empujaba el precio al fondo de la caja, dejando un hueco grande en los
  // packs sin tag ("el precio final está demasiado separado del
  // contenido"). Ahora `zonaContenido` centra todo el bloque con `gap`, así
  // que el precio ya queda a una distancia fija y chica del resto sin
  // necesidad de un margen automático.
  // Centésimo vigésimo noveno pase: pasa de vivir DENTRO de
  // `zonaContenido` a ser su PROPIA zona absoluta, pegada al borde
  // inferior de la zona clara del cartelito (top 69%, termina en 83% —
  // el mismo límite inferior ya medido con PIL para el panel claro). Este
  // es el fix real de "los dibujos están tapando... el nombre del pack":
  // con el precio adentro del bloque centrado de `zonaContenido`, la
  // suma de alturas de TODO junto (ícono+cantidad+badge+precio) superaba
  // el alto disponible, y `justifyContent:'center'` repartía ese
  // sobrante mitad para arriba (empujando el ícono sobre el letrero) y
  // mitad para abajo. Separando el precio en su propia caja, el bloque de
  // arriba (ícono+cantidad+badge) ya entra solo, sin empujar nada — y de
  // paso el precio queda anclado cerca del borde inferior de la tarjeta,
  // como pidió el usuario ("bajar todos los botones... ponerlos en la
  // parte inferior de la tarjeta").
  // Centésimo trigésimo pase: bajado más todavía (69%→74%) para dejarle
  // más aire al bloque de arriba (ver `zonaContenido`) — pedido explícito
  // del usuario ("bajar aún más los botones aunque tapen la parte de
  // abajo de las tarjetas"). El panel claro del cartelito termina
  // alrededor del 83%, así que con `top:74%`+`height:16%` (termina en
  // 90%) el botón queda parcialmente sobre el marco oscuro inferior a
  // propósito — el usuario lo prefiere así antes que perder tamaño de
  // ilustración.
  // Centésimo trigésimo primer pase: "bajar todavía más los botones de
  // compra" — `top` 74%→79% (termina en 95%), acompañando el crecimiento
  // de `zonaContenido`/`icono` de este mismo pase.
  // Centésimo trigésimo segundo pase: mismo motivo que `zonaContenido` de
  // arriba — con `justifyContent:'center'`, el botón de precio quedaba en
  // un lugar distinto según si el pack tiene precio tachado o no: en
  // "50 Monedas" (sin precio tachado, el botón es el ÚNICO hijo) el botón
  // se centraba en el medio de la caja; en el resto (precio tachado +
  // botón, dos hijos) el PAR se centraba, así que el botón individual
  // quedaba más abajo. Se había cambiado a `justifyContent:'flex-end'`
  // como propia caja absoluta — ver el pase siguiente, que revierte esto.
  // Centésimo trigésimo tercer pase: vuelve a ser un div SIMPLE (sin
  // `position:'absolute'` propio) adentro de `zonaContenido` — ver el
  // comentario largo junto a ese estilo y el JSX. Ya no hace falta
  // `justifyContent`/`alignItems` propios para centrar nada: hereda el
  // centrado del padre, solo agrupa precio tachado + botón para que el
  // `gap` del padre los trate como UN grupo (no separe el botón de su
  // propio precio tachado).
  zonaPrecio: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%',
  },
  // Centésimo décimo cuarto pase: precio de lista tachado, punto 3 de la
  // lista del usuario — solo se renderiza cuando el pack tiene
  // `precioOriginal` (todos menos pack-50, que es la base del cálculo).
  // Centésimo vigésimo quinto pase: 13.5→15px, agrandado junto con el resto
  // de los "textos de los valores" — con el fix de `zonaContenido` de
  // arriba este texto ya cae dentro del papel claro, así que agrandarlo no
  // lo empeora.
  // Ducentésimo trigésimo octavo pase: "el precio tachado ($2.800) se lee
  // un poco chico" — 15→16.5px.
  precioOriginal: {
    fontSize: 16.5, fontWeight: 700, color: '#a89a90',
    textDecoration: 'line-through', marginBottom: 3
  },
  // Centésimo décimo noveno pase: el precio final ES el botón de compra
  // (antes eran dos elementos separados) — pedido explícito del usuario en
  // su brief ("el precio final tiene que ser el que más resalte"). El
  // color de la píldora sigue el mismo criterio que antes tenía el botón:
  // dorado en los packs base, con acento propio en los dos packs con tag.
  // Centésimo vigésimo pase: agrandado (fontSize/padding). Centésimo
  // vigésimo primer pase: seguimos agrandando, pedido explícito del
  // usuario ("sigamos agrandando todo"). Centésimo vigésimo quinto pase:
  // 19→20px, último toque de la ronda de "agrandar los textos de valores".
  // Ducentésimo trigésimo primer pase: "botones más altos y con más
  // padding" (punto explícito del brief) — padding '8px 18px'→'12px 24px'.
  // Ducentésimo trigésimo segundo pase: "en los packs chicos se sienten un
  // poco pequeños... más altos y con más presencia" — padding
  // '12px 24px'→'14px 28px', fontSize 20→21.
  // Ducentésimo trigésimo cuarto pase: el botón de precio deja de ser un
  // degradé CSS — usa los 3 botones ilustrados (píldora con relieve/brillo)
  // que pasó el usuario, uno por color de tarjeta. El marco/sombra propios
  // se sacan (el dibujo ya trae su propio relieve 3D) — solo queda el
  // padding, que sigue determinando el ancho real del botón según el largo
  // del precio (`backgroundSize:'100% 100%'` estira el dibujo para llenar
  // esa caja, sea cual sea su ancho).
  // Ducentésimo trigésimo quinto pase: segunda vuelta — el botón seguía
  // "un poco achatado". Dos ajustes juntos: (1) el PNG en sí se recortó
  // (ver boton-verde/rojo/amarillo.png) sacándole el aro blanco de
  // sticker que traía alrededor de la píldora — el usuario pidió no
  // agrandar ese aro blanco (achicarlo si se podía), así que en vez de
  // agrandar la caja entera se achica primero la imagen fuente para que
  // el aro ocupe menos del dibujo; (2) con esa imagen más ajustada
  // (relación real ahora ~1.73:1), se sube el padding vertical otra vez
  // (24→32) para terminar de acercar la caja a esa proporción, sin tocar
  // el horizontal (ancho confirmado OK).
  // Ducentésimo trigésimo sexto pase: tercera vuelta — (1) quedó un poco
  // alto de más, se baja el padding vertical promedio (32→24); (2) el
  // texto se veía por debajo del centro visual del botón (el dibujo de la
  // píldora, con su bisel 3D, tiene el centro "óptico" más arriba que el
  // centro geométrico de la caja) — en vez de padding simétrico, ahora
  // arriba es más chico que abajo (18 vs 30) para correr el texto hacia
  // arriba dentro de la misma caja.
  // Pase 364: botón plano cel-shaded (igual al del Lobby/Torneos): relleno liso, contorno negro 2px y sombra
  // inferior dura; reemplaza las imágenes boton-amarillo/verde/rojo.png. El color sigue el de cada tarjeta.
  precioBoton: {
    fontFamily: "'Fredoka', sans-serif", fontWeight: 700, fontSize: 21,
    border: '2px solid #000', borderRadius: 999, padding: '9px 30px', marginBottom: 6,
    cursor: 'pointer', boxSizing: 'border-box', lineHeight: 1.2,
  },
  precioBotonDorado: {
    background: '#F5B041', color: '#2C160E', boxShadow: '0 4px 0 #B9770E, 0 6px 0 #000',
  },
  precioBotonVerde: {
    background: '#10B981', color: '#fff', textShadow: CONTORNO_TEXTO, boxShadow: '0 4px 0 #065F46, 0 6px 0 #000',
  },
  precioBotonRojo: {
    background: '#E74C3C', color: '#fff', textShadow: CONTORNO_TEXTO, boxShadow: '0 4px 0 #78281F, 0 6px 0 #000',
  },
  precioBotonDeshabilitado: {
    opacity: 0.6, cursor: 'default',
  },
  // Centésimo décimo cuarto pase: disclaimer más chico y menos protagonista,
  // punto 7 de la lista del usuario (antes: 11.5px, opacity 0.85).
  // Ducentésimo trigésimo primer pase: "el texto legal debe ser más
  // pequeño y discreto" (brief nuevo) — 10px→9px, opacity 0.65→0.55, mismo
  // criterio que ya usa la versión nativa (ver tienda.tsx, notaPie).
  // Ducentésimo trigésimo octavo pase: "sigue siendo bastante largo y se
  // lee con dificultad" — 9→8.5px, opacity 0.55→0.5 (ver también el `<br/>`
  // en el JSX que lo parte en 2 líneas).
  notaPie: {
    fontSize: 8.5, color: C.crema, opacity: 0.5, textAlign: 'center',
    margin: '12px 10px 0', lineHeight: 1.5
  },
};

// Pase siguiente: pequeño feedback de hover/click en el botón de precio —
// antes los botones se veían idénticos en reposo/hover, sin sensación de
// "esto se puede clickear" más allá del cursor. Se inyecta una sola vez
// (mismo patrón que ya usa MonedaEasterEgg.js para su @keyframes) en vez
// de :hover inline, que los objetos de estilo de React no soportan.
if (typeof document !== 'undefined' && !document.getElementById('tienda-hover-boton')) {
  const style = document.createElement('style');
  style.id = 'tienda-hover-boton';
  style.textContent = `
    .tc-precio-boton { transition: transform 0.15s ease, filter 0.15s ease; }
    .tc-precio-boton:hover { transform: translateY(-2px); filter: brightness(1.06); }
    .tc-precio-boton:active { transform: translateY(0); filter: brightness(0.95); }
  `;
  document.head.appendChild(style);
}

// Ducentésimo trigésimo primer pase: layout responsivo de las 2 filas de
// tarjetas (ver `estilos.filas`/`estilos.fila`/`estilos.card` y el JSX más
// arriba) — vive en un `<style>` inyectado, mismo patrón que el hover de
// arriba, porque un estilo inline de React siempre gana por sobre una
// media query externa: si `flex-grow`/`flex-direction` se hubieran puesto
// inline, la versión mobile no podría pisarlos.
// - Desktop (por defecto): cada fila es una fila flex de 3 tarjetas.
//   `tc-card-hero` (Mejor Valor) tiene más `flex-grow` que sus compañeras
//   — como la tarjeta es cuadrada, ese ~18% de ancho de más también la
//   hace más alta; con `align-items:flex-end` en la fila, las tarjetas
//   sin ese `flex-grow` extra quedan alineadas por abajo y la héroe
//   sobresale hacia arriba. El `filter: drop-shadow` le da el "más
//   sombra/brillo" pedido sin dibujar un borde rectangular sobre un
//   cartelito que no lo es.
//   Ducentésimo trigésimo segundo pase: `tc-card-secundario` (SOLO
//   Inauguración/500, las 2 compañeras de fila del héroe) agregado con un
//   `flex-grow` intermedio (1.09, entre el 1 de `tc-card-normal` y el
//   1.18 del héroe) — el usuario reportó que esas 2 se sentían
//   "achicadas y desbalanceadas" al lado del héroe; ahora crecen un poco
//   también, sin competir con el protagonismo del héroe.
// - Mobile (`max-width:680px`, mismo breakpoint que ya usa el resto de la
//   app en otras pantallas): cada fila pasa a apilarse en columna y las
//   tarjetas ocupan el ancho completo — pedido explícito del usuario
//   ("lista vertical, no una sola tarjeta con dots"). El `order` en la
//   fila de arriba reordena SOLO esos 3 hijos (Mejor Valor primero,
//   Inauguración segundo, 500 Monedas queda tercero sin necesidad de
//   `order` propio) — la fila de abajo (200/100/50) ya estaba en el orden
//   correcto y sigue después de la fila de arriba en el flujo normal, así
//   que juntando las 2 filas el orden final en mobile queda exactamente:
//   Mejor Valor → Inauguración → 500 → 200 → 100 → 50.
if (typeof document !== 'undefined' && !document.getElementById('tienda-grid-responsive')) {
  const styleGrid = document.createElement('style');
  styleGrid.id = 'tienda-grid-responsive';
  styleGrid.textContent = `
    .tc-fila { display: flex; gap: 14px; align-items: flex-end; }
    .tc-fila.tc-fila-inferior { gap: 10px; }
    .tc-card-normal { flex: 1 1 0; min-width: 0; }
    .tc-card-secundario { flex: 1.09 1.09 0; min-width: 0; }
    .tc-card-hero {
      flex: 1.18 1.18 0; min-width: 0; position: relative; z-index: 2;
      filter: drop-shadow(0 10px 18px rgba(0,0,0,0.4)) drop-shadow(0 0 12px rgba(255,182,39,0.55));
    }
    /* Ducentesimo cuadragesimo primer pase: a un ancho de ventana angosto
       (justo por encima de 680px) la grilla de 3 columnas seguia activa
       pero las tarjetas no tienen un ancho minimo propio (a proposito, ver
       tc-card-normal arriba), asi que se seguian achicando sin limite y el
       contenido interno (fuentes/paddings en px fijos) dejaba de entrar,
       todo se veia superpuesto. En vez de rehacer las medidas a pixel para
       que escalen fluido en cualquier ancho intermedio, se sube el punto de
       corte (680 a 900px) para que la vista de lista apilada de abajo (que
       ya funciona bien) entre en juego antes de esa zona angosta. */
    @media (max-width: 900px) {
      .tc-filas { gap: 14px; }
      .tc-fila { flex-direction: column; align-items: stretch; gap: 14px; }
      .tc-card-normal, .tc-card-secundario, .tc-card-hero { flex: 1 1 auto; width: 100%; }
      .tc-card-pack-800 { order: -2; }
      .tc-card-pack-inauguracion { order: -1; }
      .tc-fila.tc-fila-inferior { gap: 14px; }
    }
  `;
  document.head.appendChild(styleGrid);
}
