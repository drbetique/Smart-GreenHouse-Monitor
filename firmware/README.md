# Smart Greenhouse Monitor

Low-cost IoT environmental monitoring system for greenhouse applications. Built for Bachelor's thesis research at HAMK University of Applied Sciences, Lepaa campus.

## Hardware

| Component | Function | Interface | Cost (EUR) |
|-----------|----------|-----------|------------|
| ESP32-DEVKITC-32E | Microcontroller | - | ~12 |
| SCD30 Sensirion | CO2, Temperature, Humidity | I2C (0x61) | ~48 |
| BH1750 | Light intensity (lux) | I2C (0x23) | ~5 |
| Capacitive sensor v2.0 | Soil moisture | Analog (GPIO34) | ~6 |
| MicroSD card module | Data logging/buffering | SPI (GPIO5 CS) | ~3 |
| MicroSD card (8GB) | Storage | - | ~5 |
| Enclosure, wiring | Protection | - | ~10 |
| **Total** | | | **~88** |

## Wiring

```
ESP32 GPIO21 (SDA) --> SCD30 SDA, BH1750 SDA
ESP32 GPIO22 (SCL) --> SCD30 SCL, BH1750 SCL
ESP32 GPIO34       --> Soil moisture sensor (analog)
ESP32 GPIO5  (CS)  --> SD card module CS
ESP32 GPIO18 (SCK) --> SD card module SCK
ESP32 GPIO23 (MOSI)--> SD card module MOSI
ESP32 GPIO19 (MISO)--> SD card module MISO
ESP32 3.3V         --> BH1750 VCC, Soil sensor VCC, SD card VCC
ESP32 5V (VIN)     --> SCD30 VCC
ESP32 GND          --> All sensor GND, SD card GND
```

## Software Stack

- Firmware: Arduino framework via PlatformIO
- Protocol: MQTT over TLS (port 8883)
- Backend: InfluxDB (time-series storage)
- Dashboard: React.js (planned)
- Analysis: Python (pandas, scipy)

## Data Format

Sensor readings publish as JSON to `greenhouse/lepaa/sensors`:

```json
{
  "device": "LEPAA-GH-01",
  "timestamp": "2026-03-15T14:30:00+02:00",
  "reading": 142,
  "sensors": {
    "co2": 485.2,
    "temperature": 22.15,
    "humidity": 65.3,
    "light": 12450.0,
    "soil_moisture": 42.5,
    "soil_raw": 2150
  },
  "valid": {
    "scd30": true,
    "bh1750": true,
    "soil": true
  }
}
```

## Setup

1. Install PlatformIO
2. Copy `include/config.h` to `include/config_local.h`
3. Update WiFi and MQTT credentials in `config_local.h`
4. Add your MQTT broker CA certificate to `mqtt_manager.cpp`
5. Build and upload: `pio run --target upload`
6. Monitor: `pio device monitor`

## Project Structure

```
greenhouse-monitor/
├── platformio.ini          # Build configuration
├── include/
│   ├── config.h            # All settings (template)
│   ├── wifi_manager.h      # WiFi connection handler
│   ├── mqtt_manager.h      # MQTT client with TLS
│   ├── time_manager.h      # NTP time sync
│   ├── sensor_manager.h    # Sensor reading interface
│   └── sd_manager.h        # SD card logging/buffering
├── src/
│   ├── main.cpp            # Application entry point
│   ├── wifi_manager.cpp    # WiFi implementation
│   ├── mqtt_manager.cpp    # MQTT implementation
│   ├── time_manager.cpp    # NTP implementation
│   ├── sensor_manager.cpp  # Sensor implementation
│   └── sd_manager.cpp      # SD card implementation
└── test/                   # Unit tests (planned)
```

## Author

Victor Betiku - HAMK University of Applied Sciences
Supervisor: Ari Hietala
Partner: Boreal Plant Breeding Ltd

## License

MIT
