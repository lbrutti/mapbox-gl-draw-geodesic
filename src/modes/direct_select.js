import * as Constants from '../constants';
import { isCircle, getCircleCenter } from '../utils/circle_geojson';
import { distance, bearing } from '../utils/geodesy';
import createGeodesicGeojson from '../utils/create_geodesic_geojson';

function patchDirectSelect(DirectSelect) {
    const DirectSelectPatched = { ...DirectSelect };



    //overwrite to disable draw moving.
    DirectSelectPatched.onDrag = (state, e, delta) => {
        const geojson = state.feature.toGeoJSON();

        if (isCircle(geojson)) {
            if (state.selectedCoordPaths[0] === '0.1') {
                if (state.canDragMove !== true) return;
                state.dragMoving = true;
                e.originalEvent.stopPropagation();

                const delta = {
                    lng: e.lngLat.lng - state.dragMoveLocation.lng,
                    lat: e.lngLat.lat - state.dragMoveLocation.lat
                };
                DirectSelectPatched.dragVertex.call(this, state, e, delta);


                state.dragMoveLocation = e.lngLat;
            }

        }


    };
    DirectSelectPatched.dragVertex = function (state, e, delta) {
        const geojson = state.feature.toGeoJSON();

        if (isCircle(geojson)) {
            if (state.selectedCoordPaths[0] === '0.1') {
                const center = getCircleCenter(geojson);
                const handle = [e.lngLat.lng, e.lngLat.lat];
                const radius = distance(center, handle);
                const handleBearing = bearing(center, handle);
                state.feature.properties[Constants.properties.CIRCLE_RADIUS] = radius;
                state.feature.properties[Constants.properties.CIRCLE_HANDLE] = handle;

                state.feature[Constants.properties.CIRCLE_HANDLE_BEARING] = handleBearing;
                state.feature.changed();
            } else {
                DirectSelect.dragFeature.call(this, state, e, delta);
            }
        } else {
            DirectSelect.dragVertex.call(this, state, e, delta);
        }
    };

    DirectSelectPatched.toDisplayFeatures = function (state, geojson, display) {
        const displayGeodesic = (geojson) => {
            const geodesicGeojson = createGeodesicGeojson(geojson, { ctx: this._ctx, selectedPaths: state.selectedCoordPaths });
            geodesicGeojson.forEach(display);
        };

        DirectSelect.toDisplayFeatures.call(this, state, geojson, displayGeodesic);
    };

    return DirectSelectPatched;
}

export default patchDirectSelect;