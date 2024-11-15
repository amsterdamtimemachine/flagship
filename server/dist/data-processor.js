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
const parsePolygon = (geom) => {
    try {
        return geom
            .replace('POLYGON Z ((', '')
            .replace('))', '')
            .split(',')
            .map(coord => {
            const [x, y] = coord.trim().split(' ').map(Number);
            return { x, y };
        });
    }
    catch (error) {
        console.error('Error parsing polygon:', error);
        return [];
    }
};
const parseMultiLineString = (geom) => {
    try {
        return geom
            .replace('MULTILINESTRING((', '')
            .replace('))', '')
            .split('),(')
            .flatMap(line => line.split(',').map(coord => {
            const [x, y] = coord.trim().split(' ').map(Number);
            return { x, y };
        }));
    }
    catch (error) {
        console.error('Error parsing multilinestring:', error);
        return [];
    }
};
const parsePoint = (geom) => {
    try {
        const [x, y] = geom
            .replace('POINT(', '')
            .replace(')', '')
            .split(' ')
            .map(Number);
        return [{ x, y }];
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
const transformData = (data) => {
    const transformed = Object.entries(data)
        .map(([id, item]) => {
        var _a, _b, _c, _d, _e;
        if (!item || typeof item !== 'object') {
            console.warn(`Invalid item for id ${id}`);
            return null;
        }
        let points = [];
        let geomType = 'unknown';
        if (item.geom) {
            if ((0, exports.isPolygonZ)(item.geom)) {
                points = parsePolygon(item.geom);
                geomType = 'polygon';
            }
            else if ((0, exports.isMultiLineString)(item.geom)) {
                points = parseMultiLineString(item.geom);
                geomType = 'multiline';
            }
            else if ((0, exports.isPoint)(item.geom)) {
                points = parsePoint(item.geom);
                geomType = 'point';
            }
        }
        const geoData = {
            id,
            url: (_a = item.url) !== null && _a !== void 0 ? _a : '',
            title: (_b = item.title) !== null && _b !== void 0 ? _b : '',
            start_date: (_c = item.start_date) !== null && _c !== void 0 ? _c : '',
            end_date: (_d = item.end_date) !== null && _d !== void 0 ? _d : '',
            thumb: (_e = item.thumb) !== null && _e !== void 0 ? _e : '',
            geom: points,
            geomType
        };
        let centroid;
        if (geomType === 'point') {
            centroid = points[0];
        }
        else if (points.length) {
            centroid = calculateCentroid(points);
        }
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
