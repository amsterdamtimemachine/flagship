"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const dataProcessor_1 = require("./dataProcessor");
const gridManager_1 = require("./gridManager");
const app = (0, express_1.default)();
const PORT = 9000;
const CORS_PORT = 5175;
const DATA_PATH = '../../data/beeldbank_50000.json';
const GRID_CONFIG = {
    width_n: 1500,
    height_n: 1500,
    boundA: [4.73, 52.7],
    boundB: [5.3, 51.9]
};
app.use((0, cors_1.default)({ origin: `http://localhost:${CORS_PORT.toString()}` }));
let transformedData = [];
let gridManager = null;
function loadData() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const rawData = JSON.parse(yield promises_1.default.readFile(path_1.default.join(__dirname, DATA_PATH), 'utf8'));
            transformedData = (0, dataProcessor_1.transformData)(rawData, true);
            gridManager = new gridManager_1.GridManager(GRID_CONFIG);
            gridManager.processData(transformedData);
            console.log("transformed: ", transformedData.length);
            console.log(`File ${DATA_PATH} loaded and transformed`);
        }
        catch (error) {
            console.error('Error loading data:', error);
            process.exit(1);
        }
    });
}
app.get('/api/heatmap', (req, res) => {
    try {
        if (!gridManager) {
            throw new Error('Server not initialized');
        }
        const { startDate, endDate } = req.query;
        const filteredData = startDate || endDate
            ? (0, dataProcessor_1.filterByTimeRange)(transformedData, startDate, endDate)
            : transformedData;
        gridManager.processData(filteredData);
        res.json({
            cells: gridManager.getHeatmapData(),
            bounds: {
                boundA: GRID_CONFIG.boundA,
                boundB: GRID_CONFIG.boundB
            },
            dimensions: {
                width: GRID_CONFIG.width_n,
                height: GRID_CONFIG.height_n
            }
        });
    }
    catch (error) {
        console.error('Error processing heatmap request:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
app.get('/api/cell/:cellId', (req, res) => {
    try {
        if (!gridManager) {
            throw new Error('Server not initialized');
        }
        const { cellId } = req.params;
        const { startDate, endDate } = req.query;
        const filteredData = startDate || endDate // WIP! 
            ? (0, dataProcessor_1.filterByTimeRange)(transformedData, startDate, endDate)
            : transformedData;
        const cellData = gridManager.getCellEntities(cellId, transformedData);
        res.json({ cellData });
    }
    catch (error) {
        console.error('Error processing cell request:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
loadData()
    .then(() => {
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
        console.log(`CORS enabled for localhost:${CORS_PORT}`);
    });
})
    .catch(error => {
    console.error('Failed to start server:', error);
    process.exit(1);
});
process.on('uncaughtException', error => {
    console.error('Uncaught Exception:', error);
    process.exit(1);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});
