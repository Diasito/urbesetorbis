import './style.css';
import {toStringHDMS} from 'ol/coordinate';
import {Attribution, defaults as defaultControls, ScaleLine, ZoomSlider} from 'ol/control';
import {easeIn, easeOut} from 'ol/easing.js';
import {fromExtent} from 'ol/geom/Polygon';
import {fromLonLat, get as getProjection, transform} from 'ol/proj';
import {getCenter} from 'ol/extent';
import {Circle, Fill, Icon, Stroke, Style, Text} from 'ol/style';
import {LineString, Point, Polygon} from 'ol/geom';
import {toContext} from 'ol/render';
import {Vector as VectorLayer} from 'ol/layer';
import Feature from 'ol/Feature';
import GeoJSON from 'ol/format/GeoJSON';
import geojsonvt from 'geojson-vt';
import Geometry from 'ol/geom/Geometry';
import Graticule from 'ol/layer/Graticule';
import Map from 'ol/Map';
import MultiPoint from 'ol/geom/MultiPoint';
import Projection from 'ol/proj/Projection';
import Select from 'ol/interaction/Select';
import TileLayer from 'ol/layer/Tile';
import {Vector} from 'ol/source';
import VectorSource from 'ol/source/Vector';
import VectorTileLayer from 'ol/layer/VectorTile';
import VectorTileSource from 'ol/source/VectorTile';
import View from 'ol/View';
import XYZ from 'ol/source/XYZ';
import SearchFeature from 'ol-ext/control/SearchFeature';



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
	zoom: 9,
	minZoom: 3.9999,
	maxZoom: 10,
	extent: [-1400000, 2600000, 6100000, 7600000],
});



const hillshade = new TileLayer({
	extent: [-1400000, 2600000, 6100000, 7600000],
	preload: Infinity,
	source: new XYZ({
		url: 
'https://basemap.nationalmap.gov/arcgis/rest/services/USGSShadedReliefOnly/MapServer/tile/{z}/{y}/{x}',
	}),
	tilePixelRatio: 2,
	minZoom: 3.9999,
	maxZoom: 8,
	opacity: 1,
});


	
const styleRivers = new Style({
	fill: new Fill(),
	stroke: new Stroke({
		color: '#42aaff',
	}),
	text: new Text({
		font: 'italic 10px sans-serif',
		fill: new Fill({
			color: '#42aaff'
		}),
		stroke: new Stroke({
			color: '#fff',
			width: 0.1
		}),
		placement: 'line',
		repeat: 1000,
		textBaseline: 'top',
		maxAngle: Math.PI/10,
		overflow: 'true',
	}),
	zIndex: 75,
});
const rivers = new VectorLayer({
	source: new VectorSource({
		format: new GeoJSON(),
		url: "./data/physical/rivers5.geojson",
	}),
	minZoom: 3.9999,
	maxZoom: 10,
	opacity: 1,
	style: function (feature) {
		const width = feature.get('wid');
		styleRivers.getStroke().setWidth(width/1.5);
		styleRivers.getText().setText(feature.get('name'));
		return styleRivers;
	},
	declutter: true,
});


  
const replacer = function (key, value) {
	if (!value || !value.geometry) {
		return value;
	}

	let type;
	const rawType = value.type;
	let geometry = value.geometry;
	if (rawType === 1) {
		type = 'MultiPoint';
		if (geometry.length == 1) {
			type = 'Point';
			geometry = geometry[0];
		}
	} else if (rawType === 2) {
		type = 'MultiLineString';
		if (geometry.length == 1) {
			type = 'LineString';
			geometry = geometry[0];
		}
	} else if (rawType === 3) {
		type = 'Polygon';
		if (geometry.length > 1) {
			type = 'MultiPolygon';
			geometry = [geometry];
		}
	}

	return {
		'type': 'Feature',
		'geometry': {
			'type': type,
			'coordinates': geometry,
		},
		'properties': value.tags,
	};
};


const landStyle = new Style({
	fill: new Fill({
		color: '#eeeeee',
	}),
	stroke: new Stroke({
		color: '#000000',
		width: 0.5,
		}),
});
const land = new VectorTileLayer({
	minZoom: 3.9999,
	maxZoom: 8,
	opacity: 0.5,
	preload: Infinity,
	style: function (feature) {
    const color = feature.get('color') || '#eeeeee';
    landStyle.getFill().setColor(color);
    return landStyle;
	},
});



const lakes = new VectorLayer({
	source: new VectorSource({
		format: new GeoJSON(),
		url: "./data/physical/lakes5.geojson",
	}),
	style: new Style({
		stroke: new Stroke({
			color: '#42aaff',
			width: 0.3,
		}),
		fill: new Fill({
			color: 'rgba( 118, 197, 240, 1 )',
		}),
	}),
	minZoom: 3.9999,
	maxZoom: 8,
	opacity: 0.7,
});



const base = new TileLayer({
	preload: Infinity,
	source: new XYZ({
		urls:[
			"./data/base/{z}/{x}/{y}.png"
		],
		tilePixelRatio: 1.000000
	}),
	minZoom: 7.9999,
	maxZoom: 10,
	opacity: 0.6,
});



const styleBorder = new Style({
	stroke: new Stroke({
		color: 'purple',
		width: 2,
	}),
});
const border = new VectorLayer({
	source: new VectorSource({
		format: new GeoJSON(),
		url: "./data/cultural/border4.geojson",
	}),
	style: styleBorder,
	minZoom: 7.9999,
	maxZoom: 10,
	opacity: 0.8,
});



const stylePomerium = new Style({
	fill: new Fill({
		color: 'red',
	}),
});
const pomerium = new VectorLayer({
	source: new VectorSource({
		format: new GeoJSON(),
		url: "./data/cultural/pomerium1.geojson",
	}),
	style: stylePomerium,
	minZoom: 6.9999,
	maxZoom: 10,
	opacity: 0.8,
});



const styleRoads = new Style({
	fill: new Fill(),
	stroke: new Stroke({
		color: 'red',
	}),
	text: new Text({
		font: '10px sans-serif',
		fill: new Fill({
			color: 'red'
		}),
		stroke: new Stroke({
			color: '#fff',
			width: 0.1
		}),
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
		url: "./data/cultural/roads4.geojson",
	}),
	style: function (feature) {
		const width = feature.get('rank');
		styleRoads.getStroke().setWidth(width / 4);
		styleRoads.getText().setText(feature.get('name'));
		return styleRoads;
	},
	minZoom: 3.9999,
	maxZoom: 10,
	opacity: 0.6,
	declutter: true,
});



const graticule = new Graticule({
	strokeStyle: new Stroke({
		color: 'rgba(0,0,0,0.9)',
		width: 0.1,
	}),
	showLabels: true,
	wrapX: false,
});



function provincenames (feature) {
	var zoom = map.getView().getZoom();
	var degree = feature.get('mnozhitel');
	var font_size = (zoom**1.65)*degree;
	var provi = feature.get('title').toUpperCase();
	return [
		new Style({
			text: new Text({
				font: font_size + 'px serif',
				textAlign: 'center',
				justify: 'center',
				placement: 'line',
				weight: 'bold',
				fill: new Fill({
					color: [87, 0, 127, 0.6],
					}),
				stroke: new Stroke({
					color: [255, 255, 255, 0.3], 
					width: 1,
					}),
				padding: [1, 1, 1, 1],
				text: provi,
			}),
		}),
	];
};
const provimena = new VectorLayer({
	source: new VectorSource({
		format: new GeoJSON(),
		url: "./data/cultural/prov_names1.geojson",
	}),
	minZoom: 3.9999,
	maxZoom: 8,
	opacity: 1,
	style: provincenames,
});



function names (feature) {
	var zoom = map.getView().getZoom();
	var degree = feature.get('mnozhitel');
	var font_size = (zoom**1.65)*degree;
	var provi = feature.get('title').toUpperCase();
	return [
		new Style({
			text: new Text({
				font: 'italic ' + font_size + 'px serif',
				textAlign: 'center',
				justify: 'center',
				placement: 'line',
				fill: new Fill({
					color: [50, 101, 211, 0.6],
					}),
				stroke: new Stroke({
					color: [0, 0, 0, 0.1], 
					width: 1,
					}),
				padding: [1, 1, 1, 1],
				text: provi,
			}),
		}),
	];
};
const mareimena = new VectorLayer({
	source: new VectorSource({
		format: new GeoJSON(),
		url: "./data/cultural/mare_names1.geojson",
	}),
	minZoom: 3.9999,
	maxZoom: 8,
	opacity: 1,
	style: names,
});



const RomaStyle = new Style({
	image:  new Circle({
		anchor: [0.5, 0.5],
		anchorXUnits: 'fraction',
		anchorYUnits: 'pixels',
		radius: 4,
		stroke: new Stroke({
			color: '#000',
			width: 1
		}),
		fill: new Fill({
			color: 'red'
		})
	}),
	text: new Text({
		font: 'bold 13px sans-serif',
		textAlign: 'center',
		offsetX: 0,
		offsetY: 6,
		fill: new Fill({
			color: '#000'
		}),
		stroke: new Stroke({
			color: '#fff',
			width: 0.1
		}),
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
		fill: new Fill({
			color: 'red'
		}),
		stroke: new Stroke({
			color: '#000',
			width: 1
		}),
	}),
	text: new Text({
		font: 'bold 12px sans-serif',
		textAlign: 'center',
		offsetX: 0,
		offsetY: 4,
		fill: new Fill({
			color: '#000'
		}),
		stroke: new Stroke({
			color: '#fff',
			width: 0.1
		}),
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
		stroke: new Stroke({
			color: '#000',
			width: 1
		}),
		fill: new Fill({
			color: 'white'
		})
	}),
	text: new Text({
		font: 'bold 12px sans-serif',
		textAlign: 'center',
		offsetX: 0,
		offsetY: 4,
		fill: new Fill({
			color: '#000'
		}),
		stroke: new Stroke({
			color: '#fff',
			width: 0.1
		}),
		textBaseline: 'top',
	}),
	zIndex: 90,
});

const LondiniumStyle = new Style({
	image:  new Circle({
		anchorXUnits: 'fraction',
		anchorYUnits: 'pixels',
		radius: 3,
		stroke: new Stroke({
			color: '#000',
			width: 1
		}),
		fill: new Fill({
			color: 'red'
		})
	}),
	text: new Text({
		font: 'bold 11px sans-serif',
		textAlign: 'center',
		offsetX: 0,
		offsetY: 4,
		fill: new Fill({
			color: '#000'
		}),
		stroke: new Stroke({
			color: '#fff',
			width: 0.1
		}),
		textBaseline: 'top',
	}),
	zIndex: 80,
});

const TheodosiaStyle = new Style({
	image:  new Circle({
		anchorXUnits: 'fraction',
		anchorYUnits: 'pixels',
		radius: 3,
		stroke: new Stroke({
			color: '#000',
			width: 1
		}),
		fill: new Fill({
			color: 'white'
		})
	}),
	text: new Text({
		font: 'bold 11px sans-serif',
		textAlign: 'center',
		offsetX: 0,
		offsetY: 4,
		fill: new Fill({
			color: '#000'
		}),
		stroke: new Stroke({
			color: '#fff',
			width: 0.1
		}),
		textBaseline: 'top',
	}),
	zIndex: 70,
});

const AntinoopolisStyle = new Style({
	image:  new Circle({
		anchorXUnits: 'fraction',
		anchorYUnits: 'pixels',
		radius: 2.5,
		stroke: new Stroke({
			color: '#000',
			width: 1
		}),
		fill: new Fill({
			color: 'white'
		})
	}),
	text: new Text({
		font: 'bold 10px sans-serif',
		textAlign: 'center',
		offsetX: 0,
		offsetY: 3,
		fill: new Fill({
			color: '#000'
		}),
		stroke: new Stroke({
			color: '#fff',
			width: 0.1
		}),
		textBaseline: 'top',
	}),
	zIndex: 60,
});

const DelosStyle = new Style({
	image:  new Circle({
		anchorXUnits: 'fraction',
		anchorYUnits: 'pixels',
		radius: 2,
		stroke: new Stroke({
			color: '#000',
			width: 1
		}),
		fill: new Fill({
			color: 'white'
		}),
		declutterMode: 'declutter',
		declutter: true,
	}),
	text: new Text({
		font: 'bold 9px sans-serif',
		textAlign: 'center',
		offsetX: 0,
		offsetY: 3,
		fill: new Fill({
			color: '#000'
		}),
		stroke: new Stroke({
			color: '#fff',
			width: 0.1
		}),
		textBaseline: 'top',
	}),
	zIndex: 50,
});

const PityousStyle = new Style({
	image:  new Circle({
		anchorXUnits: 'fraction',
		anchorYUnits: 'pixels',
		radius: 1.5,
		stroke: new Stroke({
			color: '#000',
			width: 1
		}),
		fill: new Fill({
			color: 'white'
		}),
		declutterMode: 'declutter',
		declutter: true,
	}),
	text: new Text({
		font: '9px sans-serif',
		textAlign: 'center',
		offsetX: 0,
		offsetY: 3,
		fill: new Fill({
			color: '#000'
		}),
		stroke: new Stroke({
			color: '#fff',
			width: 0.1
		}),
		textBaseline: 'top',
	}),
	zIndex: 40,
});

const ShemakhaStyle = new Style({
	image:  new Circle({
		anchorXUnits: 'fraction',
		anchorYUnits: 'pixels',
		radius: 1,
		stroke: new Stroke({
			color: '#000',
			width: 0.5
		}),
		fill: new Fill({
			color: 'black'
		}),
		declutterMode: 'declutter',
		declutter: true,
	}),
	text: new Text({
		font: 'italic 9px sans-serif',
		textAlign: 'center',
		offsetX: 0,
		offsetY: 3,
		fill: new Fill({
			color: '#000'
		}),
		stroke: new Stroke({
			color: '#fff',
			width: 0.1
		}),
		textBaseline: 'top',
	}),
	zIndex: 30,
});



const RomaSource = new VectorSource({
	url:'./data/cities/1roma.geojson',
	attributions:
		'© <a href="http://awmc.unc.edu/awmc/map_data/license.txt">Ancient World Mapping Center</a>: Base Polygons, Borders, Data, Inland Water. © <a href="https://server.arcgisonline.com/arcgis/rest/services">ArcGIS</a>: Vibrant, World Hillshade. © <a href="https://raw.githubusercontent.com/johaahlf/dare/master/LICENSE">Digital Atlas of the Roman Empire</a>: Data, Roads. © <a href="http://oxrep.classics.ox.ac.uk/databases/cities/">Hanson, J. W. (2016)</a>: Data. © <a href="https://www.maptiler.com/copyright/">MapTiler</a>: Ocean. © <a href="https://github.com/mapzen/documentation/blob/master/LICENSE">Mapzen</a>: Global Terrain. © <a href="https://www.openstreetmap.org/copyright/en">OpenStreetMap contributors</a>. © <a href="https://pleiades.stoa.org/credits">Pleiades</a>: Data. © <a href="https://basemap.nationalmap.gov/arcgis/rest/services/USGSShadedReliefOnly/MapServer">USGS The National Map</a>: 3D Elevation Program. ',
    format: new GeoJSON(),
});
const CordubaSource = new VectorSource({
	url:'./data/cities/2corduba.geojson',
    format: new GeoJSON(),
});
const ByzantiumSource = new VectorSource({
	url:'./data/cities/3byzantium.geojson',
    format: new GeoJSON(),
});
const LondiniumSource = new VectorSource({
	url:'./data/cities/4londinium.geojson',
    format: new GeoJSON(),
});
const TheodosiaSource = new VectorSource({
	url:'./data/cities/5theodosia.geojson',
    format: new GeoJSON(),
});
const AntinoopolisSource = new VectorSource({
	url:'./data/cities/6antinoopolis.geojson',
    format: new GeoJSON(),
});
const DelosSource = new VectorSource({
	url:'./data/cities/7delos.geojson',
    format: new GeoJSON(),
});
const PityousSource = new VectorSource({
	url:'./data/cities/8pityous.geojson',
    format: new GeoJSON(),
});
const ShemakhaSource = new VectorSource({
	url:'./data/cities/9shemakha.geojson',
    format: new GeoJSON(),
});



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



const map = new Map({
	controls: defaultControls().extend([scaleControl]),
	layers: [
			hillshade,
			land,
			rivers,
			lakes,
			base,
			border,
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


const zoomslider = new ZoomSlider();
map.addControl(zoomslider);


const url = './data/cultural/land4.geojson';
fetch(url)
  .then(function (response) {
    return response.json();
  })
  .then(function (json) {
    const tileIndex = geojsonvt(json, {
      extent: 4096,
      debug: 1,
    });
    const format = new GeoJSON({
      dataProjection: new Projection({
        code: 'TILE_PIXELS',
        units: 'tile-pixels',
        extent: [0, 0, 4096, 4096],
      }),
    });
    const vectorSource = new VectorTileSource({
      tileUrlFunction: function (tileCoord) {
        return JSON.stringify(tileCoord);
      },
      tileLoadFunction: function (tile, url) {
        const tileCoord = JSON.parse(url);
        const data = tileIndex.getTile(
          tileCoord[0],
          tileCoord[1],
          tileCoord[2]
        );
        const geojson = JSON.stringify(
          {
            type: 'FeatureCollection',
            features: data ? data.features : [],
          },
          replacer
        );
        const features = format.readFeatures(geojson, {
          extent: vectorSource.getTileGrid().getTileCoordExtent(tileCoord),
          featureProjection: map.getView().getProjection(),
        });
        tile.setFeatures(features);
      },
    });
    land.setSource(vectorSource);
  });


function flyTo(sreda, done) {
  const zoom = view.getZoom();
  view.animate(
    {
		center: sreda,
		zoom: 6,
		duration: 5000,
    }
  );
}
map.once('rendercomplete', function () {
  flyTo(sreda, function () {});
});



// SEARCH

var select = new Select({
	layers: function () {
        return;
    },
});
map.addInteraction(select);

const searchSource = new VectorSource({
  features: []
});

RomaSource.on("addfeature", function (e) {
  e.feature.set("featureType", "title");
  searchSource.addFeature(e.feature);
});

CordubaSource.on("addfeature", function (e) {
  e.feature.set("featureType", "title");
  searchSource.addFeature(e.feature);
});

ByzantiumSource.on("addfeature", function (e) {
  e.feature.set("featureType", "title");
  searchSource.addFeature(e.feature);
});

LondiniumSource.on("addfeature", function (e) {
  e.feature.set("featureType", "title");
  searchSource.addFeature(e.feature);
});

TheodosiaSource.on("addfeature", function (e) {
  e.feature.set("featureType", "title");
  searchSource.addFeature(e.feature);
});

AntinoopolisSource.on("addfeature", function (e) {
  e.feature.set("featureType", "title");
  searchSource.addFeature(e.feature);
});

DelosSource.on("addfeature", function (e) {
  e.feature.set("featureType", "title");
  searchSource.addFeature(e.feature);
});

PityousSource.on("addfeature", function (e) {
  e.feature.set("featureType", "title");
  searchSource.addFeature(e.feature);
});

ShemakhaSource.on("addfeature", function (e) {
  e.feature.set("featureType", "title");
  searchSource.addFeature(e.feature);
});


var search = new SearchFeature({
	source: searchSource,
    getTitle: function (feature) {
		var searchedTxt = feature.get('title');
		return(searchedTxt);
	},
	getSearchString : function (feature) {
		return feature.get('title')
	},
});
map.addControl (search);


search.on('select', function(e) {
	select.getFeatures().clear();
	select.getFeatures().push (e.search);
	var p = e.search.getGeometry().getFirstCoordinate();
	map.getView().animate({ 
		center: p,
		zoom: 10,
		duration: 2000,
		easing: easeOut,
	});
  });



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



let minimap;
var markers;


var hello = document.getElementById('pusto');
hello.style.visibility = 'visible';

var node = document.getElementById('hopa');
node.style.visibility = 'hidden';


map.on('click', function (evt) {
	let hitt = false;
	const coordinate = evt.coordinate;
	const feature = map.forEachFeatureAtPixel(evt.pixel, function (feature, layer) {
		if ( layer === Roma || layer === Corduba || layer === Byzantium || layer === Londinium || layer === Theodosia || layer === Antinoopolis || layer === Delos || layer === Pityous || layer === Shemakha) {
			hitt = true;
			return feature;
		} else {}
	},
	{
		hitTolerance: 3,
	});
map.addControl(zoomslider);
	
	if (hitt) {

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
		coordsElement.innerHTML = feature.get('latlon').split(',').join(', ');
		var drlink = feature.get('dare');
		var pelink = feature.get('PECS');
		var pllink = feature.get('pleiades');
		var tplink = feature.get('TTPlace');
		var ttlink = feature.get('topostext');
		var vclink = feature.get('vici');
		var wdlink = feature.get('wikidata');
		var wplink = feature.get('wikipedia:en');

		var minicenter = getCenter(feature.getGeometry().getExtent());
		var maplink = coordsElement.innerHTML;
		var lonlat=(transform(minicenter,  'EPSG:3857', 'EPSG:4326'));
		var coordlon=(lonlat['0']).toFixed(6);
		var coordlat=(lonlat['1']).toFixed(6);
		var coo = toStringHDMS(lonlat);

		
		cooElement.innerHTML = coo.split('° ').join('°');

		flagElement.innerHTML = "<img src='/icons/flags/"+countryElement.innerHTML+".png' title='"+countryElement.innerHTML+"' width='17' height='17'>";
		googlelinkElement.innerHTML = "<a href='https://www.google.com/maps/place/"+coo+"' target='_blank' title='Google Maps'>Google Maps</a>";
		OSMlinkElement.innerHTML = "<a href='http://www.openstreetmap.org/index.html?mlat="+coordlat+"&mlon="+coordlon+"&zoom=16' target='_blank' title='OpenStreetMap'>OpenStreetMap</a>";
		wikimapialinkElement.innerHTML = "<a href='http://www.wikimapia.org/#lat="+coordlat+"&lon="+coordlon+"&z=16&l=0&m=w&v=0' target='_blank' title='Wikimapia'>Wikimapia</a>";

		darelinkElement.innerHTML = "<a href='http://imperium.ahlfeldt.se/places/"+drlink+"' target='_blank' title='DARE place'>"+drlink+"</a>";
		pecslinkElement.innerHTML = "<a href='http://www.perseus.tufts.edu/hopper/text?doc=Perseus:text:1999.04.0006:entry="+pelink+"' target='_blank' title='Pleiades place'>"+pelink+"</a>";
		pleiadeslinkElement.innerHTML = "<a href='https://pleiades.stoa.org/places/"+pllink+"' target='_blank' title='Pleiades place'>"+pllink+"</a>";
		tpplacelinkElement.innerHTML = "<a href='https://www.cambridge.org/us/talbert/talbertdatabase/TPPlace"+tplink+".html' target='_blank' title='TPPlace place'>"+tplink+"</a>";
		topostextlinkElement.innerHTML = "<a href='https://topostext.org/place/"+ttlink+"' target='_blank' title='ToposText place'>"+ttlink+"</a>";
		vicilinkElement.innerHTML = "<a href='https://vici.org/vici/"+vclink+"' target='_blank' title='Vici place'>"+vclink+"</a>";
		wikidatalinkElement.innerHTML = "<a href='https://www.wikidata.org/wiki/Q"+wdlink+"' target='_blank' title='Wikidata ID'>"+wdlink+"</a>";
		wikipedialinkElement.innerHTML = "<a href='https://en.wikipedia.org/wiki/"+wplink+"' target='_blank' title='Wikipedia:en'>"+wplink+"</a>";
		
		
		
		if (markers) {
			map.removeLayer(markers)
		}

		markers = new VectorLayer({
			source: new VectorSource(),
			style: new Style({
				image: new Icon({
					anchor: [0.5, 0.5],
					src: './icons/target.png'
				})
			})
		});
		
		map.addLayer(markers);
    
		var marker = new Feature(new Point(minicenter));
		markers.getSource().addFeature(marker);



		const format1 = new GeoJSON();
		const vectorSource1 = new VectorSource();
		const centerpoint = new VectorLayer({
			source: vectorSource1,
			style: new Style ({
				image:  new Icon({
					anchor: [0.5, 0.5],
					anchorXUnits: 'fraction',
					anchorYUnits: 'pixels',
					src: './icons/target.png',
				})
			})
		});

		function loadFromUrl (url) {
			fetch(url).then(function (response) {
				response.json().then(function (result) {
					vectorSource1.addFeatures(
						format1.readFeatures (result, {
							dataProjection: 'EPSG:4326',
							featureProjection: map.getView().getProjection(),
						}
						)
					)
				}
				)
			});
		};

		loadFromUrl('./data/cities/1roma.geojson');
		loadFromUrl('./data/cities/2corduba.geojson');
		loadFromUrl('./data/cities/3byzantium.geojson');
		loadFromUrl('./data/cities/4londinium.geojson');
		loadFromUrl('./data/cities/5theodosia.geojson');
		loadFromUrl('./data/cities/6antinoopolis.geojson');
		loadFromUrl('./data/cities/7delos.geojson');
		loadFromUrl('./data/cities/8pityous.geojson');
		loadFromUrl('./data/cities/9shemakha.geojson');
	
		
		const view = new View({
            projection: 'EPSG:3857',
            center: minicenter,
            zoom: 15,
			minZoom: 13.9999,
			maxZoom: 18,
		});
		

		if (!minimap) {
            minimap = new Map({
                	target: 'minimap',
					layers: [
						new TileLayer({
							source: new XYZ({
								attributions:
								'Tiles © <a href="https://services.arcgisonline.com/ArcGIS/' +
								'rest/services/World_Imagery/MapServer">ArcGIS</a>',
								url: 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}.png'
							}),
						}),
						centerpoint,
					],
            });
        }
		minimap.setView(view);
		


	new ClipboardJS('.btn');


		
	} else {
		hello.style.visibility = 'visible';
		node.style.visibility = 'hidden';
		map.removeLayer(markers);
    }
	if (!feature) {
		return;
	}


});



map.on('click', function (ev) {
	const feature = map.forEachFeatureAtPixel(ev.pixel, function (feature, layer) {
		if ( layer == Roma || layer == Corduba || layer == Byzantium || layer == Londinium || layer == Theodosia || layer == Antinoopolis || layer == Delos || layer == Pityous || layer == Shemakha) {
			document.getElementById("workOpen").click();
		} else {}
	},
	{
		hitTolerance: 3,
	});
});

map.on('pointermove', function(e) {
  if (e.dragging) return;

  var pixel = map.getEventPixel(e.originalEvent);
  var hit = false;
  map.forEachFeatureAtPixel(pixel, function(feature, layer) {
    if ( layer == Roma || layer == Corduba || layer == Byzantium || layer == Londinium || layer == Theodosia || layer == Antinoopolis || layer == Delos || layer == Pityous || layer == Shemakha) {
		  hit = true;
    } else {
		map.getTargetElement().style.cursor = '';
	}
  },
	{
		hitTolerance: 3,
	});

map.getTarget().style.cursor = hit ? 'pointer' : '';
});



//Copyright 2005-present, OpenLayers Contributors All rights reserved.
//Copyright 2016-2021, Jean-Marc Viglino, IGN-France All rights reserved.
//Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
//1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
//2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
//3. Neither the name of the copyright holder nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
//THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS “AS IS” AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.