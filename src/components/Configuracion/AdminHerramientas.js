import React, { useCallback, useEffect, useState } from 'react';
import { PlacaMadera, confirmarPopup } from '../Popup/PopupMadera';
import { API_URL as BASE_URL } from '../../config';

// Pase 640: herramientas nuevas del panel de administración (solo rol 'admin'; se montan desde Configuracion.js):
//   • AdminResumen  → números del día y estado de los eventos (solo lectura)
//   • AdminUsuarios → buscar un jugador, ver su ficha y sumar/restar mates o fijar sus puntos de la Liga
//   • AdminAcciones → registro de lo que hicieron los admins (quién, a quién, qué y cuándo)
// Usa los endpoints /api/admin/* del backend (adminHerramientas.js), que exigen rol admin en cada llamada.
const API = `${BASE_URL}/api/admin`;
const C = { chocolate: '#4A2C2A', dorado: '#F5B041', verde: '#1f7a3c', rojo: '#c2352a', gris: '#7a6660' };

async function pedir(token, ruta, opciones = {}) {
  const res = await fetch(`${API}${ruta}`, {
    ...opciones,
    headers: { Authorization: `Bearer ${token}`, ...(opciones.body ? { 'Content-Type': 'application/json' } : {}) },
  });
  const datos = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(datos.error || 'No se pudo completar la acción');
  return datos;
}

const fecha = (v) => (v ? new Date(v).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—');
const num = (v) => (v == null ? '—' : Number(v).toLocaleString('es-AR'));

const NOMBRES_ACCION = {
  suspender: 'Suspendió', reactivar: 'Levantó suspensión', regalo: 'Regaló mates', mates_sumar: 'Sumó mates', mates_restar: 'Restó mates',
  puntos_rango: 'Fijó puntos de Liga', sponsor_otorgar: 'Dio sponsor', sponsor_quitar: 'Quitó sponsor', chat_limpiar: 'Limpió el chat', reporte_premio: 'Premió un reporte', devolucion: 'Registró una devolución',
};

function Ficha({ etiqueta, valor, color }) {
  return (
    <div style={estilos.ficha}>
      <div style={{ ...estilos.fichaValor, ...(color ? { color } : {}) }}>{valor}</div>
      <div style={estilos.fichaEtiqueta}>{etiqueta}</div>
    </div>
  );
}

// ---------- Resumen del día ----------
export function AdminResumen({ token }) {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      setDatos(await pedir(token, '/resumen'));
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }, [token]);

  useEffect(() => { cargar(); }, [cargar]);

  const colorEstado = (e) => (e === 'abierto' || e === 'activo' || e === 'definida' ? C.verde : e === 'fecha inválida' ? C.rojo : C.gris);

  return (
    <PlacaMadera>
      <div style={estilos.titulo}>
        <span>📊 Resumen del día</span>
        <button style={estilos.btn} disabled={cargando} onClick={cargar}>{cargando ? 'Actualizando…' : 'Actualizar'}</button>
      </div>
      {error && <p style={estilos.error}>{error}</p>}
      {datos && (
        <>
          <div style={estilos.subtitulo}>Jugadores</div>
          <div style={estilos.grilla}>
            <Ficha etiqueta="Registrados" valor={num(datos.usuarios.total)} />
            <Ficha etiqueta="Nuevos (24 h)" valor={num(datos.usuarios.nuevos_24h)} />
            <Ficha etiqueta="Nuevos (7 días)" valor={num(datos.usuarios.nuevos_7d)} />
            <Ficha etiqueta="Entraron hoy" valor={num(datos.usuarios.activos_hoy)} />
            <Ficha etiqueta="Entraron (7 días)" valor={num(datos.usuarios.activos_7d)} />
            <Ficha etiqueta="Conectados ahora" valor={num(datos.conectados)} />
          </div>
          <div style={estilos.subtitulo}>Partidas y mates</div>
          <div style={estilos.grilla}>
            <Ficha etiqueta="Partidas de Liga (24 h)" valor={num(datos.partidas.liga_24h)} />
            <Ficha etiqueta="Salas abiertas" valor={num(datos.partidas.salas_abiertas)} />
            <Ficha etiqueta="Salas jugando" valor={num(datos.partidas.salas_en_juego)} />
            <Ficha etiqueta="Mates en circulación" valor={datos.mates ? num(datos.mates.en_circulacion) : '—'} />
            <Ficha etiqueta="Promedio por jugador" valor={datos.mates ? num(datos.mates.promedio) : '—'} />
          </div>
          <div style={estilos.subtitulo}>Para atender</div>
          <div style={estilos.grilla}>
            <Ficha etiqueta="Reportes sin revisar" valor={num(datos.pendientes.reportes)} color={datos.pendientes.reportes ? C.rojo : undefined} />
            <Ficha etiqueta="Denuncias sin revisar" valor={num(datos.pendientes.denuncias)} color={datos.pendientes.denuncias ? C.rojo : undefined} />
            <Ficha etiqueta="Cuentas suspendidas" valor={num(datos.usuarios.suspendidos)} />
          </div>
          <div style={estilos.subtitulo}>Eventos y variables (solo lectura; se cambian en Railway)</div>
          <div style={estilos.lista}>
            {datos.eventos.map((ev) => (
              <div key={ev.nombre} style={estilos.fila}>
                <div style={{ flex: 1 }}>
                  <div style={estilos.filaTitulo}>{ev.etiqueta}</div>
                  <div style={estilos.filaDetalle}>{ev.nombre}{ev.valor ? ` = ${ev.valor}` : ''}</div>
                </div>
                <span style={{ ...estilos.pastilla, color: colorEstado(ev.estado), borderColor: colorEstado(ev.estado) }}>{ev.estado}</span>
              </div>
            ))}
          </div>
          <p style={estilos.pie}>Actualizado {fecha(datos.generado_en)}. Los números de “entraron hoy” usan el día del servidor.</p>
        </>
      )}
    </PlacaMadera>
  );
}

// ---------- Jugadores: buscar y ficha ----------
export function AdminUsuarios({ token }) {
  const [q, setQ] = useState('');
  const [resultados, setResultados] = useState(null);
  const [ficha, setFicha] = useState(null);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [mates, setMates] = useState('');
  const [motivoMates, setMotivoMates] = useState('');
  const [puntos, setPuntos] = useState('');
  const [motivoPuntos, setMotivoPuntos] = useState('');

  const buscar = async () => {
    const texto = q.trim();
    if (!texto) return;
    setOcupado(true); setError(''); setAviso(''); setFicha(null);
    try {
      const d = await pedir(token, `/usuarios/buscar?q=${encodeURIComponent(texto)}`);
      setResultados(d.usuarios);
    } catch (e) { setError(e.message); }
    finally { setOcupado(false); }
  };

  const abrirFicha = useCallback(async (id) => {
    setOcupado(true); setError(''); setAviso('');
    try {
      const d = await pedir(token, `/usuarios/${id}/ficha`);
      setFicha(d);
      setPuntos(String(d.usuario.puntos_rango));
      setMates(''); setMotivoMates(''); setMotivoPuntos('');
    } catch (e) { setError(e.message); }
    finally { setOcupado(false); }
  }, [token]);

  const ajustarMates = async () => {
    const cantidad = parseInt(mates, 10);
    if (!Number.isInteger(cantidad) || cantidad === 0) { setError('Escribí una cantidad de mates (negativa para restar)'); return; }
    const u = ficha.usuario;
    const ok = await confirmarPopup({ titulo: 'Ajustar mates', mensaje: `${cantidad > 0 ? 'Sumar' : 'Restar'} ${Math.abs(cantidad)} mates a ${u.username}?`, textoSi: 'Aplicar' });
    if (!ok) return;
    setOcupado(true); setError(''); setAviso('');
    try {
      const d = await pedir(token, `/usuarios/${u.id}/mates`, { method: 'POST', body: JSON.stringify({ cantidad, motivo: motivoMates }) });
      setAviso(d.mensaje);
      await abrirFicha(u.id);
      setAviso(d.mensaje);
    } catch (e) { setError(e.message); setOcupado(false); }
  };

  const fijarPuntos = async () => {
    const valor = parseInt(puntos, 10);
    if (!Number.isInteger(valor) || valor < 0) { setError('Escribí los puntos de la Liga (0 o más)'); return; }
    const u = ficha.usuario;
    const ok = await confirmarPopup({ titulo: 'Fijar puntos de la Liga', mensaje: `Dejar a ${u.username} en ${valor} puntos? (hoy tiene ${u.puntos_rango}). No da premios por ascenso.`, textoSi: 'Fijar' });
    if (!ok) return;
    setOcupado(true); setError(''); setAviso('');
    try {
      const d = await pedir(token, `/usuarios/${u.id}/puntos-rango`, { method: 'POST', body: JSON.stringify({ puntos: valor, motivo: motivoPuntos }) });
      await abrirFicha(u.id);
      setAviso(d.mensaje);
    } catch (e) { setError(e.message); setOcupado(false); }
  };

  const u = ficha && ficha.usuario;

  return (
    <PlacaMadera>
      <div style={estilos.titulo}><span>🧑‍💼 Jugadores</span></div>
      <p style={estilos.pie}>Buscá por ID o parte del nombre. Desde la ficha podés ajustar mates y puntos de la Liga (queda anotado en Acciones). Para suspender o regalar con mensaje usá sus pestañas.</p>
      <div style={estilos.filaBusqueda}>
        <input id="admin-usuario-busqueda" style={estilos.input} type="text" placeholder="ID o nombre de usuario" value={q} maxLength={50}
          onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') buscar(); }} />
        <button style={estilos.btn} disabled={ocupado || !q.trim()} onClick={buscar}>Buscar</button>
      </div>
      {error && <p style={estilos.error}>{error}</p>}
      {aviso && <p style={estilos.ok}>{aviso}</p>}

      {!ficha && resultados && (
        resultados.length === 0 ? <p style={estilos.pie}>No hay jugadores que coincidan.</p> : (
          <div style={estilos.lista}>
            {resultados.map((r) => (
              <div key={r.id} style={estilos.fila}>
                <div style={{ flex: 1 }}>
                  <div style={estilos.filaTitulo}>{r.username} <span style={estilos.filaDetalle}>#{r.id}{r.rol === 'admin' ? ' · admin' : ''}</span></div>
                  <div style={estilos.filaDetalle}>{r.rango} · {num(r.puntos_rango)} pts · {num(r.saldo)} mates</div>
                </div>
                <button style={estilos.btn} disabled={ocupado} onClick={() => abrirFicha(r.id)}>Ver ficha</button>
              </div>
            ))}
          </div>
        )
      )}

      {u && (
        <div>
          <div style={estilos.fila}>
            <div style={{ flex: 1 }}>
              <div style={{ ...estilos.filaTitulo, fontSize: 17 }}>{u.username} <span style={estilos.filaDetalle}>#{u.id} · {u.email}</span></div>
              <div style={estilos.filaDetalle}>
                Registrado {fecha(u.creado_en)}{u.rol === 'admin' ? ' · ADMIN' : ''}{u.kit_fundador ? ' · Kit Beta Tester' : ''}{u.sponsor_plan ? ` · Sponsor ${u.sponsor_plan}` : ''}
                {u.email_verificado === false ? ' · email sin verificar' : ''}
              </div>
              {u.suspendido && (
                <div style={{ ...estilos.filaDetalle, color: C.rojo, fontWeight: 800 }}>
                  Suspendido {u.suspension_permanente ? 'de forma permanente' : `hasta ${fecha(u.suspendido_hasta)}`}{u.suspension_motivo ? ` — ${u.suspension_motivo}` : ''}
                </div>
              )}
            </div>
            <button style={estilos.btnSec} onClick={() => { setFicha(null); setAviso(''); setError(''); }}>Volver</button>
          </div>

          <div style={estilos.grilla}>
            <Ficha etiqueta="Mates" valor={num(u.saldo)} />
            <Ficha etiqueta="Rango" valor={u.rango} />
            <Ficha etiqueta="Puntos de Liga" valor={num(u.puntos_rango)} />
            <Ficha etiqueta="Rango máximo" valor={u.rango_max || '—'} />
            <Ficha etiqueta="Partidas" valor={`${num(u.partidas_ganadas)}/${num(u.partidas_jugadas)}`} />
            <Ficha etiqueta="Abandonos" valor={num(u.abandonos)} color={u.abandonos > 5 ? C.rojo : undefined} />
            <Ficha etiqueta="Liga (ganadas/jugadas)" valor={u.ranked_jugadas == null ? '—' : `${num(u.ranked_ganadas)}/${num(u.ranked_jugadas)}`} />
            <Ficha etiqueta="Denuncias recibidas" valor={num(u.denuncias_recibidas)} color={u.denuncias_recibidas ? C.rojo : undefined} />
            <Ficha etiqueta="Último ingreso" valor={u.ultimo_login ? new Date(u.ultimo_login).toLocaleDateString('es-AR') : '—'} />
          </div>

          <div style={estilos.subtitulo}>Sumar o restar mates</div>
          <div style={estilos.filaBusqueda}>
            <input id="admin-mates-cantidad" style={{ ...estilos.input, flex: '0 0 110px' }} type="number" placeholder="Ej.: 50 o -20" value={mates} onChange={(e) => setMates(e.target.value)} />
            <input id="admin-mates-motivo" style={estilos.input} type="text" placeholder="Motivo (obligatorio)" maxLength={200} value={motivoMates} onChange={(e) => setMotivoMates(e.target.value)} />
            <button style={estilos.btn} disabled={ocupado || !mates || motivoMates.trim().length < 3} onClick={ajustarMates}>Aplicar</button>
          </div>

          <div style={estilos.subtitulo}>Puntos de la Liga</div>
          <div style={estilos.filaBusqueda}>
            <input id="admin-puntos-valor" style={{ ...estilos.input, flex: '0 0 110px' }} type="number" min="0" placeholder="Puntos" value={puntos} onChange={(e) => setPuntos(e.target.value)} />
            <input id="admin-puntos-motivo" style={estilos.input} type="text" placeholder="Motivo (obligatorio)" maxLength={200} value={motivoPuntos} onChange={(e) => setMotivoPuntos(e.target.value)} />
            <button style={estilos.btn} disabled={ocupado || puntos === '' || motivoPuntos.trim().length < 3} onClick={fijarPuntos}>Fijar</button>
          </div>
          <p style={estilos.pie}>Si le bajás los puntos, conserva el rango máximo alcanzado (y las piezas del set que ya desbloqueó).</p>

          <div style={estilos.subtitulo}>Últimos movimientos de mates</div>
          {ficha.transacciones.length === 0 ? <p style={estilos.pie}>Sin movimientos.</p> : (
            <div style={estilos.lista}>
              {ficha.transacciones.map((t, i) => (
                <div key={i} style={estilos.fila}>
                  <div style={{ flex: 1 }}>
                    <div style={estilos.filaDetalle}>{t.tipo}{t.descripcion ? ` · ${t.descripcion}` : ''}</div>
                    <div style={estilos.filaDetalle}>{fecha(t.creada_en)}</div>
                  </div>
                  <strong style={{ color: Number(t.monto) >= 0 ? C.verde : C.rojo }}>{Number(t.monto) > 0 ? '+' : ''}{num(t.monto)}</strong>
                </div>
              ))}
            </div>
          )}

          <div style={estilos.subtitulo}>Acciones de admin sobre este jugador</div>
          {ficha.acciones.length === 0 ? <p style={estilos.pie}>Ninguna todavía.</p> : (
            <div style={estilos.lista}>
              {ficha.acciones.map((a, i) => (
                <div key={i} style={estilos.fila}>
                  <div style={{ flex: 1 }}>
                    <div style={estilos.filaTitulo}>{NOMBRES_ACCION[a.accion] || a.accion} <span style={estilos.filaDetalle}>por {a.admin_nombre || '—'}</span></div>
                    <div style={estilos.filaDetalle}>{a.detalle} · {fecha(a.creado_en)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </PlacaMadera>
  );
}

// ---------- Registro de acciones ----------
export function AdminAcciones({ token }) {
  const [acciones, setAcciones] = useState(null);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true); setError('');
    try {
      const d = await pedir(token, '/acciones?limite=100');
      setAcciones(d.acciones);
    } catch (e) { setError(e.message); }
    finally { setCargando(false); }
  }, [token]);

  useEffect(() => { cargar(); }, [cargar]);

  return (
    <PlacaMadera>
      <div style={estilos.titulo}>
        <span>📜 Registro de acciones</span>
        <button style={estilos.btn} disabled={cargando} onClick={cargar}>{cargando ? 'Actualizando…' : 'Actualizar'}</button>
      </div>
      <p style={estilos.pie}>Lo que hicieron los administradores: suspensiones, regalos, ajustes de mates y puntos, sponsors y limpieza del chat.</p>
      {error && <p style={estilos.error}>{error}</p>}
      {acciones && (acciones.length === 0 ? <p style={estilos.pie}>Todavía no hay acciones registradas (empiezan a anotarse desde ahora).</p> : (
        <div style={estilos.lista}>
          {acciones.map((a) => (
            <div key={a.id} style={estilos.fila}>
              <div style={{ flex: 1 }}>
                <div style={estilos.filaTitulo}>
                  {NOMBRES_ACCION[a.accion] || a.accion}{a.usuario_nombre ? ` → ${a.usuario_nombre}` : ''} <span style={estilos.filaDetalle}>por {a.admin_nombre || '—'}</span>
                </div>
                <div style={estilos.filaDetalle}>{a.detalle}</div>
              </div>
              <div style={{ ...estilos.filaDetalle, whiteSpace: 'nowrap' }}>{fecha(a.creado_en)}</div>
            </div>
          ))}
        </div>
      ))}
    </PlacaMadera>
  );
}

// ---------- Pase 654: compras y devoluciones ----------
// La plata se devuelve desde Mercado Pago (Actividad → la operación → "Devolver dinero"): vuelve al MISMO medio de pago, no hace
// falta pedir alias ni CBU. Acá solo se registra la devolución en el juego (descuenta los mates de esa compra).
const FILTROS_COMPRA = [
  { id: '', texto: 'Todas' },
  { id: 'aprobado', texto: 'Aprobadas' },
  { id: 'devuelto', texto: 'Devueltas' },
];
const colorEstadoCompra = (e) => (e === 'aprobado' ? C.verde : e === 'devuelto' ? '#B9770E' : C.gris);

export function AdminDevoluciones({ token }) {
  const [q, setQ] = useState('');
  const [estado, setEstado] = useState('');
  const [pagos, setPagos] = useState(null);
  const [pendientes, setPendientes] = useState(0);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [cargando, setCargando] = useState(false);
  const [abierta, setAbierta] = useState(null);
  const [motivo, setMotivo] = useState('');

  const cargar = useCallback(async (texto, est) => {
    setCargando(true); setError('');
    try {
      const d = await pedir(token, `/pagos?q=${encodeURIComponent((texto || '').trim())}&estado=${est || ''}`);
      setPagos(d.pagos); setPendientes(d.pendientesDescuento || 0);
    } catch (e) { setError(e.message); }
    finally { setCargando(false); }
  }, [token]);

  useEffect(() => { cargar('', ''); }, [cargar]);

  const elegirFiltro = (id) => { setEstado(id); cargar(q, id); };

  const registrar = async (p) => {
    if (motivo.trim().length < 3) { setError('Escribí el motivo de la devolución'); return; }
    const ok = await confirmarPopup({
      titulo: 'Registrar devolución',
      mensaje: `¿Ya devolviste el dinero desde Mercado Pago? Se van a descontar hasta ${num(p.monedas)} mates a ${p.username} (tiene ${num(p.saldo)}).`,
      textoSi: 'Descontar mates',
    });
    if (!ok) return;
    setCargando(true); setError(''); setAviso('');
    try {
      const d = await pedir(token, `/pagos/${p.id}/devolucion`, { method: 'POST', body: JSON.stringify({ motivo: motivo.trim() }) });
      setAviso(d.mensaje); setAbierta(null); setMotivo('');
      await cargar(q, estado);
    } catch (e) { setError(e.message); setCargando(false); }
  };

  return (
    <PlacaMadera>
      <div style={estilos.titulo}>
        <span>💳 Compras y devoluciones</span>
        <button style={estilos.btn} disabled={cargando} onClick={() => cargar(q, estado)}>{cargando ? 'Actualizando…' : 'Actualizar'}</button>
      </div>
      <p style={estilos.pie}>
        1) Devolvé el dinero en Mercado Pago (Actividad → la operación → Devolver dinero): vuelve al mismo medio de pago, no necesitás alias ni CBU.
        {' '}2) Después registrá acá la devolución para descontar los mates de esa compra.
      </p>
      {pendientes > 0 && <p style={estilos.error}>{pendientes} compra{pendientes === 1 ? '' : 's'} devuelta{pendientes === 1 ? '' : 's'} en Mercado Pago con los mates sin descontar.</p>}
      <div style={estilos.filaBusqueda}>
        <input id="admin-compras-busqueda" style={estilos.input} type="text" placeholder="Usuario, email, ID o N.º de operación" value={q} maxLength={80}
          onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') cargar(q, estado); }} />
        <button style={estilos.btn} disabled={cargando} onClick={() => cargar(q, estado)}>Buscar</button>
        {FILTROS_COMPRA.map((f) => (
          <button key={f.id || 'todas'} style={estado === f.id ? estilos.btn : estilos.btnSec} onClick={() => elegirFiltro(f.id)}>{f.texto}</button>
        ))}
      </div>
      {error && <p style={estilos.error}>{error}</p>}
      {aviso && <p style={estilos.ok}>{aviso}</p>}
      {pagos && (pagos.length === 0 ? <p style={estilos.pie}>No hay compras para mostrar.</p> : (
        <div style={estilos.lista}>
          {pagos.map((p) => {
            const sinDescontar = (p.estado === 'aprobado' || p.estado === 'devuelto') && !p.mates_descontados_en;
            return (
              <div key={p.id} style={{ ...estilos.fila, flexDirection: 'column', alignItems: 'stretch' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'space-between', flexWrap: 'wrap' }}>
                  <div style={estilos.filaTitulo}>#{p.id} · {p.username} · ${num(p.monto)}</div>
                  <span style={{ ...estilos.pastilla, color: colorEstadoCompra(p.estado), borderColor: colorEstadoCompra(p.estado) }}>{p.estado}</span>
                </div>
                <div style={estilos.filaDetalle}>{p.pack_id} · {num(p.monedas)} mates · saldo actual {num(p.saldo)}</div>
                <div style={estilos.filaDetalle}>Operación de Mercado Pago: {p.mp_payment_id || '—'}</div>
                <div style={estilos.filaDetalle}>Email: {p.email || '—'} · Compra: {fecha(p.acreditado_en || p.creado_en)}</div>
                {p.mates_descontados_en && <div style={estilos.filaDetalle}>Se descontaron {num(p.mates_descontados)} mates el {fecha(p.mates_descontados_en)}.</div>}
                {p.estado === 'devuelto' && !p.mates_descontados_en && <div style={{ ...estilos.filaDetalle, color: C.rojo }}>Mercado Pago la devolvió y faltan descontar los mates.</div>}
                {sinDescontar && abierta !== p.id && (
                  <div style={{ marginTop: 6 }}><button style={estilos.btnSec} onClick={() => { setAbierta(p.id); setMotivo(''); setError(''); }}>Registrar devolución</button></div>
                )}
                {abierta === p.id && (
                  <div style={{ ...estilos.filaBusqueda, marginBottom: 0 }}>
                    <input id={`admin-devolucion-motivo-${p.id}`} style={estilos.input} type="text" placeholder="Motivo (obligatorio)" maxLength={200} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
                    <button style={estilos.btn} disabled={cargando} onClick={() => registrar(p)}>Descontar mates</button>
                    <button style={estilos.btnSec} onClick={() => setAbierta(null)}>Cancelar</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </PlacaMadera>
  );
}

const estilos = {
  titulo: {
    fontFamily: "'Fredoka', sans-serif", fontWeight: 700, fontSize: 20, color: C.chocolate, marginBottom: 12, paddingBottom: 10,
    borderBottom: `2px solid ${C.chocolate}1a`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
  },
  subtitulo: { fontFamily: "'Fredoka', sans-serif", fontWeight: 600, fontSize: 15, color: C.chocolate, margin: '16px 0 8px' },
  grilla: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 },
  ficha: { background: '#fff', border: `2px solid ${C.chocolate}22`, borderRadius: 12, padding: '12px 8px', textAlign: 'center' },
  fichaValor: { fontFamily: "'Fredoka', sans-serif", fontWeight: 700, fontSize: 24, color: C.chocolate, lineHeight: 1.1 },
  fichaEtiqueta: { fontSize: 12, fontWeight: 700, color: C.gris, marginTop: 4 },
  lista: { display: 'flex', flexDirection: 'column', gap: 8 },
  fila: { display: 'flex', alignItems: 'center', gap: 10, background: '#fff', border: `2px solid ${C.chocolate}22`, borderRadius: 12, padding: '9px 12px' },
  filaTitulo: { fontSize: 13.5, fontWeight: 800, color: C.chocolate },
  filaDetalle: { fontSize: 12, fontWeight: 600, color: C.gris, marginTop: 2 },
  pastilla: { fontSize: 11.5, fontWeight: 800, border: '2px solid', borderRadius: 999, padding: '3px 10px', whiteSpace: 'nowrap', background: '#fff' },
  pie: { fontSize: 12, color: C.gris, fontWeight: 700, margin: '10px 0 0' },
  error: { background: '#ffe0dd', color: C.rojo, fontWeight: 700, fontSize: 12.5, borderRadius: 10, padding: 8, margin: '10px 0' },
  ok: { background: '#d8f0da', color: C.verde, fontWeight: 700, fontSize: 12.5, borderRadius: 10, padding: 8, margin: '10px 0' },
  filaBusqueda: { display: 'flex', gap: 8, alignItems: 'center', margin: '8px 0', flexWrap: 'wrap' },
  input: { flex: 1, minWidth: 140, boxSizing: 'border-box', fontSize: 14, fontWeight: 600, color: C.chocolate, background: '#fff', border: `2px solid ${C.chocolate}55`, borderRadius: 10, padding: '8px 10px' },
  btn: { fontSize: 12, fontWeight: 800, color: C.chocolate, background: C.dorado, border: `2px solid ${C.chocolate}`, borderRadius: 8, padding: '7px 12px', cursor: 'pointer', whiteSpace: 'nowrap' },
  btnSec: { fontSize: 12, fontWeight: 800, color: C.chocolate, background: '#fff', border: `2px solid ${C.chocolate}`, borderRadius: 8, padding: '7px 12px', cursor: 'pointer', whiteSpace: 'nowrap' },
};
