/**
 * Mapa do Brasil — nuvem de pontos + mapa de calor estilo temperatura (INMET/meteorologia).
 */

let leafletPromise = null;
let heatPluginPromise = null;

/** Escala azul → verde → amarelo → laranja → vermelho (mapas de temperatura BR) */
export const TEMP_STOPS = [
  { t: 0.0, r: 49, g: 54, b: 149, label: 'Mínimo' },
  { t: 0.12, r: 69, g: 117, b: 180, label: '' },
  { t: 0.25, r: 116, g: 173, b: 209, label: '' },
  { t: 0.38, r: 171, g: 217, b: 233, label: '' },
  { t: 0.48, r: 224, g: 243, b: 248, label: '' },
  { t: 0.55, r: 255, g: 255, b: 191, label: '' },
  { t: 0.65, r: 254, g: 224, b: 144, label: '' },
  { t: 0.75, r: 253, g: 174, b: 97, label: '' },
  { t: 0.85, r: 244, g: 109, b: 67, label: '' },
  { t: 0.93, r: 215, g: 48, b: 39, label: '' },
  { t: 1.0, r: 165, g: 0, b: 38, label: 'Máximo' },
];

export const UF_COORDS = {
  AC: [-9.974, -67.810], AL: [-9.571, -36.782], AM: [-3.119, -60.021],
  AP: [0.034, -51.069], BA: [-12.971, -38.501], CE: [-3.717, -38.543],
  DF: [-15.794, -47.882], ES: [-20.315, -40.338], GO: [-16.686, -49.265],
  MA: [-2.530, -44.306], MG: [-19.916, -43.934], MS: [-20.443, -54.647],
  MT: [-15.601, -56.097], PA: [-1.455, -48.504], PB: [-7.119, -34.845],
  PE: [-8.047, -34.877], PI: [-5.089, -42.801], PR: [-25.428, -49.273],
  RJ: [-22.907, -43.173], RN: [-5.794, -35.211], RO: [-8.761, -63.903],
  RR: [2.823, -60.675], RS: [-30.034, -51.217], SC: [-27.595, -48.548],
  SE: [-10.947, -37.073], SP: [-23.550, -46.633], TO: [-10.184, -48.333],
};

const BR_BOUNDS = { south: -33.75, north: 5.55, west: -73.99, east: -34.79 };

export const HEAT_PRESETS = {
  volume_lr: {
    title: 'Densidade · Lucro Real',
    subtitle: 'Quanto mais quente, maior concentração de empresas LR',
    valueKey: 'total',
    format: function (v) { return v.toLocaleString('pt-BR') + ' empresas'; },
  },
  share_pct: {
    title: 'Participação regional',
    subtitle: '% do universo LR nacional por UF',
    valueKey: 'pct',
    format: function (v) { return v.toFixed(1) + '%'; },
  },
  carencia: {
    title: 'Carência patrimonial',
    subtitle: 'Regiões com menor oferta de controle patrimonial (mais quente = mais oportunidade)',
    valueKey: 'carencia_patrimonial_pct',
    format: function (v) { return v.toFixed(0) + '% carência'; },
  },
  coldmail: {
    title: 'Prioridade cold mail',
    subtitle: 'Score composto: volume LR + carência + baixa cobertura de auditorias',
    valueKey: 'score_prioridade_cold_mail',
    format: function (v) { return 'Score ' + v.toFixed(1); },
  },
};

function loadLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  if (leafletPromise) return leafletPromise;
  leafletPromise = new Promise(function (resolve, reject) {
    if (!document.querySelector('link[data-leaflet]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      link.setAttribute('data-leaflet', '1');
      document.head.appendChild(link);
    }
    const s = document.createElement('script');
    s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    s.onload = function () { resolve(window.L); };
    s.onerror = reject;
    document.head.appendChild(s);
  });
  return leafletPromise;
}

function loadHeatPlugin(L) {
  if (L.HeatLayer) return Promise.resolve(L);
  if (heatPluginPromise) return heatPluginPromise;
  heatPluginPromise = new Promise(function (resolve, reject) {
    const s = document.createElement('script');
    s.src = 'https://unpkg.com/leaflet.heat@0.2.0/dist/leaflet-heat.js';
    s.onload = function () { resolve(window.L); };
    s.onerror = reject;
    document.head.appendChild(s);
  });
  return heatPluginPromise;
}

export function valueToColor(norm) {
  const t = Math.max(0, Math.min(1, norm));
  for (let i = 1; i < TEMP_STOPS.length; i++) {
    const a = TEMP_STOPS[i - 1];
    const b = TEMP_STOPS[i];
    if (t <= b.t) {
      const f = (t - a.t) / (b.t - a.t || 1);
      return [
        Math.round(a.r + (b.r - a.r) * f),
        Math.round(a.g + (b.g - a.g) * f),
        Math.round(a.b + (b.b - a.b) * f),
      ];
    }
  }
  const last = TEMP_STOPS[TEMP_STOPS.length - 1];
  return [last.r, last.g, last.b];
}

export function buildHeatSources(aggregado, valueKey) {
  valueKey = valueKey || 'total';
  const vals = aggregado.map(function (a) { return Number(a[valueKey]) || 0; });
  const min = Math.min.apply(null, vals);
  const max = Math.max.apply(null, vals) || 1;
  const sources = [];
  aggregado.forEach(function (a) {
    const uf = a.uf;
    const base = UF_COORDS[uf];
    if (!base) return;
    const value = Number(a[valueKey]) || 0;
    const norm = max > min ? (value - min) / (max - min) : 0.5;
    const anchors = 10;
    for (let i = 0; i < anchors; i++) {
      const angle = (i / anchors) * Math.PI * 2;
      const r = 0.35 + (i % 3) * 0.25;
      sources.push({
        lat: base[0] + Math.sin(angle) * r,
        lng: base[1] + Math.cos(angle) * r * 1.1,
        value: value,
        norm: norm,
        uf: uf,
      });
    }
    sources.push({ lat: base[0], lng: base[1], value: value, norm: norm, uf: uf });
  });
  return { sources: sources, min: min, max: max };
}

function idw(lat, lng, sources, power) {
  power = power || 2;
  let num = 0;
  let den = 0;
  for (let i = 0; i < sources.length; i++) {
    const s = sources[i];
    const dlat = lat - s.lat;
    const dlng = (lng - s.lng) * Math.cos(lat * Math.PI / 180);
    const d = Math.sqrt(dlat * dlat + dlng * dlng);
    if (d < 0.08) return s.norm;
    const w = 1 / Math.pow(d, power);
    num += w * s.norm;
    den += w;
  }
  return den ? num / den : 0;
}

function renderIdwCanvas(sources, w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(w, h);
  const latStep = (BR_BOUNDS.north - BR_BOUNDS.south) / h;
  const lngStep = (BR_BOUNDS.east - BR_BOUNDS.west) / w;

  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const lat = BR_BOUNDS.north - py * latStep;
      const lng = BR_BOUNDS.west + px * lngStep;
      if (lat > 5.2 || lat < -33.5 || lng > -34.5 || lng < -74) {
        continue;
      }
      const v = idw(lat, lng, sources, 2.2);
      const rgb = valueToColor(v);
      const idx = (py * w + px) * 4;
      img.data[idx] = rgb[0];
      img.data[idx + 1] = rgb[1];
      img.data[idx + 2] = rgb[2];
      img.data[idx + 3] = v > 0.02 ? 200 : 0;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

export function renderHeatLegend(container, preset, min, max) {
  const stopsHtml = TEMP_STOPS.filter(function (_, i) {
    return i === 0 || i === TEMP_STOPS.length - 1 || i % 3 === 0;
  }).map(function (s) {
    const rgb = 'rgb(' + s.r + ',' + s.g + ',' + s.b + ')';
    const val = min + (max - min) * s.t;
    const label = preset.format ? preset.format(val) : String(Math.round(val));
    return '<span class="pm-heat-legend-tick" style="left:' + (s.t * 100) + '%"><i style="background:' + rgb + '"></i>' + label + '</span>';
  }).join('');

  container.innerHTML =
    '<div class="pm-heat-legend">' +
      '<div class="pm-heat-legend-title">' + preset.title + '</div>' +
      '<div class="pm-heat-legend-bar"></div>' +
      '<div class="pm-heat-legend-ticks">' + stopsHtml + '</div>' +
      '<p class="hint pm-heat-legend-sub">' + preset.subtitle + '</p>' +
    '</div>';
}

function tempGradientForHeat() {
  const g = {};
  TEMP_STOPS.forEach(function (s) {
    g[s.t.toFixed(2)] = 'rgb(' + s.r + ',' + s.g + ',' + s.b + ')';
  });
  return g;
}

function baseMap(L, container, zoom) {
  const map = L.map(container, {
    center: [-14.5, -52.0],
    zoom: zoom || 4,
    zoomControl: true,
    scrollWheelZoom: true,
  });
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap &copy; CARTO',
    maxZoom: 18,
  }).addTo(map);
  return map;
}

/**
 * Mapa de calor suave (IDW + canvas) — visual de mapa de temperatura.
 */
export async function mountBrazilHeatmap(container, opts) {
  opts = opts || {};
  const L = await loadLeaflet();
  container.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'pm-map-wrap';
  const mapEl = document.createElement('div');
  mapEl.className = 'pm-map-inner';
  const legendEl = document.createElement('div');
  legendEl.className = 'pm-heat-legend-wrap';
  wrap.appendChild(mapEl);
  wrap.appendChild(legendEl);
  container.appendChild(wrap);

  const preset = HEAT_PRESETS[opts.preset] || HEAT_PRESETS.volume_lr;
  const built = buildHeatSources(opts.aggregado || [], preset.valueKey);
  renderHeatLegend(legendEl, preset, built.min, built.max);

  const map = baseMap(L, mapEl, opts.zoom || 4);
  const bounds = L.latLngBounds(
    [BR_BOUNDS.south, BR_BOUNDS.west],
    [BR_BOUNDS.north, BR_BOUNDS.east],
  );

  const canvas = renderIdwCanvas(built.sources, 280, 320);
  const url = canvas.toDataURL('image/png');
  const overlay = L.imageOverlay(url, bounds, { opacity: 0.82, interactive: false }).addTo(map);

  const markers = L.layerGroup().addTo(map);
  (opts.aggregado || []).slice(0, 27).forEach(function (a) {
    const c = UF_COORDS[a.uf];
    if (!c) return;
    const val = Number(a[preset.valueKey]) || 0;
    L.circleMarker(c, {
      radius: 4,
      color: '#fff',
      weight: 1,
      fillColor: 'rgb(' + valueToColor(built.max > built.min ? (val - built.min) / (built.max - built.min) : 0.5).join(',') + ')',
      fillOpacity: 0.9,
    }).bindPopup('<strong>' + a.uf + '</strong><br>' + (preset.format ? preset.format(val) : val)).addTo(markers);
  });

  setTimeout(function () { map.invalidateSize(); }, 120);
  return {
    map: map,
    overlay: overlay,
    destroy: function () { map.remove(); },
  };
}

export async function mountBrazilMap(container, opts) {
  opts = opts || {};
  if (opts.mode === 'heatmap' && opts.aggregado) {
    return mountBrazilHeatmap(container, opts);
  }

  const L = await loadLeaflet();
  container.innerHTML = '';
  const map = baseMap(L, container, opts.zoom || 4);
  const layers = { points: L.layerGroup().addTo(map) };

  if (opts.points && opts.points.length && opts.mode !== 'heatmap') {
    if (opts.mode === 'heat') {
      await loadHeatPlugin(L);
      const max = Math.max.apply(null, opts.points.map(function (p) { return p.intensity || 0.5; }));
      const heatData = opts.points.slice(0, 12000).map(function (p) {
        return [p.lat, p.lng, (p.intensity || 0.5) / (max || 1)];
      });
      L.heatLayer(heatData, {
        radius: 18,
        blur: 22,
        maxZoom: 12,
        minOpacity: 0.35,
        gradient: tempGradientForHeat(),
      }).addTo(map);
    } else {
      addPointCloud(L, layers.points, opts.points, opts.pointStyle || 'empresa');
    }
  }

  if (opts.circles && opts.circles.length) {
    opts.circles.forEach(function (c) {
      L.circle([c.lat, c.lng], {
        radius: (c.raio_km || 100) * 1000,
        color: c.color || '#e8681a',
        fillColor: c.color || '#e8681a',
        fillOpacity: 0.06,
        weight: 1,
        opacity: 0.35,
      }).addTo(layers.points);
      if (c.label) {
        L.circleMarker([c.lat, c.lng], {
          radius: 6,
          color: c.color || '#e8681a',
          fillColor: c.color || '#e8681a',
          fillOpacity: 0.85,
        }).bindPopup(c.label).addTo(layers.points);
      }
    });
  }

  setTimeout(function () { map.invalidateSize(); }, 120);
  return {
    map: map,
    layers: layers,
    addPoints: function (pts, style) {
      addPointCloud(L, layers.points, pts, style || 'empresa');
      map.invalidateSize();
    },
    clear: function () { layers.points.clearLayers(); },
  };
}

function addPointCloud(L, layer, points, style) {
  const colors = {
    empresa: '#e8681a',
    auditoria: '#60a5fa',
    patrimonial: '#34d399',
    carencia: '#f472b6',
  };
  const color = colors[style] || colors.empresa;
  const batch = Math.min(points.length, 12000);
  for (let i = 0; i < batch; i++) {
    const p = points[i];
    if (!p.lat || !p.lng) continue;
    const m = L.circleMarker([p.lat, p.lng], {
      radius: style === 'empresa' ? 3 : 5,
      color: color,
      fillColor: color,
      fillOpacity: style === 'empresa' ? 0.55 : 0.75,
      weight: 0,
    });
    if (p.razao_social || p.municipio) {
      const cap = p.capital_social ? 'R$ ' + Number(p.capital_social).toLocaleString('pt-BR') : '';
      m.bindPopup(
        '<strong>' + (p.razao_social || p.municipio || '') + '</strong><br>' +
        (p.municipio ? p.municipio + ' · ' + (p.uf || '') + '<br>' : '') +
        cap,
      );
    }
    m.addTo(layer);
  }
}

export function destroyMap(instance) {
  if (!instance) return;
  if (instance.destroy) instance.destroy();
  else if (instance.map) instance.map.remove();
}
