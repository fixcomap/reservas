import { useCallback, useEffect, useMemo, useState } from 'react';
import { getDisponibilidad, crearReserva, getClub } from './api.js';
import { proximosSieteDias } from './fechas.js';
import ElegirTurno from './pantallas/ElegirTurno.jsx';
import ConfirmarReserva from './pantallas/ConfirmarReserva.jsx';

// Acá vive todo el estado de la app. Las pantallas no guardan nada propio
// (salvo lo que el usuario está tipeando), solo reciben datos y avisan
// cuando pasa algo.
export default function App() {
  const dias = useMemo(() => proximosSieteDias(), []);

  const [pantalla, setPantalla] = useState('elegir'); // elegir | confirmar
  const [fecha, setFecha] = useState(dias[0].iso);
  const [hora, setHora] = useState(null);
  const [canchaId, setCanchaId] = useState(null);

  const [canchas, setCanchas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState(null);

  // Datos del club (nombre, dirección, mapa, horarios, contacto) para
  // el encabezado y la sección "Dónde estamos" de la pantalla 1. Se
  // piden una sola vez; si fallan, esas secciones simplemente no
  // muestran nada en vez de romper el resto de la app.
  const [club, setClub] = useState(null);
  useEffect(() => {
    getClub()
      .then(setClub)
      .catch(() => setClub(null));
  }, []);
  // Valor por defecto hasta que llegue el real de la API; el que vale
  // para calcular la seña de verdad es siempre el que calcula el
  // servidor al reservar, esto es solo para mostrar algo mientras tanto.
  const [seniaPorcentaje, setSeniaPorcentaje] = useState(50);

  const [enviando, setEnviando] = useState(false);
  const [errorReserva, setErrorReserva] = useState(null);
  const [avisoGrilla, setAvisoGrilla] = useState(null);

  // Si el jugador vuelve con "atrás" desde Mercado Pago, el navegador
  // puede restaurar la página tal como quedó (con el botón en
  // "Yendo a Mercado Pago…"): lo destrabamos.
  useEffect(() => {
    function alVolver(evento) {
      if (evento.persisted) setEnviando(false);
    }
    window.addEventListener('pageshow', alVolver);
    return () => window.removeEventListener('pageshow', alVolver);
  }, []);

  // Un contador que subimos a mano cuando queremos volver a pedir
  // la disponibilidad del mismo día (reintentar, o después de un 409).
  const [recarga, setRecarga] = useState(0);

  useEffect(() => {
    let cancelado = false;

    setCargando(true);
    setErrorCarga(null);

    getDisponibilidad(fecha)
      .then((datos) => {
        if (cancelado) return;
        setCanchas(datos.canchas || []);
        if (datos.senia_porcentaje != null) setSeniaPorcentaje(datos.senia_porcentaje);
      })
      .catch((err) => {
        if (cancelado) return;
        setCanchas([]);
        setErrorCarga(err.message);
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });

    // Si el usuario cambia de día antes de que llegue la respuesta,
    // ignoramos la vieja para no pisar los datos nuevos.
    return () => {
      cancelado = true;
    };
  }, [fecha, recarga]);

  // Horarios que tienen al menos una cancha libre, ordenados.
  const horarios = useMemo(() => {
    const libres = new Set();
    for (const cancha of canchas) {
      for (const turno of cancha.turnos) {
        if (turno.libre) libres.add(turno.hora);
      }
    }
    return [...libres].sort();
  }, [canchas]);

  const canchasLibres = useMemo(() => {
    if (!hora) return [];
    return canchas.filter((cancha) => cancha.turnos.some((t) => t.hora === hora && t.libre));
  }, [canchas, hora]);

  const canchaElegida = useMemo(
    () => canchasLibres.find((cancha) => cancha.id === canchaId) || null,
    [canchasLibres, canchaId]
  );

  // Si después de recargar el horario elegido ya no existe, lo soltamos.
  useEffect(() => {
    if (hora && !cargando && !horarios.includes(hora)) {
      setHora(null);
      setCanchaId(null);
    }
  }, [horarios, hora, cargando]);

  function elegirFecha(nuevaFecha) {
    setFecha(nuevaFecha);
    setHora(null);
    setCanchaId(null);
    setAvisoGrilla(null);
  }

  function elegirHora(nuevaHora) {
    setHora(nuevaHora);
    setCanchaId(null); // la cancha elegida puede no estar libre a esa hora
    setAvisoGrilla(null);
  }

  const recargarDisponibilidad = useCallback(() => setRecarga((n) => n + 1), []);

  async function reservar(datosCliente) {
    setEnviando(true);
    setErrorReserva(null);

    try {
      const creada = await crearReserva({
        cancha_id: canchaId,
        fecha,
        hora,
        ...datosCliente,
      });
      // El turno quedó retenido: a pagar. Mercado Pago vuelve a
      // /reserva/<token>, que muestra cómo quedó (ver EstadoReserva).
      // "enviando" queda prendido a propósito: la página se va.
      window.location.assign(creada.checkout_url);
      return;
    } catch (err) {
      if (err.estado === 409) {
        // Alguien reservó primero: lo mandamos de vuelta a la grilla
        // con datos frescos para que elija otro turno.
        setAvisoGrilla(`${err.message}. Elegí otro horario.`);
        setCanchaId(null);
        setPantalla('elegir');
        recargarDisponibilidad();
      } else {
        setErrorReserva(err.message);
      }
    }
    setEnviando(false);
  }

  if (pantalla === 'confirmar' && canchaElegida) {
    return (
      <ConfirmarReserva
        club={club}
        fecha={fecha}
        hora={hora}
        cancha={canchaElegida}
        seniaPorcentaje={seniaPorcentaje}
        enviando={enviando}
        error={errorReserva}
        onVolver={() => {
          setErrorReserva(null);
          setPantalla('elegir'); // la selección queda como estaba
        }}
        onReservar={reservar}
      />
    );
  }

  return (
    <ElegirTurno
      club={club}
      dias={dias}
      fecha={fecha}
      hora={hora}
      canchaId={canchaId}
      horarios={horarios}
      canchasLibres={canchasLibres}
      canchaElegida={canchaElegida}
      cargando={cargando}
      error={errorCarga}
      aviso={avisoGrilla}
      onElegirFecha={elegirFecha}
      onElegirHora={elegirHora}
      onElegirCancha={setCanchaId}
      onReintentar={recargarDisponibilidad}
      onContinuar={() => setPantalla('confirmar')}
    />
  );
}
