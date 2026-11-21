#!/usr/bin/env python3
"""
Genera los archivos de datos del sitio a partir de la planilla y de los polígonos municipales.

Qué hace:
  1. Lee la planilla (CSV exportado de Google Sheets).
  2. Para cada espacio con latitud y longitud, calcula solo el barrio y la delegación
     (punto dentro de polígono), sin cargarlos a mano.
  3. Usa los nombres de barrio propios (archivo nombres_barrios.csv) y guarda el ID municipal.
  4. Escribe en site/data/: espacios.geojson, barrios.geojson y delegaciones.geojson
     (los polígonos se simplifican para que el sitio cargue rápido).

Uso (desde la carpeta del proyecto):
  python3 scripts/build_data.py \
      --planilla planilla.csv \
      --barrios fuentes/barrios.geojson \
      --delegaciones fuentes/delegaciones.geojson \
      --nombres scripts/nombres_barrios.csv \
      --salida site/data

Solo usa la biblioteca estándar de Python 3.
"""
import argparse, csv, json, re, sys, unicodedata, collections, os

# ---------- utilidades ----------
def sin_tildes(s):
    s = unicodedata.normalize("NFD", s or "")
    return "".join(c for c in s if unicodedata.category(c) != "Mn")

def slug(s):
    s = sin_tildes(s).lower()
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s[:60] or "espacio"

def num(v):
    v = (v or "").strip()
    if not v:
        return None
    if "," in v and "." not in v:
        v = v.replace(",", ".")
    try:
        return float(v)
    except ValueError:
        return None

def entero(v):
    m = re.search(r"\d{4}", v or "")
    return int(m.group(0)) if m else None

def arreglar_nombre(s):
    s = (s or "").strip()
    if s.startswith("EI "):          # error de tipeo de la fuente: "EI" en vez de "El"
        s = "El " + s[3:]
    return s.replace("ünico", "Único")

def nombre_delegacion(s):
    if (s or "").upper().startswith("LA PLATA CASCO"):
        return "Casco urbano"
    chicas = {"DE", "DEL", "Y"}
    return " ".join(w.lower() if w in chicas else w.capitalize() for w in (s or "").split())

CATEGORIAS = [
    ("casa-centro-espacio", "Casas, centros y espacios culturales"),
    ("cine-teatro", "Salas de cine y teatro"),
    ("museo-galeria", "Galerías de arte y museos"),
    ("club-comunitario", "Clubes y centros comunitarios"),
    ("biblioteca-libreria", "Bibliotecas y librerías"),
    ("otros", "Varias o sin categoría"),
]

def categoria(texto):
    t = sin_tildes(texto or "").lower()
    if "cine" in t or "teatro" in t: return "cine-teatro"
    if "galeria" in t or "museo" in t: return "museo-galeria"
    if "club" in t or "comunitario" in t: return "club-comunitario"
    if "biblioteca" in t or "libreria" in t: return "biblioteca-libreria"
    if "casa" in t or "centro" in t or "espacio" in t: return "casa-centro-espacio"
    return "otros"

# ---------- geometría ----------
def pip(x, y, ring):
    dentro = False
    n = len(ring)
    j = n - 1
    for i in range(n):
        xi, yi = ring[i][0], ring[i][1]
        xj, yj = ring[j][0], ring[j][1]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
            dentro = not dentro
        j = i
    return dentro

class Zona:
    def __init__(self, props, geom):
        self.props = props
        self.polys = geom["coordinates"] if geom["type"] == "MultiPolygon" else [geom["coordinates"]]
        xs = [p[0] for poly in self.polys for p in poly[0]]
        ys = [p[1] for poly in self.polys for p in poly[0]]
        self.bb = (min(xs), min(ys), max(xs), max(ys))

    def contiene(self, x, y):
        b = self.bb
        if x < b[0] or x > b[2] or y < b[1] or y > b[3]:
            return False
        for poly in self.polys:
            if pip(x, y, poly[0]) and not any(pip(x, y, h) for h in poly[1:]):
                return True
        return False

def cargar_zonas(ruta):
    with open(ruta, encoding="utf-8") as f:
        return [Zona(ft["properties"], ft["geometry"]) for ft in json.load(f)["features"]]

def dp(pts, eps):
    """Douglas-Peucker iterativo."""
    if len(pts) <= 2:
        return pts
    keep = [False] * len(pts)
    keep[0] = keep[-1] = True
    pila = [(0, len(pts) - 1)]
    while pila:
        a, b = pila.pop()
        ax, ay = pts[a][0], pts[a][1]
        bx, by = pts[b][0], pts[b][1]
        dx, dy = bx - ax, by - ay
        L = dx * dx + dy * dy
        md, mi = -1.0, -1
        for i in range(a + 1, b):
            px_, py_ = pts[i][0], pts[i][1]
            if L == 0:
                d = (px_ - ax) ** 2 + (py_ - ay) ** 2
            else:
                t = max(0.0, min(1.0, ((px_ - ax) * dx + (py_ - ay) * dy) / L))
                d = (px_ - ax - t * dx) ** 2 + (py_ - ay - t * dy) ** 2
            if d > md:
                md, mi = d, i
        if md > eps * eps:
            keep[mi] = True
            pila.append((a, mi))
            pila.append((mi, b))
    return [p for p, k in zip(pts, keep) if k]

def area(r):
    n = len(r)
    return abs(sum(r[i][0] * r[(i + 1) % n][1] - r[(i + 1) % n][0] * r[i][1] for i in range(n))) / 2

def simplificar(zona, eps, min_area):
    polys = []
    for poly in zona.polys:
        anillos = []
        for k, anillo in enumerate(poly):
            rr = dp([(p[0], p[1]) for p in anillo], eps)
            if len(rr) >= 4 and area(rr) > min_area:
                if rr[0] != rr[-1]:
                    rr.append(rr[0])
                anillos.append([[round(x, 5), round(y, 5)] for x, y in rr])
            elif k == 0:
                break
        if anillos:
            polys.append(anillos)
    return {"type": "MultiPolygon", "coordinates": polys}

# ---------- programa principal ----------
def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--planilla", required=True)
    ap.add_argument("--barrios", required=True)
    ap.add_argument("--delegaciones", required=True)
    ap.add_argument("--nombres", required=True)
    ap.add_argument("--salida", required=True)
    a = ap.parse_args()

    # nombres propios por ID municipal
    propios = {}
    with open(a.nombres, encoding="utf-8-sig", newline="") as f:
        for r in csv.DictReader(f):
            if (r.get("nombre_propio") or "").strip():
                propios[r["id"].strip()] = r["nombre_propio"].strip()

    barrios = cargar_zonas(a.barrios)
    delegs = cargar_zonas(a.delegaciones)

    # planilla: la fila de encabezados puede no ser la primera
    with open(a.planilla, encoding="utf-8-sig", newline="") as f:
        lineas = f.read().splitlines()
    ini = next((i for i, l in enumerate(lineas) if "PROYECTO" in l.upper()), None)
    if ini is None:
        sys.exit("No encontré la columna PROYECTO en la planilla.")
    lector = csv.reader(lineas[ini:])
    enc = [(h or "").strip().upper().replace("\n", " ") for h in next(lector)]
    def col(fila, *nombres):
        for n in nombres:
            if n in enc:
                i = enc.index(n)
                if i < len(fila):
                    return (fila[i] or "").strip()
        return ""

    espacios, sin_coord, fuera, usados = [], [], [], set()
    for fila in lector:
        nombre = col(fila, "PROYECTO")
        if not nombre:
            continue
        lat, lon = num(col(fila, "LATITUD")), num(col(fila, "LONGITUD"))
        base = col(fila, "ID") or slug(nombre)
        eid, n = base, 2
        while eid in usados:
            eid, n = "%s-%d" % (base, n), n + 1
        usados.add(eid)
        fin, estado = entero(col(fila, "FIN")), col(fila, "ESTADO").lower()
        props = {
            "id": eid,
            "nombre": nombre,
            "categoria": categoria(col(fila, "CATEGORÍA", "CATEGORIA")),
            "subcategoria": col(fila, "SUBCATEGORÍA", "SUBCATEGORIA"),
            "inicio": entero(col(fila, "INICIO", "AÑO DE CREACIÓN")),
            "fin": fin,
            "estado": estado or ("cerrado" if fin else "activo"),
            "instagram": col(fila, "INSTAGRAM").lstrip("@").strip("/ "),
            "direccion": col(fila, "DIRECCIÓN", "DIRECCION"),
            "gestion": col(fila, "GESTIÓN", "GESTION"),
            "tipo_gestion": col(fila, "TIPO DE GESTION", "TIPO DE GESTIÓN"),
            "barrio": "", "barrio_id": "", "delegacion": "",
        }
        if lat is None or lon is None:
            sin_coord.append(nombre)
            continue
        b = next((z for z in barrios if z.contiene(lon, lat)), None)
        if b:
            bid = b.props["id"]
            props["barrio_id"] = bid
            props["barrio"] = propios.get(bid) or arreglar_nombre(b.props["nombre"])
            props["delegacion"] = nombre_delegacion(b.props.get("delegacion_2026", ""))
        else:
            d = next((z for z in delegs if z.contiene(lon, lat)), None)
            props["delegacion"] = nombre_delegacion(d.props["nombre"]) if d else "Fuera del partido"
            props["barrio"] = col(fila, "BARRIO")        # se conserva lo cargado a mano
            fuera.append(nombre)
        espacios.append({"type": "Feature", "id": eid, "properties": props,
                         "geometry": {"type": "Point", "coordinates": [round(lon, 6), round(lat, 6)]}})

    os.makedirs(a.salida, exist_ok=True)
    def guardar(nombre_archivo, obj):
        with open(os.path.join(a.salida, nombre_archivo), "w", encoding="utf-8") as f:
            json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))

    guardar("espacios.geojson", {"type": "FeatureCollection", "features": espacios})
    guardar("barrios.geojson", {"type": "FeatureCollection", "features": [
        {"type": "Feature", "properties": {
            "id": z.props["id"],
            "nombre": propios.get(z.props["id"]) or arreglar_nombre(z.props["nombre"]),
            "nombre_municipal": arreglar_nombre(z.props["nombre"]),
            "delegacion": nombre_delegacion(z.props.get("delegacion_2026", ""))},
         "geometry": simplificar(z, 4e-5, 2e-9)} for z in barrios]})
    guardar("delegaciones.geojson", {"type": "FeatureCollection", "features": [
        {"type": "Feature", "properties": {"nombre": nombre_delegacion(z.props["nombre"])},
         "geometry": simplificar(z, 1.2e-4, 1e-8)} for z in delegs]})
    guardar("categorias.json", [{"id": i, "nombre": n} for i, n in CATEGORIAS])

    print("Espacios en el mapa:", len(espacios))
    print("Con barrio asignado:", sum(1 for e in espacios if e["properties"]["barrio_id"]))
    print("Por delegación:", dict(collections.Counter(e["properties"]["delegacion"] for e in espacios).most_common()))
    if sin_coord:
        print("\nSin coordenadas (no aparecen en el mapa):")
        for n in sin_coord: print("  -", n)
    if fuera:
        print("\nFuera de todo barrio municipal (revisar el punto):")
        for n in fuera: print("  -", n)

if __name__ == "__main__":
    main()
