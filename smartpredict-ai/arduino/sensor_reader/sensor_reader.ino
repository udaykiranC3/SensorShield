// Three DHT22 sensors (M001 pin 2, M002 pin 3, M003 pin 4). One JSON line per sensor every 5 s.
// Close the Serial Monitor before running bridge.js
#include <DHT.h>
#define DHTTYPE DHT22   // change to DHT11 if that's your sensor
DHT dht[3] = { DHT(2, DHTTYPE), DHT(3, DHTTYPE), DHT(4, DHTTYPE) };

void setup() {
  Serial.begin(9600);
  for (int i = 0; i < 3; i++) dht[i].begin();
}

void loop() {
  for (int i = 0; i < 3; i++) {
    float t = dht[i].readTemperature();
    float h = dht[i].readHumidity();
    if (!isnan(t) && !isnan(h)) {
      Serial.print("{\"machine_id\":\"M00"); Serial.print(i + 1);
      Serial.print("\",\"temperature\":"); Serial.print(t, 1);
      Serial.print(",\"humidity\":"); Serial.print(h, 1);
      Serial.println("}");
    }
  }
  delay(5000);
}
