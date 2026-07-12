# Argus

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
| GPS update frequency | 30 min | How long a GPS fix is reused (Auto only) |

Fetch behaviour:

| Setting | Default | Notes |
|---------|---------|-------|
| Weather model | Auto | Open-Meteo seamless models (ECMWF, GFS, ICON, Météo-France, JMA, GEM, UKMO) |
| Pause at night | Off | Skips periodic refreshes during chart night hours |
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
