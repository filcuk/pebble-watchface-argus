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

  clayConfig.on(clayConfig.EVENTS.AFTER_BUILD, function () {
    var debugToggle = clayConfig.getItemByMessageKey('DebugMode');
    syncDemoWeatherToggle();
    debugToggle.on('change', syncDemoWeatherToggle);
  });
};
