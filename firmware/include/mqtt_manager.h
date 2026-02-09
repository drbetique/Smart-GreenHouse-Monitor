/**
 * mqtt_manager.h - MQTT client with TLS support
 */

#ifndef MQTT_MANAGER_H
#define MQTT_MANAGER_H

#include <Arduino.h>

namespace MQTTManager {
    /**
     * Initialize MQTT client with TLS.
     * Must be called after WiFi is connected.
     */
    void init();

    /**
     * Maintain MQTT connection. Reconnects if needed.
     * Call this in the main loop.
     * Returns true if connected.
     */
    bool maintain();

    /**
     * Publish sensor data as JSON to the data topic.
     * Returns true if publish succeeded.
     */
    bool publishData(const String& payload);

    /**
     * Publish device status to the status topic.
     * Returns true if publish succeeded.
     */
    bool publishStatus(const String& payload);

    /**
     * Publish error message to the error topic.
     */
    bool publishError(const String& errorMsg);

    /**
     * Check connection status.
     */
    bool isConnected();
}

#endif // MQTT_MANAGER_H
