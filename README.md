# Climate Localities Map

Mapa meteorológico nacional de ClimateProyectar para las 10.601 localidades
argentinas y las 121 estaciones operativas.

## Funciones

- todas las localidades del catálogo nacional;
- icono meteorológico y temperatura en cada localidad;
- observación actual heredada de la estación operativa asociada;
- estaciones operativas en una capa independiente;
- agrupamiento inteligente para evitar saturar el mapa;
- buscador por localidad, departamento y provincia;
- filtros por provincia y condición meteorológica;
- mapas claro, oscuro y terreno;
- actualización automática de observaciones en el navegador;
- diseño adaptable a computadora y celular;
- publicación estática mediante GitHub Pages.

## Repositorio recomendado

```text
mtgproyect/climate-localities-map
```

## Descripción recomendada

```text
Mapa meteorológico nacional de 10.601 localidades argentinas con iconos de condiciones actuales y observaciones de las 121 estaciones operativas de ClimateProyectar.
```

## Fuentes de datos

La aplicación no consulta directamente al SMN. Consume los productos ya
procesados y publicados por ClimateProyectar:

```text
https://mtgproyect.github.io/climateproyectar-v2/data/localidades.min.json
https://mtgproyect.github.io/climate-observations/estaciones.min.json
```

Cada localidad utiliza su campo:

```text
operational_station_number
```

para recuperar la observación de la estación operativa correspondiente.

Por ese motivo, el popup aclara que se trata de un dato de la estación
asociada y muestra la distancia entre la localidad y la estación cuando está
disponible.

## Publicación inicial

1. Crear un repositorio público vacío llamado `climate-localities-map`.
2. Subir todo el contenido de este paquete.
3. Abrir:

```text
Settings → Pages → Source → GitHub Actions
```

4. Abrir:

```text
Actions → Deploy localities weather map → Run workflow
```

5. La dirección pública será:

```text
https://mtgproyect.github.io/climate-localities-map/
```

## Automatización

El workflow conserva exclusivamente:

```yaml
workflow_dispatch:
```

No contiene `schedule`, `push` ni `pull_request`.

Este repositorio no necesita ejecutarse cada vez que cambian las
observaciones. El navegador vuelve a leer `climate-observations` cada diez
minutos, mientras que ese repositorio continúa actualizándose mediante su
propio cron-job.org.

Solo es necesario volver a desplegar este repositorio cuando se modifica el
frontend.

### Disparo externo opcional

```text
POST
https://api.github.com/repos/mtgproyect/climate-localities-map/actions/workflows/deploy-pages.yml/dispatches
```

Cuerpo:

```json
{
  "ref": "main"
}
```

## Rendimiento

Las 10.601 localidades se cargan con `Leaflet.markercluster` y
`chunkedLoading`.

- a escala nacional se muestran grupos con cantidades;
- al acercarse los grupos se separan;
- desde zoom alto aparecen todos los iconos individuales;
- las 121 estaciones pueden mostrarse u ocultarse independientemente.

## Corrección visual de CABA

La localidad `4864` se muestra como:

```text
Ciudad Autónoma de Buenos Aires (CABA)
```

sin modificar sus identificadores, estación, pronóstico ni coordenadas.

## Prueba local

```bash
python -m http.server 8000 --directory docs
```

Abrir:

```text
http://localhost:8000
```

La prueba local requiere conexión a Internet para descargar mapas y datos.

## Licencias y atribuciones

- código del proyecto: MIT;
- cartografía: OpenStreetMap, CARTO y OpenTopoMap;
- motor: Leaflet;
- agrupamiento: Leaflet.markercluster;
- datos meteorológicos: productos derivados del Servicio Meteorológico
  Nacional publicados por ClimateProyectar.
