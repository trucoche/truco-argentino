import React from 'react';

// Pase 312: Términos de Servicio (web). Se enlazan con la Política de
// Privacidad (`PoliticaPrivacidad.js`): cada una tiene un link a la otra al
// final. Mismo renderizado y mismos estilos que la política. Texto redactado
// como borrador razonable para el proyecto — conviene que lo revise un
// abogado antes de lanzar con cobros reales.
const C = {
  dorado: '#FFB627', doradoOscuro: '#C9860E',
  crema: '#FFF8ED', chocolate: '#4A2C2A',
};

const FECHA_ACTUALIZACION = '06/10/2026';

const SECCIONES = [
  {
    "titulo": "1. Aceptación de estos Términos",
    "parrafos": [
      "Estos Términos de Servicio (\"Términos\") regulan el uso de TrucoChe (\"nosotros\", \"la aplicación\", \"el juego\"), un juego de truco argentino multijugador online disponible en versión web y móvil. Al crear una cuenta o usar TrucoChe, aceptás estos Términos y nuestra Política de Privacidad, que forma parte de este acuerdo.",
      "Si no estás de acuerdo con alguno de los puntos, no uses la aplicación."
    ]
  },
  {
    "titulo": "2. Qué es TrucoChe",
    "parrafos": [
      "TrucoChe es un servicio de entretenimiento: permite jugar al truco contra otros jugadores en salas y torneos, chatear, sumar puntos en un ranking y personalizar tu perfil. Algunas funciones pueden cambiar, agregarse o retirarse con el tiempo."
    ]
  },
  {
    "titulo": "3. Tu cuenta",
    "lista": [
      "Tenés que tener al menos 16 años para crear una cuenta.",
      "Los datos que nos des (por ejemplo tu email) deben ser verdaderos y mantenerse actualizados.",
      "Podés registrarte con email y contraseña o con tu cuenta de Google o de Facebook.",
      "Cada persona puede tener una sola cuenta. No está permitido crear cuentas adicionales para evadir una sanción u obtener ventajas.",
      "Sos responsable de mantener la seguridad de tu contraseña y de todo lo que ocurra desde tu cuenta. Si sospechás que alguien accedió sin tu permiso, avisanos.",
      "No podés vender, prestar ni transferir tu cuenta a otra persona."
    ]
  },
  {
    "titulo": "4. Monedas virtuales",
    "parrafos": [
      "TrucoChe usa una moneda virtual propia (\"monedas\"). Las monedas se pueden obtener gratis (bonos diarios, misiones, logros, premios de torneos) o comprarlas dentro de la aplicación. Se usan para entrar a salas y torneos, y para personalizar tu experiencia de juego.",
      "Las monedas no son dinero, no tienen valor monetario fuera de la aplicación y no se pueden canjear, retirar ni cambiar por dinero, premios en efectivo ni otros bienes. Tampoco son una inversión ni generan intereses.",
      "Las monedas son personales: no se pueden vender, transferir ni intercambiar fuera de la aplicación. Cualquier intento de comprar o vender monedas o cuentas a terceros por fuera de TrucoChe está prohibido y puede llevar a la suspensión de la cuenta.",
      "Podemos modificar los precios, los packs, los bonos y las reglas para obtener o usar monedas. Los cambios no afectan las compras ya acreditadas."
    ]
  },
  {
    "titulo": "5. Compras y pagos",
    "lista": [
      "Las compras de monedas se pagan a través de Mercado Pago. No almacenamos los datos de tu tarjeta ni de tu medio de pago.",
      "Los precios se muestran en pesos argentinos e incluyen lo indicado en cada pack al momento de la compra.",
      "Las monedas se acreditan cuando Mercado Pago confirma el pago, lo que puede demorar unos minutos. Si pasado un tiempo razonable no ves tus monedas, escribinos con el comprobante de pago.",
      "Una vez acreditadas, las monedas se consideran entregadas y consumibles dentro del juego. Esto no limita los derechos que te reconozca la normativa de defensa del consumidor vigente en Argentina, ni los casos de cobros duplicados o errores comprobables, que vamos a resolver con el criterio de corregir el error."
    ]
  },
  {
    "titulo": "6. Normas de convivencia",
    "parrafosPrevios": [
      "Para que TrucoChe sea un lugar cómodo para todos, no está permitido:"
    ],
    "lista": [
      "Expresar odio o discriminar (por raza, género, orientación sexual, nacionalidad, religión u otra condición), acosar a otros jugadores o incitar a la violencia, en el chat, en los nombres de usuario, en las fotos de perfil, en las biografías o en el chat de voz.",
      "Publicar contenido sexual explícito, ilegal o que vulnere derechos de terceros.",
      "Suplantar la identidad de otra persona o de TrucoChe.",
      "Enviar spam, publicidad o enlaces engañosos.",
      "Pedir o compartir datos personales de otros jugadores sin su consentimiento."
    ]
  },
  {
    "titulo": "7. Juego limpio",
    "parrafosPrevios": [
      "El truco se juega con cartas ocultas; por eso también está prohibido:"
    ],
    "lista": [
      "Pasarse información sobre las cartas con un compañero por cualquier medio ajeno a las señas y recursos que el propio juego permite.",
      "Usar programas, bots, scripts o cualquier herramienta que automatice o altere el juego.",
      "Aprovechar errores del sistema en beneficio propio, o no reportarlos cuando los encontrás.",
      "Arreglar resultados con otros jugadores (por ejemplo, perder a propósito para transferir monedas o puntos).",
      "Abandonar partidas de forma reiterada. Los abandonos pueden registrarse y afectar tus estadísticas y tu ranking."
    ]
  },
  {
    "titulo": "8. Reportes y sanciones",
    "parrafos": [
      "Podés reportar a otros jugadores y bloquearlos desde la aplicación. Revisamos los reportes y, según la gravedad y la reiteración, podemos advertir, limitar funciones, suspender temporalmente o cerrar definitivamente una cuenta, y quitar contenido o resultados obtenidos de forma indebida, incluidas las monedas y los puntos asociados.",
      "Si tu cuenta es suspendida o cerrada por incumplir estos Términos, no corresponde la devolución de monedas, incluso las compradas, salvo que la ley disponga otra cosa.",
      "Si creés que una sanción fue un error, escribinos y la revisamos."
    ]
  },
  {
    "titulo": "9. Actividades de dinero real fuera de la aplicación",
    "parrafos": [
      "TrucoChe no aloja ni administra apuestas de dinero real ni juegos de azar con dinero real. Las partidas dentro de la aplicación se juegan con monedas virtuales.",
      "Cualquier actividad de dinero real entre usuarios que se organice por fuera de TrucoChe (por ejemplo, por grupos de mensajería) es completamente ajena a nosotros: no la operamos, supervisamos ni respaldamos, y no respondemos por ella. Usar la aplicación para promover u organizar ese tipo de actividades está prohibido."
    ]
  },
  {
    "titulo": "10. Contenido que publicás",
    "parrafos": [
      "Sos responsable del contenido que subís o escribís (nombre de usuario, foto, biografía, mensajes, fondos de perfil). Al hacerlo nos das permiso limitado, no exclusivo y gratuito para mostrarlo y almacenarlo dentro del servicio, únicamente para que la aplicación funcione.",
      "Podemos quitar o modificar contenido que incumpla estos Términos, sin previo aviso."
    ]
  },
  {
    "titulo": "11. Propiedad intelectual",
    "parrafos": [
      "La marca TrucoChe, el diseño de la aplicación, los personajes, las ilustraciones, las animaciones, los sonidos, el código y el resto de los contenidos del juego pertenecen a TrucoChe o a sus licenciantes y están protegidos por las leyes de propiedad intelectual.",
      "Te damos una licencia personal, limitada, revocable y no transferible para usar la aplicación para jugar. No podés copiar, modificar, descompilar, hacer ingeniería inversa, revender ni explotar comercialmente ninguna parte del servicio."
    ]
  },
  {
    "titulo": "12. Disponibilidad del servicio",
    "parrafos": [
      "Trabajamos para que TrucoChe esté disponible y funcione bien, pero se ofrece \"tal cual está\": puede haber mantenimientos, cortes, errores o fallas de conexión, propias o de terceros, que interrumpan partidas, salas o torneos.",
      "Si una falla técnica nuestra afecta una partida o un torneo, vamos a buscar una solución razonable (por ejemplo, reanudar la partida o devolver las monedas de la entrada). No garantizamos una compensación en todos los casos, ni respondemos por interrupciones causadas por tu conexión o tu dispositivo."
    ]
  },
  {
    "titulo": "13. Servicios de terceros",
    "parrafos": [
      "TrucoChe usa servicios de terceros, como Google y Facebook (inicio de sesión), Mercado Pago (pagos) y Daily.co (chat de voz). Su uso está sujeto además a los términos y políticas de cada proveedor, de los que no somos responsables. En la Política de Privacidad detallamos qué datos se comparten con cada uno."
    ]
  },
  {
    "titulo": "14. Limitación de responsabilidad",
    "parrafos": [
      "En la medida permitida por la ley, TrucoChe no responde por daños indirectos, pérdida de monedas virtuales por uso indebido de tu cuenta o de tus credenciales, interrupciones del servicio, ni por la conducta de otros usuarios.",
      "Nada de lo dispuesto en estos Términos limita los derechos que las leyes de defensa del consumidor te reconocen y que no pueden renunciarse."
    ]
  },
  {
    "titulo": "15. Eliminación de tu cuenta y fin del servicio",
    "parrafos": [
      "Podés eliminar tu cuenta cuando quieras desde Ajustes → Mi cuenta → \"Eliminar mi cuenta\", o desde trucoche.com.ar/eliminar-cuenta. El proceso (confirmación por email, período de 30 días para arrepentirte y eliminación definitiva) se explica en el punto 10 de la Política de Privacidad.",
      "Al eliminar tu cuenta se pierden las monedas que tengas y no se devuelven ni se pueden transferir. Gastalas antes si querés aprovecharlas.",
      "También podemos cerrar una cuenta o dejar de ofrecer el servicio, total o parcialmente. Si cerramos el servicio completo, vamos a avisar con anticipación razonable."
    ]
  },
  {
    "titulo": "16. Cambios a estos Términos",
    "parrafos": [
      "Podemos actualizar estos Términos. Si el cambio es importante, te avisamos dentro de la aplicación o por email. La fecha de \"Última actualización\" indica la versión vigente. Si seguís usando TrucoChe después del aviso, entendemos que aceptás los cambios."
    ]
  },
  {
    "titulo": "17. Ley aplicable",
    "parrafos": [
      "Estos Términos se rigen por las leyes de la República Argentina. Ante cualquier conflicto, intentaremos primero resolverlo de buena fe por los canales de contacto; si no es posible, serán competentes los tribunales ordinarios que correspondan según la ley, sin perjuicio de los derechos que la normativa de defensa del consumidor te reconozca."
    ]
  },
  {
    "titulo": "18. Contacto",
    "parrafos": [
      "Si tenés preguntas sobre estos Términos, escribinos a trucoargentino.dev@gmail.com.",
      "Para saber cómo tratamos tus datos personales, leé nuestra Política de Privacidad."
    ]
  }
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

export default function TerminosServicio({ onVolver, textoVolver = '← Volver a Ajustes', onVerPrivacidad }) {
  return (
    <div style={estilos.contenedor}>
      <button style={estilos.btnVolver} onClick={onVolver}>{textoVolver}</button>
      <div style={estilos.panel}>
        <div style={estilos.titulo}>Términos de Servicio de TrucoChe</div>
        <div style={estilos.fecha}>Última actualización: {FECHA_ACTUALIZACION}</div>
        {SECCIONES.map((seccion, i) => (
          <Seccion key={i} seccion={seccion} />
        ))}
        {onVerPrivacidad && (
          <div style={estilos.enlaceCruzado}>
            <button style={estilos.btnEnlaceCruzado} onClick={onVerPrivacidad}>
              Leer la Política de Privacidad →
            </button>
          </div>
        )}
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
  enlaceCruzado: { marginTop: 26, paddingTop: 16, borderTop: `1.5px solid ${C.chocolate}18`, textAlign: 'center' },
  btnEnlaceCruzado: {
    background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700,
    color: C.doradoOscuro, textDecoration: 'underline',
  },
};
