const express = require('express');
const cors = require('cors');
const fs = require('fs/promises');
const path = require('path');
const { transformData, filterByTimeRange } = require('./dist/data-processor');

const app = express();
const PORT = 9000;
const CORS_PORT = 5175;
const DATA_PATH = '../data/beeldbank_50000.json';

app.use(cors({ origin: `http://localhost:${CORS_PORT.toString()}` }));

let transformedData = null;

async function loadData() {
  const rawData = JSON.parse(
    await fs.readFile(path.join(__dirname, DATA_PATH), 'utf8')
  );
  transformedData = transformData(rawData);
  console.log(`File ${DATA_PATH} loaded and transformed`);
}

app.get('/api/images', (req, res) => {
  const { count = 10, startDate, endDate } = req.query;
  const limit = parseInt(count);
  
  const filteredData = filterByTimeRange(
    transformedData,
    startDate,
    endDate
  ).slice(0, limit);
  
  res.json(filteredData);
});

loadData().then(() => 
  app.listen(PORT, () => console.log(`Running on ${PORT}`))
);
