"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.filterByTimeRange = exports.transformData = exports.isPoint = exports.isMultiLineString = exports.isPolygonZ = void 0;
const isPolygonZ = (geom) => {
    return Boolean(geom === null || geom === void 0 ? void 0 : geom.startsWith('POLYGON Z'));
};
exports.isPolygonZ = isPolygonZ;
const isMultiLineString = (geom) => {
    return Boolean(geom === null || geom === void 0 ? void 0 : geom.startsWith('MULTILINESTRING'));
};
exports.isMultiLineString = isMultiLineString;
const isPoint = (geom) => {
    return Boolean(geom === null || geom === void 0 ? void 0 : geom.startsWith('POINT'));
};
exports.isPoint = isPoint;
const parsePolygon = (geom, dropNullVertices = false) => {
    try {
        const points = geom
            .replace('POLYGON Z ((', '')
            .replace('))', '')
            .split(',')
            .map(coord => {
            // Split and take only x, y coordinates (ignore z if present)
            const [x, y] = coord.trim().split(' ').map(Number);
            if (dropNullVertices) {
                return isNaN(x) || isNaN(y) ? null : { x, y };
            }
            else {
                return { x, y };
            }
        })
            .filter((coord) => coord !== null);
        return points;
    }
    catch (error) {
        console.error('Error parsing polygon:', error);
        return [];
    }
};
const parseMultiLineString = (geom, dropNullVertices) => {
    try {
        const points = geom
            .replace('MULTILINESTRING((', '')
            .replace('))', '')
            .split('),(')
            .flatMap(line => line.split(',').map(coord => {
            const [x, y] = coord.trim().split(' ').map(Number);
            if (dropNullVertices) {
                return isNaN(x) || isNaN(y) ? null : { x, y };
            }
            else {
                return { x, y };
            }
        }).filter((coord) => coord !== null));
        return points;
    }
    catch (error) {
        console.error('Error parsing multilinestring:', error);
        return [];
    }
};
const parsePoint = (geom, dropNullVertex) => {
    try {
        const [x, y] = geom
            .replace('POINT(', '')
            .replace(')', '')
            .split(' ')
            .map(Number);
        if (dropNullVertex) {
            return isNaN(x) || isNaN(y) ? null : [{ x, y }];
        }
        else {
            return [{ x, y }];
        }
    }
    catch (error) {
        console.error('Error parsing point:', error);
        return [];
    }
};
const calculateCentroid = (points) => {
    if (!points.length)
        return undefined;
    try {
        const x = points.reduce((sum, p) => sum + p.x, 0) / points.length;
        const y = points.reduce((sum, p) => sum + p.y, 0) / points.length;
        return { x, y };
    }
    catch (error) {
        console.error('Error calculating centroid:', error);
        return undefined;
    }
};
const processGeometry = (geom, dropNulls) => {
    if ((0, exports.isPolygonZ)(geom)) {
        return null;
        // WIP: ignore polygonZ for now since the data is in wrong coord system in the current data sample
    }
    if ((0, exports.isMultiLineString)(geom)) {
        const multiline = parseMultiLineString(geom, dropNulls);
        return {
            points: dropNulls ? (multiline.length > 0 ? multiline : null) : multiline,
            geomType: 'multiline'
        };
    }
    if ((0, exports.isPoint)(geom)) {
        const pointArray = parsePoint(geom, dropNulls);
        return {
            points: pointArray,
            geomType: 'point'
        };
    }
    return null;
};
const calculateGeometryCentroid = (points, geomType) => {
    if (points.length === 0) {
        return undefined;
    }
    if (geomType === 'point') {
        return points[0];
    }
    return calculateCentroid(points);
};
const transformData = (data, dropNulls) => {
    const transformed = Object.entries(data)
        .map(([id, item]) => {
        var _a, _b, _c, _d, _e;
        if (!item || typeof item !== 'object') {
            console.warn(`Invalid item for id ${id}`);
            return null;
        }
        let points = null;
        let geomType = 'unknown';
        if (item.geom) {
            const result = processGeometry(item.geom, dropNulls);
            if (result) {
                ({ points, geomType } = result);
            }
        }
        if (!points || (dropNulls && points.length === 0)) {
            return null;
        }
        const validPoints = points;
        const geoData = {
            id,
            url: (_a = item.url) !== null && _a !== void 0 ? _a : '',
            title: (_b = item.title) !== null && _b !== void 0 ? _b : '',
            start_date: (_c = item.start_date) !== null && _c !== void 0 ? _c : '',
            end_date: (_d = item.end_date) !== null && _d !== void 0 ? _d : '',
            thumb: (_e = item.thumb) !== null && _e !== void 0 ? _e : '',
            geom: validPoints,
            geomType
        };
        // Add centroid if possible
        const centroid = calculateGeometryCentroid(validPoints, geomType);
        if (centroid) {
            geoData.centroid = centroid;
        }
        return geoData;
    });
    return transformed.filter((item) => item !== null);
};
exports.transformData = transformData;
const filterByTimeRange = (data, startDate, endDate) => {
    if (!startDate && !endDate)
        return data;
    return data.filter(item => {
        const itemStart = new Date(item.start_date);
        const itemEnd = new Date(item.end_date);
        const filterStart = startDate ? new Date(startDate) : new Date(0);
        const filterEnd = endDate ? new Date(endDate) : new Date();
        return itemStart >= filterStart && itemEnd <= filterEnd;
    });
};
exports.filterByTimeRange = filterByTimeRange;
