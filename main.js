import '/style.css';
import { toStringHDMS } from 'ol/coordinate';
import { defaults as defaultControls, ScaleLine, ZoomSlider, Attribution } from 'ol/control';
import Control from 'ol/control/Control';
import { easeOut } from 'ol/easing';
import { fromLonLat, transform } from 'ol/proj';
import { getCenter } from 'ol/extent';
import { Circle, Fill, Icon, Stroke, Style, Text } from 'ol/style';
import { Point } from 'ol/geom';
import { Vector as VectorLayer } from 'ol/layer';
import Feature from 'ol/Feature';
import GeoJSON from 'ol/format/GeoJSON';
import Graticule from 'ol/layer/Graticule';
import Map from 'ol/Map';
import Select from 'ol/interaction/Select';
import TileLayer from 'ol/layer/Tile';
import { Vector as VectorSource } from 'ol/source';
import View from 'ol/View';
import XYZ from 'ol/source/XYZ';
import ClipboardJS from 'clipboard';

// === 1. ГЛОБАЛЬНЫЕ КОНФИГУРАЦИИ И СОСТОЯНИЕ ===
const CITY_FILES = [
  '/data/cities/1roma.geojson',
  '/data/cities/2corduba.geojson',
  '/data/cities/3byzantium.geojson',
  '/data/cities/4londinium.geojson',
  '/data/cities/5theodosia.geojson',
  '/data/cities/6antinoopolis.geojson',
  '/data/cities/7delos.geojson',
  '/data/cities/8pityous.geojson',
  '/data/cities/9shemakha.geojson'
];

let searchSource = new VectorSource({ features: [] });
let markersLayer = null;
let minimap = null;
let minimapSource = null;
let clipboard = null;
let cityLayers = [];
let lastSearchResults = [];

// === 2. БЕЗОПАСНЫЕ УТИЛИТЫ ===
function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}

function safeGet(feature, key, fallback = '') {
  const val = feature.get(key);
  return val !== undefined && val !== null ? String(val) : fallback;
}

function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '');
}

// Форматирование заголовков для отображения
function formatTitleForDisplay(title) {
  if (!title) return '';
  // Сохраняет оригинальный регистр, но гарантирует безопасную строку
  return String(title).trim();
}

// === 3. DOM-ЭЛЕМЕНТЫ (с проверкой на null) ===
function getEl(id) {
  const el = document.getElementById(id);
  if (!el) console.warn(`[DOM] Элемент #${id} не найден.`);
  return el;
}

const els = {
  title: getEl('title'), alt: getEl('alt'), province: getEl('province'),
  start: getEl('start'), modern: getEl('modern'), country: getEl('country'),
  batlas: getEl('batlas'), description: getEl('description'),
  awmc: getEl('awmc'), darmc: getEl('darmc'), hanson: getEl('hanson'),
  orbis: getEl('orbis'), trismegistos: getEl('trismegistos'),
  coords: getEl('coords'), coords2: getEl('coords2'),
  flag: getEl('flag'), googlelink: getEl('googlelink'),
  OSMlink: getEl('OSMlink'), wikimapialink: getEl('wikimapialink'),
  darelink: getEl('darelink'), pecslink: getEl('pecslink'),
  pleiadeslink: getEl('pleiadeslink'), tpplacelink: getEl('tpplacelink'),
  topostextlink: getEl('topostextlink'), vicilink: getEl('vicilink'),
  wikidatalink: getEl('wikidatalink'), wikipedialink: getEl('wikipedialink'),
  id130: getEl('id130-value'), permLink: getEl('perm-link-display'),
  hello: getEl('pusto'), node: getEl('hopa'), minimapDiv: getEl('minimap'),
  workOpen: getEl('workOpen')
};

// === 4. СТИЛИ ГОРОДОВ (Базовые стили теперь не мутируются) ===
function createCityStyle(config) {
  return new Style({
    image: new Circle({
      anchor: [0.5, 0.5], anchorXUnits: 'fraction', anchorYUnits: 'pixels',
      radius: config.radius,
      stroke: new Stroke({ color: config.stroke || '#000', width: config.strokeWidth || 1 }),
      fill: new Fill({ color: config.fill || 'white' }),
      ...(config.declutter ? { declutterMode: 'declutter' } : {})
    }),
    text: new Text({
      font: `${config.fontStyle || ''} ${config.fontWeight || ''} ${config.fontSize}px Roboto, "Noto Sans", "Segoe UI", "Helvetica Neue", Arial, sans-serif`.trim(),
      textAlign: 'center', offsetX: 0, offsetY: config.offsetY || 3,
      fill: new Fill({ color: '#000' }),
      stroke: new Stroke({ color: '#fff', width: 0.1 }),
      textBaseline: 'top',
      ...(config.declutter ? { declutter: true } : {})
    }),
    zIndex: config.zIndex || 50
  });
}

const baseStyles = {
  Roma: createCityStyle({ radius: 4, fill: 'red', fontSize: 13, offsetY: 6, fontWeight: 'bold', zIndex: 100 }),
  Corduba: createCityStyle({ radius: 3.5, fill: 'red', fontSize: 12, offsetY: 4, fontWeight: 'bold', zIndex: 90 }),
  Byzantium: createCityStyle({ radius: 3.5, fill: 'white', fontSize: 12, offsetY: 4, fontWeight: 'bold', zIndex: 90 }),
  Londinium: createCityStyle({ radius: 3, fill: 'red', fontSize: 11, offsetY: 4, fontWeight: 'bold', zIndex: 80 }),
  Theodosia: createCityStyle({ radius: 3, fill: 'white', fontSize: 11, offsetY: 4, fontWeight: 'bold', zIndex: 70 }),
  Antinoopolis: createCityStyle({ radius: 2.5, fill: 'white', fontSize: 10, offsetY: 3, fontWeight: 'bold', zIndex: 60 }),
  Delos: createCityStyle({ radius: 2, fill: 'white', fontSize: 9, offsetY: 3, fontWeight: 'bold', declutter: true, zIndex: 50 }),
  Pityous: createCityStyle({ radius: 1.5, fill: 'white', fontSize: 9, offsetY: 3, declutter: true, zIndex: 40 }),
  Shemakha: createCityStyle({ radius: 1, fill: 'black', fontSize: 9, offsetY: 3, strokeWidth: 0.5, fontStyle: 'italic', declutter: true, zIndex: 30 })
};

// Фабрика стилей с клонированием (исключает мутацию)
const createCityStyleFn = (baseStyle, transformFn) => (feature) => {
  const style = baseStyle.clone();
  style.getText().setText(transformFn(safeGet(feature, 'title')));
  return style;
};

// === 5. СЛОИ ===
const base = new TileLayer({ preload: 1, source: new XYZ({ urls: ["/data/base7/{z}/{x}/{y}.png"], tilePixelRatio: 1 }), minZoom: 3, maxZoom: 10, opacity: 1 });

// === СЛОЙ ДОРОГ ===
const styleRoadsBase = new Style({
  stroke: new Stroke({ color: 'red' }),
  text: new Text({
    font: '10px "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif',
    fill: new Fill({ color: 'red' }),
    stroke: new Stroke({ color: '#fff', width: 0.1 }),
    placement: 'line',
    repeat: 1000,
    textBaseline: 'bottom',
    maxAngle: Math.PI / 10,
    overflow: true
  })
});

const roads = new VectorLayer({
  source: new VectorSource({ format: new GeoJSON(), url: "/data/cultural/roads10.geojson" }),
  style: (feature, resolution) => {
    const zoom = map.getView().getZoom();
    const val = Number(feature.get('value')) || 1;

    if (val === 1 && zoom < 5.5) return null; // Скрываем второстепенные при зуме < 5.5

    const clone = styleRoadsBase.clone();
    const acc = Number(feature.get('acc')) || 1;
    const name = safeGet(feature, 'name');

    clone.getStroke().setWidth(val === 2 ? 1 : 0.5); // Уменьшаем толщину для всех дорог
    let dash = null;
    if (acc === 2) dash = [6, 4];
    else if (acc === 3) dash = [1, 3];
    clone.getStroke().setLineDash(dash);
    clone.getText().setText(zoom >= 8 ? name : undefined);
    return clone;
  },
  minZoom: 3.9999,
  maxZoom: 10,
  opacity: 0.6,
  declutter: true
});

const pomerium = new VectorLayer({ source: new VectorSource({ format: new GeoJSON(), url: "/data/cultural/pomerium1.geojson" }), style: new Style({ fill: new Fill({ color: 'rgba(255,0,0,0.3)' }) }), minZoom: 6.9999, maxZoom: 10, opacity: 0.8 });

const graticule = new Graticule({ strokeStyle: new Stroke({ color: 'rgba(0,0,0,0.9)', width: 0.1 }), showLabels: true, wrapX: false });

const makeDynamicLabel = (prop, fontBase, color, strokeColor) => (feature) => {
  const zoom = map.getView().getZoom();
  const mnozhitel = feature.get('mnozhitel') || 1;
  const fontSize = Math.max(8, (zoom ** 1.65) * mnozhitel);
  return new Style({ 
    text: new Text({ 
      font: `${fontBase} ${fontSize}px serif`, 
      textAlign: 'center',
      placement: 'line',
      fill: new Fill({ color }), 
      stroke: new Stroke({ color: strokeColor, width: 1 }), 
      padding: [1, 1, 1, 1], 
      text: String(feature.get(prop) || '').toUpperCase() 
    }) 
  });
};

const provimena = new VectorLayer({ source: new VectorSource({ format: new GeoJSON(), url: "/data/cultural/prov_names1.geojson" }), minZoom: 3.9999, maxZoom: 8, opacity: 1, style: makeDynamicLabel('title', '', [87, 0, 127, 0.6], [255, 255, 255, 0.3]) });

const mareimena = new VectorLayer({ source: new VectorSource({ format: new GeoJSON(), url: "/data/cultural/mare_names1.geojson" }), minZoom: 3.9999, maxZoom: 8, opacity: 1, style: makeDynamicLabel('title', 'italic ', [50, 101, 211, 0.6], [0, 0, 0, 0.1]) });

// Все слои городов используют клонирование стилей
const createCityLayer = (sourceUrl, styleFn, minZ, maxZ) => new VectorLayer({ source: new VectorSource({ format: new GeoJSON(), url: sourceUrl }), style: styleFn, declutter: true, minZoom: minZ, maxZoom: maxZ });

const RomaL = createCityLayer('/data/cities/1roma.geojson', createCityStyleFn(baseStyles.Roma, t => t.toUpperCase()), 3.9999, 10);
const CordubaL = createCityLayer('/data/cities/2corduba.geojson', createCityStyleFn(baseStyles.Corduba, t => t), 3.9999, 10);
const ByzantiumL = createCityLayer('/data/cities/3byzantium.geojson', createCityStyleFn(baseStyles.Byzantium, t => t), 3.9999, 10);
const LondiniumL = createCityLayer('/data/cities/4londinium.geojson', createCityStyleFn(baseStyles.Londinium, t => t.replace(/ /g, '\n')), 3.9999, 10);
const TheodosiaL = createCityLayer('/data/cities/5theodosia.geojson', createCityStyleFn(baseStyles.Theodosia, t => t.replace(/ /g, '\n')), 3.9999, 10);
const AntinoopolisL = createCityLayer('/data/cities/6antinoopolis.geojson', createCityStyleFn(baseStyles.Antinoopolis, t => t.replace(/ /g, '\n')), 4.9999, 10);
const DelosL = createCityLayer('/data/cities/7delos.geojson', createCityStyleFn(baseStyles.Delos, t => t.replace(/ /g, '\n')), 5.9999, 10);
const PityousL = createCityLayer('/data/cities/8pityous.geojson', createCityStyleFn(baseStyles.Pityous, t => t.replace(/ /g, '\n')), 6.9999, 10);
const ShemakhaL = createCityLayer('/data/cities/9shemakha.geojson', createCityStyleFn(baseStyles.Shemakha, t => t.replace(/ /g, '\n')), 7.9999, 10);

cityLayers = [RomaL, CordubaL, ByzantiumL, LondiniumL, TheodosiaL, AntinoopolisL, DelosL, PityousL, ShemakhaL];

// === 6. ИНИЦИАЛИЗАЦИЯ КАРТЫ ===
const sreda = fromLonLat([23, 38.5]);
const view = new View({ projection: 'EPSG:3857', center: sreda, zoom: 6, minZoom: 3.9999, maxZoom: 10, extent: [-1400000, 2600000, 6100000, 7600000] });

const map = new Map({
  controls: defaultControls().extend([new ScaleLine({ units: 'metric', bar: true, steps: 4, text: true, minWidth: 140 })]),
  layers: [base, roads, graticule, mareimena, provimena, ShemakhaL, PityousL, DelosL, AntinoopolisL, TheodosiaL, LondiniumL, ByzantiumL, CordubaL, RomaL, pomerium],
  target: document.getElementById('map'),
  view
});
window.map = map;
window.homeCenter = sreda;
map.addControl(new ZoomSlider());

// === КОНТРОЛ АТРИБУЦИЙ (кнопка ⓘ в правом нижнем углу) ===
const attributionControl = new Attribution({
  collapsible: true,        // Скрывается в кнопку "i" по умолчанию
  collapsed: true,          // Начальное состояние — свёрнуто
  tipLabel: 'Sources & Licenses', // Подсказка при наведении
  attributions: [
  '<a href="https://www.maptiler.com/copyright/" target="_blank" rel="noopener">MapTiler</a>: Land and Ocean Bases,',
  '<a href="https://developers.arcgis.com/documentation/esri-and-data-attribution/" target="_blank" rel="noopener">Powered by Esri</a>: Hillshade,',
  '<a href="https://github.com/AWMC/geodata/blob/master/LICENSE.txt" target="_blank" rel="noopener">Ancient World Mapping Center</a>: Basemap Polygons, Borders, Inland Water (BSD-2),',
  '<a href="https://pleiades.stoa.org/credits" target="_blank" rel="noopener">Pleiades</a>: Settlement Data (CC BY 3.0),',
  '<a href="https://github.com/johaahlf/dare/blob/master/LICENSE" target="_blank" rel="noopener">Digital Atlas of the Roman Empire by Johan Åhlfeldt</a>: Cities,',
  '<a href="https://oxrep.classics.ox.ac.uk/databases/cities/" target="_blank" rel="noopener">Hanson, J. W. (2016). Cities Database (OXREP databases). Version 1.0</a>: Urban Ranks,',
  '<a href="https://itiner-e.org/about" target="_blank" rel="noopener">Itiner-e: the digital atlas of ancient roads</a>: Roads (CC BY 4.0).'
]
});
map.addControl(attributionControl);

// === 7. СИСТЕМА ПОИСКА ===
const searchContainer = document.createElement('div');
searchContainer.className = 'ol-search ol-control';
searchContainer.setAttribute('role', 'search');
const searchInput = document.createElement('input');
searchInput.type = 'text';
searchInput.placeholder = 'Search cities...';
searchInput.setAttribute('aria-label', 'Поиск городов');
searchInput.setAttribute('autocomplete', 'off');
const resultsContainer = document.createElement('ul');
resultsContainer.setAttribute('role', 'listbox');
resultsContainer.style.cssText = 'position:absolute;top:100%;left:0;width:100%;max-height:300px;overflow-y:auto;background:white;border:1px solid #895E8A;border-top:none;list-style:none;padding:0;margin:0;z-index:1000;display:none;';

searchContainer.appendChild(searchInput);
searchContainer.appendChild(resultsContainer);
map.addControl(new Control({ element: searchContainer }));

// Слушатель клика вынесен наружу (добавляется один раз)
resultsContainer.addEventListener('click', (e) => {
  if (e.target.tagName === 'LI') {
    const idx = Array.from(resultsContainer.children).indexOf(e.target);
    if (lastSearchResults[idx]) handleSearchSelect(lastSearchResults[idx]);
  }
});

// Загрузка данных в поиск
async function loadCityData() {
  const promises = CITY_FILES.map(async url => {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const features = new GeoJSON().readFeatures(data, { dataProjection: 'EPSG:4326', featureProjection: map.getView().getProjection() });
      features.forEach(f => { f.set("featureType", "title"); searchSource.addFeature(f); });
    } catch (err) { console.error(`[Search] Ошибка загрузки ${url}:`, err); }
  });

  await Promise.all(promises);
  handleInitialHash();
}

searchInput.addEventListener('input', () => {
  const term = searchInput.value.trim().toLowerCase();
  resultsContainer.innerHTML = '';
  if (term.length < 1) { resultsContainer.style.display = 'none'; lastSearchResults = []; return; }

  const matches = searchSource.getFeatures().filter(f => safeGet(f, 'title').toLowerCase().includes(term));
  matches.sort((a, b) => {
    const ta = safeGet(a, 'title').toLowerCase(), tb = safeGet(b, 'title').toLowerCase();
    if (ta === term) return -1; if (tb === term) return 1;
    if (ta.startsWith(term) && !tb.startsWith(term)) return -1;
    if (!ta.startsWith(term) && tb.startsWith(term)) return 1;
    return ta.localeCompare(tb);
  });

  lastSearchResults = matches.slice(0, 15);
  if (lastSearchResults.length === 0) {
    const li = document.createElement('li'); li.textContent = 'No cities found'; li.style.padding = '8px 10px'; li.style.color = '#666';
    resultsContainer.appendChild(li);
  } else {
    lastSearchResults.forEach(f => {
      const li = document.createElement('li');
      li.setAttribute('role', 'option');
      li.setAttribute('tabindex', '0');
      li.textContent = safeGet(f, 'title');
      li.style.cssText = 'padding:8px 10px;cursor:pointer;border-bottom:1px solid #eee;';
      resultsContainer.appendChild(li);
    });
  }
  resultsContainer.style.display = 'block';
});

document.addEventListener('click', e => { if (!searchContainer.contains(e.target)) resultsContainer.style.display = 'none'; });

searchInput.addEventListener('keydown', e => {
  const items = resultsContainer.querySelectorAll('li[role="option"]');
  if (!items.length) return;
  const active = document.activeElement;
  if (e.key === 'ArrowDown') { e.preventDefault(); (active === searchInput ? items[0] : active.nextElementSibling || items[0]).focus(); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); (active === searchInput ? items[items.length-1] : active.previousElementSibling || searchInput).focus(); }
  else if (e.key === 'Enter') { e.preventDefault(); (active.tagName === 'LI' ? active : items[0]).click(); }
});

// === 8. URL / PERMALINK / ROUTING ===
function parseCityIdFromHash() {
  const match = window.location.hash.match(/#id(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

function findFeatureById130(id) {
  if (!id) return null;
  return searchSource.getFeatures().find(f => f.get('id130') === id) || null;
}

function updateHashForCity(feature) {
  const id = feature.get('id130');
  const slug = slugify(safeGet(feature, 'title'));
  const newHash = `#id${id}${slug ? '-' + slug : ''}`;
  if (window.location.hash !== newHash) {
    window.history.replaceState(null, '', newHash);
  }
  document.title = `Urbes et Orbis — ${formatTitleForDisplay(safeGet(feature, 'title'))}`;
}

function getPermanentLink(feature) {
  const id = feature.get('id130');
  const slug = slugify(safeGet(feature, 'title'));
  return `${window.location.origin}${window.location.pathname}#id${id}${slug ? '-' + slug : ''}`;
}

function handleInitialHash() {
  const id = parseCityIdFromHash();
  if (id) { const f = findFeatureById130(id); if (f) handleSearchSelect(f); }
}

window.addEventListener('hashchange', () => {
  const id = parseCityIdFromHash();
  if (id) { const f = findFeatureById130(id); if (f) handleSearchSelect(f); }
});

// === 9. ОТОБРАЖЕНИЕ ИНФОРМАЦИИ О ГОРОДЕ ===
function showCityDetails(feature) {
  if (!feature) return;
  const setTitle = (el, val) => { if (el) el.textContent = formatTitleForDisplay(val); };
  const setHTML = (el, val) => { if (el) el.innerHTML = val ? escapeHtml(String(val)) : ''; };

  setTitle(els.title, safeGet(feature, 'title'));
  setTitle(els.alt, safeGet(feature, 'alt'));
  setTitle(els.province, safeGet(feature, 'province'));
  setTitle(els.start, safeGet(feature, 'start'));
  setTitle(els.modern, safeGet(feature, 'modern'));
  setHTML(els.country, safeGet(feature, 'country'));
  setTitle(els.batlas, safeGet(feature, 'batlas'));
  setHTML(els.description, safeGet(feature, 'description'));
  setTitle(els.awmc, safeGet(feature, 'awmc'));
  setTitle(els.darmc, safeGet(feature, 'darmc'));
  setTitle(els.hanson, safeGet(feature, 'hanson'));
  setTitle(els.orbis, safeGet(feature, 'orbis'));
  setTitle(els.trismegistos, safeGet(feature, 'trismegistos'));

  const lonlat = transform(feature.getGeometry().getFirstCoordinate(), 'EPSG:3857', 'EPSG:4326');
  const decLon = lonlat[0].toFixed(6), decLat = lonlat[1].toFixed(6);
  const dms = toStringHDMS(lonlat).replace(/° /g, '°');
  if (els.coords) els.coords.textContent = `${decLat}, ${decLon}`;
  if (els.coords2) els.coords2.textContent = dms;

  const country = safeGet(feature, 'country');
  if (els.flag) els.flag.innerHTML = country ? `<img src="/icons/flags/${escapeHtml(country)}.png" title="${escapeHtml(country)}" width="17" height="17" style="display:inline-block;margin:0 5px;">` : '';

  if (els.googlelink) els.googlelink.innerHTML = `<a href="https://www.google.com/maps/place/${decLat},${decLon}" target="_blank" rel="noopener">Google Maps</a>`;
  if (els.OSMlink) els.OSMlink.innerHTML = `<a href="https://www.openstreetmap.org/index.html?mlat=${decLat}&mlon=${decLon}&zoom=16" target="_blank" rel="noopener">OpenStreetMap</a>`;
  if (els.wikimapialink) els.wikimapialink.innerHTML = `<a href="https://wikimapia.org/#lat=${decLat}&lon=${decLon}&z=16&l=0&m=w&v=0" target="_blank" rel="noopener">Wikimapia</a>`;

  const linkIf = (el, url, prefix) => { if (el) el.innerHTML = url ? `<a href="${escapeHtml(prefix)}${escapeHtml(url)}" target="_blank" rel="noopener">${escapeHtml(url)}</a>` : ''; };
  linkIf(els.darelink, safeGet(feature, 'dare'), 'http://imperium.ahlfeldt.se/places/');
  linkIf(els.pecslink, safeGet(feature, 'PECS'), 'http://www.perseus.tufts.edu/hopper/text?doc=Perseus:text:1999.04.0006:entry=');
  linkIf(els.pleiadeslink, safeGet(feature, 'pleiades'), 'https://pleiades.stoa.org/places/');
  linkIf(els.tpplacelink, safeGet(feature, 'TTPlace'), 'https://www.cambridge.org/us/talbert/talbertdatabase/TPPlace');
  linkIf(els.topostextlink, safeGet(feature, 'topostext'), 'https://topostext.org/place/');
  linkIf(els.vicilink, safeGet(feature, 'vici'), 'https://vici.org/vici/');
  linkIf(els.wikidatalink, safeGet(feature, 'wikidata'), 'https://www.wikidata.org/wiki/Q');
  linkIf(els.wikipedialink, safeGet(feature, 'wikipedia:en'), 'https://en.wikipedia.org/wiki/');

  if (els.id130) els.id130.textContent = feature.get('id130') || '';
  const permUrl = getPermanentLink(feature);
  if (els.permLink) { els.permLink.href = permUrl; els.permLink.textContent = permUrl; }

  updateHashForCity(feature);

  if (markersLayer) map.removeLayer(markersLayer);
  markersLayer = new VectorLayer({
    source: new VectorSource(),
    style: new Style({ image: new Icon({ anchor: [0.5, 0.5], src: '/icons/target.png' }) })
  });
  map.addLayer(markersLayer);
  markersLayer.getSource().addFeature(new Feature(new Point(feature.getGeometry().getFirstCoordinate())));

if (!els.minimapDiv) return;
const center = feature.getGeometry().getFirstCoordinate();
if (!minimap) {
  minimapSource = new VectorSource();
  const targetFeature = new Feature(new Point(center));
  minimapSource.addFeature(targetFeature);

  minimap = new Map({
    target: 'minimap',
    layers: [
      new TileLayer({ source: new XYZ({ attributions: 'Tiles © Google', url: 'https://mt0.google.com/vt/lyrs=s&hl=en&x={x}&y={y}&z={z}' }) }),
      new VectorLayer({ source: minimapSource, style: new Style({ image: new Icon({ anchor: [0.5, 0.5], src: '/icons/target.png' }) }) })
    ],
    view: new View({ projection: 'EPSG:3857', center, zoom: 15, minZoom: 13.9999, maxZoom: 18 })
  });

  // Ждём 1 кадр браузера, чтобы панель получила реальные размеры,
  // затем принудительно пересчитываем карту и рендерим все слои
  requestAnimationFrame(() => {
    minimap.updateSize();
    minimap.render();
  });
} else {
  minimapSource.clear();
  minimapSource.addFeature(new Feature(new Point(center)));
  minimap.getView().setCenter(center);
  minimap.getView().setZoom(15);
}

  els.hello.style.visibility = 'hidden';
  els.node.style.visibility = 'visible';
  if (els.workOpen) els.workOpen.click();
  if (!clipboard) clipboard = new ClipboardJS('.btn');
}

// === 10. ОБРАБОТЧИКИ СОБЫТИЙ ===
const select = new Select();
map.addInteraction(select);

function handleSearchSelect(feature) {
  select.getFeatures().clear();
  select.getFeatures().push(feature);
  map.getView().animate({ center: feature.getGeometry().getFirstCoordinate(), zoom: 10, duration: 2000, easing: easeOut });
  showCityDetails(feature);
  searchInput.value = formatTitleForDisplay(safeGet(feature, 'title'));
  resultsContainer.style.display = 'none';
}

map.on('click', evt => {
  const hitFeature = map.forEachFeatureAtPixel(evt.pixel, (f, l) => cityLayers.includes(l) ? f : null, { hitTolerance: 3 });
  if (hitFeature) { showCityDetails(hitFeature); if (els.workOpen) els.workOpen.click(); }
  else {
    els.hello.style.visibility = 'visible';
    els.node.style.visibility = 'hidden';
    if (markersLayer) { map.removeLayer(markersLayer); markersLayer = null; }
    if (minimapSource) minimapSource.clear();
    select.getFeatures().clear();
  }
});

map.on('pointermove', e => {
  if (e.dragging) return;
  const hit = map.forEachFeatureAtPixel(e.pixel, (f, l) => cityLayers.includes(l), { hitTolerance: 3 });
  map.getTargetElement().style.cursor = hit ? 'pointer' : '';
});

// === 11. ЭКРАН ЗАГРУЗКИ ===
window.addEventListener('load', () => {
  const screen = document.getElementById('loading-screen');
  if (!screen) return;
  const bar = document.getElementById('loading-progress-bar');
  const text = document.getElementById('loading-progress-text');
  let loaded = 0, total = 0, done = false;

  const update = () => {
    const pct = Math.min(100, Math.round((Math.min(loaded, Math.max(total, 10)) / Math.max(total, 10)) * 100));
    if (bar) bar.style.width = `${pct}%`;
    if (text) text.textContent = `Loading map tiles... ${pct}%`;
    if ((loaded >= total && total >= 5) || pct >= 90) finish();
  };

  const finish = () => {
    if (done) return; done = true;
    if (bar) bar.style.width = '100%';
    if (text) text.textContent = 'Ready!';
    setTimeout(() => { screen.style.opacity = '0'; setTimeout(() => screen.style.display = 'none', 500); }, 800);
  };

  const src = base.getSource();
  const onTile = () => { loaded++; update(); };
  src.on('tileloadstart', () => { total++; update(); });
  src.on('tileloadend', onTile);
  src.on('tileloaderror', onTile);

  map.once('rendercomplete', finish);
  setTimeout(() => { if (!done) { done = true; finish(); } }, 8000);
  setTimeout(() => { if (bar) bar.style.width = '10%'; if (text) text.textContent = 'Starting map load...'; }, 300);
});

// Запуск загрузки данных
loadCityData();