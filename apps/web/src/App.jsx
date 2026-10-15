import { useCallback, useEffect, useMemo, useState } from 'react';
import { getDisponibilidad, crearReserva } from './api.js';
import { proximosSieteDias } from './fechas.js';
import ElegirTurno from './pantallas/ElegirTurno.jsx';
import ConfirmarReserva from './pantallas/ConfirmarReserva.jsx';
import TurnoConfirmado from './pantallas/TurnoConfirmado.jsx';

// Acá vive todo el estado de la app. Las pantallas no guardan nada propio
// (salvo lo que el usuario está tipeando), solo reciben datos y avisan
// cuando pasa algo.
export default function App() {
  const dias = useMemo(() => proximosSieteDias(), []);

  const [pantalla, setPantalla] = useState('elegir'); // elegir | confirmar | listo
  const [fecha, setFecha] = useState(dias[0].iso);
  const [hora, setHora] = useState(null);
  const [canchaId, setCanchaId] = useState(null);

  const [canchas, setCanchas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState(null);

  const [enviando, setEnviando] = useState(false);
  const [errorReserva, setErrorReserva] = useState(null);
  const [avisoGrilla, setAvisoGrilla] = useState(null);
  const [reserva, setReserva] = useState(null);

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
      // Guardamos una foto del turno: la disponibilidad se va a recargar
      // y no queremos que el comprobante cambie por debajo.
      setReserva({ ...creada, fecha, hora, cancha: canchaElegida });
      setPantalla('listo');
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
    } finally {
      setEnviando(false);
    }
  }

  function empezarDeNuevo() {
    setPantalla('elegir');
    setReserva(null);
    setHora(null);
    setCanchaId(null);
    setErrorReserva(null);
    setAvisoGrilla(null);
    setFecha(dias[0].iso);
    recargarDisponibilidad();
  }

  if (pantalla === 'confirmar' && canchaElegida) {
    return (
      <ConfirmarReserva
        fecha={fecha}
        hora={hora}
        cancha={canchaElegida}
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

  if (pantalla === 'listo' && reserva) {
    return (
      <TurnoConfirmado
        reserva={reserva}
        fecha={reserva.fecha}
        hora={reserva.hora}
        cancha={reserva.cancha}
        onOtraReserva={empezarDeNuevo}
      />
    );
  }

  return (
    <ElegirTurno
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
