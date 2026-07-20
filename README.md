# Argus
[![GitHub release (latest by date)](https://img.shields.io/github/v/release/filcuk/pebble-watchface-argus?label=latest&color=85C1E9&logo=data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAQAAABKfvVzAAAAAmJLR0QA/4ePzL8AAAC0SURBVDjLldLLCcJAFEbhP4oIE1xYhw1pA4JWYRGCVbhxoTshWIUNaAnBgB4XBiTJ3HncbALznXAZIpnDmHnnmSqAS470p2Fn8wrfNEzS+INX++ZS+J6CRZu4lGWWEgVPT2DsfmfFwbMSjiuxcXn8H5gX6Q+S+ZtRDofT7/uXRF5RSmJEncEliS2fDC5JrCPJjVn/lwglQx5M/NxMbO5NwnyQxHknSeOSxIaac+feo0lhn30BIXaN/u4MXmAAAAAASUVORK5CYII=)](https://github.com/filcuk/pebble-watchface-argus/releases/latest)
[![Pebble Store Hearts](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fappstore-api.repebble.com%2Fapi%2Fv1%2Fapps%2Fid%2Fd119efdfa11e498496d4d411%3Fimage_ratio%3D1%26hardware%3Dbasalt%26firmware_version%3D3&query=%24.data%5B0%5D.hearts&logo=data%3Aimage%2Fsvg%2Bxml%3Bbase64%2CPHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI%2BPHRpdGxlPmhlYXJ0PC90aXRsZT48cGF0aCBmaWxsPSJ3aGl0ZSIgZD0iTTEyLDIxLjM1TDEwLjU1LDIwLjAzQzUuNCwxNS4zNiAyLDEyLjI3IDIsOC41QzIsNS40MSA0LjQyLDMgNy41LDNDOS4yNCwzIDEwLjkxLDMuODEgMTIsNS4wOEMxMy4wOSwzLjgxIDE0Ljc2LDMgMTYuNSwzQzE5LjU4LDMgMjIsNS40MSAyMiw4LjVDMjIsMTIuMjcgMTguNiwxNS4zNiAxMy40NSwyMC4wM0wxMiwyMS4zNVoiIC8%2BPC9zdmc%2B&label=pebble%20store&color=%23FFAA00)](https://apps.repebble.com/d119efdfa11e498496d4d411)
[![Rebble Store Hearts](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fappstore-api.rebble.io%2Fapi%2Fv1%2Fapps%2Fid%2F6a48d3975cf4bd0009ff8ba7%3Fimage_ratio%3D1%26hardware%3Dbasalt%26firmware_version%3D3&query=%24.data%5B0%5D.hearts&logo=data%3Aimage%2Fsvg%2Bxml%3Bbase64%2CPHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI%2BPHRpdGxlPmhlYXJ0PC90aXRsZT48cGF0aCBmaWxsPSJ3aGl0ZSIgZD0iTTEyLDIxLjM1TDEwLjU1LDIwLjAzQzUuNCwxNS4zNiAyLDEyLjI3IDIsOC41QzIsNS40MSA0LjQyLDMgNy41LDNDOS4yNCwzIDEwLjkxLDMuODEgMTIsNS4wOEMxMy4wOSwzLjgxIDE0Ljc2LDMgMTYuNSwzQzE5LjU4LDMgMjIsNS40MSAyMiw4LjVDMjIsMTIuMjcgMTguNiwxNS4zNiAxMy40NSwyMC4wM0wxMiwyMS4zNVoiIC8%2BPC9zdmc%2B&label=rebble%20store&color=%23FFAA00)
](https://apps.rebble.io/en_US/application/6a48d3975cf4bd0009ff8ba7)
[![Platform](https://img.shields.io/badge/platform-emery-red?logo=data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAQAAABKfvVzAAAAAmJLR0QA/4ePzL8AAAC1SURBVDjL1ZSxDoIwFEWbMOLE6qgYdlb5FUkMFEOMox8pJsJg/A4HmGqOkwZtoTRx8b7t5p6h6X1PCIMIiIgIxBQxo+GlGt8OHOhrb4t73D6AK944sONbxVg8p9OAjmwovuLBiRLZm5IKxdIMpMBacxNgYwYkEGtuDNyZuwEG3waEbsDR9Q3yb4AUSFw+LkRRadU4o1gMtSmj1crXsh3ra6EB+W8XyHlFhcCnfscvE46A7cw8Ab9fQsIsgqKzAAAAAElFTkSuQmCC)](https://developer.rebble.io/developer.pebble.com/guides/tools-and-resources/hardware-information/index.html)

Argus guides you through the days ahead with hourly weather forecast, a two-week calendar view and a configurable header to focus on what is important.  
Inspired by [WarnWeather](https://github.com/Toasbi/WarnWeather).

<div align="center">
<img width="200" height="228" alt="argus-1" src="images/argus.gif" />
</div>
<div align="center">
<img width="200" height="228" alt="header" src="images/header.png" />
<img width="200" height="228" alt="calendar" src="images/calendar.png" />
<img width="200" height="228" alt="time" src="images/time.png" />
<img width="200" height="228" alt="weather" src="images/weather.png" />
</div>
  
## Features

- **Header**: week number (ISO or Gregorian), month/year, Bluetooth status, battery level
- **Calendar**: current and next week with Monday or Sunday week start; today highlighted; optional public-holiday outlines (national or regional)
- **Time**: 12h/24h (system override or forced format)
- **Weather**: Open-Meteo hourly temperature line and precipitation bars (12/24/48h); configurable forecast model, refresh interval, night pause, and GPS reuse
- **Settings**: Clay configuration page on the phone

### Weather settings

Display and location (in order):

| Setting | Default | Notes |
|---------|---------|-------|
| Temperature scale | °C | °C or °F on watch and chart |
| Forecast | 24h | Chart window: 12, 24, or 48 hours |
| Feels-like temperature | Off | Actual vs apparent temperature on chart |
| Location | Auto | Auto uses phone GPS; Manual uses city geocoding |
| City name | — | Shown only when Location is Manual |
| GPS update frequency | 1 hour | How long a GPS fix is reused (Auto only) |

Fetch behaviour:

| Setting | Default | Notes |
|---------|---------|-------|
| Weather model | Auto | Open-Meteo seamless models (ECMWF, GFS, ICON, Météo-France, JMA, GEM, UKMO) |
| Pause at night | Off | Skips periodic refreshes between sunset and sunrise; force-fetches at dawn |
| Update interval | 30 min | Watch request cadence: 5, 15, 30, or 60 minutes |

Weather data is fetched on the phone via Open-Meteo (no API key). Each update sends a full hourly payload to the watch; refresh interval and GPS reuse settings reduce how often the phone hits the network or re-acquires location.

### Calendar settings

| Setting | Default | Notes |
|---------|---------|-------|
| Week start | Monday | Monday or Sunday |
| Week numbers | ISO | ISO 8601 or US/Gregorian week numbering |
| Show holidays | On | Blue outline on public holiday dates |
| Holiday country | Auto-detected | From phone locale when supported; otherwise pick manually |
| Region | National only | Optional first-level region for regional holidays (where available) |

Public holidays are fetched on the phone from [Nager.Date](https://date.nager.at/api) (no API key), cached per country/year, and sent to the watch as a compact 14-day mask aligned to the calendar grid. The settings country list is also loaded from Nager.Date on first open (cached on the phone). If no supported country can be detected automatically, holidays stay hidden until a country is selected.

## Development

Build instructions, emulator setup, and troubleshooting are in [DEVELOPMENT.md](DEVELOPMENT.md).
