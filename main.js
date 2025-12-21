import '/style.css';
import {toStringHDMS} from 'ol/coordinate';
import {Attribution, defaults as defaultControls, ScaleLine, ZoomSlider} from 'ol/control';
import Control from 'ol/control/Control';
import {easeIn, easeOut} from 'ol/easing.js';
import {fromLonLat, get as getProjection, transform} from 'ol/proj';
import {getCenter} from 'ol/extent';
import {Circle, Fill, Icon, Stroke, Style, Text} from 'ol/style';
import {LineString, Point, Polygon} from 'ol/geom';
import {Vector as VectorLayer} from 'ol/layer';
import Feature from 'ol/Feature';
import GeoJSON from 'ol/format/GeoJSON';
import Graticule from 'ol/layer/Graticule';
import Map from 'ol/Map';
import Select from 'ol/interaction/Select';
import TileLayer from 'ol/layer/Tile';
import {Vector} from 'ol/source';
import VectorSource from 'ol/source/Vector';
import View from 'ol/View';
import XYZ from 'ol/source/XYZ';
import ClipboardJS from 'clipboard';

let clipboard = null;

// ==================== ЗАГРУЗКА ЭКРАНА ====================
window.addEventListener('load', function() {
  const loadingScreen = document.getElementById('loading-screen');
  const progressBar = document.getElementById('loading-progress-bar');
  const progressText = document.getElementById('loading-progress-text');
  
  if (!loadingScreen) return;
  
  // Счётчики
  let loadedTiles = 0;
  let totalTiles = 0;
  let isComplete = false;
  
  // Отслеживаем загрузку тайлов базовой карты
  const baseSource = base.getSource();
  
  // ВАЖНО: используем tileloadend как основной маркер
  const tileLoadHandler = function() {
    loadedTiles++;
    updateProgress();
  };
  
  // Подписываемся на события
  baseSource.on('tileloadstart', function() {
    totalTiles++;
    updateProgress();
  });
  
  baseSource.on('tileloadend', tileLoadHandler);
  baseSource.on('tileloaderror', tileLoadHandler); // Ошибки тоже считаем
  
  function updateProgress() {
    if (totalTiles === 0) return;
    
    // Минимум 10 тайлов для расчёта процентов
    const minTiles = 10;
    const effectiveTotal = Math.max(totalTiles, minTiles);
    const effectiveLoaded = Math.min(loadedTiles, effectiveTotal);
    
    const percent = Math.min(100, Math.round((effectiveLoaded / effectiveTotal) * 100));
    
    if (progressBar) progressBar.style.width = percent + '%';
    if (progressText) progressText.textContent = `Loading map tiles... ${percent}%`;
    
    // Условие завершения: загружено достаточно тайлов ИЛИ прошло время
    const shouldComplete = (loadedTiles >= totalTiles && totalTiles >= 5) || percent >= 90;
    
    if (shouldComplete && !isComplete) {
      isComplete = true;
      completeLoading();
    }
  }
  
  function completeLoading() {
    // Финальное состояние
    if (progressBar) progressBar.style.width = '100%';
    if (progressText) progressText.textContent = 'Ready!';
    
    // Задержка перед скрытием
    setTimeout(() => {
      if (loadingScreen) {
        loadingScreen.style.opacity = '0';
        setTimeout(() => {
          loadingScreen.style.display = 'none';
          // Отписываемся от событий
          baseSource.un('tileloadend', tileLoadHandler);
          baseSource.un('tileloaderror', tileLoadHandler);
        }, 500);
      }
    }, 800);
  }
  
  // Фоллбэк на случай, если загрузка не отслеживается
  const fallbackTimeout = setTimeout(() => {
    if (loadingScreen && loadingScreen.style.display !== 'none' && !isComplete) {
      console.log('Fallback: forcing completion after timeout');
      isComplete = true;
      completeLoading();
    }
  }, 7000); // 7 секунд максимум
  
  // Также слушаем общее событие готовности карты
  map.once('rendercomplete', function() {
    if (!isComplete) {
      isComplete = true;
      clearTimeout(fallbackTimeout);
      completeLoading();
    }
  });
  
  // Начальный прогресс
  setTimeout(() => {
    if (progressBar) progressBar.style.width = '10%';
    if (progressText) progressText.textContent = 'Starting map load...';
  }, 300);
});

// ==================== БАЗОВЫЕ ЭЛЕМЕНТЫ КАРТЫ ====================
const scaleControl = new ScaleLine({
  units: 'metric',
  bar: true,
  steps: 4,
  text: true,
  minWidth: 140,
});

const sreda = fromLonLat([23, 38.5]);

const view = new View({
  projection: 'EPSG:3857',
  center: sreda,
  zoom: 6,
  minZoom: 3.9999,
  maxZoom: 10,
  extent: [-1400000, 2600000, 6100000, 7600000],
});

// ==================== БАЗОВЫЙ СЛОЙ КАРТЫ ====================
const base = new TileLayer({
  preload: 1,
  source: new XYZ({
    urls:["/data/base2/{z}/{x}/{y}.png"],
    tilePixelRatio: 1.000000
  }),
  minZoom: 3,
  maxZoom: 10,
  opacity: 1,
});

// ==================== СЛОЙ ПОМЕРИЯ ====================
const stylePomerium = new Style({
  fill: new Fill({ color: 'red' }),
});
const pomerium = new VectorLayer({
  source: new VectorSource({
    format: new GeoJSON(),
    url: "/data/cultural/pomerium1.geojson",
  }),
  style: stylePomerium,
  minZoom: 6.9999,
  maxZoom: 10,
  opacity: 0.8,
});

// ==================== СЛОЙ ДОРОГ ====================
const styleRoads = new Style({
  fill: new Fill(),
  stroke: new Stroke({ color: 'red' }),
  text: new Text({
    font: '10px sans-serif',
    fill: new Fill({ color: 'red' }),
    stroke: new Stroke({ color: '#fff', width: 0.1 }),
    placement: 'line',
    repeat: 1000,
    textBaseline: 'bottom',
    maxAngle: Math.PI/10,
    overflow: 'true',
  }),
});
const roads = new VectorLayer({
  source: new VectorSource({
    format: new GeoJSON(),
    url: "/data/cultural/roads5.geojson",
  }),
  style: function (feature) {
    const width = feature.get('rank');
    styleRoads.getStroke().setWidth(width / 3);
    styleRoads.getText().setText(feature.get('name'));
    return styleRoads;
  },
  minZoom: 3.9999,
  maxZoom: 10,
  opacity: 0.6,
  declutter: true,
});

// ==================== СЕТКА КООРДИНАТ ====================
const graticule = new Graticule({
  strokeStyle: new Stroke({ color: 'rgba(0,0,0,0.9)', width: 0.1 }),
  showLabels: true,
  wrapX: false,
});

// ==================== НАЗВАНИЯ ПРОВИНЦИЙ ====================
function provincenames (feature) {
  const zoom = map.getView().getZoom();
  const degree = feature.get('mnozhitel');
  const font_size = (zoom**1.65)*degree;
  const provi = feature.get('title').toUpperCase();
  return [
    new Style({
      text: new Text({
        font: font_size + 'px serif',
        textAlign: 'center',
        justify: 'center',
        placement: 'line',
        weight: 'bold',
        fill: new Fill({ color: [87, 0, 127, 0.6] }),
        stroke: new Stroke({ color: [255, 255, 255, 0.3], width: 1 }),
        padding: [1, 1, 1, 1],
        text: provi,
      }),
    }),
  ];
};
const provimena = new VectorLayer({
  source: new VectorSource({
    format: new GeoJSON(),
    url: "/data/cultural/prov_names1.geojson",
  }),
  minZoom: 3.9999,
  maxZoom: 8,
  opacity: 1,
  style: provincenames,
});

// ==================== НАЗВАНИЯ МОРЕЙ ====================
function names (feature) {
  const zoom = map.getView().getZoom();
  const degree = feature.get('mnozhitel');
  const font_size = (zoom**1.65)*degree;
  const provi = feature.get('title').toUpperCase();
  return [
    new Style({
      text: new Text({
        font: 'italic ' + font_size + 'px serif',
        textAlign: 'center',
        justify: 'center',
        placement: 'line',
        fill: new Fill({ color: [50, 101, 211, 0.6] }),
        stroke: new Stroke({ color: [0, 0, 0, 0.1], width: 1 }),
        padding: [1, 1, 1, 1],
        text: provi,
      }),
    }),
  ];
};
const mareimena = new VectorLayer({
  source: new VectorSource({
    format: new GeoJSON(),
    url: "/data/cultural/mare_names1.geojson",
  }),
  minZoom: 3.9999,
  maxZoom: 8,
  opacity: 1,
  style: names,
});

// ==================== СТИЛИ ГОРОДОВ ====================
const RomaStyle = new Style({
  image:  new Circle({
    anchor: [0.5, 0.5],
    anchorXUnits: 'fraction',
    anchorYUnits: 'pixels',
    radius: 4,
    stroke: new Stroke({ color: '#000', width: 1 }),
    fill: new Fill({ color: 'red' })
  }),
  text: new Text({
    font: 'bold 13px sans-serif',
    textAlign: 'center',
    offsetX: 0,
    offsetY: 6,
    fill: new Fill({ color: '#000' }),
    stroke: new Stroke({ color: '#fff', width: 0.1 }),
    textBaseline: 'top',
  }),
  zIndex: 100,
});

const CordubaStyle = new Style({
  image:  new Circle({
    anchor: [0.5, 0.5],
    anchorXUnits: 'fraction',
    anchorYUnits: 'pixels',
    radius: 3.5,
    fill: new Fill({ color: 'red' }),
    stroke: new Stroke({ color: '#000', width: 1 }),
  }),
  text: new Text({
    font: 'bold 12px sans-serif',
    textAlign: 'center',
    offsetX: 0,
    offsetY: 4,
    fill: new Fill({ color: '#000' }),
    stroke: new Stroke({ color: '#fff', width: 0.1 }),
    textBaseline: 'top',
  }),
  zIndex: 90,
});

const ByzantiumStyle = new Style({
  image:  new Circle({
    anchor: [0.5, 0.5],
    anchorXUnits: 'fraction',
    anchorYUnits: 'pixels',
    radius: 3.5,
    stroke: new Stroke({ color: '#000', width: 1 }),
    fill: new Fill({ color: 'white' })
  }),
  text: new Text({
    font: 'bold 12px sans-serif',
    textAlign: 'center',
    offsetX: 0,
    offsetY: 4,
    fill: new Fill({ color: '#000' }),
    stroke: new Stroke({ color: '#fff', width: 0.1 }),
    textBaseline: 'top',
  }),
  zIndex: 90,
});

const LondiniumStyle = new Style({
  image:  new Circle({
    anchorXUnits: 'fraction',
    anchorYUnits: 'pixels',
    radius: 3,
    stroke: new Stroke({ color: '#000', width: 1 }),
    fill: new Fill({ color: 'red' })
  }),
  text: new Text({
    font: 'bold 11px sans-serif',
    textAlign: 'center',
    offsetX: 0,
    offsetY: 4,
    fill: new Fill({ color: '#000' }),
    stroke: new Stroke({ color: '#fff', width: 0.1 }),
    textBaseline: 'top',
  }),
  zIndex: 80,
});

const TheodosiaStyle = new Style({
  image:  new Circle({
    anchorXUnits: 'fraction',
    anchorYUnits: 'pixels',
    radius: 3,
    stroke: new Stroke({ color: '#000', width: 1 }),
    fill: new Fill({ color: 'white' })
  }),
  text: new Text({
    font: 'bold 11px sans-serif',
    textAlign: 'center',
    offsetX: 0,
    offsetY: 4,
    fill: new Fill({ color: '#000' }),
    stroke: new Stroke({ color: '#fff', width: 0.1 }),
    textBaseline: 'top',
  }),
  zIndex: 70,
});

const AntinoopolisStyle = new Style({
  image:  new Circle({
    anchorXUnits: 'fraction',
    anchorYUnits: 'pixels',
    radius: 2.5,
    stroke: new Stroke({ color: '#000', width: 1 }),
    fill: new Fill({ color: 'white' })
  }),
  text: new Text({
    font: 'bold 10px sans-serif',
    textAlign: 'center',
    offsetX: 0,
    offsetY: 3,
    fill: new Fill({ color: '#000' }),
    stroke: new Stroke({ color: '#fff', width: 0.1 }),
    textBaseline: 'top',
  }),
  zIndex: 60,
});

const DelosStyle = new Style({
  image:  new Circle({
    anchorXUnits: 'fraction',
    anchorYUnits: 'pixels',
    radius: 2,
    stroke: new Stroke({ color: '#000', width: 1 }),
    fill: new Fill({ color: 'white' }),
    declutterMode: 'declutter',
    declutter: true,
  }),
  text: new Text({
    font: 'bold 9px sans-serif',
    textAlign: 'center',
    offsetX: 0,
    offsetY: 3,
    fill: new Fill({ color: '#000' }),
    stroke: new Stroke({ color: '#fff', width: 0.1 }),
    textBaseline: 'top',
  }),
  zIndex: 50,
});

const PityousStyle = new Style({
  image:  new Circle({
    anchorXUnits: 'fraction',
    anchorYUnits: 'pixels',
    radius: 1.5,
    stroke: new Stroke({ color: '#000', width: 1 }),
    fill: new Fill({ color: 'white' }),
    declutterMode: 'declutter',
    declutter: true,
  }),
  text: new Text({
    font: '9px sans-serif',
    textAlign: 'center',
    offsetX: 0,
    offsetY: 3,
    fill: new Fill({ color: '#000' }),
    stroke: new Stroke({ color: '#fff', width: 0.1 }),
    textBaseline: 'top',
  }),
  zIndex: 40,
});

const ShemakhaStyle = new Style({
  image:  new Circle({
    anchorXUnits: 'fraction',
    anchorYUnits: 'pixels',
    radius: 1,
    stroke: new Stroke({ color: '#000', width: 0.5 }),
    fill: new Fill({ color: 'black' }),
    declutterMode: 'declutter',
    declutter: true,
  }),
  text: new Text({
    font: 'italic 9px sans-serif',
    textAlign: 'center',
    offsetX: 0,
    offsetY: 3,
    fill: new Fill({ color: '#000' }),
    stroke: new Stroke({ color: '#fff', width: 0.1 }),
    textBaseline: 'top',
  }),
  zIndex: 30,
});

// ==================== ИСТОЧНИКИ ДАННЫХ ГОРОДОВ ====================
const RomaSource = new VectorSource({
  url:'/data/cities/1roma.geojson',
  attributions:
		'© <a href="http://awmc.unc.edu/awmc/map_data/license.txt">Ancient World Mapping Center</a>: Base Polygons, Borders, Data, Inland Water. © <a href="https://server.arcgisonline.com/arcgis/rest/services">ArcGIS</a>: Vibrant, World Hillshade. © <a href="https://raw.githubusercontent.com/johaahlf/dare/master/LICENSE">Digital Atlas of the Roman Empire</a>: Data, Roads. © <a href="http://oxrep.classics.ox.ac.uk/databases/cities/">Hanson, J. W. (2016)</a>: Data. © <a href="https://www.maptiler.com/copyright/">MapTiler</a>: Ocean. © <a href="https://github.com/mapzen/documentation/blob/master/LICENSE">Mapzen</a>: Global Terrain. © <a href="https://www.openstreetmap.org/copyright/en">OpenStreetMap contributors</a>. © <a href="https://pleiades.stoa.org/credits">Pleiades</a>: Data. © <a href="https://basemap.nationalmap.gov/arcgis/rest/services/USGSShadedReliefOnly/MapServer">USGS The National Map</a>: 3D Elevation Program. ',
  format: new GeoJSON(),
});
const CordubaSource = new VectorSource({
  url:'/data/cities/2corduba.geojson',
  format: new GeoJSON(),
});
const ByzantiumSource = new VectorSource({
  url:'/data/cities/3byzantium.geojson',
  format: new GeoJSON(),
});
const LondiniumSource = new VectorSource({
  url:'/data/cities/4londinium.geojson',
  format: new GeoJSON(),
});
const TheodosiaSource = new VectorSource({
  url:'/data/cities/5theodosia.geojson',
  format: new GeoJSON(),
});
const AntinoopolisSource = new VectorSource({
  url:'/data/cities/6antinoopolis.geojson',
  format: new GeoJSON(),
});
const DelosSource = new VectorSource({
  url:'/data/cities/7delos.geojson',
  format: new GeoJSON(),
});
const PityousSource = new VectorSource({
  url:'/data/cities/8pityous.geojson',
  format: new GeoJSON(),
});
const ShemakhaSource = new VectorSource({
  url:'/data/cities/9shemakha.geojson',
  format: new GeoJSON(),
});

// ==================== СЛОИ ГОРОДОВ ====================
const Roma = new VectorLayer({
  source: RomaSource,
  style: function (feature) {
    RomaStyle.getText().setText(feature.get('title').toUpperCase());
    return RomaStyle;
  },
  declutter: true,
  minZoom: 3.9999,
  maxZoom: 10,
});

const Corduba = new VectorLayer({
  source: CordubaSource,
  style: function (feature) {
    CordubaStyle.getText().setText(feature.get('title'));
    return CordubaStyle;
  },
  declutter: true,
  minZoom: 3.9999,
  maxZoom: 10,
});

const Byzantium = new VectorLayer({
  source: ByzantiumSource,
  style: function (feature) {
    ByzantiumStyle.getText().setText(feature.get('title'));
    return ByzantiumStyle;
  },
  declutter: true,
  minZoom: 3.9999,
  maxZoom: 10,
});

const Londinium = new VectorLayer({
  source: LondiniumSource,
  style: function (feature) {
    const label = feature.get('title').split(' ').join('\n');
    LondiniumStyle.getText().setText(label);
    return LondiniumStyle;
  },
  declutter: true,
  minZoom: 3.9999,
  maxZoom: 10,
});

const Theodosia = new VectorLayer({
  source: TheodosiaSource,
  style: function (feature) {
    const label = feature.get('title').split(' ').join('\n');
    TheodosiaStyle.getText().setText(label);
    return TheodosiaStyle;
  },
  declutter: true,
  minZoom: 3.9999,
  maxZoom: 10,
});

const Antinoopolis = new VectorLayer({
  source: AntinoopolisSource,
  style: function (feature) {
    const label = feature.get('title').split(' ').join('\n');
    AntinoopolisStyle.getText().setText(label);
    return AntinoopolisStyle;
  },
  declutter: true,
  minZoom: 4.9999,
  maxZoom: 10,
});

const Delos = new VectorLayer({
  source: DelosSource,
  style: function (feature) {
    const label = feature.get('title').split(' ').join('\n');
    DelosStyle.getText().setText(label);
    return DelosStyle;
  },
  declutter: true,
  minZoom: 5.9999,
  maxZoom: 10,
});

const Pityous = new VectorLayer({
  source: PityousSource,
  style: function (feature) {
    const label = feature.get('title').split(' ').join('\n');
    PityousStyle.getText().setText(label);
    return PityousStyle;
  },
  declutter: true,
  minZoom: 6.9999,
  maxZoom: 10,
});

const Shemakha = new VectorLayer({
  source: ShemakhaSource,
  style: function (feature) {
    const label = feature.get('title').split(' ').join('\n');
    ShemakhaStyle.getText().setText(label);
    return ShemakhaStyle;
  },
  declutter: true,
  minZoom: 7.9999,
  maxZoom: 10,
});

// ==================== СОЗДАНИЕ КАРТЫ ====================
const map = new Map({
  controls: defaultControls().extend([scaleControl]),
  layers: [
    base,
    roads,
    graticule,
    mareimena,
    provimena,
    Shemakha,
    Pityous,
    Delos,
    Antinoopolis,
    Theodosia,
    Londinium,
    Byzantium,
    Corduba,
    Roma,
    pomerium,
  ],
  target: document.getElementById('map'),
  view: view,
});

// ==================== ДОПОЛНИТЕЛЬНЫЕ ЭЛЕМЕНТЫ УПРАВЛЕНИЯ ====================
const zoomslider = new ZoomSlider();
map.addControl(zoomslider);

// ==================== ЭЛЕМЕНТЫ ИНТЕРФЕЙСА ====================
const titleElement = document.querySelector("#title");
const altElement = document.querySelector("#alt");
const provinceElement = document.querySelector("#province");
const countryElement = document.querySelector("#country");
const startElement = document.querySelector("#start");
const modernElement = document.querySelector("#modern");
const descriptionElement = document.querySelector("#description");
const batlasElement = document.querySelector("#batlas");
const awmcElement = document.querySelector("#awmc");
const darmcElement = document.querySelector("#darmc");
const hansonElement = document.querySelector("#hanson");
const orbisElement = document.querySelector("#orbis");
const trismegistosElement = document.querySelector("#trismegistos");
const coordsElement = document.querySelector("#coords");
const cooElement = document.querySelector("#coords2");
const flagElement = document.querySelector("#flag");
const googlelinkElement = document.querySelector("#googlelink");
const OSMlinkElement = document.querySelector("#OSMlink");
const wikimapialinkElement = document.querySelector("#wikimapialink");
const darelinkElement = document.querySelector("#darelink");
const pecslinkElement = document.querySelector("#pecslink");
const pleiadeslinkElement = document.querySelector("#pleiadeslink");
const tpplacelinkElement = document.querySelector("#tpplacelink");
const topostextlinkElement = document.querySelector("#topostextlink");
const vicilinkElement = document.querySelector("#vicilink");
const wikidatalinkElement = document.querySelector("#wikidatalink");
const wikipedialinkElement = document.querySelector("#wikipedialink");

const hello = document.getElementById('pusto');
const node = document.getElementById('hopa');

let minimap = null;
let markers = null;
let centerpointSource = null;

// ==================== ФУНКЦИЯ ОТОБРАЖЕНИЯ ИНФОРМАЦИИ О ГОРОДЕ ====================
function showCityDetails(feature) {
  hello.style.visibility = 'hidden';
  node.style.visibility = 'visible';
  
  titleElement.innerHTML = feature.get('title');
  altElement.innerHTML = feature.get('alt');
  provinceElement.innerHTML = feature.get('province');
  startElement.innerHTML = feature.get('start');
  modernElement.innerHTML = feature.get('modern');
  countryElement.innerHTML = feature.get('country');
  batlasElement.innerHTML = feature.get('batlas');
  descriptionElement.innerHTML = feature.get('description');
  awmcElement.innerHTML = feature.get('awmc');
  darmcElement.innerHTML = feature.get('darmc');
  hansonElement.innerHTML = feature.get('hanson');
  orbisElement.innerHTML = feature.get('orbis');
  trismegistosElement.innerHTML = feature.get('trismegistos');
  coordsElement.textContent = feature.get('latlon').split(',').join(', ');
  
  const drlink = feature.get('dare');
  const pelink = feature.get('PECS');
  const pllink = feature.get('pleiades');
  const tplink = feature.get('TTPlace');
  const ttlink = feature.get('topostext');
  const vclink = feature.get('vici');
  const wdlink = feature.get('wikidata');
  const wplink = feature.get('wikipedia:en');
  
  const minicenter = getCenter(feature.getGeometry().getExtent());
  const lonlat = transform(minicenter, 'EPSG:3857', 'EPSG:4326');
  const coordlon = (lonlat[0]).toFixed(6);
  const coordlat = (lonlat[1]).toFixed(6);
  const coo = toStringHDMS(lonlat);

  cooElement.textContent = coo.split('° ').join('°');
  
  flagElement.innerHTML = `<img src='/icons/flags/${countryElement.innerHTML}.png' 
                             title='${countryElement.innerHTML}' 
                             width='17' height='17'
                             style='display: inline-block; margin: 0 5px 0 5px;'>`;
  googlelinkElement.innerHTML = `<a href='https://www.google.com/maps/place/${coo}' target='_blank' title='Google Maps'>Google Maps</a>`;
  OSMlinkElement.innerHTML = `<a href='http://www.openstreetmap.org/index.html?mlat=${coordlat}&mlon=${coordlon}&zoom=16' target='_blank' title='OpenStreetMap'>OpenStreetMap</a>`;
  wikimapialinkElement.innerHTML = `<a href='http://www.wikimapia.org/#lat=${coordlat}&lon=${coordlon}&z=16&l=0&m=w&v=0' target='_blank' title='Wikimapia'>Wikimapia</a>`;
  
  darelinkElement.innerHTML = drlink ? `<a href='http://imperium.ahlfeldt.se/places/${drlink}' target='_blank' title='DARE place'>${drlink}</a>` : '';
  pecslinkElement.innerHTML = pelink ? `<a href='http://www.perseus.tufts.edu/hopper/text?doc=Perseus:text:1999.04.0006:entry=${pelink}' target='_blank' title='Princeton place'>${pelink}</a>` : '';
  pleiadeslinkElement.innerHTML = pllink ? `<a href='https://pleiades.stoa.org/places/${pllink}' target='_blank' title='Pleiades place'>${pllink}</a>` : '';
  tpplacelinkElement.innerHTML = tplink ? `<a href='https://www.cambridge.org/us/talbert/talbertdatabase/TPPlace${tplink}.html' target='_blank' title='TPPlace place'>${tplink}</a>` : '';
  topostextlinkElement.innerHTML = ttlink ? `<a href='https://topostext.org/place/${ttlink}' target='_blank' title='ToposText place'>${ttlink}</a>` : '';
  vicilinkElement.innerHTML = vclink ? `<a href='https://vici.org/vici/${vclink}' target='_blank' title='Vici place'>${vclink}</a>` : '';
  wikidatalinkElement.innerHTML = wdlink ? `<a href='https://www.wikidata.org/wiki/Q${wdlink}' target='_blank' title='Wikidata ID'>${wdlink}</a>` : '';
  wikipedialinkElement.innerHTML = wplink ? `<a href='https://en.wikipedia.org/wiki/${wplink}' target='_blank' title='Wikipedia:en'>${wplink}</a>` : '';
  
  if (markers) {
    map.removeLayer(markers);
  }
  
  markers = new VectorLayer({
    source: new VectorSource(),
    style: new Style({
      image: new Icon({
        anchor: [0.5, 0.5],
        src: '/icons/target.png'
      })
    })
  });
  
  map.addLayer(markers);
  const marker = new Feature(new Point(minicenter));
  markers.getSource().addFeature(marker);
  
  if (!minimap) {
    centerpointSource = new VectorSource();
    const pointFeature = new Feature(new Point(minicenter));
    centerpointSource.addFeature(pointFeature);
    
    const centerpoint = new VectorLayer({
      source: centerpointSource,
      style: new Style({
        image: new Icon({
          anchor: [0.5, 0.5],
          anchorXUnits: 'fraction',
          anchorYUnits: 'pixels',
          src: '/icons/target.png',
        })
      })
    });
    
    minimap = new Map({
      target: 'minimap',
      layers: [
        new TileLayer({
          source: new XYZ({
            attributions: 'Tiles © Google',
            url: 'https://mt0.google.com/vt/lyrs=s&hl=en&x={x}&y={y}&z={z}'
          }),
        }),
        centerpoint,
      ],
      view: new View({
        projection: 'EPSG:3857',
        center: minicenter,
        zoom: 15,
        minZoom: 13.9999,
        maxZoom: 18,
      }),
    });
  } else {
    centerpointSource.clear();
    
    const pointFeature = new Feature(new Point(minicenter));
    centerpointSource.addFeature(pointFeature);
    
    minimap.getView().setCenter(minicenter);
    minimap.getView().setZoom(15);
  }
  
  document.getElementById("workOpen").click();
  
  if (!clipboard) {
  clipboard = new ClipboardJS('.btn');
  };
}

// ==================== УЛУЧШЕННАЯ СИСТЕМА ПОИСКА ====================
const searchSource = new VectorSource({ features: [] });
let lastSearchResults = [];

// Загружаем ВСЕ города в поиск сразу (как делали вчера)
setTimeout(() => {
  const cityFiles = [
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
  
  let loadedCount = 0;
  
  cityFiles.forEach(url => {
    fetch(url)
      .then(response => response.json())
      .then(data => {
        const features = new GeoJSON().readFeatures(data, {
          dataProjection: 'EPSG:4326',
          featureProjection: map.getView().getProjection()
        });
        
        features.forEach(feature => {
          feature.set("featureType", "title");
          searchSource.addFeature(feature);
        });
        
        loadedCount++;
      })
      .catch(error => {
        console.error('Error loading city data:', error);
      });
  });
}, 100);

// Функция сортировки результатов (по алфавиту, сначала точные совпадения)
function sortSearchResults(results, searchTerm) {
  if (!searchTerm || results.length === 0) return results;
  
  const termLower = searchTerm.toLowerCase();
  const resultsCopy = [...results];
  
  resultsCopy.sort((a, b) => {
    const titleA = a.get('title').toLowerCase();
    const titleB = b.get('title').toLowerCase();
    
    // Сначала точные совпадения
    const exactMatchA = titleA === termLower;
    const exactMatchB = titleB === termLower;
    if (exactMatchA && !exactMatchB) return -1;
    if (!exactMatchA && exactMatchB) return 1;
    
    // Затем начинающиеся с поискового запроса
    const startsWithA = titleA.startsWith(termLower);
    const startsWithB = titleB.startsWith(termLower);
    if (startsWithA && !startsWithB) return -1;
    if (!startsWithA && startsWithB) return 1;
    
    // Затем по алфавиту
    return titleA.localeCompare(titleB);
  });
  
  return resultsCopy;
}

// Создание элементов интерфейса поиска
const searchContainer = document.createElement('div');
searchContainer.className = 'ol-search ol-control';
searchContainer.style.top = '0.5em';
searchContainer.style.left = '3em';

const searchInput = document.createElement('input');
searchInput.type = 'text';
searchInput.placeholder = 'Search cities...';
searchInput.style.cssText = `
  width: 200px;
  padding: 5px 10px;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 14px;
`;

const resultsContainer = document.createElement('ul');
resultsContainer.style.cssText = `
  position: absolute;
  top: 100%;
  left: 0;
  width: 100%;
  max-height: 300px;
  overflow-y: auto;
  background: white;
  border: 1px solid #ccc;
  border-top: none;
  list-style: none;
  padding: 0;
  margin: 0;
  z-index: 1000;
  display: none;
`;

searchContainer.appendChild(searchInput);
searchContainer.appendChild(resultsContainer);

// Обработчик ввода в поиск
searchInput.addEventListener('input', function() {
  const searchTerm = this.value.trim();
  resultsContainer.innerHTML = '';
  
  if (searchTerm.length < 1) {
    resultsContainer.style.display = 'none';
    lastSearchResults = [];
    return;
  }
  
  const allFeatures = searchSource.getFeatures();
  const termLower = searchTerm.toLowerCase();
  
  const matchingFeatures = allFeatures.filter(feature => {
    const title = feature.get('title').toLowerCase();
    return title.includes(termLower);
  });
  
  const sortedFeatures = sortSearchResults(matchingFeatures, searchTerm);
  lastSearchResults = sortedFeatures;
  
  if (sortedFeatures.length === 0) {
    const li = document.createElement('li');
    li.textContent = 'No cities found';
    li.style.padding = '8px 10px';
    li.style.color = '#666';
    resultsContainer.appendChild(li);
  } else {
    sortedFeatures.slice(0, 15).forEach(feature => {
      const li = document.createElement('li');
      li.textContent = feature.get('title');
      li.style.padding = '8px 10px';
      li.style.cursor = 'pointer';
      li.style.borderBottom = '1px solid #eee';
      
      li.addEventListener('mouseenter', () => {
        li.style.backgroundColor = '#f0f0f0';
      });
      li.addEventListener('mouseleave', () => {
        li.style.backgroundColor = '';
      });
      
      li.addEventListener('click', () => {
        handleSearchSelect(feature);
      });
      
      resultsContainer.appendChild(li);
    });
  }
  
  resultsContainer.style.display = 'block';
});

// Закрытие выпадающего списка
document.addEventListener('click', function(event) {
  if (!searchContainer.contains(event.target)) {
    resultsContainer.style.display = 'none';
  }
});

// Кастомный контрол поиска
class CustomSearchControl extends Control {
  constructor(opt_options) {
    const options = opt_options || {};
    
    const element = searchContainer;
    
    super({
      element: element,
      target: options.target,
    });
  }
}

const customSearchControl = new CustomSearchControl({
  target: undefined
});
map.addControl(customSearchControl);

// Обработка клавиш в поиске
searchInput.addEventListener('keydown', function(e) {
  const items = resultsContainer.querySelectorAll('li');
  if (items.length === 0) return;
  
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    const current = document.activeElement;
    if (current === searchInput) {
      items[0].focus();
    } else if (current.tagName === 'LI') {
      const next = current.nextElementSibling;
      if (next) next.focus();
    }
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    const current = document.activeElement;
    if (current.tagName === 'LI') {
      const prev = current.previousElementSibling;
      if (prev) {
        prev.focus();
      } else {
        searchInput.focus();
      }
    }
  } else if (e.key === 'Enter') {
    e.preventDefault();
    const current = document.activeElement;
    if (current.tagName === 'LI') {
      current.click();
    } else if (lastSearchResults.length > 0) {
      const firstResult = lastSearchResults[0];
      if (firstResult) {
        handleSearchSelect(firstResult);
      }
    }
  }
});

// ==================== SELECT ДЛЯ ПОИСКА ====================
const select = new Select({
  layers: function () {
    return;
  },
});
map.addInteraction(select);

// Функция обработки выбора из поиска
function handleSearchSelect(feature) {
  // Очищаем предыдущий выбор Select
  select.getFeatures().clear();
  // Добавляем выбранный город в Select (только для визуального выделения)
  select.getFeatures().push(feature);
  
  // Центрируем карту
  const center = feature.getGeometry().getFirstCoordinate();
  map.getView().animate({ 
    center: center,
    zoom: 10,
    duration: 2000,
    easing: easeOut,
  });
  
  // Показываем детали города
  showCityDetails(feature);
  
  // Закрываем поиск
  searchInput.value = feature.get('title');
  resultsContainer.style.display = 'none';
}

// ==================== ОБРАБОТЧИК КЛИКА ПО КАРТЕ ====================
map.on('click', function (evt) {
  let hitt = false;
  const feature = map.forEachFeatureAtPixel(evt.pixel, function (feature, layer) {
    if (layer === Roma || layer === Corduba || layer === Byzantium || 
        layer === Londinium || layer === Theodosia || layer === Antinoopolis || 
        layer === Delos || layer === Pityous || layer === Shemakha) {
      hitt = true;
      return feature;
    }
  }, { hitTolerance: 3 });
  
  if (hitt) {
    // ВАЖНО: НЕ используем select.getFeatures() при обычном клике!
    // Просто показываем город напрямую
    showCityDetails(feature);
    document.getElementById("workOpen").click();
  } else {
    // Клик в пустое место
    hello.style.visibility = 'visible';
    node.style.visibility = 'hidden';
    if (markers) {
      map.removeLayer(markers);
      markers = null;
    }
    if (centerpointSource) {
      centerpointSource.clear();
    }
    // Очищаем Select при клике в пустое место
    select.getFeatures().clear();
  }
});

// ==================== ИЗМЕНЕНИЕ КУРСОРА ====================
map.on('pointermove', function(e) {
  if (e.dragging) return;
  
  const pixel = map.getEventPixel(e.originalEvent);
  let hit = false;
  
  map.forEachFeatureAtPixel(pixel, function(feature, layer) {
    if (layer === Roma || layer === Corduba || layer === Byzantium || 
        layer === Londinium || layer === Theodosia || layer === Antinoopolis || 
        layer === Delos || layer === Pityous || layer === Shemakha) {
      hit = true;
    }
  }, { hitTolerance: 3 });
  
  map.getTarget().style.cursor = hit ? 'pointer' : '';
});