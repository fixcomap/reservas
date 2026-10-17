import { useCallback, useEffect, useMemo, useState } from 'react';
import { getDisponibilidad, crearReserva, getClub } from './api.js';
import { proximosSieteDias } from './fechas.js';
import ElegirTurno from './pantallas/ElegirTurno.jsx';
import ConfirmarReserva from './pantallas/ConfirmarReserva.jsx';

// Estado de la app del jugador; las pantallas solo reciben datos.
export default function App() {
  const dias = useMemo(() => proximosSieteDias(), []);

  const [pantalla, setPantalla] = useState('elegir'); // elegir | confirmar
  const [fecha, setFecha] = useState(dias[0].iso);
  const [hora, setHora] = useState(null);
  const [canchaId, setCanchaId] = useState(null);

  const [canchas, setCanchas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState(null);

  const [club, setClub] = useState(null);
  useEffect(() => {
    getClub()
      .then(setClub)
      .catch(() => setClub(null));
  }, []);
  // Solo para mostrar; el monto real lo calcula el servidor
  const [seniaPorcentaje, setSeniaPorcentaje] = useState(50);

  const [enviando, setEnviando] = useState(false);
  const [errorReserva, setErrorReserva] = useState(null);
  const [avisoGrilla, setAvisoGrilla] = useState(null);

  // Al volver con "atrás" desde Mercado Pago, destraba el botón
  useEffect(() => {
    function alVolver(evento) {
      if (evento.persisted) setEnviando(false);
    }
    window.addEventListener('pageshow', alVolver);
    return () => window.removeEventListener('pageshow', alVolver);
  }, []);

  // Subirlo vuelve a pedir la disponibilidad
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

    return () => {
      cancelado = true;
    };
  }, [fecha, recarga]);

  // Horarios con al menos una cancha libre
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
      // Mercado Pago vuelve a /reserva/<token>
      window.location.assign(creada.checkout_url);
      return;
    } catch (err) {
      if (err.estado === 409) {
        // Alguien reservó primero: volver a la grilla
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
