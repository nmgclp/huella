# Huella Cultural (nombre provisorio)

Mapa de los espacios culturales de La Plata, organizado por barrio. Esta es la **etapa 1**: sitio público de consulta, sin cuentas ni aportes todavía.

## Qué hay en la carpeta

```
site/       El sitio. Es lo único que se publica.
scripts/    El programa que genera los datos desde tu planilla.
docs/       Notas de diseño para las próximas etapas.
```

## Probarlo en tu computadora

Necesitás Python 3. Desde la carpeta `site/`:

```
python3 -m http.server 8000
```

Abrí http://localhost:8000 en el navegador. (No sirve abrir `index.html` con doble clic, porque el navegador bloquea la lectura de los datos.)

## Publicarlo en GitHub Pages

El sitio es estático: no necesita servidor ni base de datos. El proyecto incluye `.github/workflows/pages.yml`, que publica la carpeta `site/` cada vez que subís cambios.

1. Creá una cuenta en github.com y un repositorio nuevo, **público** (en el plan gratuito, GitHub Pages lo requiere). Por ejemplo, `huella-cultural`.
2. Subí todo el contenido de esta carpeta al repositorio (en la web: **Add file → Upload files**, arrastrando las carpetas). Si la carpeta oculta `.github` no se sube, creá el archivo desde la web: **Add file → Create new file**, escribí `.github/workflows/pages.yml` como nombre y pegá el contenido de ese archivo.
3. En el repositorio: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
4. Entrá a la pestaña **Actions** y esperá a que termine "Publicar sitio" (un par de minutos). Si no arrancó solo, abrilo y apretá **Run workflow**.
5. El sitio queda en `https://TU-USUARIO.github.io/NOMBRE-DEL-REPOSITORIO/`.

Para usar tu propio dominio: en **Settings → Pages → Custom domain** y en el panel del proveedor donde lo compraste, siguiendo las instrucciones de GitHub.

Cada cambio posterior (datos nuevos, nombre, textos) se publica solo al subirlo.

> Las carpetas `fuentes/` y el archivo `planilla.csv` están excluidos (`.gitignore`) para que los archivos municipales completos no se suban.

## Antes de difundirlo

1. **Mapa base.** Por defecto usa los mosaicos públicos de OpenStreetMap, que sirven para probar pero no para mucho tráfico. Para el lanzamiento:
   - Creá una cuenta en un proveedor de mapas (por ejemplo MapTiler).
   - Abrí `site/js/config.js`, poné `mapaBase: "maptiler"` y pegá tu clave en `maptilerClave`.
   - Mirá las condiciones de uso de ese proveedor (la atribución es obligatoria y los planes gratuitos tienen límites).
2. **Polígonos municipales.** Confirmá con la Municipalidad que podés reutilizarlos citando la fuente.
3. **Datos.** Los archivos que vienen en `site/data/` se generaron a partir de una copia reducida de la planilla (con direcciones abreviadas). Antes de publicar, regeneralos con tu planilla real (siguiente sección).
4. **Nombre.** Cambialo en `site/index.html` (`<title>`, `<h1>`) y en `site/js/config.js`.
5. **Contacto.** Si ponés un correo en `contacto` (en `config.js`), cada ficha muestra el botón "Sugerir una corrección".

## Actualizar los datos desde la planilla

Cada vez que cambies la planilla:

1. En Google Sheets: **Archivo → Descargar → Valores separados por comas (.csv)**. Guardalo como `planilla.csv`.
2. Poné en una carpeta `fuentes/` los archivos municipales `barrios.geojson` y `delegaciones.geojson` (los completos, sin simplificar).
3. Desde la carpeta del proyecto, corré:

```
python3 scripts/build_data.py \
  --planilla planilla.csv \
  --barrios fuentes/barrios.geojson \
  --delegaciones fuentes/delegaciones.geojson \
  --nombres scripts/nombres_barrios.csv \
  --salida site/data
```

4. Volvé a subir la carpeta `site/`.

El programa hace solo lo que antes hacías a mano: a partir de la latitud y la longitud calcula el **barrio** y la **delegación** de cada espacio, y guarda el **ID municipal** del barrio. Al final te avisa qué espacios no tienen coordenadas y cuáles caen fuera de todo barrio, para que los revises.

Columnas que usa de la planilla: `PROYECTO`, `CATEGORÍA`, `SUBCATEGORÍA`, `INICIO` (o `AÑO DE CREACIÓN`), `FIN`, `ESTADO`, `INSTAGRAM`, `DIRECCIÓN`, `LATITUD`, `LONGITUD`, `GESTIÓN`, `TIPO DE GESTION` e `ID` (opcional: si está vacío, el programa genera uno a partir del nombre). Las demás se ignoran. Un espacio sin `FIN` ni `ESTADO` se considera activo.

### Nombres de barrio

`scripts/nombres_barrios.csv` tiene los 735 barrios municipales. La columna `nombre_propio` guarda los nombres de tu mapeo ("Pza. San Martín", "Htal. Italiano"); donde está vacía se usa el nombre municipal. Podés editar esa columna con cualquier planilla y volver a correr el programa.

## Próximas etapas

Ver `docs/modelo-de-datos.md`: archivo con línea de tiempo, aportes con moderación, recuerdos y fotos, agenda y tickets.

## Créditos y licencias

- Mapa base: © colaboradores de OpenStreetMap.
- Librería de mapas: MapLibre GL JS (licencia BSD-3, en `site/vendor/`).
- Límites de barrios y delegaciones: Municipalidad de La Plata (condiciones de reutilización por confirmar).
