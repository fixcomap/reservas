import { describe, expect, it } from 'vitest';
import { agruparHorarios, diaDeLaSemana, fechaCorta, nombreDiaCorto, sumarDias, sumarMinutos, tituloLargo } from './fechas.js';
import { formatearMonto, formatearPrecio } from './precios.js';

describe('fechas', () => {
  it('sumar días y minutos, también cruzando mes y medianoche', () => {
    expect(sumarDias('2026-10-31', 1)).toBe('2026-11-01');
    expect(sumarDias('2026-03-01', -1)).toBe('2026-02-28');
    expect(sumarMinutos('21:00', 90)).toBe('22:30');
    expect(sumarMinutos('23:30', 60)).toBe('00:30');
  });
  it('nombres y formatos', () => {
    expect(diaDeLaSemana('2026-10-27')).toBe(2);
    expect(tituloLargo('2026-10-15')).toBe('Jueves 15 de octubre');
    expect(fechaCorta('2026-10-19')).toBe('19/10');
    expect(nombreDiaCorto(4)).toBe('jue');
  });
  it('agrupa días seguidos con el mismo horario', () => {
    const lv = [1, 2, 3, 4, 5].map((d) => ({ dia_semana: d, abre: '09:00', cierra: '24:00' }));
    const finde = [6, 0].map((d) => ({ dia_semana: d, abre: '10:00', cierra: '22:00' }));
    expect(agruparHorarios([...lv, ...finde]).map((g) => g.texto)).toEqual(['Lunes a Viernes 9:00 a 24:00', 'Sábado y Domingo 10:00 a 22:00']);
    expect(agruparHorarios([{ dia_semana: 3, abre: '08:00', cierra: '12:00' }]).map((g) => g.texto)).toEqual(['Miércoles 8:00 a 12:00']);
  });
});

describe('precios', () => {
  it('sin precio cargado: Consultar; $0 solo vale como monto calculado', () => {
    expect(formatearPrecio(null)).toBe('Consultar');
    expect(formatearPrecio(0)).toBe('Consultar');
    expect(formatearPrecio(25000)).toBe('$25.000');
    expect(formatearMonto(0)).toBe('$0');
    expect(formatearMonto('7500')).toBe('$7.500');
  });
});
