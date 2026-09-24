import React from 'react';

// Pase siguiente: texto real de la Política de Privacidad, mandado por el
// usuario como PDF ("Recurso_19092026.pdf", con fecha de última
// actualización 19/09/2025 en el propio documento) — reemplaza el
// placeholder que había desde el pase 147. Transcripto tal cual, sin
// reescribir ni resumir nada (es un documento legal) — la única
// estructura nueva es puramente de presentación: el texto se separó en
// un array de secciones (`SECCIONES`) para poder tipografiarlo con la
// misma jerarquía que ya usa el resto de la app (título dorado, texto
// chocolate/gris) en vez de un bloque de texto plano. La tabla de
// "con quién compartimos información" (punto 4 del documento) se
// convirtió en una lista de tarjetas en vez de una tabla HTML — mismo
// contenido, más cómodo de leer en una columna angosta.
//
// Nota para el usuario: el punto 11 del documento original dice "te
// avisaríamos... (punto 12)" al referirse a los avisos de cambios de
// política, pero esa sección es en realidad el punto 13 ("Cambios a
// esta política") en la numeración del propio documento — se transcribió
// tal cual vino, sin corregirlo, por si prefieren ajustarlo en el
// original.
const C = {
  dorado: '#FFB627', doradoOscuro: '#C9860E',
  crema: '#FFF8ED', chocolate: '#4A2C2A',
};

const FECHA_ACTUALIZACION = '19/09/2025';

const SECCIONES = [
  {
    titulo: '1. Introducción',
    parrafos: [
      'TrucoChe ("nosotros", "la aplicación", "el juego") es un juego de truco argentino multijugador online, disponible en versión web y móvil. Esta Política de Privacidad explica qué información recolectamos de los usuarios, cómo la usamos, con quién la compartimos y qué derechos tenés sobre tus datos.',
      'Al crear una cuenta o usar TrucoChe, aceptás las prácticas descritas en este documento.',
      'Responsable del tratamiento de datos: TrucoChe. Contacto: trucoargentino.dev@gmail.com',
    ],
  },
  {
    titulo: '2. Qué información recolectamos',
    subsecciones: [
      {
        subtitulo: '2.1 Información que nos proporcionás directamente',
        lista: [
          'Dirección de correo electrónico',
          'Contraseña (almacenada de forma encriptada, nunca en texto plano)',
          'Nombre de usuario',
          'Foto de perfil (opcional, si elegís usar tu foto de Google/Facebook en lugar de un personaje del juego)',
        ],
      },
      {
        subtitulo: '2.2 Información de inicio de sesión con terceros',
        parrafos: [
          'Si elegís iniciar sesión con Google o Facebook, recibimos de esos servicios tu nombre, dirección de email, foto de perfil asociada a esa cuenta y el identificador único que ese proveedor te asigna (necesario para reconocer tu cuenta en futuros inicios de sesión), según los permisos que autorices en el momento de conectar.',
        ],
      },
      {
        subtitulo: '2.3 Información generada por el uso del juego',
        lista: [
          'Estadísticas de partidas (victorias, derrotas, rachas, resultados de torneos)',
          'Historial de partidas jugadas',
          'Saldo de moneda virtual dentro del juego',
          'Logros y misiones completadas',
          'Mensajes de chat (stickers) enviados dentro de las salas de juego',
        ],
      },
      {
        subtitulo: '2.4 Audio en salas privadas',
        parrafos: [
          'Si usás la función de chat de voz en salas privadas, tu audio se transmite en tiempo real a través de nuestro proveedor de infraestructura de comunicación (Daily.co) para permitir la conversación con otros jugadores en la misma sala. No grabamos ni almacenamos este audio.',
        ],
      },
      {
        subtitulo: '2.5 Información técnica',
        lista: [
          'Dirección IP',
          'Tipo de dispositivo y sistema operativo',
          'Identificadores de sesión',
        ],
      },
    ],
  },
  {
    titulo: '3. Cómo usamos tu información',
    parrafosPrevios: ['Usamos la información recolectada para:'],
    lista: [
      'Crear y administrar tu cuenta',
      'Permitir el funcionamiento de las partidas multijugador en tiempo real',
      'Calcular y mostrar estadísticas, rankings y logros',
      'Enviar comunicaciones relacionadas con tu cuenta (por ejemplo, recuperación de contraseña)',
      'Mejorar el funcionamiento y la seguridad de la aplicación',
      'Prevenir fraude, trampas o uso indebido del sistema de moneda virtual',
    ],
    parrafos: [
      'Si detectamos un uso fraudulento del juego o de la economía virtual (por ejemplo, coordinar partidas para transferirse créditos de forma artificial, explotar errores del sistema, o usar múltiples cuentas para manipular resultados), podemos suspender o eliminar la cuenta involucrada. Si la gravedad lo amerita, esta medida puede extenderse a otras cuentas que identifiquemos como vinculadas a la misma persona.',
    ],
  },
  {
    titulo: '4. Con quién compartimos información',
    parrafosPrevios: [
      'No vendemos tu información personal a terceros. Compartimos datos únicamente con los siguientes proveedores de servicios, necesarios para el funcionamiento de la aplicación:',
    ],
    tabla: [
      { proveedor: 'Google / Facebook', funcion: 'Inicio de sesión social', datos: 'Nombre, email, foto de perfil (si autorizás)' },
      { proveedor: 'Daily.co', funcion: 'Chat de voz en salas privadas', datos: 'Audio en tiempo real (no almacenado)' },
      { proveedor: 'Resend', funcion: 'Envío de emails transaccionales (ej. recuperación de contraseña)', datos: 'Dirección de email' },
      { proveedor: 'Mercado Pago', funcion: 'Procesamiento de pagos para compra de créditos (a completar cuando esté integrado)', datos: 'Datos de pago (procesados directamente por Mercado Pago, no almacenamos datos de tarjetas)' },
    ],
    parrafos: [
      'Cada uno de estos proveedores tiene su propia política de privacidad, que rige el tratamiento que ellos hacen de los datos que procesan en nuestro nombre.',
    ],
  },
  {
    titulo: '5. Moneda virtual — aclaración importante',
    parrafos: [
      'TrucoChe utiliza un sistema de moneda virtual propia, sin valor monetario fuera de la aplicación. Esta moneda se puede obtener de forma gratuita (bonos diarios, misiones, logros) y, en el futuro, mediante compra directa dentro de la app.',
      'TrucoChe no aloja ni administra apuestas de dinero real ni juegos de azar con dinero real. Cualquier actividad de dinero real entre usuarios que pudiera organizarse por fuera de la aplicación (por ejemplo, a través de grupos externos de mensajería) es completamente ajena a TrucoChe, no es operada, supervisada ni respaldada por nosotros, y no está cubierta por esta Política de Privacidad ni por los Términos de Servicio de la aplicación.',
    ],
  },
  {
    titulo: '6. Convivencia dentro del juego',
    parrafos: [
      'TrucoChe tiene espacios de interacción entre jugadores: chat con stickers y, en salas privadas, chat de voz. Para que el juego sea un lugar cómodo para todos, no se permite el uso de estos espacios para expresiones de odio, discriminación (por raza, género, orientación sexual, nacionalidad, religión u otra condición), acoso hacia otros jugadores, ni contenido que incite a la violencia.',
      'El incumplimiento de esta norma puede derivar en la suspensión temporal o permanente de la cuenta, según la gravedad. En los casos que correspondan, colaboraremos con las autoridades competentes si la conducta reportada constituye un delito.',
      'Como el chat de voz funciona en tiempo real y no se graba (ver punto 2.4), la moderación de voz depende principalmente de los reportes que hagan los propios jugadores dentro de la sala. Los mensajes de chat con stickers, en cambio, sí quedan registrados en nuestros servidores por un tiempo, ya que son el principal medio con el que contamos para revisar un reporte de mal comportamiento y decidir si corresponde una sanción.',
    ],
  },
  {
    titulo: '7. Seguridad de los datos',
    parrafosPrevios: ['Implementamos medidas técnicas razonables para proteger tu información, incluyendo:'],
    lista: [
      'Encriptación de contraseñas (hash, nunca almacenadas en texto plano)',
      'Conexiones seguras (HTTPS) entre la aplicación y nuestros servidores',
      'Acceso restringido a las bases de datos de producción',
    ],
    parrafos: [
      'Ningún sistema es 100% infalible, y no podemos garantizar seguridad absoluta, pero trabajamos activamente para proteger tu información.',
    ],
  },
  {
    titulo: '8. Tus derechos',
    parrafosPrevios: ['Podés, en cualquier momento:'],
    lista: [
      'Acceder a los datos que tenemos sobre vos',
      'Solicitar la corrección de datos incorrectos',
      'Solicitar la eliminación de tu cuenta y datos asociados',
      'Retirar el permiso de inicio de sesión social (desconectando Google/Facebook desde la configuración de tu cuenta)',
    ],
    parrafos: [
      'Para ejercer cualquiera de estos derechos, escribinos a trucoargentino.dev@gmail.com.',
    ],
  },
  {
    titulo: '9. Menores de edad',
    parrafos: [
      'TrucoChe está dirigido a usuarios mayores de 16 años. No recolectamos intencionalmente información de menores de esa edad. Si tomamos conocimiento de que un menor por debajo de la edad mínima nos proporcionó datos personales, procederemos a eliminar dicha información.',
    ],
  },
  {
    titulo: '10. Qué pasa cuando eliminás tu cuenta',
    parrafos: [
      'Cuando solicitás la eliminación de tu cuenta desde la aplicación, el proceso funciona en dos etapas:',
      'Etapa 1 — Desactivación inmediata. Tu cuenta deja de estar visible para otros jugadores (no aparece en rankings, búsquedas ni salas) y ya no podés iniciar sesión con normalidad.',
      'Etapa 2 — Período de arrepentimiento (30 días). Durante los 30 días posteriores a la desactivación, conservamos tus datos por si querés recuperar la cuenta. Si volvés a iniciar sesión dentro de ese plazo, tu cuenta y toda tu información (estadísticas, personaje, historial) se restauran automáticamente. Pasados los 30 días sin que vuelvas a ingresar, eliminamos de forma definitiva y sin posibilidad de recuperación tus datos personales (nombre de usuario, foto de perfil, estadísticas e historial de partidas).',
      'Podés pedirnos también una eliminación inmediata y definitiva, sin pasar por el período de 30 días, escribiéndonos a trucoargentino.dev@gmail.com. En ese caso, podemos pedirte alguna verificación para confirmar que sos el titular de la cuenta.',
      'Aun eliminada la cuenta, podemos conservar tu dirección de email por un tiempo adicional únicamente para evitar el registro de cuentas duplicadas o la reincidencia de usuarios que hayan sido suspendidos por incumplir las normas de convivencia (punto 6).',
    ],
  },
  {
    titulo: '11. Si TrucoChe cambia de manos',
    parrafos: [
      'Si en el futuro TrucoChe fuera adquirido por otra empresa, se fusionara con otro proyecto, o cambiara su estructura de titularidad, tus datos podrían transferirse como parte de esa operación. En ese caso, te avisaríamos con anticipación por los mismos medios que usamos para notificar cambios a esta política (punto 13), y la nueva parte responsable quedaría obligada a respetar los compromisos de privacidad ya asumidos acá, salvo que aceptes expresamente una nueva política.',
    ],
  },
  {
    titulo: '12. Enlaces a sitios externos',
    parrafos: [
      'Dentro de la aplicación o en nuestras redes sociales podés encontrar enlaces a sitios de terceros (por ejemplo, redes sociales o canales de contacto). No somos responsables de las prácticas de privacidad de esos sitios externos, y te recomendamos revisar sus propias políticas antes de compartir información ahí.',
    ],
  },
  {
    titulo: '13. Cambios a esta política',
    parrafos: [
      'Podemos actualizar esta Política de Privacidad periódicamente. Notificaremos cambios significativos a través de la aplicación o por correo electrónico. La fecha de "Última actualización" en la parte superior de este documento refleja la versión vigente.',
    ],
  },
  {
    titulo: '14. Contacto',
    parrafos: [
      'Si tenés preguntas sobre esta Política de Privacidad o sobre el tratamiento de tus datos, escribinos a trucoargentino.dev@gmail.com.',
      'Vamos a intentar responder cualquier consulta dentro de un plazo de 30 días.',
    ],
  },
];

function Parrafo({ children }) {
  return <p style={estilos.texto}>{children}</p>;
}

function Lista({ items }) {
  return (
    <ul style={estilos.lista}>
      {items.map((item, i) => (
        <li key={i} style={estilos.listaItem}>{item}</li>
      ))}
    </ul>
  );
}

function TablaProveedores({ filas }) {
  return (
    <div style={estilos.tabla}>
      {filas.map((fila, i) => (
        <div key={i} style={estilos.tablaFila}>
          <div style={estilos.tablaProveedor}>{fila.proveedor}</div>
          <div style={estilos.tablaFuncion}>{fila.funcion}</div>
          <div style={estilos.tablaDatos}>{fila.datos}</div>
        </div>
      ))}
    </div>
  );
}

function Seccion({ seccion }) {
  return (
    <div style={estilos.seccion}>
      <div style={estilos.subtitulo}>{seccion.titulo}</div>
      {seccion.parrafosPrevios?.map((p, i) => <Parrafo key={`pp${i}`}>{p}</Parrafo>)}
      {seccion.lista && <Lista items={seccion.lista} />}
      {seccion.tabla && <TablaProveedores filas={seccion.tabla} />}
      {seccion.parrafos?.map((p, i) => <Parrafo key={`p${i}`}>{p}</Parrafo>)}
      {seccion.subsecciones?.map((sub, i) => (
        <div key={i} style={estilos.subseccion}>
          <div style={estilos.subsubtitulo}>{sub.subtitulo}</div>
          {sub.parrafos?.map((p, j) => <Parrafo key={`sp${j}`}>{p}</Parrafo>)}
          {sub.lista && <Lista items={sub.lista} />}
        </div>
      ))}
    </div>
  );
}

export default function PoliticaPrivacidad({ onVolver }) {
  return (
    <div style={estilos.contenedor}>
      <button style={estilos.btnVolver} onClick={onVolver}>← Volver a Ajustes</button>
      <div style={estilos.panel}>
        <div style={estilos.titulo}>Política de Privacidad de TrucoChe</div>
        <div style={estilos.fecha}>Última actualización: {FECHA_ACTUALIZACION}</div>
        {SECCIONES.map((seccion, i) => (
          <Seccion key={i} seccion={seccion} />
        ))}
      </div>
    </div>
  );
}

const estilos = {
  contenedor: { maxWidth: 720, margin: '0 auto', padding: '24px 16px' },
  btnVolver: {
    background: 'none', border: 'none', cursor: 'pointer',
    fontSize: 14, fontWeight: 700, color: C.chocolate, marginBottom: 16, padding: 0,
  },
  panel: {
    background: C.crema, border: `2px solid ${C.chocolate}22`, borderRadius: 18,
    padding: '24px 22px',
  },
  titulo: { fontFamily: "'Fredoka', sans-serif", fontWeight: 600, fontSize: 22, color: C.chocolate, marginBottom: 4 },
  fecha: { fontSize: 13, color: '#a5928a', marginBottom: 18 },
  seccion: { marginTop: 22 },
  subtitulo: { fontFamily: "'Fredoka', sans-serif", fontWeight: 600, fontSize: 16.5, color: C.doradoOscuro, marginBottom: 8 },
  subseccion: { marginTop: 14 },
  subsubtitulo: { fontFamily: "'Fredoka', sans-serif", fontWeight: 600, fontSize: 14.5, color: C.chocolate, marginBottom: 6 },
  texto: { fontSize: 14.5, lineHeight: 1.6, color: '#7a6660', margin: '0 0 10px' },
  lista: { margin: '0 0 10px', paddingLeft: 20 },
  listaItem: { fontSize: 14.5, lineHeight: 1.6, color: '#7a6660', marginBottom: 4 },
  tabla: { display: 'flex', flexDirection: 'column', gap: 10, margin: '4px 0 14px' },
  tablaFila: {
    background: '#fff', border: `1.5px solid ${C.chocolate}18`, borderRadius: 12,
    padding: '10px 14px',
  },
  tablaProveedor: { fontFamily: "'Fredoka', sans-serif", fontWeight: 600, fontSize: 14.5, color: C.chocolate, marginBottom: 3 },
  tablaFuncion: { fontSize: 13, color: '#a5928a', marginBottom: 3 },
  tablaDatos: { fontSize: 13, color: '#7a6660' },
};