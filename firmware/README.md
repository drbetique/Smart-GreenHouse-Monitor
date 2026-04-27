# Smart Greenhouse Monitor

Low-cost IoT environmental monitoring system for greenhouse applications. Built for Bachelor's thesis research at HAMK University of Applied Sciences, Lepaa campus.

## Hardware

| Component | Function | Interface | Cost (EUR) |
|-----------|----------|-----------|------------|
| ESP32-WROOM-32 (DEVKITC-32E) | Microcontroller | - | ~12 |
| SCD30 Sensirion | CO2, Temperature, Humidity | I2C bus 0 (0x61) | ~48 |
| BH1750 | Light intensity (lux) | I2C bus 1 (0x23) | ~5 |
| Capacitive Soil Moisture Sensor V1.0 | Soil moisture | Analog (GPIO34) | ~6 |
| PmodMicroSD | Data logging/buffering | SPI (GPIO27 CS) | ~3 |
| MicroSD card (8GB, FAT32) | Storage | - | ~5 |
| Enclosure, wiring | Protection | - | ~10 |
| **Total** | | | **~88** |

## Wiring

### SCD30 (CO2, Temperature, Humidity) — I2C Bus 0

```
SCD30 Pin 1 VDD  --> ESP32 3.3V
SCD30 Pin 2 GND  --> ESP32 GND
SCD30 Pin 3 SCL  --> ESP32 GPIO22
SCD30 Pin 4 SDA  --> ESP32 GPIO21
SCD30 Pin 5 RDY  --> unconnected
SCD30 Pin 6 PWM  --> unconnected
SCD30 Pin 7 SEL  --> GND
```

### BH1750 (Light) — I2C Bus 1

```
BH1750 VIN  --> ESP32 3.3V
BH1750 GND  --> ESP32 GND
BH1750 SCL  --> ESP32 GPIO17
BH1750 SDA  --> ESP32 GPIO16
BH1750 ADDR --> unconnected
```

> BH1750 runs on a separate I2C bus (bus 1) to avoid conflicts between
> SCD30's internal 45kΩ pullups and BH1750's 10kΩ pullups on a shared bus.

### Capacitive Soil Moisture Sensor V1.0 (Analog)

```
Red (+)  --> ESP32 3.3V
Black (-) -> ESP32 GND
Blue (A) --> ESP32 GPIO34
```

### PmodMicroSD (SD Card) — SPI, Row 1 only

```
Pin 1 CS   --> ESP32 GPIO27
Pin 2 MOSI --> ESP32 GPIO23
Pin 3 MISO --> ESP32 GPIO19
Pin 4 SCK  --> ESP32 GPIO18
Pin 5 GND  --> ESP32 GND
Pin 6 VCC  --> ESP32 3.3V
Row 2      --> completely unconnected
```

> SD card must be formatted as FAT32. Row 2 of the PmodMicroSD is left unconnected.

## Platform and Libraries

```ini
[env:esp32dev]
platform = espressif32
board = esp32dev
framework = arduino
monitor_speed = 115200
upload_speed = 921600
lib_deps =
    knolleary/PubSubClient@^2.8
    bblanchon/ArduinoJson@^7.0.0
    sparkfun/SparkFun SCD30 Arduino Library@^1.0.20
    claws/BH1750@^1.3.0
```

> Do not add `arduino-libraries/SD` as a lib_dep. Use the ESP32 built-in SD library instead.

## Initialization Order

Always initialize I2C buses before SPI. SCD30 must initialize before the SD card.

1. I2C bus 0 (Wire) — SCD30
2. I2C bus 1 (Wire1) — BH1750
3. SPI — SD card

## Confirmed Sensor Readings

| Sensor | Range observed | Notes |
|--------|---------------|-------|
| CO2 | 908–1390 ppm | Responds to breath and room air |
| Temperature | 24–28°C | Stable |
| Humidity | 31–32% %RH | Stable |
| Light | 0.83–320 lx | Responds correctly to changes |
| Soil moisture | 17–79% | Dry in air to submerged in water |

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
5. Format your SD card as FAT32
6. Build and upload: `pio run --target upload`
7. Monitor: `pio device monitor`

## Next Steps

- Add MQTT over TLS for data transmission
- Add timestamp using NTP
- Move to final enclosure with SCD30 mounted externally
- Calibrate soil moisture sensor with actual soil samples

## Project Structure

```
firmware/
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
