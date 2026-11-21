(function () {
  "use strict";
  var CFG = window.HUELLA_CONFIG || {};
  var CATS = [
    { id: "casa-centro-espacio", n: "Casas, centros y espacios culturales", c: "#d9480f", v: "--c0" },
    { id: "cine-teatro", n: "Salas de cine y teatro", c: "#7048e8", v: "--c1" },
    { id: "museo-galeria", n: "Galerías de arte y museos", c: "#0b7285", v: "--c2" },
    { id: "club-comunitario", n: "Clubes y centros comunitarios", c: "#e67700", v: "--c3" },
    { id: "biblioteca-libreria", n: "Bibliotecas y librerías", c: "#1c7ed6", v: "--c4" },
    { id: "otros", n: "Varias o sin categoría", c: "#868e96", v: "--c5" }
  ];
  var catById = {};
  CATS.forEach(function (c, i) { c.i = i; catById[c.id] = c; });

  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };
  var plano = function (s) {
    return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  };

  var state = { cats: {}, deleg: "", q: "", choro: true, seleccion: null };
  CATS.forEach(function (c) { state.cats[c.id] = true; });
  var espacios = [], barrios = null, porId = {}, conteos = {}, visibles = [], map, listo = false;

  // ---------- estilo del mapa base ----------
  function estiloBase() {
    if (CFG.mapaBase === "maptiler" && CFG.maptilerClave) {
      return "https://api.maptiler.com/maps/" + (CFG.maptilerEstilo || "streets-v2") + "/style.json?key=" + encodeURIComponent(CFG.maptilerClave);
    }
    return {
      version: 8,
      sources: {
        osm: {
          type: "raster",
          tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
          tileSize: 256, maxzoom: 19,
          attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>'
        }
      },
      layers: [{ id: "osm", type: "raster", source: "osm" }]
    };
  }

  // ---------- datos ----------
  function cargar() {
    return Promise.all([
      fetch("data/espacios.geojson").then(function (r) { return r.json(); }),
      fetch("data/barrios.geojson").then(function (r) { return r.json(); }),
      fetch("data/delegaciones.geojson").then(function (r) { return r.json(); })
    ]);
  }

  function matchTexto(p, q) {
    if (!q) return true;
    return plano([p.nombre, p.barrio, p.subcategoria, p.delegacion].join(" ")).indexOf(q) >= 0;
  }

  function calcularVisibles() {
    var q = plano(state.q.trim());
    visibles = espacios.filter(function (f) {
      var p = f.properties;
      if (!state.cats[p.categoria]) return false;
      if (state.deleg && p.delegacion !== state.deleg) return false;
      return matchTexto(p, q);
    });
    conteos = {};
    visibles.forEach(function (f) {
      var b = f.properties.barrio_id;
      if (b) conteos[b] = (conteos[b] || 0) + 1;
    });
  }

  function aplicar() {
    calcularVisibles();
    var ids = visibles.map(function (f) { return f.properties.id; });
    var filtro = ["in", ["get", "id"], ["literal", ids]];
    if (listo) {
      map.setFilter("espacios", filtro);
      map.setFilter("espacios-halo", filtro);
      barrios.features.forEach(function (b) { b.properties.n = conteos[b.properties.id] || 0; });
      map.getSource("barrios").setData(barrios);
      map.setPaintProperty("barrios-fill", "fill-opacity", state.choro ? opacidadBarrios() : 0);
    }
    pintarLista();
    var faltan = espacios.length;
    $("stat").innerHTML = "<b>" + visibles.length + "</b> de " + faltan + " espacios en el mapa.";
  }

  function opacidadBarrios() {
    var max = 1;
    Object.keys(conteos).forEach(function (k) { if (conteos[k] > max) max = conteos[k]; });
    return ["case", [">", ["get", "n"], 0],
      ["+", 0.1, ["*", 0.45, ["sqrt", ["/", ["get", "n"], max]]]], 0];
  }

  // ---------- panel ----------
  function armarPanel() {
    var cont = {};
    espacios.forEach(function (f) { cont[f.properties.categoria] = (cont[f.properties.categoria] || 0) + 1; });
    var box = $("cats");
    CATS.forEach(function (c) {
      var b = document.createElement("button");
      b.type = "button"; b.className = "cat"; b.setAttribute("aria-pressed", "true");
      b.innerHTML = '<span class="dot" style="background:' + c.c + '"></span><span>' + esc(c.n) + '</span><span class="n">' + (cont[c.id] || 0) + "</span>";
      b.onclick = function () {
        state.cats[c.id] = !state.cats[c.id];
        b.setAttribute("aria-pressed", state.cats[c.id]);
        aplicar();
      };
      box.appendChild(b);
    });
    var d = {};
    espacios.forEach(function (f) { var k = f.properties.delegacion || "Sin dato"; d[k] = (d[k] || 0) + 1; });
    $("deleg").innerHTML = '<option value="">Todas</option>' + Object.keys(d).sort().map(function (k) {
      return '<option value="' + esc(k) + '">' + esc(k) + " (" + d[k] + ")</option>";
    }).join("");
    $("q").addEventListener("input", function (e) { state.q = e.target.value; aplicar(); });
    $("deleg").addEventListener("change", function (e) { state.deleg = e.target.value; aplicar(); });
    $("choro").addEventListener("change", function (e) { state.choro = e.target.checked; aplicar(); });
    $("btn-todo").onclick = function () { ajustar(visibles.length ? visibles : espacios, 40); };
    $("btn-casco").onclick = function () {
      ajustar(espacios.filter(function (f) { return f.properties.delegacion === "Casco urbano"; }), 40);
    };
  }

  function pintarLista() {
    var ul = $("lista");
    if (!visibles.length) { ul.innerHTML = '<li class="vacio">No hay espacios con esos filtros.</li>'; return; }
    var orden = visibles.slice().sort(function (a, b) {
      return a.properties.nombre.localeCompare(b.properties.nombre, "es");
    });
    ul.innerHTML = "";
    orden.forEach(function (f) {
      var p = f.properties, c = catById[p.categoria] || catById.otros;
      var li = document.createElement("li"), b = document.createElement("button");
      b.type = "button";
      b.innerHTML = '<i style="background:' + c.c + '"></i><span><span class="nm">' + esc(p.nombre) + '</span><span class="sb">' +
        esc([p.barrio, p.delegacion].filter(Boolean).join(" · ")) + "</span></span>";
      b.onclick = function () { abrirEspacios([f], true); };
      li.appendChild(b); ul.appendChild(li);
    });
  }

  // ---------- ficha ----------
  function fichaEspacio(f) {
    var p = f.properties, c = catById[p.categoria] || catById.otros;
    var ig = p.instagram ? '<div class="meta"><a href="https://www.instagram.com/' + encodeURIComponent(p.instagram) +
      '/" target="_blank" rel="noopener">@' + esc(p.instagram) + "</a></div>" : "";
    var desde = p.inicio ? "Desde " + p.inicio + (p.fin ? " hasta " + p.fin : "") :
      '<span class="meta">Año de inicio sin cargar</span>';
    var gest = p.gestion ? " · " + esc(p.gestion) + (p.tipo_gestion ? " (" + esc(p.tipo_gestion) + ")" : "") : "";
    var mail = CFG.contacto ? '<a class="btn" href="mailto:' + esc(CFG.contacto) + "?subject=" +
      encodeURIComponent("Corrección: " + p.nombre) + '">Sugerir una corrección</a>' : "";
    return '<div class="item"><h2>' + esc(p.nombre) + '</h2><div class="tag"><i style="background:' + c.c + '"></i>' +
      esc(c.n) + (p.subcategoria ? " · " + esc(p.subcategoria) : "") + "</div>" +
      '<div class="meta">' + esc([p.barrio, p.delegacion].filter(Boolean).join(" · ")) + "</div>" +
      (p.direccion ? '<div class="meta">' + esc(p.direccion) + "</div>" : "") +
      '<div class="meta">' + desde + gest + "</div>" + ig +
      "<h3>Fotos</h3><div class=\"ph\">Todavía no hay fotos de este espacio.</div>" +
      "<h3>Recuerdos</h3><div class=\"ph\">Todavía no hay recuerdos. Pronto vas a poder sumar el primero.</div>" +
      '<div class="acciones"><button class="btn" type="button" disabled>Sumar un recuerdo (pronto)</button>' + mail + "</div></div>";
  }

  function mostrarFicha(html) {
    var el = $("ficha");
    el.innerHTML = '<button class="cerrar" type="button" aria-label="Cerrar">×</button>' + html;
    el.hidden = false;
    el.querySelector(".cerrar").onclick = cerrarFicha;
    el.scrollTop = 0;
  }

  function cerrarFicha() {
    $("ficha").hidden = true;
    state.seleccion = null;
    if (listo) map.setFilter("espacios-sel", ["==", ["get", "id"], ""]);
    if (history.replaceState) history.replaceState(null, "", location.pathname + location.search);
  }

  function abrirEspacios(fs, volar) {
    state.seleccion = fs.map(function (f) { return f.properties.id; });
    mostrarFicha(fs.map(fichaEspacio).join(""));
    if (listo) map.setFilter("espacios-sel", ["in", ["get", "id"], ["literal", state.seleccion]]);
    if (history.replaceState) history.replaceState(null, "", "#e=" + encodeURIComponent(fs[0].properties.id));
    if (volar && listo) {
      var c = fs[0].geometry.coordinates;
      map.flyTo({ center: c, zoom: Math.max(map.getZoom(), 16), speed: 1.4 });
    }
  }

  function abrirBarrio(props) {
    var lista = visibles.filter(function (f) { return f.properties.barrio_id === props.id; });
    var extra = props.nombre_municipal && props.nombre_municipal !== props.nombre ?
      '<div class="meta">Nombre municipal: ' + esc(props.nombre_municipal) + "</div>" : "";
    var html = "<h2>" + esc(props.nombre) + '</h2><div class="meta">' + esc(props.delegacion) + " · ID " + esc(props.id) + "</div>" + extra +
      '<div class="meta" style="margin-top:6px">' + (lista.length ? lista.length + (lista.length === 1 ? " espacio cultural" : " espacios culturales") : "Sin espacios cargados") + "</div>";
    mostrarFicha(html + (lista.length ? '<ul class="lista" id="lb"></ul>' : ""));
    state.seleccion = null;
    map.setFilter("espacios-sel", ["==", ["get", "id"], ""]);
    if (lista.length) {
      var ul = $("ficha").querySelector("#lb");
      lista.forEach(function (f) {
        var c = catById[f.properties.categoria] || catById.otros, li = document.createElement("li"), b = document.createElement("button");
        b.type = "button";
        b.innerHTML = '<i style="background:' + c.c + '"></i><span class="nm">' + esc(f.properties.nombre) + "</span>";
        b.onclick = function () { abrirEspacios([f], true); };
        li.appendChild(b); ul.appendChild(li);
      });
    }
  }

  // ---------- mapa ----------
  function ajustar(fs, pad) {
    if (!fs.length) return;
    var x0 = 180, y0 = 90, x1 = -180, y1 = -90;
    fs.forEach(function (f) {
      var c = f.geometry.coordinates;
      if (c[0] < x0) x0 = c[0]; if (c[0] > x1) x1 = c[0];
      if (c[1] < y0) y0 = c[1]; if (c[1] > y1) y1 = c[1];
    });
    map.fitBounds([[x0, y0], [x1, y1]], { padding: pad || 40, maxZoom: 16, duration: 700 });
  }

  function iniciarMapa(datos) {
    espacios = datos[0].features;
    barrios = datos[1];
    barrios.features.forEach(function (b) { b.properties.n = 0; });
    espacios.forEach(function (f) { porId[f.properties.id] = f; });
    armarPanel();

    map = new maplibregl.Map({
      container: "map", style: estiloBase(), center: CFG.centro || [-57.9545, -34.9205], zoom: CFG.zoom || 12.6,
      attributionControl: false, dragRotate: false
    });
    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-left");
    map.touchZoomRotate.disableRotation();

    var colorMatch = ["match", ["get", "categoria"]];
    CATS.forEach(function (c) { colorMatch.push(c.id, c.c); });
    colorMatch.push("#868e96");

    map.on("load", function () {
      map.addSource("barrios", { type: "geojson", data: barrios });
      map.addSource("deleg", { type: "geojson", data: datos[2] });
      map.addSource("espacios", { type: "geojson", data: datos[0] });
      var acento = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#1f4fd8";
      map.addLayer({ id: "barrios-fill", type: "fill", source: "barrios", paint: { "fill-color": acento, "fill-opacity": 0 } });
      map.addLayer({ id: "barrios-line", type: "line", source: "barrios", paint: { "line-color": "#6b7280", "line-opacity": 0.35, "line-width": 0.8 } });
      map.addLayer({ id: "deleg-line", type: "line", source: "deleg", paint: { "line-color": "#374151", "line-opacity": 0.55, "line-width": 1.8 } });
      map.addLayer({ id: "espacios-halo", type: "circle", source: "espacios",
        paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 4.5, 16, 9], "circle-color": "#ffffff" } });
      map.addLayer({ id: "espacios", type: "circle", source: "espacios",
        paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 3.2, 16, 7], "circle-color": colorMatch } });
      map.addLayer({ id: "espacios-sel", type: "circle", source: "espacios", filter: ["==", ["get", "id"], ""],
        paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 7, 16, 12], "circle-color": "rgba(0,0,0,0)", "circle-stroke-width": 2.5, "circle-stroke-color": "#111827" } });
      listo = true;
      aplicar();
      desdeHash();
    });

    var tip = $("tip");
    map.on("mousemove", function (e) {
      if (!listo) return;
      var pts = map.queryRenderedFeatures([[e.point.x - 6, e.point.y - 6], [e.point.x + 6, e.point.y + 6]], { layers: ["espacios"] });
      var texto = "";
      if (pts.length) {
        texto = pts.map(function (f) { return f.properties.nombre; }).filter(function (v, i, a) { return a.indexOf(v) === i; }).join(" · ");
        map.getCanvas().style.cursor = "pointer";
      } else {
        var bs = map.queryRenderedFeatures(e.point, { layers: ["barrios-fill"] });
        map.getCanvas().style.cursor = bs.length ? "pointer" : "";
        if (bs.length) {
          var n = conteos[bs[0].properties.id] || 0;
          texto = bs[0].properties.nombre + " · " + bs[0].properties.delegacion + " · " + n + (n === 1 ? " espacio" : " espacios");
        }
      }
      if (texto) {
        tip.hidden = false; tip.textContent = texto;
        var w = map.getContainer().clientWidth;
        tip.style.left = Math.max(4, Math.min(e.point.x + 14, w - 270)) + "px";
        tip.style.top = (e.point.y + 14) + "px";
      } else tip.hidden = true;
    });
    map.on("mouseout", function () { tip.hidden = true; });

    map.on("click", function (e) {
      var pts = map.queryRenderedFeatures([[e.point.x - 7, e.point.y - 7], [e.point.x + 7, e.point.y + 7]], { layers: ["espacios"] });
      if (pts.length) {
        var vistos = {}, fs = [];
        pts.forEach(function (p) {
          var id = p.properties.id;
          if (!vistos[id] && porId[id]) { vistos[id] = 1; fs.push(porId[id]); }
        });
        abrirEspacios(fs, false);
        return;
      }
      var bs = map.queryRenderedFeatures(e.point, { layers: ["barrios-fill"] });
      if (bs.length) abrirBarrio(bs[0].properties); else cerrarFicha();
    });
  }

  function desdeHash() {
    var m = /^#e=(.+)$/.exec(location.hash);
    if (m && porId[decodeURIComponent(m[1])]) abrirEspacios([porId[decodeURIComponent(m[1])]], true);
  }
  window.addEventListener("hashchange", function () { if (listo) desdeHash(); });

  cargar().then(iniciarMapa).catch(function (err) {
    $("stat").textContent = "No se pudieron cargar los datos.";
    if (window.console) console.error(err);
  });
})();
