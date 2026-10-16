# Licencias de terceros

Este proyecto no instala librerías de íconos como dependencia (`package.json`
no las lista). Los íconos de uso general se dibujan a mano en
`src/componentes/Iconos.jsx` y `src/admin/componentes/IconosAdmin.jsx`.

Los 13 íconos de servicios del club (Wi-Fi, Vestuario, Gimnasio,
Estacionamiento, Ayuda médica, Torneos, Cumpleaños, Parrilla, Escuelita,
Colegios, Bar / Restaurante, Quincho y Alquiler de paletas), en
`src/componentes/Iconos.jsx`, son el SVG (`<path>`) de los siguientes
íconos de **Tabler Icons**, copiado en línea dentro de cada componente —
sin agregar `@tabler/icons` como dependencia — y reusando el mismo estilo
de trazo (grosor, remates y tamaño) que el resto de los íconos de la app.

| Servicio | Ícono de Tabler Icons |
| --- | --- |
| Wi-Fi | `wifi` |
| Vestuario | `hanger` |
| Gimnasio | `dumbbell` |
| Estacionamiento | `parking` |
| Ayuda médica | `first-aid-kit` |
| Torneos | `trophy` |
| Cumpleaños | `cake` |
| Parrilla | `grill` |
| Escuelita | `school-bell` |
| Colegios | `school` |
| Bar / Restaurante | `tools-kitchen-2` |
| Quincho | `building-pavilion` |
| Alquiler de paletas | `ping-pong` (Tabler no tiene un ícono de paleta de pádel; es el más parecido de la librería) |

Fuente: https://tabler.io/icons (paquete `@tabler/icons`, versión 3.49.0).

## Tabler Icons — Licencia MIT

```
MIT License

Copyright (c) 2020-2026 Paweł Kuna

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
