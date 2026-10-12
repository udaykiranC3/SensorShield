# Sensor Shield

Three DHT22 sensors (M001 pin 2, M002 pin 3, M003 pin 4) -> Arduino -> laptop -> dashboard. Every 5 s the dashboard recomputes averages, min/max, anomalies, ML risk, a 1-minute forecast and maintenance status.

## Quick start (no server needed)
1. Wire the sensors (VCC->5V, DATA->pin 2/3/4 with 10k pull-up to VCC, GND->GND). Install the Adafruit "DHT sensor library", upload `arduino/sensor_reader/sensor_reader.ino`.
2. Close the Arduino Serial Monitor (only one program can use the port).
3. Open `dashboard/smartpredict-ai.html` in Chrome or Edge on the laptop. Click **Connect Arduino**, pick the port. Simulated data is removed and live readings appear within 5 s.

## Optional: backend (database, other apps)
`cd backend && npm install`, then `npm start` (real data) or `npm run sim` (simulated M001-M003), and `node bridge.js COM3` to forward Arduino readings. The dashboard polls http://localhost:5000/api/readings (click the header badge to change the URL).

## Notes
- Fault rule (from your SensorShield script): a sensor is ABNORMAL when it deviates more than 25 % from the median of the 3 sensors. Tolerances and thresholds are editable in the dashboard.
- ML risk: Isolation Forest trained on `ml/dataset.csv` (`ml/train_model.py`), shown as a percentile risk score. Readings outside 35.55-121.94 C or 30-80 % are flagged 'out of trained range'.
- Sample faults can be injected on the Sensor Shield page when data is simulated.
