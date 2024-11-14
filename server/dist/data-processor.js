"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.filterByTimeRange = exports.transformData = exports.isPoint = exports.isMultiLineString = exports.isPolygonZ = void 0;
const isPolygonZ = (geom) => {
    var _a;
    return (_a = geom === null || geom === void 0 ? void 0 : geom.startsWith('POLYGON Z')) !== null && _a !== void 0 ? _a : false;
};
exports.isPolygonZ = isPolygonZ;
const isMultiLineString = (geom) => {
    var _a;
    return (_a = geom === null || geom === void 0 ? void 0 : geom.startsWith('MULTILINESTRING')) !== null && _a !== void 0 ? _a : false;
};
exports.isMultiLineString = isMultiLineString;
const isPoint = (geom) => {
    var _a;
    return (_a = geom === null || geom === void 0 ? void 0 : geom.startsWith('POINT')) !== null && _a !== void 0 ? _a : false;
};
exports.isPoint = isPoint;
const calculatePolygonCentroid = (geom) => {
    try {
        const coordinates = geom
            .replace('POLYGON Z ((', '')
            .replace('))', '')
            .split(',')
            .map(coord => coord.trim().split(' ').map(Number));
        const x = coordinates.reduce((sum, coord) => sum + coord[0], 0) / coordinates.length;
        const y = coordinates.reduce((sum, coord) => sum + coord[1], 0) / coordinates.length;
        return { x, y };
    }
    catch (error) {
        console.error('Error calculating polygon centroid:', error);
        return { x: 0, y: 0 };
    }
};
const calculateMultiLineCentroid = (geom) => {
    try {
        const coords = geom
            .replace('MULTILINESTRING((', '')
            .replace('))', '')
            .split('),(')
            .flatMap(line => line.split(',').map(coord => coord.trim().split(' ').map(Number)));
        const x = coords.reduce((sum, coord) => sum + coord[0], 0) / coords.length;
        const y = coords.reduce((sum, coord) => sum + coord[1], 0) / coords.length;
        return { x, y };
    }
    catch (error) {
        console.error('Error calculating multiline centroid:', error);
        return { x: 0, y: 0 };
    }
};
const transformData = (data) => {
    if (!data)
        return [];
    return Object.entries(data).map(([id, item]) => {
        var _a, _b, _c, _d, _e, _f;
        if (!item || typeof item !== 'object') {
            console.error(`Invalid item for id ${id}`);
            return null;
        }
        const transformed = {
            id,
            url: (_a = item.url) !== null && _a !== void 0 ? _a : '',
            title: (_b = item.title) !== null && _b !== void 0 ? _b : '',
            start_date: (_c = item.start_date) !== null && _c !== void 0 ? _c : '',
            end_date: (_d = item.end_date) !== null && _d !== void 0 ? _d : '',
            thumb: (_e = item.thumb) !== null && _e !== void 0 ? _e : '',
            geom: (_f = item.geom) !== null && _f !== void 0 ? _f : ''
        };
        if ((0, exports.isPolygonZ)(item.geom)) {
            transformed.centroid = calculatePolygonCentroid(item.geom);
        }
        else if ((0, exports.isMultiLineString)(item.geom)) {
            transformed.centroid = calculateMultiLineCentroid(item.geom);
        }
        return transformed;
    }).filter(Boolean);
};
exports.transformData = transformData;
const filterByTimeRange = (data, startDate, endDate) => {
    if (!data || !Array.isArray(data))
        return [];
    if (!startDate && !endDate)
        return data;
    return data.filter(item => {
        try {
            const itemStart = new Date(item.start_date);
            const itemEnd = new Date(item.end_date);
            const filterStart = startDate ? new Date(startDate) : new Date(0);
            const filterEnd = endDate ? new Date(endDate) : new Date();
            return itemStart >= filterStart && itemEnd <= filterEnd;
        }
        catch (error) {
            console.error('Error filtering date range:', error);
            return false;
        }
    });
};
exports.filterByTimeRange = filterByTimeRange;
