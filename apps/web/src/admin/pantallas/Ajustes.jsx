import { useEffect, useState } from 'react';
import { getAjustes, guardarPrecios, guardarSenia, getClubInfo, guardarClubInfo } from '../apiAdmin.js';
import { formatearPesos } from '../util.js';
import { Cargando, ErrorRed } from '../../componentes/Estados.jsx';
import { SERVICIOS_DISPONIBLES } from '../../config.js';

const RE_WHATSAPP = /^\d{8,15}$/;
const RE_INSTAGRAM = /^[A-Za-z0-9_.]{1,30}$/;

// Ajustes: precios, porcentaje de seña y datos del club.
export default function Ajustes({ onCerrarSesion }) {
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const [canchas, setCanchas] = useState([]); // [{ id, nombre, precio }]
  const [senia, setSenia] = useState('50');

  const [guardando, setGuardando] = useState(false);
  const [errorGuardar, setErrorGuardar] = useState(null);
  const [guardadoOk, setGuardadoOk] = useState(false);

  // Datos del club
  const [cargandoClub, setCargandoClub] = useState(true);
  const [errorClub, setErrorClub] = useState(null);
  const [direccionCompleta, setDireccionCompleta] = useState('');
  const [localidad, setLocalidad] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [instagram, setInstagram] = useState('');
  const [mapaConsulta, setMapaConsulta] = useState('');
  const [servicios, setServicios] = useState([]);
  const [guardandoClub, setGuardandoClub] = useState(false);
  const [errorGuardarClub, setErrorGuardarClub] = useState(null);
  const [guardadoClubOk, setGuardadoClubOk] = useState(false);

  function cargarClub() {
    setCargandoClub(true);
    setErrorClub(null);
    getClubInfo()
      .then((datos) => {
        setDireccionCompleta(datos.direccion_completa || '');
        setLocalidad(datos.localidad || '');
        setWhatsapp(datos.telefono_whatsapp || '');
        setInstagram(datos.instagram || '');
        setMapaConsulta(datos.mapa_consulta || '');
        setServicios(datos.servicios || []);
      })
      .catch((err) => setErrorClub(err.message))
      .finally(() => setCargandoClub(false));
  }

  useEffect(cargarClub, []);

  function alternarServicio(servicio) {
    setGuardadoClubOk(false);
    setServicios((actual) =>
      actual.includes(servicio) ? actual.filter((s) => s !== servicio) : [...actual, servicio]
    );
  }

  async function guardarClub(evento) {
    evento.preventDefault();
    setGuardadoClubOk(false);

    const wa = whatsapp.trim();
    if (wa && !RE_WHATSAPP.test(wa)) {
      setErrorGuardarClub('El WhatsApp tiene que tener solo números, con código de país y sin +, espacios ni guiones.');
      return;
    }
    const insta = instagram.trim().replace(/^@/, '');
    if (insta && !RE_INSTAGRAM.test(insta)) {
      setErrorGuardarClub('El usuario de Instagram no es válido (sin @, solo letras, números, puntos o guiones bajos).');
      return;
    }

    setErrorGuardarClub(null);
    setGuardandoClub(true);
    try {
      await guardarClubInfo({
        direccion_completa: direccionCompleta.trim(),
        localidad: localidad.trim(),
        telefono_whatsapp: wa,
        instagram: insta,
        mapa_consulta: mapaConsulta.trim(),
        servicios,
      });
      setInstagram(insta);
      setGuardadoClubOk(true);
    } catch (err) {
      setErrorGuardarClub(err.message);
    } finally {
      setGuardandoClub(false);
    }
  }

  function cargar() {
    setCargando(true);
    setError(null);
    getAjustes()
      .then((datos) => {
        setCanchas(datos.canchas.map((c) => ({ ...c, precio: String(c.precio) })));
        setSenia(String(datos.senia_porcentaje));
      })
      .catch((err) => setError(err.message))
      .finally(() => setCargando(false));
  }

  useEffect(cargar, []);

  function cambiarPrecio(id, valor) {
    setGuardadoOk(false);
    setCanchas((actual) => actual.map((c) => (c.id === id ? { ...c, precio: valor } : c)));
  }

  function cambiarSenia(valor) {
    setGuardadoOk(false);
    setSenia(valor);
  }

  async function guardar(evento) {
    evento.preventDefault();
    setGuardadoOk(false);

    const seniaNum = Number(senia);
    if (!Number.isInteger(seniaNum) || seniaNum < 1 || seniaNum > 100) {
      setErrorGuardar('El porcentaje de seña tiene que ser un número entero entre 1 y 100.');
      return;
    }
    const precios = [];
    for (const c of canchas) {
      const precioNum = Number(c.precio);
      if (!Number.isInteger(precioNum) || precioNum < 0 || precioNum > 10000000) {
        setErrorGuardar(`El precio de ${c.nombre} tiene que ser un número entero entre 0 y 10.000.000.`);
        return;
      }
      precios.push({ cancha_id: c.id, precio: precioNum });
    }

    setErrorGuardar(null);
    setGuardando(true);
    try {
      await Promise.all([guardarPrecios(precios), guardarSenia(seniaNum)]);
      setGuardadoOk(true);
    } catch (err) {
      setErrorGuardar(err.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="pantalla-scroll con-barra">
      <div className="barra-superior">
        <h1 className="barra-superior-titulo">Ajustes</h1>
      </div>

      <div className="contenido contenido-angosto">
        {cargando && <Cargando />}
        {!cargando && error && <ErrorRed mensaje={error} onReintentar={cargar} />}

        {!cargando && !error && (
          <form onSubmit={guardar} noValidate>
            <section className="tarjeta">
              <h2 className="tarjeta-titulo">Precio por cancha</h2>
              {canchas.map((c) => {
                const precioNum = Number(c.precio) || 0;
                const seniaNum = Number(senia) || 0;
                const ejemploSenia = Math.round((precioNum * seniaNum) / 100);
                return (
                  <div className="campo" key={c.id}>
                    <label htmlFor={`adm-precio-${c.id}`}>{c.nombre}</label>
                    <input
                      id={`adm-precio-${c.id}`}
                      type="number"
                      inputMode="numeric"
                      min="0"
                      max="10000000"
                      step="1"
                      value={c.precio}
                      onChange={(e) => cambiarPrecio(c.id, e.target.value)}
                    />
                    <p className="letra-chica adm-ejemplo-senia">
                      Con {formatearPesos(precioNum)} y {seniaNum}%, la seña es {formatearPesos(ejemploSenia)}.
                    </p>
                  </div>
                );
              })}
            </section>

            <section className="tarjeta">
              <h2 className="tarjeta-titulo">Porcentaje de seña</h2>
              <div className="campo">
                <label htmlFor="adm-senia">Seña (%)</label>
                <input
                  id="adm-senia"
                  type="number"
                  inputMode="numeric"
                  min="1"
                  max="100"
                  step="1"
                  value={senia}
                  onChange={(e) => cambiarSenia(e.target.value)}
                />
              </div>
              <p className="letra-chica">Se aplica a todas las canchas del club por igual.</p>
            </section>

            {errorGuardar && (
              <p className="aviso-error" role="alert">
                {errorGuardar}
              </p>
            )}
            {guardadoOk && !errorGuardar && (
              <p className="aviso-exito" role="status">
                Guardado.
              </p>
            )}

            <button type="submit" className="boton boton-verde boton-ancho" disabled={guardando}>
              {guardando ? 'Guardando…' : 'Guardar'}
            </button>
          </form>
        )}

        {cargandoClub && <Cargando />}
        {!cargandoClub && errorClub && <ErrorRed mensaje={errorClub} onReintentar={cargarClub} />}

        {!cargandoClub && !errorClub && (
          <form onSubmit={guardarClub} noValidate>
            <section className="tarjeta">
              <h2 className="tarjeta-titulo">Datos del club</h2>
              <p className="letra-chica" style={{ marginBottom: 14 }}>
                Se muestran en la pantalla de reserva, debajo de los horarios.
              </p>

              <div className="campo">
                <label htmlFor="adm-club-direccion">Dirección</label>
                <input
                  id="adm-club-direccion"
                  type="text"
                  placeholder="Ej: Av. Siempre Viva 742"
                  value={direccionCompleta}
                  onChange={(e) => {
                    setGuardadoClubOk(false);
                    setDireccionCompleta(e.target.value);
                  }}
                />
              </div>

              <div className="campo">
                <label htmlFor="adm-club-localidad">Localidad</label>
                <input
                  id="adm-club-localidad"
                  type="text"
                  placeholder="Ej: Lomas de Zamora"
                  value={localidad}
                  onChange={(e) => {
                    setGuardadoClubOk(false);
                    setLocalidad(e.target.value);
                  }}
                />
              </div>

              <div className="campo">
                <label htmlFor="adm-club-mapa">Dirección para el mapa</label>
                <input
                  id="adm-club-mapa"
                  type="text"
                  placeholder="Lo que buscarías en Google Maps para encontrar el club"
                  value={mapaConsulta}
                  onChange={(e) => {
                    setGuardadoClubOk(false);
                    setMapaConsulta(e.target.value);
                  }}
                />
              </div>

              <div className="campo">
                <label htmlFor="adm-club-whatsapp">WhatsApp</label>
                <input
                  id="adm-club-whatsapp"
                  type="tel"
                  inputMode="numeric"
                  placeholder="Con código de país, solo números: 5491122334455"
                  value={whatsapp}
                  onChange={(e) => {
                    setGuardadoClubOk(false);
                    setWhatsapp(e.target.value);
                  }}
                />
              </div>

              <div className="campo">
                <label htmlFor="adm-club-instagram">Instagram</label>
                <input
                  id="adm-club-instagram"
                  type="text"
                  placeholder="usuario (sin @)"
                  value={instagram}
                  onChange={(e) => {
                    setGuardadoClubOk(false);
                    setInstagram(e.target.value);
                  }}
                />
              </div>

              <div className="campo">
                <label>Servicios</label>
                <div className="adm-servicios-grilla">
                  {SERVICIOS_DISPONIBLES.map((s) => (
                    <label key={s} className="adm-servicio-check">
                      <input type="checkbox" checked={servicios.includes(s)} onChange={() => alternarServicio(s)} />
                      {s}
                    </label>
                  ))}
                </div>
              </div>
            </section>

            {errorGuardarClub && (
              <p className="aviso-error" role="alert">
                {errorGuardarClub}
              </p>
            )}
            {guardadoClubOk && !errorGuardarClub && (
              <p className="aviso-exito" role="status">
                Guardado.
              </p>
            )}

            <button type="submit" className="boton boton-verde boton-ancho" disabled={guardandoClub}>
              {guardandoClub ? 'Guardando…' : 'Guardar datos del club'}
            </button>
          </form>
        )}

        <button type="button" className="adm-boton-secundario boton-ancho" onClick={onCerrarSesion}>
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
