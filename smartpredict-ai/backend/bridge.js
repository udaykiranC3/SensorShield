// Reads JSON lines from the Arduino over USB and posts them to the API.
// Usage: node bridge.js COM3     (or set SERIAL_PORT; Linux: /dev/ttyUSB0)
const { SerialPort, ReadlineParser } = require('serialport');
const axios = require('axios');

const PATH = process.argv[2] || process.env.SERIAL_PORT || 'COM3';
const API = process.env.API_URL || 'http://localhost:5000/api/readings';

const port = new SerialPort({ path: PATH, baudRate: 9600 });
const parser = port.pipe(new ReadlineParser({ delimiter: '\n' }));
port.on('open', () => console.log('Listening on', PATH));
port.on('error', e => console.error('Serial error:', e.message));

parser.on('data', async line => {
  try {
    const r = await axios.post(API, JSON.parse(line));
    console.log('sent', r.data.temperature, r.data.humidity);
  } catch (e) { console.log('skipped:', line.trim()); }
});
