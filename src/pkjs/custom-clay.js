module.exports = function () {
  var clayConfig = this;

  function syncDemoWeatherToggle() {
    var debugToggle = clayConfig.getItemByMessageKey('DebugMode');
    var demoWeatherToggle = clayConfig.getItemByMessageKey('DemoWeather');

    if (debugToggle.get()) {
      demoWeatherToggle.enable();
    } else {
      demoWeatherToggle.set(false);
      demoWeatherToggle.disable();
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

    syncDemoWeatherToggle();
    debugToggle.on('change', syncDemoWeatherToggle);

    syncManualLocationInput();
    locationMode.on('change', syncManualLocationInput);
  });
};
