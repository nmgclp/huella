# Modelo de datos para las próximas etapas

Idea central: **un lugar, en un momento, con personas que lo vivieron**. Todo se cuelga de ahí.

## Etapa 1 (hecha): consulta

Cada espacio es un punto con: `id`, `nombre`, `categoria`, `subcategoria`, `inicio`, `fin`, `estado`, `instagram`, `direccion`, `gestion`, `tipo_gestion`, `barrio`, `barrio_id` (municipal), `delegacion`. Ya incluye `inicio`, `fin` y `estado`, así que la línea de tiempo no obliga a rehacer nada.

## Etapa 2: archivo y aportes (base de datos en línea)

Tablas previstas:

| Tabla | Para qué | Campos principales |
|---|---|---|
| `espacios` | El proyecto o colectivo | id, nombre, categoría, subcategoría, inicio, fin, estado, redes, descripción |
| `ubicaciones` | Dónde estuvo, y cuándo | espacio_id, dirección, punto, desde, hasta, barrio_id |
| `aportes` | Todo lo que manda la gente, en cola | tipo (nuevo espacio, corrección, recuerdo, foto), datos, autor, fecha, estado (pendiente, aprobado, rechazado), moderador |
| `recuerdos` | Anécdotas e historias | espacio_id, texto, año aproximado, autor (o anónimo), estado |
| `fotos` | Galería | espacio_id, archivo, año aproximado, crédito, derechos, estado |
| `fuentes` | De dónde sale cada dato | espacio_id, tipo (prensa, testimonio, redes), enlace o cita, nivel de certeza |

Separar `espacios` de `ubicaciones` resuelve las mudanzas: un mismo espacio puede pasar por varias direcciones. También resuelve los casos de varios proyectos en una misma sede.

Reglas:
- Todo aporte entra como **pendiente** y no se muestra hasta que alguien lo aprueba.
- Cada dato conserva quién lo aportó y cuándo.
- El barrio, la delegación y el ID municipal se calculan solos a partir del punto, con los polígonos municipales.
- Cada dato histórico lleva **nivel de certeza** (seguro, aproximado, a confirmar).

## Etapa 3: agenda

| Tabla | Campos principales |
|---|---|
| `eventos` | espacio_id, título, tipo (obra, recital, taller, curso, muestra), inicio, fin, descripción, precio, enlace de entradas |
| `organizadores` | persona o espacio autorizado a cargar eventos de un espacio |

Los tickets, al principio, pueden ser un enlace al lugar donde ya se venden.

## Etapa 4: tickets y catálogos

A definir con los aliados (venta de entradas, catálogos de bibliotecas, librerías).
