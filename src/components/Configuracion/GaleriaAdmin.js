import React, { useMemo, useState } from 'react';
import { PlacaMadera } from '../Popup/PopupMadera';
import PopupMadera from '../Popup/PopupMadera';
import { etapasDisponibles, SIM_MODOS, SIM_CUPOS } from '../Torneos/bracketSimulado';
import { CSS_EVENTOS, EventoCard, EventoDetalle } from '../Eventos/EventosLiga';
import { RegaloAvisoModal } from '../Regalo/RegaloAvisoModal';
import { KitFundadorModal } from '../Personalizacion/KitFundadorModal';
import { SponsorGraciasModal } from '../Personalizacion/SponsorGraciasModal';
import { ReporteAvisoModal } from '../Reportar/ReporteAvisoModal';
import LogroDesbloqueadoPopup from '../Lobby/LogroDesbloqueadoPopup';

// Pase 684: Galería de pantallas (solo admin; subpestaña "Galería" de Ajustes → Admin).
// Muestra pantallas difíciles de alcanzar (bracket de torneos, pantalla final, sala de espera, mesa con cantos, eventos y popups)
// con datos de EJEMPLO, dentro de un marco con el ancho de un celular (o de compu) para revisar su diseño. No usa servidor, cuentas ni mates.
//  - Bracket / Eventos / Popups: componentes reales con datos simulados dentro del marco (los popups quedan contenidos en el marco).
//  - Pantalla final / Sala de espera / Mesa: la escena real de Phaser en un <iframe> (/?preview=<modo>&final=… | &espera=… | &canto=…),
//    así el layout de celular se calcula con el ancho del marco, no con el de la ventana.

const SECCIONES = [
  { id: 'bracket', texto: 'Bracket de torneos' },
  { id: 'final', texto: 'Pantalla final' },
  { id: 'espera', texto: 'Sala de espera' },
  { id: 'mesa', texto: 'Mesa y cantos' },
  { id: 'eventos', texto: 'Eventos' },
  { id: 'popups', texto: 'Popups' },
];
const ANCHOS = [
  { id: 360, texto: '360' },
  { id: 390, texto: '390' },
  { id: 430, texto: '430' },
  { id: 900, texto: 'Compu' },
];
const MODOS = ['1v1', '2v2', '3v3'];
const CAPACIDAD = { '1v1': 2, '2v2': 4, '3v3': 6 };
const CANTOS = [
  { id: '', texto: 'Sin canto' },
  { id: 'truco', texto: 'Truco' },
  { id: 'retruco', texto: 'Retruco' },
  { id: 'envido', texto: 'Envido' },
  { id: 'real', texto: 'Real envido' },
  { id: 'flor', texto: 'Flor' },
];

// Eventos de ejemplo con la misma forma que devuelve GET /api/salas/ranked/rangos → eventos.
function eventosEjemplo(abiertos) {
  const ahora = Date.now();
  const hasta = (dias) => new Date(ahora + dias * 86400000).toISOString();
  const d = abiertos ? 32 : -3;
  return [
    {
      id: 'temporada_inaugural', titulo: 'Temporada Inaugural', abierto: abiertos, hasta: hasta(d),
      texto: 'La primera temporada no reinicia los puntos. Al cerrar se reparte un premio según el rango más alto que hayas alcanzado.',
      como: ['Jugá partidas de Liga Criolla y subí de rango.', 'Durante esta temporada tus puntos no se reinician.', 'Al cerrar se reparte un premio según el rango más alto que hayas alcanzado.'],
    },
    {
      id: 'pack_inauguracion', titulo: 'Pack de inauguración', abierto: abiertos, hasta: hasta(abiertos ? 27 : -3), accion: 'tienda',
      texto: 'Pack especial de 100 mates por tiempo limitado, con una sola compra por cuenta. Lo encontrás en la Tienda.',
      como: ['Entrá a la Tienda, en la web o en la app.', 'Elegí el Pack de inauguración.', 'Se compra una sola vez por cuenta y solo hasta que cierre el evento.'],
    },
    {
      id: 'pionero', titulo: 'Pionero de la Liga', abierto: abiertos, hasta: hasta(abiertos ? 1.5 : -3), meta: 20, actual: 8,
      texto: 'Jugá 20 partidas de Liga antes de que cierre la inauguración y llevate un anillo y un banner exclusivos que no se consiguen después.',
      premio: 'Anillo y banner Pionero', premioDisponible: false,
      como: ['Jugá 20 partidas de Liga Criolla mientras el evento esté abierto.', 'Cada partida cuenta, ganes o pierdas.', 'El anillo y el banner Pionero son exclusivos del evento: no se consiguen después.'],
    },
  ];
}

const LOGROS_EJEMPLO = [
  { tipo: 'primera_victoria', titulo: '🏆 Primera Victoria', descripcion: 'Ganá tu primera partida online.' },
  { tipo: 'rey_del_envido', titulo: '👑 Rey del Envido', descripcion: 'Ganá 10 envidos en partidas online.' },
];

export default function GaleriaAdmin() {
  const [seccion, setSeccion] = useState('bracket');
  const [ancho, setAncho] = useState(390);
  // Bracket
  const [bModo, setBModo] = useState('2v2');
  const [bCupo, setBCupo] = useState(8);
  const [bEtapa, setBEtapa] = useState('sala-media');
  // Pantalla final / espera / mesa
  const [modo, setModo] = useState('2v2');
  const [gano, setGano] = useState(true);
  const [sentados, setSentados] = useState(1);
  const [ranked, setRanked] = useState(false);
  const [canto, setCanto] = useState('');
  // Eventos / popups
  const [eventosAbiertos, setEventosAbiertos] = useState(true);
  const [eventoSel, setEventoSel] = useState('temporada_inaugural');
  const [popupAbierto, setPopupAbierto] = useState('logro');
  const [recarga, setRecarga] = useState(0);

  const etapas = useMemo(() => etapasDisponibles(bCupo), [bCupo]);
  const etapaValida = etapas.some((e) => e.id === bEtapa) ? bEtapa : 'sala-media';
  const eventos = useMemo(() => eventosEjemplo(eventosAbiertos), [eventosAbiertos]);
  const evento = eventos.find((e) => e.id === eventoSel) || eventos[0];
  const cap = CAPACIDAD[modo];
  const sentadosOk = Math.min(sentados, cap - 1);

  const celular = ancho < 900;
  const alto = celular ? Math.round(ancho * 2.05) : 640;
  const usaIframe = seccion === 'bracket' || seccion === 'final' || seccion === 'espera' || seccion === 'mesa';   // Pase 710: el bracket también va en iframe (para que valga el diseño de celular)

  const urlIframe = useMemo(() => {
    if (seccion === 'bracket') return `/?galeria=bracket&modo=${bModo}&cupo=${bCupo}&etapa=${etapaValida}`;
    const q = [`preview=${modo}`];
    if (seccion === 'final') q.push(`final=${gano ? '1' : 'perdiste'}`);
    if (seccion === 'espera') { q.push(`espera=${sentadosOk}`); if (ranked) q.push('ranked=1'); }
    if (seccion === 'mesa' && canto) q.push(`canto=${canto}`);
    return `/?${q.join('&')}`;
  }, [seccion, modo, gano, sentadosOk, ranked, canto, bModo, bCupo, etapaValida]);

  const chip = (activo) => ({ ...estilos.chip, ...(activo ? estilos.chipActivo : {}) });
  const chips = (lista, valor, alElegir, key = (x) => x, texto = (x) => x) => (
    <div style={estilos.fila}>
      {lista.map((x) => (
        <button key={key(x)} type="button" style={chip(valor === key(x))} onClick={() => alElegir(key(x))}>{texto(x)}</button>
      ))}
    </div>
  );

  const controlesModo = (
    <>
      <div style={estilos.seccion}>Modo</div>
      {chips(MODOS, modo, setModo)}
    </>
  );

  const popupsLista = [
    { id: 'logro', texto: 'Logro desbloqueado' },
    { id: 'regalo', texto: 'Regalo de TrucoChe' },
    { id: 'kit', texto: 'Kit Beta Tester' },
    { id: 'sponsor', texto: 'Gracias Sponsor' },
    { id: 'reporte', texto: 'Reporte revisado' },
    { id: 'desafio', texto: 'Desafío' },
    { id: 'torneo', texto: 'Invitación a torneo' },
    { id: 'confirmar', texto: 'Confirmar acción' },
  ];
  const cerrarPopup = () => setPopupAbierto(null);

  const renderPopup = () => {
    switch (popupAbierto) {
      case 'logro': return <LogroDesbloqueadoPopup logros={LOGROS_EJEMPLO} onCerrarTodos={cerrarPopup} />;
      case 'regalo': return <RegaloAvisoModal visible regalos={[{ id: 1, mates: 50, mensaje: '¡Gracias por ayudarnos a probar TrucoChe!' }]} totalMates={50} onCerrar={cerrarPopup} />;
      case 'kit': return <KitFundadorModal visible onEquipar={cerrarPopup} onCerrar={cerrarPopup} />;
      case 'sponsor': return <SponsorGraciasModal visible onEquipar={cerrarPopup} onCerrar={cerrarPopup} />;
      case 'reporte': return <ReporteAvisoModal visible avisos={[{ id: 1, tipo: 'bug' }]} totalMates={20} onCerrar={cerrarPopup} />;
      case 'desafio':
        return (
          <PopupMadera visible titulo="¡Desafío!" cinta="roja" icono="/assets/images/vs-escudo.png" tamIcono={92} onCerrar={cerrarPopup}
            botones={[{ texto: 'Aceptar', tipo: 'verde', onClick: cerrarPopup }, { texto: 'Rechazar', tipo: 'carmesi', onClick: cerrarPopup }]}>
            <p style={estilos.textoPopup}><strong>pruebatesttruco</strong> te desafió a jugar.</p>
          </PopupMadera>
        );
      case 'torneo':
        return (
          <PopupMadera visible titulo="¡Invitación a torneo!" cinta="verde" icono="/assets/images/trofeo.png" tamIcono={64} onCerrar={cerrarPopup}
            botones={[{ texto: 'Aceptar', tipo: 'verde', onClick: cerrarPopup }, { texto: 'Rechazar', tipo: 'carmesi', onClick: cerrarPopup }]}>
            <p style={estilos.textoPopup}><strong>Chiqui</strong> te invitó a su equipo en <strong>Copa Criolla</strong>.</p>
            <p style={{ ...estilos.textoPopup, fontSize: 13, color: '#7a6660' }}>2v2 · 15 pts · Entrada 10 mates (se descuenta al aceptar)</p>
          </PopupMadera>
        );
      case 'confirmar':
        return (
          <PopupMadera visible titulo="Confirmar" cinta="dorada" onCerrar={cerrarPopup}
            mensaje="¿Seguro que querés salir de la mesa? Si te vas, tu equipo pierde la partida."
            botones={[{ texto: 'Salir', tipo: 'carmesi', onClick: cerrarPopup }, { texto: 'Cancelar', tipo: 'neutro', onClick: cerrarPopup }]} />
        );
      default: return null;
    }
  };

  const marcoStyle = {
    ...estilos.marco,
    width: celular ? ancho + 16 : '100%',
    maxWidth: '100%',
    height: alto + 16,
    borderRadius: celular ? 30 : 14,
  };

  return (
    <PlacaMadera>
      <style>{CSS_EVENTOS}</style>
      <div style={estilos.titulo}>🖼️ Galería de pantallas</div>
      <p style={estilos.hint}>Pantallas difíciles de alcanzar, con datos de ejemplo (sin servidor, cuentas ni mates). Cambiá el ancho para ver cómo queda en cada celular.</p>

      <div style={estilos.seccion}>Pantalla</div>
      <div style={estilos.fila}>
        {SECCIONES.map((s) => (
          <button key={s.id} type="button" style={chip(seccion === s.id)} onClick={() => setSeccion(s.id)}>{s.texto}</button>
        ))}
      </div>

      <div style={estilos.seccion}>Ancho del marco</div>
      <div style={estilos.fila}>
        {ANCHOS.map((a) => (
          <button key={a.id} type="button" style={chip(ancho === a.id)} onClick={() => setAncho(a.id)}>{a.texto}</button>
        ))}
      </div>

      {seccion === 'bracket' && (
        <>
          <div style={estilos.seccion}>Modo del torneo</div>
          {chips(SIM_MODOS, bModo, setBModo)}
          <div style={estilos.seccion}>Equipos en el cuadro</div>
          <div style={estilos.fila}>
            {SIM_CUPOS.map((c) => <button key={c} type="button" style={chip(bCupo === c)} onClick={() => setBCupo(c)}>{c}</button>)}
          </div>
          <div style={estilos.seccion}>Etapa</div>
          <div style={estilos.fila}>
            {etapas.map((e) => <button key={e.id} type="button" style={chip(etapaValida === e.id)} onClick={() => setBEtapa(e.id)}>{e.texto}</button>)}
          </div>
        </>
      )}

      {seccion === 'final' && (
        <>
          {controlesModo}
          <div style={estilos.seccion}>Resultado</div>
          <div style={estilos.fila}>
            <button type="button" style={chip(gano)} onClick={() => setGano(true)}>Ganaste</button>
            <button type="button" style={chip(!gano)} onClick={() => setGano(false)}>Perdiste</button>
          </div>
        </>
      )}

      {seccion === 'espera' && (
        <>
          {controlesModo}
          <div style={estilos.seccion}>Jugadores ya sentados (además de vos)</div>
          <div style={estilos.fila}>
            {Array.from({ length: cap - 1 }, (_, i) => (
              <button key={i} type="button" style={chip(sentadosOk === i)} onClick={() => setSentados(i)}>{i}</button>
            ))}
          </div>
          <label style={estilos.checkFila}>
            <input id="galeria-ranked" type="checkbox" checked={ranked} onChange={(e) => setRanked(e.target.checked)} style={{ width: 20, height: 20 }} />
            <span>Partida de Liga Criolla</span>
          </label>
        </>
      )}

      {seccion === 'mesa' && (
        <>
          {controlesModo}
          <div style={estilos.seccion}>Canto pendiente de respuesta</div>
          <div style={estilos.fila}>
            {CANTOS.map((c) => <button key={c.id || 'nada'} type="button" style={chip(canto === c.id)} onClick={() => setCanto(c.id)}>{c.texto}</button>)}
          </div>
        </>
      )}

      {seccion === 'eventos' && (
        <>
          <div style={estilos.seccion}>Estado de los eventos</div>
          <div style={estilos.fila}>
            <button type="button" style={chip(eventosAbiertos)} onClick={() => setEventosAbiertos(true)}>Abiertos</button>
            <button type="button" style={chip(!eventosAbiertos)} onClick={() => setEventosAbiertos(false)}>Cerrados</button>
          </div>
        </>
      )}

      {seccion === 'popups' && (
        <>
          <div style={estilos.seccion}>Popup</div>
          <div style={estilos.fila}>
            {popupsLista.map((p) => (
              <button key={p.id} type="button" style={chip(popupAbierto === p.id)} onClick={() => { setPopupAbierto(p.id); setRecarga((n) => n + 1); }}>{p.texto}</button>
            ))}
          </div>
        </>
      )}

      <div style={estilos.escenario}>
        <div style={marcoStyle} data-galeria-marco="1">
          <div style={estilos.pantalla}>
            {usaIframe && (
              <iframe key={`${urlIframe}-${ancho}-${recarga}`} title="Vista previa de la pantalla" src={urlIframe} style={estilos.iframe} />
            )}

            {seccion === 'eventos' && (
              <div style={estilos.scroll}>
                <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={estilos.eventosFila}>
                    {eventos.map((ev, i) => (
                      <EventoCard key={`${ev.id}-${eventosAbiertos}`} e={ev} indice={i} onClick={() => setEventoSel(ev.id)} />
                    ))}
                  </div>
                  <PlacaMadera>
                    <EventoDetalle e={evento} />
                    {evento.accion === 'tienda' && <button type="button" style={estilos.btnTienda}>Ir a la Tienda</button>}
                  </PlacaMadera>
                </div>
              </div>
            )}

            {seccion === 'popups' && (
              <div style={estilos.pantallaVacia}>
                {!popupAbierto && <span>Elegí un popup de la lista</span>}
                {renderPopup()}
              </div>
            )}
          </div>
        </div>
        <p style={estilos.pie}>{usaIframe ? `Vista previa: ${urlIframe}` : `Marco de ${celular ? `${ancho} px` : 'compu'}`}</p>
      </div>
    </PlacaMadera>
  );
}

const estilos = {
  titulo: { fontFamily: "'Fredoka', sans-serif", fontWeight: 600, fontSize: 20, color: '#4A2C2A', marginBottom: 6 },
  hint: { margin: '0 0 8px', fontSize: 13.5, color: '#6b5a50' },
  seccion: { fontWeight: 800, fontSize: 13, color: '#4A2C2A', textTransform: 'uppercase', margin: '14px 0 6px' },
  fila: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  chip: { fontFamily: "'Fredoka', sans-serif", fontWeight: 600, fontSize: 14, color: '#FFFBEB', background: '#8B5A2B', border: '2px solid #1a1410', borderRadius: 999, padding: '7px 12px', cursor: 'pointer', boxShadow: 'inset 0 3px 5px rgba(74,44,17,0.55)' },
  chipActivo: { background: 'linear-gradient(180deg, #F5B041 0%, #EB984E 100%)', color: '#4A2C2A', border: '2px solid #000', boxShadow: '0 3px 0 #000' },
  checkFila: { display: 'flex', alignItems: 'center', gap: 10, marginTop: 14, fontWeight: 700, fontSize: 15, color: '#4A2C2A', cursor: 'pointer' },
  escenario: { marginTop: 18, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, overflowX: 'auto' },
  marco: { boxSizing: 'border-box', padding: 8, background: '#14100c', boxShadow: '0 6px 0 #000, inset 0 0 0 2px #3a2c20' },
  pantalla: { position: 'relative', width: '100%', height: '100%', borderRadius: 22, overflow: 'hidden', background: 'var(--ts-verde-oscuro, #1f7a3c)', transform: 'translateZ(0)' },
  iframe: { width: '100%', height: '100%', border: 0, display: 'block', background: '#0d2a18' },
  scroll: { position: 'absolute', inset: 0, overflowY: 'auto', overflowX: 'hidden' },
  pantallaVacia: { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFF8ED', fontFamily: "'Fredoka', sans-serif", fontWeight: 600, fontSize: 16 },
  eventosFila: { display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' },
  btnTienda: { marginTop: 12, width: '100%', fontFamily: "'Fredoka', sans-serif", fontWeight: 700, fontSize: 16, color: '#4A2C2A', background: 'linear-gradient(180deg, #FFD147 0%, #E69D00 100%)', border: '2.5px solid #000', borderRadius: 999, padding: '10px 16px', boxShadow: '0 4px 0 #000' },
  textoPopup: { margin: '0 0 10px', fontWeight: 800, fontSize: 15, color: '#2C160E', textAlign: 'center' },
  pie: { margin: 0, fontSize: 12, color: '#6b5a50', wordBreak: 'break-all', textAlign: 'center' },
};
