module.exports = function () {
  var clayConfig = this;

  function syncDebugToggles() {
    var debugToggle = clayConfig.getItemByMessageKey('DebugMode');
    var demoWeatherToggle = clayConfig.getItemByMessageKey('DemoWeather');
    var demoBiometricsToggle = clayConfig.getItemByMessageKey('DemoBiometrics');

    if (debugToggle.get()) {
      demoWeatherToggle.enable();
      demoBiometricsToggle.enable();
    } else {
      demoWeatherToggle.set(false);
      demoWeatherToggle.disable();
      demoBiometricsToggle.set(false);
      demoBiometricsToggle.disable();
    }
  }

  function syncManualLocationInput() {
    var locationMode = clayConfig.getItemByMessageKey('LocationMode');
    var manualLocation = clayConfig.getItemByMessageKey('ManualLocation');

    if (locationMode.get() === '1') {
      manualLocation.enable();
    } else {
      manualLocation.disable();
    }
  }

  clayConfig.on(clayConfig.EVENTS.AFTER_BUILD, function () {
    var debugToggle = clayConfig.getItemByMessageKey('DebugMode');
    var locationMode = clayConfig.getItemByMessageKey('LocationMode');

    syncDebugToggles();
    debugToggle.on('change', syncDebugToggles);

    syncManualLocationInput();
    locationMode.on('change', syncManualLocationInput);
  });
};
