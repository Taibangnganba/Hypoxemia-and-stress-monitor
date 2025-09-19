#include <WiFi.h>
#include <Firebase_ESP_Client.h>
#include <Wire.h>
#include "MAX30105.h"
#include "spo2_algorithm.h"
#include "heartRate.h"
#include <time.h>

// ---------------- WiFi ----------------
const char* ssid = "EIGHTFOURTWOONE";    
const char* password = "H@ppy123"; 

// ---------------- Firebase ----------------
#define API_KEY "AIzaSyAJ2tFrdAT2fFhShvVoPixYK2PaCtN0M2c"
#define DATABASE_URL "https://hypoxemia-and-stress-monitor-default-rtdb.asia-southeast1.firebasedatabase.app"

// 🔹 Firebase Authentication
#define USER_EMAIL    "kambamtaibangnganba@gmail.com"
#define USER_PASSWORD "H@ppy123"

FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;

// ---------------- MAX30102 ----------------
MAX30105 sensor;
#define BUFFER_LENGTH 100
uint32_t irBuffer[BUFFER_LENGTH];
uint32_t redBuffer[BUFFER_LENGTH];

int32_t spo2;
int8_t validSPO2;
int32_t heartRate;
int8_t validHeartRate;

float perfusionIndex = 0.0;
int respirationRate = 0;

// ---------------- Counter ----------------
int dataCounter = 0;

// ---------------- Time (NTP) ----------------
const char* ntpServer = "pool.ntp.org";
const long gmtOffset_sec = 19800;  // India GMT+5:30
const int daylightOffset_sec = 0;

// ---------------- Helpers ----------------
String getDate() {
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) return "1970-01-01";
  char buffer[11];
  strftime(buffer, sizeof(buffer), "%Y-%m-%d", &timeinfo);
  return String(buffer);
}

String getTime() {
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) return "00:00:00";
  char buffer[9];
  strftime(buffer, sizeof(buffer), "%H:%M:%S", &timeinfo);
  return String(buffer);
}

// Estimate respiration rate from HRV (very simple demo)
int estimateRR(int32_t hr) {
  if (hr > 0) {
    return (int)(hr / 4.5);  // rough mapping, refine with PPG analysis
  }
  return 0;
}

void setup() {
  Serial.begin(115200);
  Wire.begin(8, 9);

  // WiFi
  WiFi.begin(ssid, password);
  Serial.print("Connecting to WiFi..");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected");

  // NTP
  configTime(gmtOffset_sec, daylightOffset_sec, ntpServer);

  // MAX30102
  if (!sensor.begin(Wire, I2C_SPEED_FAST)) {
    Serial.println("MAX30102 not found. Check wiring!");
    while (1);
  }
  sensor.setup(); // Default config
  sensor.setPulseAmplitudeRed(0x0A);
  sensor.setPulseAmplitudeIR(0x0A);
  sensor.setPulseAmplitudeGreen(0);

  // Firebase
  config.api_key = API_KEY;
  config.database_url = DATABASE_URL;

  auth.user.email = USER_EMAIL;
  auth.user.password = USER_PASSWORD;

  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);

  // 🔹 Get last counter from Firebase (if exists)
  if (Firebase.RTDB.getInt(&fbdo, "/SensorDataCounter")) {
    dataCounter = fbdo.intData();
    Serial.printf("Resuming counter from Firebase: %d\n", dataCounter);
  } else {
    Serial.println("No counter found, starting from 0");
    dataCounter = 0;
  }
}

void loop() {
  // Collect samples
  for (byte i = 0; i < BUFFER_LENGTH; i++) {
    while (!sensor.available()) sensor.check();
    redBuffer[i] = sensor.getRed();
    irBuffer[i] = sensor.getIR();
    sensor.nextSample();
  }

  // Calculate HR + SpO2
  maxim_heart_rate_and_oxygen_saturation(irBuffer, BUFFER_LENGTH,
                                         redBuffer,
                                         &spo2, &validSPO2,
                                         &heartRate, &validHeartRate);

  if (spo2 < 0 || validSPO2 == 0) spo2 = 0;
  if (heartRate < 0 || validHeartRate == 0) heartRate = 0;

  // Estimate PI (rough: ratio of IR and Red AC/DC components)
  perfusionIndex = (float)redBuffer[BUFFER_LENGTH - 1] / (float)irBuffer[BUFFER_LENGTH - 1];
  if (perfusionIndex < 0) perfusionIndex = 0;

  // Estimate RR
  respirationRate = estimateRR(heartRate);

  // Timestamp
  String date = getDate();
  String time = getTime();

  // Print
  Serial.printf("[%d] %s %s | SpO2: %d | HR: %d | PI: %.2f | RR: %d\n",
                dataCounter, date.c_str(), time.c_str(), spo2, heartRate, perfusionIndex, respirationRate);

  // Push to Firebase
  if (Firebase.ready()) {
    FirebaseJson json;
    json.add("date", date);
    json.add("time", time);
    json.add("saturation", spo2);
    json.add("pi", perfusionIndex);
    json.add("dev60_HR", heartRate);
    json.add("RR", respirationRate);

    // 🔹 Store under /SensorData/[counter]
    String path = "/SensorData/" + String(dataCounter);

    if (Firebase.RTDB.setJSON(&fbdo, path, &json)) {
      Serial.printf("Data %d sent to Firebase\n", dataCounter);

      // 🔹 Update counter
      dataCounter++;
      Firebase.RTDB.setInt(&fbdo, "/SensorDataCounter", dataCounter);

    } else {
      Serial.print("Firebase send failed: ");
      Serial.println(fbdo.errorReason());
    }
  }

  delay(2000);  // send every 2 sec
}
