import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import path from 'path';
import { transformData, filterByTimeRange } from './data-processor';
import { GridManager } from './grid-processor';
import { GridConfig, GeoData } from './types';

const app = express();
const PORT = 9000;
const CORS_PORT = 5175;
const DATA_PATH = '../../data/beeldbank_50000.json'; 
const GRID_CONFIG: GridConfig = {
    width_n: 50,
    height_n: 50,
    boundA: [4.8305961, 52.4329828],  // Amsterdam bounds
    boundB: [4.9411689, 52.2880825]
};

app.use(cors({ origin: `http://localhost:${CORS_PORT.toString()}` }));

let transformedData: GeoData[] = [];
let gridManager: GridManager | null = null;

async function loadData() {
    try {
        const rawData = JSON.parse(
            await fs.readFile(path.join(__dirname, DATA_PATH), 'utf8')
        );
        transformedData = transformData(rawData);
        gridManager = new GridManager(GRID_CONFIG);
        gridManager.processData(transformedData);
        console.log(`File ${DATA_PATH} loaded and transformed`);
    } catch (error) {
        console.error('Error loading data:', error);
        process.exit(1);
    }
}

app.get('/api/heatmap', (req, res) => {
    try {
        if (!gridManager) {
            throw new Error('Server not initialized');
        }

        const { startDate, endDate } = req.query;
        const filteredData = startDate || endDate 
            ? filterByTimeRange(transformedData, startDate as string, endDate as string)
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
    } catch (error) {
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
        
        const filteredData = startDate || endDate 
            ? filterByTimeRange(transformedData, startDate as string, endDate as string)
            : transformedData;
        
        const cellData = gridManager.getCellEntities(cellId, filteredData);
        res.json(cellData);
    } catch (error) {
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
