(() => {
  "use strict";

  const FALLBACK_LOCALITIES_URL =
    "https://mtgproyect.github.io/climateproyectar-v2/data/localidades.min.json";
  const FALLBACK_OBSERVATIONS_URL =
    "https://mtgproyect.github.io/climate-observations/estaciones.min.json";

  const state = {
    config: null,
    map: null,
    baseLayers: {},
    activeBaseLayer: null,
    localityCluster: null,
    stationLayer: null,
    localities: [],
    observations: new Map(),
    localityMarkers: [],
    stationMarkers: [],
    markerByLocalityId: new Map(),
    iconCache: new Map(),
    showTemperature: true,
    filters: {
      province: "",
      condition: "",
    },
    refreshTimer: null,
    loading: false,
  };

  const elements = {
    panel: document.getElementById("control-panel"),
    panelButton: document.getElementById("panel-button"),
    panelClose: document.getElementById("panel-close"),
    locateButton: document.getElementById("locate-button"),
    searchInput: document.getElementById("search-input"),
    searchClear: document.getElementById("search-clear"),
    searchResults: document.getElementById("search-results"),
    dataStatus: document.getElementById("data-status"),
    localityCount: document.getElementById("locality-count"),
    stationCount: document.getElementById("station-count"),
    freshCount: document.getElementById("fresh-count"),
    baseMapSelect: document.getElementById("base-map-select"),
    localitiesToggle: document.getElementById("localities-toggle"),
    stationsToggle: document.getElementById("stations-toggle"),
    temperatureToggle: document.getElementById("temperature-toggle"),
    provinceSelect: document.getElementById("province-select"),
    conditionSelect: document.getElementById("condition-select"),
    resetFilters: document.getElementById("reset-filters"),
    updatedAt: document.getElementById("updated-at"),
    loadingOverlay: document.getElementById("loading-overlay"),
    loadingTitle: document.getElementById("loading-title"),
    loadingMessage: document.getElementById("loading-message"),
    loadingProgress: document.getElementById("loading-progress-bar"),
    toast: document.getElementById("toast"),
  };

  const WEATHER_SYMBOLS = {
    clear: "☀",
    partly: "◒",
    cloudy: "☁",
    rain: "☂",
    storm: "ϟ",
    snow: "✣",
    fog: "≋",
    wind: "≈",
    unknown: "?",
  };

  const ICON_SVGS = {
    clear: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="4"></circle>
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"></path>
      </svg>`,
    partly: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M8 6a5 5 0 0 1 9.3 2.5"></path>
        <path d="M6.5 18h11a3.5 3.5 0 0 0 .4-7 5.5 5.5 0 0 0-10.4-1.8A4.5 4.5 0 0 0 6.5 18Z"></path>
      </svg>`,
    cloudy: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6.5 18h11a3.5 3.5 0 0 0 .4-7 5.5 5.5 0 0 0-10.4-1.8A4.5 4.5 0 0 0 6.5 18Z"></path>
      </svg>`,
    rain: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6.5 14h11a3.5 3.5 0 0 0 .4-7 5.5 5.5 0 0 0-10.4-1.8A4.5 4.5 0 0 0 6.5 14Z"></path>
        <path d="M8 17l-1 3M13 17l-1 3M18 17l-1 3"></path>
      </svg>`,
    storm: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6.5 13h11a3.5 3.5 0 0 0 .4-7 5.5 5.5 0 0 0-10.4-1.8A4.5 4.5 0 0 0 6.5 13Z"></path>
        <path d="M13 14l-3 5h3l-1 4 5-7h-3l1-2"></path>
      </svg>`,
    snow: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6.5 12h11a3.5 3.5 0 0 0 .4-7 5.5 5.5 0 0 0-10.4-1.8A4.5 4.5 0 0 0 6.5 12Z"></path>
        <path d="M8 16h0M12 19h0M16 16h0" stroke-width="4"></path>
      </svg>`,
    fog: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 8h14M3 12h18M5 16h14"></path>
      </svg>`,
    wind: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 8h10a2 2 0 1 0-2-2M4 12h15a2 2 0 1 1-2 2M4 16h8"></path>
      </svg>`,
    unknown: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="9"></circle>
        <path d="M9.7 9a2.5 2.5 0 1 1 3.9 2c-1 .7-1.6 1.2-1.6 2.5M12 17h0" stroke-width="2.6"></path>
      </svg>`,
  };

  function setLoading(title, message, progress) {
    elements.loadingTitle.textContent = title;
    elements.loadingMessage.textContent = message;
    elements.loadingProgress.style.width = `${Math.max(5, Math.min(100, progress))}%`;
    elements.loadingOverlay.classList.remove("hidden");
  }

  function hideLoading() {
    elements.loadingProgress.style.width = "100%";
    window.setTimeout(() => {
      elements.loadingOverlay.classList.add("hidden");
    }, 240);
  }

  function showToast(message, duration = 4500) {
    elements.toast.textContent = message;
    elements.toast.hidden = false;
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => {
      elements.toast.hidden = true;
    }, duration);
  }

  function normalizeText(value) {
    return String(value ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatNumber(value, suffix = "", digits = 0) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return "—";
    return `${numeric.toFixed(digits)}${suffix}`;
  }

  function formatDateTime(value) {
    if (!value) return "No disponible";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "No disponible";
    return new Intl.DateTimeFormat("es-AR", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(date);
  }

  function isObservationFresh(record) {
    if (!record) return false;
    if (record.fresh === false) return false;

    const dateValue = record.payload?.date || record.fetched_at;
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return Boolean(record.fresh);

    const staleAfter =
      Number(state.config?.stale_after_minutes) > 0
        ? Number(state.config.stale_after_minutes)
        : 90;

    return Date.now() - date.getTime() <= staleAfter * 60 * 1000;
  }

  async function fetchJson(url) {
    const separator = url.includes("?") ? "&" : "?";
    const response = await fetch(`${url}${separator}ts=${Date.now()}`, {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`${response.status} al descargar ${url}`);
    }

    return response.json();
  }

  async function loadConfig() {
    try {
      state.config = await fetchJson("config/data-sources.json");
    } catch (error) {
      console.warn("No se leyó la configuración; se usan fuentes predeterminadas.", error);
      state.config = {
        localities_url: FALLBACK_LOCALITIES_URL,
        observations_url: FALLBACK_OBSERVATIONS_URL,
        refresh_interval_ms: 600000,
        stale_after_minutes: 90,
        station_aliases: {
          "87412": "87420",
          "87470": "87360",
          "87683": "87637",
        },
        locality_display_aliases: {
          "4864": "Ciudad Autónoma de Buenos Aires (CABA)",
        },
        initial_view: {
          center: [-38.5, -64.5],
          zoom_desktop: 4,
          zoom_mobile: 3,
        },
      };
    }
  }

  function initializeMap() {
    const initial = state.config.initial_view || {};
    const mobile = window.matchMedia("(max-width: 850px)").matches;
    const center = Array.isArray(initial.center)
      ? initial.center
      : [-38.5, -64.5];
    const zoom = mobile
      ? Number(initial.zoom_mobile ?? 3)
      : Number(initial.zoom_desktop ?? 4);

    state.map = L.map("map", {
      center,
      zoom,
      zoomControl: true,
      minZoom: 2,
      maxZoom: 18,
      preferCanvas: true,
      worldCopyJump: true,
    });

    state.map.createPane("stationPane");
    state.map.getPane("stationPane").style.zIndex = "650";

    state.baseLayers = {
      light: L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
          maxZoom: 19,
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        }
      ),
      dark: L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
        {
          maxZoom: 20,
          subdomains: "abcd",
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; CARTO',
        }
      ),
      terrain: L.tileLayer(
        "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
        {
          maxZoom: 17,
          attribution:
            'Map data &copy; OpenStreetMap contributors, map style &copy; OpenTopoMap',
        }
      ),
    };

    state.activeBaseLayer = state.baseLayers.light;
    state.activeBaseLayer.addTo(state.map);

    state.localityCluster = L.markerClusterGroup({
      chunkedLoading: true,
      chunkInterval: 180,
      chunkDelay: 28,
      maxClusterRadius: 58,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      removeOutsideVisibleBounds: true,
      animate: true,
      animateAddingMarkers: false,
      disableClusteringAtZoom: 10,
      iconCreateFunction(cluster) {
        const count = cluster.getChildCount();
        let size = "small";
        if (count >= 100) size = "medium";
        if (count >= 1000) size = "large";

        return L.divIcon({
          html: `<div><span>${count.toLocaleString("es-AR")}</span></div>`,
          className: `marker-cluster marker-cluster-${size}`,
          iconSize:
            size === "large" ? [54, 54] : size === "medium" ? [48, 48] : [42, 42],
        });
      },
    });

    state.stationLayer = L.layerGroup();

    state.localityCluster.addTo(state.map);
    state.stationLayer.addTo(state.map);
  }

  function normalizeLocalities(payload) {
    const columns = Array.isArray(payload?.columns) ? payload.columns : [];
    const rows = Array.isArray(payload?.records) ? payload.records : [];
    const index = Object.fromEntries(columns.map((column, position) => [column, position]));
    const aliases = state.config?.locality_display_aliases || {};

    return rows
      .map((row) => {
        const id = row[index.id];
        const originalName = row[index.name];
        const displayName = aliases[String(id)] || originalName;
        const lat = Number(row[index.lat]);
        const lon = Number(row[index.lon]);

        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

        const locality = {
          id,
          name: displayName,
          original_name: originalName,
          department: row[index.department] || "",
          province: row[index.province] || "",
          type: row[index.type] || "Localidad",
          forecast_reference_id: row[index.forecast_reference_id],
          operational_station_number: row[index.operational_station_number],
          source_station_number: row[index.source_station_number],
          station_name: row[index.station_name] || "",
          distance_km: row[index.distance_km],
          lat,
          lon,
        };

        locality.search_text = normalizeText(
          [
            locality.name,
            locality.original_name,
            locality.department,
            locality.province,
            locality.type,
            locality.id,
          ].join(" ")
        );

        return locality;
      })
      .filter(Boolean);
  }

  function normalizeObservations(payload) {
    const records = payload?.records && typeof payload.records === "object"
      ? payload.records
      : {};

    const result = new Map();

    for (const [stationNumber, record] of Object.entries(records)) {
      result.set(String(stationNumber), record);
    }

    return result;
  }

  function resolveStationNumber(locality) {
    const aliases = state.config?.station_aliases || {};
    const operational = String(locality.operational_station_number ?? "");
    const source = String(locality.source_station_number ?? "");

    return aliases[operational] || operational || aliases[source] || source;
  }

  function observationForLocality(locality) {
    const station = resolveStationNumber(locality);
    if (station && state.observations.has(station)) {
      return state.observations.get(station);
    }

    const source = String(locality.source_station_number ?? "");
    const sourceAlias = state.config?.station_aliases?.[source] || source;
    return state.observations.get(sourceAlias) || null;
  }

  function classifyWeather(record) {
    const description = normalizeText(record?.payload?.weather?.description);

    if (!record || !record.payload) return "unknown";
    if (/torment|trueno|electri/.test(description)) return "storm";
    if (/nieve|nevada|aguanieve/.test(description)) return "snow";
    if (/lluvia|chaparr|precipit/.test(description)) return "rain";
    if (/lloviz/.test(description)) return "rain";
    if (/niebla|neblina|bruma|invisible/.test(description)) return "fog";
    if (/despejado/.test(description)) return "clear";
    if (/parcial|algo nublado|mayormente despejado/.test(description)) return "partly";
    if (/nublado|cubierto/.test(description)) return "cloudy";

    const windSpeed = Number(record.payload?.wind?.speed);
    if (Number.isFinite(windSpeed) && windSpeed >= 45) return "wind";

    return "unknown";
  }

  function createWeatherIcon(record, kind = "locality") {
    const category = classifyWeather(record);
    const temperature = Number(record?.payload?.temperature);
    const fresh = isObservationFresh(record);
    const showTemp = state.showTemperature && Number.isFinite(temperature);

    const cacheKey = [
      kind,
      category,
      showTemp ? Math.round(temperature) : "x",
      fresh ? "fresh" : "stale",
    ].join("|");

    if (state.iconCache.has(cacheKey)) {
      return state.iconCache.get(cacheKey);
    }

    const size = kind === "station" ? 54 : 47;
    const classNames = [
      "weather-pin",
      `marker-${category}`,
      kind === "station" ? "station" : "",
      fresh ? "" : "stale",
      showTemp ? "" : "no-temp",
    ]
      .filter(Boolean)
      .join(" ");

    const tempText = showTemp ? `${Math.round(temperature)}°` : "";

    const icon = L.divIcon({
      className: kind === "station" ? "station-div-icon" : "weather-div-icon",
      html: `
        <div class="${classNames}">
          <span class="weather-pin__glyph">${ICON_SVGS[category] || ICON_SVGS.unknown}</span>
          <span class="weather-pin__temp">${tempText}</span>
        </div>
      `,
      iconSize: [size, size],
      iconAnchor: [Math.round(size / 2), size - 4],
      popupAnchor: [0, -size + 6],
    });

    state.iconCache.set(cacheKey, icon);
    return icon;
  }

  function stationName(locality, record) {
    return (
      locality.station_name ||
      record?.payload?.location?.name ||
      `Estación ${resolveStationNumber(locality)}`
    );
  }

  function buildPopupHtml(locality, isStation = false) {
    const record = observationForLocality(locality);
    const payload = record?.payload || null;
    const category = classifyWeather(record);
    const fresh = isObservationFresh(record);
    const description =
      payload?.weather?.description || "Sin observación disponible";
    const temperature = Number(payload?.temperature);
    const feelsLike = Number(payload?.feels_like);
    const humidity = Number(payload?.humidity);
    const pressure = Number(payload?.pressure);
    const visibility = Number(payload?.visibility);
    const windSpeed = Number(payload?.wind?.speed);
    const windDirection = payload?.wind?.direction || "Sin dato";
    const stationNumber = resolveStationNumber(locality);
    const distance = Number(locality.distance_km);

    const placeSubtitle = [
      locality.type,
      locality.department,
      locality.province,
    ]
      .filter(Boolean)
      .join(" · ");

    if (!payload) {
      return `
        <div class="popup-card">
          <div class="popup-title">
            <div class="popup-title-copy">
              <h3>${escapeHtml(locality.name)}</h3>
              <small>${escapeHtml(placeSubtitle)}</small>
            </div>
            <span class="popup-condition-icon">${WEATHER_SYMBOLS.unknown}</span>
          </div>
          <div class="popup-no-data">
            No hay una observación utilizable para la estación operativa
            asociada ${escapeHtml(stationNumber || "sin identificar")}.
          </div>
          <div class="popup-station">
            <strong>${isStation ? "Estación operativa" : "Dato asociado"}</strong><br>
            ${escapeHtml(stationName(locality, record))}
          </div>
        </div>
      `;
    }

    return `
      <div class="popup-card">
        <div class="popup-title">
          <div class="popup-title-copy">
            <h3>${escapeHtml(locality.name)}</h3>
            <small>${escapeHtml(placeSubtitle)}</small>
          </div>
          <span class="popup-condition-icon">${WEATHER_SYMBOLS[category]}</span>
        </div>

        <div class="popup-main">
          <span class="popup-temperature">${formatNumber(temperature, "°", 1)}</span>
          <span class="popup-condition">
            <strong>${escapeHtml(description)}</strong>
            <span>${fresh ? "Observación vigente" : "Dato posiblemente desactualizado"}</span>
          </span>
        </div>

        <div class="popup-grid">
          <article>
            <span>Sensación</span>
            <strong>${formatNumber(feelsLike, "°", 1)}</strong>
          </article>
          <article>
            <span>Humedad</span>
            <strong>${formatNumber(humidity, "%")}</strong>
          </article>
          <article>
            <span>Presión</span>
            <strong>${formatNumber(pressure, " hPa", 1)}</strong>
          </article>
          <article>
            <span>Visibilidad</span>
            <strong>${formatNumber(visibility, " km", 1)}</strong>
          </article>
          <article>
            <span>Viento</span>
            <strong>${escapeHtml(windDirection)}</strong>
          </article>
          <article>
            <span>Velocidad</span>
            <strong>${formatNumber(windSpeed, " km/h")}</strong>
          </article>
        </div>

        <div class="popup-station">
          <strong>${isStation ? "Estación operativa" : "Dato de estación asociada"}</strong><br>
          ${escapeHtml(stationName(locality, record))}
          ${stationNumber ? ` · código ${escapeHtml(stationNumber)}` : ""}
          ${
            Number.isFinite(distance)
              ? ` · a ${distance.toFixed(1)} km`
              : ""
          }
          <br>
          Observación: ${escapeHtml(formatDateTime(payload.date))}
        </div>
      </div>
    `;
  }

  function localityMatchesFilters(locality) {
    if (
      state.filters.province &&
      locality.province !== state.filters.province
    ) {
      return false;
    }

    if (state.filters.condition) {
      const category = classifyWeather(observationForLocality(locality));
      if (category !== state.filters.condition) return false;
    }

    return true;
  }

  function createLocalityMarkers() {
    state.localityMarkers = [];
    state.markerByLocalityId.clear();

    const markers = state.localities.map((locality) => {
      const record = observationForLocality(locality);
      const marker = L.marker([locality.lat, locality.lon], {
        icon: createWeatherIcon(record, "locality"),
        title: locality.name,
        riseOnHover: true,
      });

      marker.locality = locality;
      marker.bindPopup(
        () => buildPopupHtml(locality, false),
        {
          className: "weather-popup",
          maxWidth: 340,
          minWidth: 260,
        }
      );

      state.markerByLocalityId.set(String(locality.id), marker);
      return marker;
    });

    state.localityMarkers = markers;
  }

  function createStationMarkers() {
    state.stationMarkers = [];
    state.stationLayer.clearLayers();

    const byStation = new Map();

    for (const locality of state.localities) {
      const station = resolveStationNumber(locality);
      if (!station || byStation.has(station)) continue;

      const record = state.observations.get(station);
      const location = record?.payload?.location;
      const lat = Number(location?.coord?.lat ?? locality.lat);
      const lon = Number(location?.coord?.lon ?? locality.lon);

      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

      const stationLocality = {
        ...locality,
        name: location?.name || locality.station_name || locality.name,
        department: location?.department || locality.department,
        province: location?.province || locality.province,
        type: "Estación meteorológica",
        lat,
        lon,
        operational_station_number: station,
        distance_km: 0,
      };

      const marker = L.marker([lat, lon], {
        pane: "stationPane",
        icon: createWeatherIcon(record, "station"),
        title: `Estación ${stationLocality.name}`,
        zIndexOffset: 1000,
      });

      marker.stationNumber = station;
      marker.locality = stationLocality;
      marker.bindPopup(
        () => buildPopupHtml(stationLocality, true),
        {
          className: "weather-popup",
          maxWidth: 340,
          minWidth: 260,
        }
      );

      byStation.set(station, marker);
    }

    state.stationMarkers = [...byStation.values()];
    state.stationLayer.addLayer(L.layerGroup(state.stationMarkers));
  }

  function applyLocalityFilters() {
    if (!state.localityCluster) return;

    state.localityCluster.clearLayers();
    const visible = state.localityMarkers.filter((marker) =>
      localityMatchesFilters(marker.locality)
    );

    state.localityCluster.addLayers(visible);
    elements.localityCount.textContent = visible.length.toLocaleString("es-AR");
  }

  function updateAllMarkerIcons() {
    state.iconCache.clear();

    for (const marker of state.localityMarkers) {
      const record = observationForLocality(marker.locality);
      marker.setIcon(createWeatherIcon(record, "locality"));
    }

    for (const marker of state.stationMarkers) {
      const record = state.observations.get(String(marker.stationNumber));
      marker.setIcon(createWeatherIcon(record, "station"));
    }
  }

  function populateProvinceFilter() {
    const provinces = [...new Set(state.localities.map((item) => item.province))]
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, "es"));

    const fragment = document.createDocumentFragment();
    for (const province of provinces) {
      const option = document.createElement("option");
      option.value = province;
      option.textContent = province;
      fragment.appendChild(option);
    }

    elements.provinceSelect.appendChild(fragment);
  }

  function updateStats(localityPayload, observationPayload) {
    const stationsWithData = [...state.observations.values()].filter(
      (record) => record?.status === "success" && record?.payload
    );

    elements.localityCount.textContent =
      state.localities.length.toLocaleString("es-AR");
    elements.stationCount.textContent =
      state.observations.size.toLocaleString("es-AR");
    elements.freshCount.textContent =
      stationsWithData.length.toLocaleString("es-AR");

    const generatedAt =
      observationPayload?.generated_at ||
      localityPayload?.generated_at ||
      null;

    elements.updatedAt.textContent = formatDateTime(generatedAt);
    elements.dataStatus.textContent =
      `${state.localities.length.toLocaleString("es-AR")} localidades · ` +
      `${state.observations.size.toLocaleString("es-AR")} estaciones`;
  }

  async function loadInitialData() {
    state.loading = true;
    setLoading(
      "Descargando catálogo",
      "Leyendo las 10.601 localidades de ClimateProyectar.",
      12
    );

    const localitiesUrl =
      state.config.localities_url || FALLBACK_LOCALITIES_URL;
    const observationsUrl =
      state.config.observations_url || FALLBACK_OBSERVATIONS_URL;

    const localitiesPromise = fetchJson(localitiesUrl);
    const observationsPromise = fetchJson(observationsUrl);

    const localityPayload = await localitiesPromise;
    setLoading(
      "Procesando localidades",
      "Preparando coordenadas, estaciones asociadas y buscador.",
      38
    );

    state.localities = normalizeLocalities(localityPayload);

    const observationPayload = await observationsPromise;
    setLoading(
      "Uniendo observaciones",
      "Asignando a cada localidad el dato de su estación operativa.",
      58
    );

    state.observations = normalizeObservations(observationPayload);

    populateProvinceFilter();

    setLoading(
      "Creando iconos",
      "El mapa agrupa los puntos automáticamente para mantener fluidez.",
      72
    );

    createLocalityMarkers();

    setLoading(
      "Agregando localidades",
      "Cargando los puntos en grupos progresivos.",
      84
    );

    applyLocalityFilters();
    createStationMarkers();
    updateStats(localityPayload, observationPayload);

    setLoading(
      "Mapa listo",
      "Finalizando controles y actualización automática.",
      100
    );

    state.loading = false;
    hideLoading();
  }

  async function refreshObservations() {
    if (state.loading) return;

    const observationsUrl =
      state.config.observations_url || FALLBACK_OBSERVATIONS_URL;

    try {
      const payload = await fetchJson(observationsUrl);
      state.observations = normalizeObservations(payload);
      updateAllMarkerIcons();
      createStationMarkers();
      updateStats(null, payload);
      showToast("Las observaciones del mapa se actualizaron.");
    } catch (error) {
      console.error(error);
      showToast("No se pudieron revisar observaciones nuevas. Se conservan los datos visibles.");
    }
  }

  function scheduleRefresh() {
    const interval = Math.max(
      300000,
      Number(state.config.refresh_interval_ms) || 600000
    );

    window.clearInterval(state.refreshTimer);
    state.refreshTimer = window.setInterval(refreshObservations, interval);
  }

  function switchBaseMap(layerId) {
    const next = state.baseLayers[layerId];
    if (!next || next === state.activeBaseLayer) return;

    if (state.activeBaseLayer) {
      state.map.removeLayer(state.activeBaseLayer);
    }

    next.addTo(state.map);
    next.bringToBack();
    state.activeBaseLayer = next;
  }

  function toggleLocalities(visible) {
    if (visible) {
      if (!state.map.hasLayer(state.localityCluster)) {
        state.localityCluster.addTo(state.map);
      }
    } else if (state.map.hasLayer(state.localityCluster)) {
      state.map.removeLayer(state.localityCluster);
    }
  }

  function toggleStations(visible) {
    if (visible) {
      if (!state.map.hasLayer(state.stationLayer)) {
        state.stationLayer.addTo(state.map);
      }
    } else if (state.map.hasLayer(state.stationLayer)) {
      state.map.removeLayer(state.stationLayer);
    }
  }

  function renderSearchResults(query) {
    const normalized = normalizeText(query);

    if (normalized.length < 2) {
      elements.searchResults.hidden = true;
      elements.searchResults.innerHTML = "";
      return;
    }

    const matches = state.localities
      .filter((locality) => locality.search_text.includes(normalized))
      .sort((a, b) => {
        const aStarts = normalizeText(a.name).startsWith(normalized) ? 0 : 1;
        const bStarts = normalizeText(b.name).startsWith(normalized) ? 0 : 1;
        return aStarts - bStarts || a.name.localeCompare(b.name, "es");
      })
      .slice(0, 35);

    elements.searchResults.innerHTML = "";

    if (!matches.length) {
      const empty = document.createElement("div");
      empty.className = "search-result";
      empty.innerHTML = `
        <span class="search-result-icon">?</span>
        <span class="search-result-copy">
          <strong>Sin resultados</strong>
          <small>Probá con otra localidad, departamento o provincia.</small>
        </span>
      `;
      elements.searchResults.appendChild(empty);
      elements.searchResults.hidden = false;
      return;
    }

    const fragment = document.createDocumentFragment();

    for (const locality of matches) {
      const record = observationForLocality(locality);
      const category = classifyWeather(record);
      const temperature = Number(record?.payload?.temperature);
      const button = document.createElement("button");
      button.className = "search-result";
      button.type = "button";
      button.innerHTML = `
        <span class="search-result-icon">${WEATHER_SYMBOLS[category]}</span>
        <span class="search-result-copy">
          <strong>${escapeHtml(locality.name)}</strong>
          <small>${escapeHtml(
            [locality.department, locality.province].filter(Boolean).join(" · ")
          )}</small>
        </span>
        <span class="search-result-temp">${
          Number.isFinite(temperature) ? `${Math.round(temperature)}°` : "—"
        }</span>
      `;

      button.addEventListener("click", () => focusLocality(locality));
      fragment.appendChild(button);
    }

    elements.searchResults.appendChild(fragment);
    elements.searchResults.hidden = false;
  }

  function focusLocality(locality) {
    const marker = state.markerByLocalityId.get(String(locality.id));
    if (!marker) return;

    elements.searchInput.value = locality.name;
    elements.searchResults.hidden = true;

    if (!state.map.hasLayer(state.localityCluster)) {
      elements.localitiesToggle.checked = true;
      state.localityCluster.addTo(state.map);
    }

    const filteredOut = !localityMatchesFilters(locality);
    if (filteredOut) {
      state.filters.province = "";
      state.filters.condition = "";
      elements.provinceSelect.value = "";
      elements.conditionSelect.value = "";
      applyLocalityFilters();
    }

    state.map.setView([locality.lat, locality.lon], 12, {
      animate: true,
    });

    state.localityCluster.zoomToShowLayer(marker, () => {
      marker.openPopup();
    });

    closePanel();
  }

  function locateUser() {
    if (!navigator.geolocation) {
      showToast("El navegador no ofrece geolocalización.");
      return;
    }

    showToast("Buscando tu ubicación…", 10000);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        state.map.setView(
          [position.coords.latitude, position.coords.longitude],
          10,
          { animate: true }
        );
        showToast("El mapa se centró en tu ubicación aproximada.");
      },
      (error) => showToast(`No se pudo obtener la ubicación: ${error.message}`),
      {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 300000,
      }
    );
  }

  function openPanel() {
    elements.panel.classList.add("open");
  }

  function closePanel() {
    elements.panel.classList.remove("open");
  }

  function resetFilters() {
    state.filters.province = "";
    state.filters.condition = "";
    elements.provinceSelect.value = "";
    elements.conditionSelect.value = "";
    applyLocalityFilters();
  }

  function debounce(callback, delay = 170) {
    let timer;
    return (...args) => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => callback(...args), delay);
    };
  }

  function attachEvents() {
    elements.panelButton.addEventListener("click", openPanel);
    elements.panelClose.addEventListener("click", closePanel);
    elements.locateButton.addEventListener("click", locateUser);

    elements.baseMapSelect.addEventListener("change", (event) => {
      switchBaseMap(event.target.value);
    });

    elements.localitiesToggle.addEventListener("change", (event) => {
      toggleLocalities(event.target.checked);
    });

    elements.stationsToggle.addEventListener("change", (event) => {
      toggleStations(event.target.checked);
    });

    elements.temperatureToggle.addEventListener("change", (event) => {
      state.showTemperature = event.target.checked;
      updateAllMarkerIcons();
    });

    elements.provinceSelect.addEventListener("change", (event) => {
      state.filters.province = event.target.value;
      applyLocalityFilters();
    });

    elements.conditionSelect.addEventListener("change", (event) => {
      state.filters.condition = event.target.value;
      applyLocalityFilters();
    });

    elements.resetFilters.addEventListener("click", resetFilters);

    const handleSearch = debounce((event) => {
      renderSearchResults(event.target.value);
    });

    elements.searchInput.addEventListener("input", handleSearch);

    elements.searchInput.addEventListener("focus", () => {
      renderSearchResults(elements.searchInput.value);
    });

    elements.searchClear.addEventListener("click", () => {
      elements.searchInput.value = "";
      elements.searchResults.hidden = true;
      elements.searchInput.focus();
    });

    document.addEventListener("click", (event) => {
      if (!event.target.closest(".search-shell")) {
        elements.searchResults.hidden = true;
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        elements.searchResults.hidden = true;
        closePanel();
      }
    });
  }

  async function boot() {
    try {
      setLoading(
        "Preparando aplicación",
        "Leyendo configuración y fuentes de datos.",
        6
      );

      attachEvents();
      await loadConfig();
      initializeMap();
      await loadInitialData();
      scheduleRefresh();
    } catch (error) {
      console.error(error);
      elements.loadingTitle.textContent = "No se pudo cargar el mapa";
      elements.loadingMessage.textContent =
        `${error.message}. Revisá que los repositorios de datos estén publicados.`;
      elements.loadingProgress.style.width = "100%";
      elements.loadingProgress.style.background = "#dc4a4a";
    }
  }

  boot();
})();
