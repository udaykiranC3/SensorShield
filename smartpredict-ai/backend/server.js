const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const axios = require('axios');

const MONGO = process.env.MONGO_URL || 'mongodb://127.0.0.1:27017/smartpredict';
let useDb = false, mem = [];

const Reading = mongoose.model('Reading', new mongoose.Schema({
  machine_id: String, temperature: Number, humidity: Number,
  machine_status: String, anomaly_flag: Boolean, failure_probability: Number,
  ts: { type: Date, default: Date.now }
}));

// ---- storage: MongoDB if available, otherwise memory ----
async function save(d) {
  if (useDb) return (await Reading.create(d)).toObject();
  d.ts = d.ts || new Date(); mem.push(d); if (mem.length > 5000) mem.shift(); return d;
}
async function list(since) {
  if (useDb) return Reading.find(since ? { ts: { $gt: since } } : {}).sort({ ts: -1 }).limit(500).lean();
  return mem.filter(r => !since || r.ts > since).slice(-500).reverse();
}
const valid = ({ machine_id, temperature, humidity }) =>
  machine_id && typeof temperature === 'number' && typeof humidity === 'number' &&
  temperature >= -20 && temperature <= 100 && humidity >= 0 && humidity <= 100;

// ---- sample readings generator (simulated, NOT real sensor data) ----
const BASE = { M001: [78, 55], M002: [78.6, 55], M003: [78.2, 55] };
const FAULTS = {};
const fv = (id, ts, k) => (FAULTS[id] && ts >= (FAULTS[id].from || 0) && ts < FAULTS[id].until ? FAULTS[id][k] : 0);
function sample(id, ts) {
  const [bt, bh] = BASE[id], spike = Math.random() < 0.04;
  return {
    machine_id: id, ts: new Date(ts),
    temperature: +(bt + 3 * Math.sin(ts / 20000) + (Math.random() - .5) * 3 + (spike ? 24 : 0) + fv(id, ts, 'dt')).toFixed(1),
    humidity: +(bh + 4 * Math.sin(ts / 25000 + 1) + (Math.random() - .5) * 4 + (spike ? 8 : 0) + fv(id, ts, 'dh')).toFixed(1)
  };
}
// node server.js --sim        -> samples for M001-M003
// node server.js --sim-extra  -> samples for M002-M003 (use when real M001 is on the Arduino)
const args = process.argv;
const SIM = args.includes('--sim') ? ['M001', 'M002', 'M003']
          : args.includes('--sim-extra') ? ['M002', 'M003'] : [];

// ---- API ----
const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => res.send('SmartPredict API is running. Try /api/readings'));
app.get('/api/health', (req, res) => res.json({ ok: true, storage: useDb ? 'mongodb' : 'memory', simulating: SIM }));

// Inject a sample fault into a simulated sensor: POST {machine_id, dt, dh, seconds}
app.post('/api/sim/fault', (req, res) => {
  const { machine_id, dt = 0, dh = 0, seconds = 60 } = req.body || {};
  if (!SIM.includes(machine_id)) return res.status(409).json({ error: 'Not a simulated sensor (start with --sim)' });
  FAULTS[machine_id] = { dt: +dt, dh: +dh, until: Date.now() + seconds * 1000 };
  res.json({ ok: true, until: FAULTS[machine_id].until });
});

app.post('/api/readings', async (req, res) => {
  if (!valid(req.body)) return res.status(400).json({ error: 'Invalid reading' });
  const { machine_id, temperature, humidity } = req.body;
  let ml = {};
  try { ml = (await axios.post('http://localhost:8000/predict', { temperature, humidity }, { timeout: 2000 })).data; } catch (e) {}
  res.status(201).json(await save({ machine_id, temperature, humidity, ...ml }));
});

app.get('/api/readings', async (req, res) => {
  const s = req.query.since ? new Date(req.query.since) : null;
  res.json(await list(s && !isNaN(s) ? s : null));
});

app.post('/api/predict', async (req, res) => {
  try { res.json((await axios.post('http://localhost:8000/predict', req.body, { timeout: 3000 })).data); }
  catch (e) { res.status(502).json({ error: 'Model service unavailable' }); }
});

// ---- start ----
(async () => {
  try { await mongoose.connect(MONGO, { serverSelectionTimeoutMS: 2500 }); useDb = true; console.log('Storage: MongoDB'); }
  catch (e) { console.log('MongoDB not available -> storage: memory (data is lost on restart)'); }

  if (SIM.length) {
    const now = Date.now();
    if (SIM.includes('M003')) FAULTS.M003 = { dt: 26, dh: 0, from: now - 47 * 5000, until: now - 40 * 5000 };   // sample fault in history
    if (SIM.includes('M002')) FAULTS.M002 = { dt: 0, dh: 16, from: now - 28 * 5000, until: now - 22 * 5000 };
    for (let j = 60; j > 0; j--) for (const id of SIM) await save(sample(id, now - j * 5000));
    setInterval(() => SIM.forEach(id => save(sample(id, Date.now()))), 5000);
    console.log('Sample readings ON for', SIM.join(', '));
  }
  app.listen(5000, () => console.log('API running on http://localhost:5000'));
})();
