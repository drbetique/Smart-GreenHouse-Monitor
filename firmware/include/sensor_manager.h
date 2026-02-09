/**
 * sensor_manager.h - Sensor reading and management
 * 
 * Handles SCD30 (CO2/Temp/RH), BH1750 (Light), 
 * and capacitive soil moisture sensor.
 */

#ifndef SENSOR_MANAGER_H
#define SENSOR_MANAGER_H

#include <Arduino.h>

// Sensor reading structure
struct SensorData {
    float co2;              // ppm
    float temperature;      // Celsius
    float humidity;         // %RH
    float light;            // lux
    float soilMoisture;     // percentage (0-100%)
    int   soilRaw;          // raw ADC value
    bool  scd30Valid;       // SCD30 reading valid
    bool  bh1750Valid;      // BH1750 reading valid
    bool  soilValid;        // Soil reading valid
};

namespace SensorManager {
    /**
     * Initialize I2C bus and all sensors.
     * Returns true if at least one sensor initialized.
     */
    bool init();

    /**
     * Read all sensors and return data.
     */
    SensorData read();

    /**
     * Check if individual sensors are responding.
     */
    bool isSCD30Ready();
    bool isBH1750Ready();

    /**
     * Get sensor status as JSON string for diagnostics.
     */
    String getStatusJSON();
}

#endif // SENSOR_MANAGER_H
