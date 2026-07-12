  function clayToggleOn(item) {
    if (!item) {
      return false;
    }
    var value = item.get();
    return value === true || value === 1 || value === '1' || value === 'true';
  }

  function syncWeatherDebugLogVisibility() {
    var debugToggle = clayConfig.getItemByMessageKey('DebugMode');
    var logToggle = clayConfig.getItemByMessageKey('DebugWeatherLog');
    var logItem = clayConfig.getItemById('argus-weather-debug-log');
    if (!logItem || !logItem.$element || !logItem.$element[0]) {
      return;
    }

    var show = clayToggleOn(debugToggle) && clayToggleOn(logToggle);
    var root = logItem.$element[0];

    if (show) {
      root.classList.remove('hide');
      root.classList.add('argus-row', 'argus-weather-log-panel');
      return;
    }

    root.classList.add('hide');
    root.classList.remove('argus-row', 'argus-weather-log-panel');
    logItem.set('');
  }
