import { useEffect, useState } from 'react';
import { getCanchas, getTurnosFijos, crearTurnoFijo, desactivarTurnoFijo } from '../apiAdmin.js';
import { nombreDiaCorto, proximaFecha, fechaCorta } from '../../fechas.js';
import { Cargando, ErrorRed } from '../../componentes/Estados.jsx';

const RE_TEL = /^\+?[\d\s-]{8,20}$/;
const DIAS = [
  { valor: 0, texto: 'Domingo' },
  { valor: 1, texto: 'Lunes' },
  { valor: 2, texto: 'Martes' },
  { valor: 3, texto: 'Miércoles' },
  { valor: 4, texto: 'Jueves' },
  { valor: 5, texto: 'Viernes' },
  { valor: 6, texto: 'Sábado' },
];

// "Desde 19/10" o "Desde 19/10 hasta 30/12"
function textoVigencia(t) {
  const desde = `Desde ${fechaCorta(t.fecha_desde)}`;
  return t.fecha_hasta ? `${desde} hasta ${fechaCorta(t.fecha_hasta)}` : desde;
}

export default function TurnosFijos() {
  const [canchas, setCanchas] = useState([]);
  const [turnos, setTurnos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const [canchaId, setCanchaId] = useState('');
  const [diaSemana, setDiaSemana] = useState('1');
  const [horaInicio, setHoraInicio] = useState('18:00');
  const [fechaDesde, setFechaDesde] = useState(() => proximaFecha(1));
  const [fechaHasta, setFechaHasta] = useState('');
  const [nombre, setNombre] = useState('');
  const [tel, setTel] = useState('');
  const [errorForm, setErrorForm] = useState(null);
  const [conflictos, setConflictos] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [desactivando, setDesactivando] = useState(null); // id en curso, o null

  function cargar() {
    setCargando(true);
    setError(null);
    Promise.all([getCanchas(), getTurnosFijos()])
      .then(([resCanchas, resTurnos]) => {
        setCanchas(resCanchas.canchas);
        setTurnos(resTurnos.turnosFijos);
        if (resCanchas.canchas[0]) setCanchaId((actual) => actual || String(resCanchas.canchas[0].id));
      })
      .catch((err) => setError(err.message))
      .finally(() => setCargando(false));
  }

  useEffect(cargar, []);

  // Al cambiar el día, proponemos de nuevo la fecha de inicio: la
  // próxima vez que cae ese día. Si el admin ya la había tocado a mano,
  // esto se la pisa, pero es la lectura más simple de "por defecto, la
  // próxima fecha de ese día de la semana".
  function cambiarDia(valor) {
    setDiaSemana(valor);
    setFechaDesde(proximaFecha(Number(valor)));
  }

  async function crear(evento) {
    evento.preventDefault();
    const nombreOk = nombre.trim().length >= 2;
    const telOk = RE_TEL.test(tel.trim());
    const fechasOk = !fechaHasta || fechaHasta >= fechaDesde;
    if (!nombreOk || !telOk || !canchaId || !fechaDesde || !fechasOk) {
      setErrorForm(
        !fechasOk ? 'La fecha de fin no puede ser anterior a la de inicio.' : 'Revisá la cancha, las fechas, el nombre y el teléfono.'
      );
      return;
    }
    setErrorForm(null);
    setConflictos(null);
    setEnviando(true);
    try {
      await crearTurnoFijo({
        cancha_id: Number(canchaId),
        dia_semana: Number(diaSemana),
        hora_inicio: horaInicio,
        fecha_desde: fechaDesde,
        fecha_hasta: fechaHasta || undefined,
        cliente_nombre: nombre.trim(),
        cliente_tel: tel.trim(),
      });
      setNombre('');
      setTel('');
      cargar();
    } catch (err) {
      if (err.detalle?.conflictos?.length) {
        setErrorForm('Estas fechas ya tienen reserva. Cancelalas o elegí otra fecha de inicio.');
        setConflictos(err.detalle.conflictos);
      } else {
        setErrorForm(err.message);
      }
    } finally {
      setEnviando(false);
    }
  }

  async function desactivar(id) {
    setDesactivando(id);
    try {
      await desactivarTurnoFijo(id);
      cargar();
    } catch (err) {
      setError(err.message);
    } finally {
      setDesactivando(null);
    }
  }

  return (
    <div className="pantalla-scroll con-barra">
      <div className="barra-superior">
        <h1 className="barra-superior-titulo">Turnos fijos</h1>
      </div>

      <div className="contenido contenido-angosto">
        {cargando && <Cargando />}
        {!cargando && error && <ErrorRed mensaje={error} onReintentar={cargar} />}

        {!cargando && !error && (
          <>
            <section className="tarjeta">
              <h2 className="tarjeta-titulo">Activos</h2>
              {turnos.length === 0 && <p className="letra-chica">Todavía no hay turnos fijos cargados.</p>}
              <ul className="adm-lista-fijos">
                {turnos.map((t) => (
                  <li key={t.id} className="adm-fijo-item">
                    <div>
                      <p className="adm-fijo-titulo">
                        {t.cancha_nombre} · {nombreDiaCorto(t.dia_semana)} {t.hora_inicio}
                      </p>
                      <p className="letra-chica">
                        {t.cliente_nombre}
                        {t.cliente_tel ? ` · ${t.cliente_tel}` : ''}
                      </p>
                      <p className="letra-chica">{textoVigencia(t)}</p>
                    </div>
                    <button
                      type="button"
                      className="boton-texto-rojo"
                      onClick={() => desactivar(t.id)}
                      disabled={desactivando === t.id}
                    >
                      {desactivando === t.id ? 'Desactivando…' : 'Desactivar'}
                    </button>
                  </li>
                ))}
              </ul>
            </section>

            <section className="tarjeta">
              <h2 className="tarjeta-titulo">Nuevo turno fijo</h2>
              <form onSubmit={crear} noValidate>
                <div className="campo">
                  <label htmlFor="adm-ft-cancha">Cancha</label>
                  <select id="adm-ft-cancha" value={canchaId} onChange={(e) => setCanchaId(e.target.value)}>
                    {canchas.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="campo">
                  <label htmlFor="adm-ft-dia">Día de la semana</label>
                  <select id="adm-ft-dia" value={diaSemana} onChange={(e) => cambiarDia(e.target.value)}>
                    {DIAS.map((d) => (
                      <option key={d.valor} value={d.valor}>
                        {d.texto}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="campo">
                  <label htmlFor="adm-ft-hora">Hora</label>
                  <input
                    id="adm-ft-hora"
                    type="time"
                    value={horaInicio}
                    onChange={(e) => setHoraInicio(e.target.value)}
                  />
                </div>

                <div className="campo">
                  <label htmlFor="adm-ft-desde">Desde</label>
                  <input
                    id="adm-ft-desde"
                    type="date"
                    value={fechaDesde}
                    onChange={(e) => setFechaDesde(e.target.value)}
                  />
                </div>

                <div className="campo">
                  <label htmlFor="adm-ft-hasta">Hasta (opcional)</label>
                  <input
                    id="adm-ft-hasta"
                    type="date"
                    value={fechaHasta}
                    onChange={(e) => setFechaHasta(e.target.value)}
                  />
                </div>

                <div className="campo">
                  <label htmlFor="adm-ft-nombre">Nombre del cliente</label>
                  <input
                    id="adm-ft-nombre"
                    type="text"
                    placeholder="Ej: Grupo de los jueves"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                  />
                </div>

                <div className="campo">
                  <label htmlFor="adm-ft-tel">WhatsApp</label>
                  <input
                    id="adm-ft-tel"
                    type="tel"
                    inputMode="tel"
                    placeholder="11 1234 5678"
                    value={tel}
                    onChange={(e) => setTel(e.target.value)}
                  />
                </div>

                {errorForm && (
                  <p className="aviso-error" role="alert">
                    {errorForm}
                  </p>
                )}

                {conflictos && (
                  <ul className="adm-lista-conflictos">
                    {conflictos.map((c) => (
                      <li key={c.reserva_id}>
                        {fechaCorta(c.fecha)} · {c.hora} · {c.cliente_nombre || 'Sin nombre'} ({c.origen})
                      </li>
                    ))}
                  </ul>
                )}

                <button type="submit" className="boton boton-verde boton-ancho" disabled={enviando || !canchas.length}>
                  {enviando ? 'Creando…' : 'Crear turno fijo'}
                </button>
              </form>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
