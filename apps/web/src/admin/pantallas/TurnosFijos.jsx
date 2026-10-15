import { useEffect, useState } from 'react';
import { getCanchas, getTurnosFijos, crearTurnoFijo, desactivarTurnoFijo } from '../apiAdmin.js';
import { nombreDiaCorto } from '../../fechas.js';
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

export default function TurnosFijos() {
  const [canchas, setCanchas] = useState([]);
  const [turnos, setTurnos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const [canchaId, setCanchaId] = useState('');
  const [diaSemana, setDiaSemana] = useState('1');
  const [horaInicio, setHoraInicio] = useState('18:00');
  const [nombre, setNombre] = useState('');
  const [tel, setTel] = useState('');
  const [errorForm, setErrorForm] = useState(null);
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

  async function crear(evento) {
    evento.preventDefault();
    const nombreOk = nombre.trim().length >= 2;
    const telOk = RE_TEL.test(tel.trim());
    if (!nombreOk || !telOk || !canchaId) {
      setErrorForm('Revisá la cancha, el nombre y el teléfono.');
      return;
    }
    setErrorForm(null);
    setEnviando(true);
    try {
      await crearTurnoFijo({
        cancha_id: Number(canchaId),
        dia_semana: Number(diaSemana),
        hora_inicio: horaInicio,
        cliente_nombre: nombre.trim(),
        cliente_tel: tel.trim(),
      });
      setNombre('');
      setTel('');
      cargar();
    } catch (err) {
      setErrorForm(err.message);
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

      <div className="contenido">
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
                  <select id="adm-ft-dia" value={diaSemana} onChange={(e) => setDiaSemana(e.target.value)}>
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
