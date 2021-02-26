import createVertex from '@mapbox/mapbox-gl-draw/src/lib/create_vertex';
import * as Constants from '../constants';
import { isCircle, getCircleCenter, getCircleRadius } from './circle_geojson';
import createGeodesicLine from './create_geodesic_line';
import createGeodesicCircle from './create_geodesic_circle';
import { midpoint, destinationPoint } from './geodesy';

const STEPS = 32;
const HANDLE_BEARING = 45;

function getCoordinate(coordinates, path) {
  const ids = path.split('.').map(x => parseInt(x, 10));
  const coordinate = ids.reduce((coordinates, id) => coordinates[id], coordinates);
  return JSON.parse(JSON.stringify(coordinate));
}

function createGeodesicGeojson(geojson, options) {
  options = { steps: STEPS, ...options };

  const properties = geojson.properties;
  const type = geojson.geometry.type;
  const coordinates = geojson.geometry.coordinates;

  const featureId = properties.parent || properties.id;
  const feature = options.ctx.store.get(featureId);
  const featureGeojson = feature.toGeoJSON();

  if (type === Constants.geojsonTypes.POINT) {
    if ((properties.meta === Constants.meta.VERTEX || properties.meta === Constants.meta.MIDPOINT) && isCircle(featureGeojson)) {
      return []; // hide circle points, they are displayed in processCircle instead
    } else if (properties.meta === Constants.meta.MIDPOINT) {
      return processMidpoint(); // calculate geodesic midpoint
    } else {
      return [geojson]; // pass point as is
    }
  } else if (type === Constants.geojsonTypes.LINE_STRING) {
    return processLine(); // calculate geodesic line
  } else if (type === Constants.geojsonTypes.POLYGON) {
    if (isCircle(featureGeojson)) {
      return processCircle(); // calculate geodesic circle
    } else {
      return processPolygon(); // calculate geodesic polygon
    }
  } else /* istanbul ignore else */ if (type.indexOf(Constants.geojsonTypes.MULTI_PREFIX) === 0) {
    return processMultiGeometry(); 
  }

  function isSelectedPath(path) {
    if (!options.selectedPaths) {
      return false;
    }
    return options.selectedPaths.indexOf(path) !== -1;
  }

  function processMidpoint() {
    const coordPath = properties.coord_path;

    // subtract 1 from the last coord path id
    const coordPathIds = coordPath.split('.').map(x => parseInt(x, 10));
    const startCoordPath = coordPathIds.map((x, i) => x + (i === coordPathIds.length - 1 ? -1 : 0)).join('.');
    const endCoordPath = coordPath;

    const startCoord = getCoordinate(featureGeojson.geometry.coordinates, startCoordPath);
    const endCoord = getCoordinate(featureGeojson.geometry.coordinates, endCoordPath);
    const midCoord = midpoint(startCoord, endCoord);

    const geodesicGeojson = {
      ...geojson,
      properties: {
        ...properties,
        lng: midCoord[0],
        lat: midCoord[1]
      },
      geometry: {
        ...geojson.geometry,
        coordinates: midCoord
      },
    };
    return [geodesicGeojson];
  }

  function processLine() {
    const geodesicCoordinates = createGeodesicLine(coordinates, options.steps);
    const geodesicGeojson = {
      ...geojson,
      geometry: {
        ...geojson.geometry,
        coordinates: geodesicCoordinates
      }
    };
    return [geodesicGeojson];
  }

  function processPolygon() {
    const geodesicCoordinates = coordinates.map((subCoordinates) => {
      return createGeodesicLine(subCoordinates);
    });
    const geodesicGeojson = {
      ...geojson,
      geometry: {
        ...geojson.geometry,
        coordinates: geodesicCoordinates
      }
    };
    return [geodesicGeojson];
  }

  function processCircle() {
    const center = getCircleCenter(featureGeojson);
    const radius = getCircleRadius(featureGeojson);
    const handleBearing = feature[Constants.properties.CIRCLE_HANDLE_BEARING] || HANDLE_BEARING;
    const geodesicCoordinates = createGeodesicCircle(center, radius, handleBearing, options.steps * 4);
    const geodesicGeojson = {
      ...geojson,
      geometry: {
        ...geojson.geometry,
        coordinates: [geodesicCoordinates]
      }
    };

    // circle handles
    if (properties.active === Constants.activeStates.ACTIVE) {
      const handle = destinationPoint(center, radius, handleBearing);
      const points = [center, handle];
      const vertices = points.map((point, i) => {
        return createVertex(properties.id, point, `0.${i}`, isSelectedPath(`0.${i}`));
      })
        vertices[1].properties.isHandle = "true";// flag last vertex as handle
      return [geodesicGeojson, ...vertices];
    } else {
      return [geodesicGeojson];
    }
  }

  function processMultiGeometry() {
    const subType = type.replace(Constants.geojsonTypes.MULTI_PREFIX, '');
    const geodesicFeatures = coordinates.map((subCoordinates) => {
      const subFeature = {
        type: Constants.geojsonTypes.FEATURE,
        properties: properties,
        geometry: {
          type: subType,
          coordinates: subCoordinates
        }
      };
      return createGeodesicGeojson(subFeature, options);
    }).flat();
    const geodesicCoordinates = geodesicFeatures.map((subFeature) => {
      return subFeature.geometry.coordinates;
    });
    const geodesicGeojson = {
      ...geojson,
      geometry: {
        ...geojson.geometry,
        coordinates: geodesicCoordinates
      }
    };
    return [geodesicGeojson];
  }
}

export default createGeodesicGeojson;