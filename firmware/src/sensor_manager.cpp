/**
 * sensor_manager.cpp - Sensor reading and management
 * 
 * SCD30: CO2 (ppm), Temperature (C), Humidity (%RH) via I2C
 * BH1750: Light intensity (lux) via I2C
 * Capacitive sensor: Soil moisture (%) via analog
 */

#include "sensor_manager.h"
#include "config.h"
#include <Wire.h>
#include <SparkFun_SCD30_Arduino_Library.h>
#include <BH1750.h>

static SCD30 scd30;
static BH1750 bh1750(BH1750_I2C_ADDR);
static bool scd30Initialized = false;
static bool bh1750Initialized = false;

// Dual I2C buses: Wire (bus 0) for SCD30, Wire1 (bus 1) for BH1750
// Wire1 is provided by the ESP32 Arduino framework (no redeclaration needed)
// Needed because SCD30 has internal 45kΩ pullups that conflict with BH1750's 10kΩ pullups

/**
 * Read soil moisture from capacitive sensor.
 * Takes multiple samples and averages them to reduce noise.
 * Maps raw ADC value to 0-100% range.
 */
static float readSoilMoisture(int* rawOut) {
    long sum = 0;
    for (int i = 0; i < SOIL_SAMPLES; i++) {
        sum += analogRead(SOIL_PIN);
        delay(10);
    }
    int raw = sum / SOIL_SAMPLES;
    *rawOut = raw;

    // ADC range check: raw must be within calibrated sensor range
    // SOIL_WATER_VALUE = wet (100%), SOIL_AIR_VALUE = dry (0%)
    if (raw < SOIL_WATER_VALUE || raw > SOIL_AIR_VALUE) {
        return -1.0f;
    }

    // Map raw value to percentage
    // SOIL_AIR_VALUE = dry (0%), SOIL_WATER_VALUE = wet (100%)
    float percent = map(raw, SOIL_AIR_VALUE, SOIL_WATER_VALUE, 0, 100);
    percent = constrain(percent, 0.0f, 100.0f);
    return percent;
}

bool SensorManager::init() {
    // Initialize I2C bus 0: SCD30 on GPIO 21 (SDA) / 22 (SCL)
    Wire.begin(I2C_SDA, I2C_SCL);
    Wire.setClock(100000);  // 100 kHz for sensor compatibility

    // Initialize I2C bus 1: BH1750 on GPIO 16 (SDA) / 17 (SCL)
    Wire1.begin(I2C1_SDA, I2C1_SCL);
    Wire1.setClock(100000);
    delay(100);

    bool anySensor = false;

    // Initialize SCD30 on bus 0
    Serial.print("[Sensor] SCD30 init... ");
    if (scd30.begin(Wire)) {
        scd30.setMeasurementInterval(SCD30_INTERVAL);
        scd30.setAutoSelfCalibration(true);
        scd30Initialized = true;
        anySensor = true;
        Serial.println("OK");
    } else {
        Serial.println("FAILED (check wiring, addr 0x61)");
    }

    // Initialize BH1750 on bus 1
    Serial.print("[Sensor] BH1750 init... ");
    if (bh1750.begin(BH1750::CONTINUOUS_HIGH_RES_MODE, BH1750_I2C_ADDR, &Wire1)) {
        bh1750Initialized = true;
        anySensor = true;
        Serial.println("OK");
    } else {
        Serial.println("FAILED (check wiring, addr 0x23)");
    }

    // Initialize soil moisture pin
    Serial.print("[Sensor] Soil moisture init... ");
    pinMode(SOIL_PIN, INPUT);
    analogSetAttenuation(ADC_11db);  // Full 0-3.3V range
    Serial.println("OK (GPIO34)");
    anySensor = true;

    return anySensor;
}

SensorData SensorManager::read() {
    SensorData data = {};

    // Read SCD30
    if (scd30Initialized && scd30.dataAvailable()) {
        data.co2 = scd30.getCO2();
        data.temperature = scd30.getTemperature();
        data.humidity = scd30.getHumidity();
        data.scd30Valid = true;

        // Sanity checks
        if (data.co2 < 0 || data.co2 > 10000) data.scd30Valid = false;
        if (data.temperature < -40 || data.temperature > 80) data.scd30Valid = false;
        if (data.humidity < 0 || data.humidity > 100) data.scd30Valid = false;

        if (data.scd30Valid) {
            Serial.printf("[Sensor] SCD30: %.1f ppm, %.2f C, %.1f %%RH\n",
                          data.co2, data.temperature, data.humidity);
        } else {
            Serial.println("[Sensor] SCD30: Reading out of range");
        }
    } else if (scd30Initialized) {
        Serial.println("[Sensor] SCD30: Data not ready");
        data.scd30Valid = false;
    }

    // Read BH1750
    if (bh1750Initialized) {
        float lux = bh1750.readLightLevel();
        if (lux >= 0) {
            data.light = lux;
            data.bh1750Valid = true;
            Serial.printf("[Sensor] BH1750: %.1f lux\n", data.light);
        } else {
            data.bh1750Valid = false;
            Serial.println("[Sensor] BH1750: Read error");
        }
    }

    // Read soil moisture
    int rawValue = 0;
    data.soilMoisture = readSoilMoisture(&rawValue);
    data.soilRaw = rawValue;
    data.soilValid = (rawValue > 0 && rawValue < 4095);

    Serial.printf("[Sensor] Soil: %.1f%% (raw: %d)\n", data.soilMoisture, data.soilRaw);

    return data;
}

bool SensorManager::isSCD30Ready() {
    return scd30Initialized && scd30.dataAvailable();
}

bool SensorManager::isBH1750Ready() {
    return bh1750Initialized;
}

String SensorManager::getStatusJSON() {
    String json = "{";
    json += "\"scd30\":" + String(scd30Initialized ? "true" : "false") + ",";
    json += "\"bh1750\":" + String(bh1750Initialized ? "true" : "false") + ",";
    json += "\"soil\":true";
    json += "}";
    return json;
}
