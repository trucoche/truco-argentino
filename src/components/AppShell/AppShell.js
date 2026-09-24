import React from 'react';

const C = {
  verde: '#2D9B4F', verdeOscuro: '#1f7a3c',
  crimson: '#E8483A', crimsonOscuro: '#c2352a',
  dorado: '#FFB627', doradoClaro: '#FFD668', doradoOscuro: '#C9860E',
  celeste: '#4FB3E8',
  crema: '#FFF8ED', chocolate: '#4A2C2A'
};

// Ítems de navegación: id interno, label, emoji-ícono, y (opcional) badge
// numérico que se le pasa desde afuera (ej: cantidad de salas abiertas).
// Trigésimo pase: "Config" pasó de emoji a ícono ilustrado (mismo archivo
// que el botón de configuración dentro de la partida) — `iconImg` en vez
// de `icon` marca cuáles items usan imagen en vez de emoji (ver el render
// del <nav> más abajo).
// Cuadragésimo primer pase: los otros 4 ítems también pasaron de emoji a
// íconos ilustrados propios (mismo estilo cartoon/plano que el engranaje),
// diseñados por el usuario específicamente para el nav del lobby.
// Octogésimo tercer pase: "Config" → "Ajustes", mismo cambio de texto que
// ya se había hecho en nativo (septuagésimo noveno pase).
// Pase siguiente: "Chat" pasa de emoji (💬) a `iconImg`, con el ícono
// ilustrado (globo de diálogo dorado) que mandó el usuario para reemplazarlo.
const NAV_ITEMS = [
  { id: 'lobby',     label: 'Salas',     iconImg: '/assets/images/cartas-monedas.png' },
  { id: 'torneos',   label: 'Torneos',   iconImg: '/assets/images/trofeo.png' },
  { id: 'ranking',   label: 'Ranking',   iconImg: '/assets/images/podio.png' },
  { id: 'historial', label: 'Historial', iconImg: '/assets/images/reloj-arena.png' },
  { id: 'chat',      label: 'Chat',      iconImg: '/assets/images/icono-chat.png' },
  { id: 'config',    label: 'Ajustes',   iconImg: '/assets/images/icono-engranaje.png' },
];

// Shell persistente de la app: header arriba (avatar, saldo, nav, logout)
// + contenido debajo. El <nav> vive DENTRO del <header> en el markup —
// en mobile se "desengancha" del flujo con position:fixed y cae como
// barra inferior (el CSS no depende de dónde esté en el DOM para eso);
// en desktop se queda en flujo normal, como fila horizontal dentro del
// header mismo, en vez de sidebar lateral.
export default function AppShell({
  usuario,
  pantallaActiva,
  onNavegar,
  onLogout,
  badges = {},
  bannerTexto,
  onBannerClick,
  bonusDisponible,
  onReclamarBonus,
  children
}) {
  return (
    <div
      className="ts-shell"
      style={{
        backgroundImage: 'linear-gradient(rgba(20,20,15,0.38), rgba(20,20,15,0.38)), url(/assets/images/fondo-lobby.jpeg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundAttachment: 'fixed',
      }}
    >
      <header className="ts-header">
        <div className="ts-header-inner">
            {/* Octogésimo séptimo pase: reemplaza al avatar+saludo+saldo viejo
                por la tarjeta de madera nueva que mandó el usuario — círculo
                de foto, nombre (ya sin el "¡Hola, !", pedido explícito) y
                saldo sobre el mismo gráfico, más un botón "+" (por ahora
                lleva al perfil también, como el resto de la tarjeta — es el
                lugar lógico para un futuro "recargar saldo" que todavía no
                existe). Coordenadas en % calculadas a mano sobre el archivo
                fuente (tarjeta-perfil.png, recortado a su contenido real,
                491x226) — ver detalle en app-shell.css. */}
            <div className="ts-tarjeta-perfil">
              <img src="/assets/images/tarjeta-perfil.png" alt="" className="ts-tarjeta-perfil-fondo" />
              <div className="ts-tarjeta-perfil-avatar">
                <img
                  src={
                    usuario?.avatar_tipo === 'foto' && usuario?.foto_perfil_url
                      ? usuario.foto_perfil_url
                      : `/assets/${usuario?.personaje || 'gaucho'}-avatar.png`
                  }
                  alt="Avatar"
                />
              </div>
              <div className="ts-tarjeta-perfil-nombre">{usuario?.username}</div>
              {/* Octogésimo octavo pase: el saldo se muestra siempre redondeado
                  a entero (pedido explícito del usuario) — defensivo del lado
                  del cliente, además del fix de fondo en el backend
                  (torneoManager.js/index.js, ver estado-proyecto.md) que
                  evita que se sigan generando saldos con decimales nuevos.
                  Number(...) primero porque `DECIMAL` de Postgres puede
                  llegar como string por el driver `pg`. */}
              <div className="ts-tarjeta-perfil-saldo">{Math.round(Number(usuario?.saldo) || 0)}</div>
              {/* Nonagésimo primer pase: el hotspot único de "+" (que hacía lo
                  mismo que tocar el resto de la tarjeta) se separa en DOS
                  zonas — ahora que existe la Tienda, la mitad de "identidad"
                  (foto+nombre) sigue yendo al perfil, y la mitad de "moneda"
                  (medallón+saldo+"+") lleva a comprar monedas. La zona de
                  perfil cubre TODA la tarjeta como fallback (va debajo); la
                  zona de moneda tapa solo el cuadrante inferior derecho y
                  gana ahí por estar arriba (ver z-index en app-shell.css). */}
              <button
                className="ts-tarjeta-perfil-zona-perfil"
                onClick={() => onNavegar('perfil')}
                title="Mi perfil"
              />
              <button
                className="ts-tarjeta-perfil-zona-moneda"
                onClick={() => onNavegar('tienda')}
                title="Comprar monedas"
              />
            </div>

          <nav className="ts-nav">
            {NAV_ITEMS.map(item => (
              <button
                key={item.id}
                className={`ts-nav-item ${pantallaActiva === item.id ? 'ts-nav-item-activo' : ''}`}
                onClick={() => onNavegar(item.id)}
              >
                {item.iconImg ? (
                  // Nonagésimo noveno pase: 36→46px — el header creció en pases
                  // anteriores (87-90) y estos íconos quedaron chicos en
                  // proporción al resto de la fila (el ícono de bonus, por
                  // ejemplo, ya usa 46px).
                  <img src={item.iconImg} alt="" className="ts-nav-icon" style={{ width: 46, height: 46, objectFit: 'contain' }} />
                ) : (
                  <span className="ts-nav-icon">{item.icon}</span>
                )}
                <span className="ts-nav-label">{item.label}</span>
                {/* Pase siguiente: `badges[item.id]` ahora también puede ser
                    `true` (sin número) — un punto rojo simple, usado para
                    "Chat" cuando llega un mensaje al Chat Global mientras
                    no estás en esa pantalla (ver App.js). El caso numérico
                    de siempre (cantidad de salas, etc.) sigue igual. */}
                {badges[item.id] === true && <span className="ts-nav-badge ts-nav-badge-punto" />}
                {typeof badges[item.id] === 'number' && badges[item.id] > 0 && (
                  <span className="ts-nav-badge">{badges[item.id]}</span>
                )}
              </button>
            ))}
          </nav>
          {/* Centésimo tercer pase: el botón de bono diario ya no se queda
              visible-pero-deshabilitado una vez reclamado — desaparece del
              todo (pedido explícito del usuario), en vez de mostrar el
              estado "inactivo" que tenía desde su creación. */}
          {bonusDisponible && (
            <button
              className="ts-icon-btn ts-icon-bonus-activo"
              onClick={onReclamarBonus}
              title="Reclamar bono diario (+5)"
            >
              <img
                src="/assets/images/regalo.png"
                alt=""
                style={{ width: 46, height: 46, objectFit: 'contain' }}
              />
            </button>
          )}
          {/* Octogésimo tercer pase: se saca el botón de mutear música de
              acá (vivía arriba de TODAS las pantallas con nav, no solo el
              lobby) — se reemplaza por un slider de volumen en Ajustes,
              mismo criterio que ya usa el panel de configuración de la
              partida (ConfiguracionMesaModal.js). Ver App.js/Configuracion.js.
              Octogésimo séptimo pase: recuadro restituido (ver comentario de
              `.ts-icon-btn`/`.ts-icon-logout` en app-shell.css) — el ícono
              vuelve a un tamaño acorde al recuadro nuevo (antes 44px sin
              recuadro, ahora 24x36 conteniendo la proporción real de la
              puerta dentro del botón de 50px).
              Octogésimo octavo pase: recuadro 50→62px, ícono acompaña
              (24x36→30x44) manteniendo la misma proporción.
              Centésimo tercer pase: el ícono de la puerta se sentía chico
              dentro del recuadro (62px) comparado con el resto de íconos del
              header — agrandado 30x44→38x54 (misma proporción real del
              archivo), sin tocar el tamaño del recuadro. */}
          <button className="ts-icon-btn ts-icon-logout" onClick={onLogout} title="Cerrar sesión">
            <img src="/assets/images/icono-logout.png" alt="" style={{ width: 38, height: 54, objectFit: 'contain' }} />
          </button>
        </div>
      </header>

      {/* Pase siguiente: en el Lobby este banner ya no se dibuja acá —
          se movió a compartir fila con el panel "Jugar ya" (ver
          Lobby.js), a pedido del usuario, para acortar la página. En el
          resto de las pantallas sigue apareciendo acá arriba, como
          siempre — EXCEPTO en Torneos y Ajustes: el usuario pidió
          sacarlo de esas dos ("no tiene sentido tenerlo en ajustes" /
          "no hace falta tenerlo en la página misma de torneo", ya que
          ahí el usuario ya está viendo el torneo, no tiene sentido
          invitarlo a anotarse). */}
      {bannerTexto && !['lobby', 'torneos', 'config'].includes(pantallaActiva) && (
        // Bug real encontrado (pase siguiente): este banner tenía su
        // propia copia vieja del botón — imagen de fondo Y texto los dos
        // directo en el <button> `.ts-banner`, sin el glow (`.ts-banner-
        // bg` con drop-shadow) ni el texto crema con contorno (`.ts-
        // banner-texto`) que ya tiene la versión del Lobby desde el pase
        // 185. El usuario lo reportó: "en todas las otras pantallas...
        // les falta el efecto luminoso de atrás y las letras no tienen
        // un diseño, son solo letras básicas" — exactamente lo que se
        // ve al comparar este bloque con el de Lobby.js. Fix: la misma
        // estructura de dos capas (imagen con drop-shadow + texto con
        // contorno), copiada tal cual de Lobby.js, para que el banner se
        // vea IDÉNTICO sin importar en qué pantalla aparezca.
        <button
          className="ts-banner"
          onClick={onBannerClick}
        >
          <div
            className="ts-banner-bg"
            style={{
              backgroundImage: "url('/assets/images/banner-torneo.png')",
              backgroundSize: '100% 100%',
              backgroundRepeat: 'no-repeat',
            }}
          />
          <span className="ts-banner-texto">{bannerTexto}</span>
        </button>
      )}

      <main className="ts-content">
        <div className="ts-content-inner">
          {children}
        </div>
      </main>
    </div>
  );
}