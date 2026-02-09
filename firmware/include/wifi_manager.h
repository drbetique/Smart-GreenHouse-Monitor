/**
 * wifi_manager.h - WiFi connection handler
 */

#ifndef WIFI_MANAGER_H
#define WIFI_MANAGER_H

#include <Arduino.h>

namespace WiFiManager {
    /**
     * Initialize WiFi in station mode and connect.
     * Blocks until connected or max retries reached.
     * Reboots ESP32 if connection fails after max retries.
     */
    void init();

    /**
     * Check connection and reconnect if needed.
     * Call this in the main loop.
     * Returns true if connected, false if reconnecting.
     */
    bool maintain();

    /**
     * Get current connection status info.
     */
    bool isConnected();
    int getRSSI();
    String getIP();
    String getMAC();
}

#endif // WIFI_MANAGER_H
