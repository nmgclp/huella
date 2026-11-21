// Configuración del sitio. Editá este archivo para cambiar nombre, mapa base y contacto.
window.HUELLA_CONFIG = {
  // Nombre provisorio del proyecto (también hay que cambiarlo en index.html: <title> y <h1>).
  nombre: "Huella Cultural",

  // MAPA BASE
  // "osm"      -> mosaicos públicos de OpenStreetMap. Sirve para probar y para poco tráfico.
  //               Su política de uso no admite tráfico alto: antes de difundir el sitio, pasá a "maptiler".
  // "maptiler" -> mapa de calles de MapTiler. Pide una clave gratuita (https://www.maptiler.com).
  mapaBase: "osm",
  maptilerClave: "",
  maptilerEstilo: "streets-v2",   // otros: "dataviz-light", "basic-v2", "positron" según el plan

  // Centro y zoom iniciales (casco urbano de La Plata)
  centro: [-57.9545, -34.9205],
  zoom: 12.6,

  // Correo para el botón "Escribinos". Vacío = el botón no aparece.
  contacto: ""
};
