const https = require('https');
const { BlobServiceClient } = require('@azure/storage-blob');

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: d }));
    }).on('error', reject);
  });
}

module.exports = async function (context, req) {
  const city = (req.query.city || 'Abha');
  try {
    // Source 1: live data from OpenWeatherMap
    const w = await get('https://api.openweathermap.org/data/2.5/weather?q=' +
      encodeURIComponent(city) + '&appid=' + process.env.OPENWEATHER_API_KEY + '&units=metric');
    if (w.status !== 200) throw new Error('OpenWeatherMap error ' + w.status);
    const weather = JSON.parse(w.body);
    const liveTemp = weather.main.temp;

    // Source 2: Kaggle CSV from Blob Storage
    const blob = BlobServiceClient.fromConnectionString(process.env.STORAGE_CONNECTION_STRING)
      .getContainerClient('climate-data').getBlobClient('climate.csv');
    const text = (await blob.downloadToBuffer()).toString('utf-8').replace(/^\uFEFF/, '');
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    const header = lines[0].split(',').map(h => h.trim());
    const iDt = header.indexOf('dt'), iT = header.indexOf('AverageTemperature'), iC = header.indexOf('City');
    const rows = lines.slice(1).map(l => l.split(',')).filter(c => c[iT] && c[iT].trim() &&
      ['abha', city.toLowerCase()].includes((c[iC] || '').trim().toLowerCase()));
    if (!rows.length) { context.res = { status: 404, body: { error: 'No historical data for ' + city } }; return; }
    const temps = rows.map(c => parseFloat(c[iT]));
    const avg = temps.reduce((a, b) => a + b, 0) / temps.length;

    context.res = {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: {
        service: 'GreenTech Analytics Climate Processor',
        cloud_provider: 'Azure Functions',
        live: { city, temperature_c: liveTemp, humidity_pct: weather.main.humidity },
        historical: { records_used: temps.length, first_date: rows[0][iDt],
          latest_date: rows[rows.length - 1][iDt], avg_temperature_c: Math.round(avg * 100) / 100 },
        temperature_deviation_c: Math.round((liveTemp - avg) * 100) / 100
      }
    };
  } catch (e) {
    context.res = { status: 500, body: { error: e.message } };
  }
};
