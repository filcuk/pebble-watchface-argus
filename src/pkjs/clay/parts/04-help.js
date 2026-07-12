  function appendFieldHelp(messageKey, text, secondaryClass) {
    var item = clayConfig.getItemByMessageKey(messageKey);
    if (!item || !item.$element || !item.$element[0]) {
      return;
    }

    var root = item.$element[0];
    var className = secondaryClass || 'argus-field-help-secondary';
    if (root.querySelector(':scope > .' + className)) {
      return;
    }

    var help = document.createElement('div');
    help.className = className;
    help.innerHTML = text;

    var primaryHelp = root.querySelector(':scope > .argus-field-help');
    if (primaryHelp) {
      if (primaryHelp.nextSibling) {
        root.insertBefore(help, primaryHelp.nextSibling);
      } else {
        root.appendChild(help);
      }
      return;
    }

    root.appendChild(help);
  }

  function injectFieldHelp(messageKey, text) {
    var item = clayConfig.getItemByMessageKey(messageKey);
    if (!item || !item.$element || !item.$element[0]) {
      return;
    }

    var root = item.$element[0];
    if (root.querySelector(':scope > .argus-field-help')) {
      return;
    }

    var help = document.createElement('div');
    help.className = 'argus-field-help';
    help.innerHTML = text;

    var description = root.querySelector(':scope > .description');
    if (description) {
      if (description.nextSibling) {
        root.insertBefore(help, description.nextSibling);
      } else {
        root.appendChild(help);
      }
      return;
    }

    var anchor = root.querySelector(':scope > .argus-control-row') ||
      root.querySelector(':scope > .radio-group');
    if (anchor) {
      if (anchor.nextSibling) {
        root.insertBefore(help, anchor.nextSibling);
      } else {
        root.appendChild(help);
      }
    } else {
      root.appendChild(help);
    }
  }

  function injectSettingsFieldHelp() {
    injectFieldHelp(
      'WeekNumberMode',
      '<strong>ISO 8601</strong> is the international standard. Week 1 is determined by the first Thursday ' +
      'of the year. <strong>US</strong> traditional style is typically used in North America. US week 1 is ' +
      'the week containing 1st of January.'
    );
    injectFieldHelp(
      'HeaderDisplay',
      '<strong>Step count</strong> shows your total steps for the day. <strong>Temperature</strong> shows the current ' +
      'reading with today\'s minimum and maximum forecasted. <strong>Heart rate</strong> ' +
      'shows your current BPM with today\'s maximum.'
    );
    appendFieldHelp(
      'HeaderDisplay',
      '<em>Maximum heart rate is recorded while Argus is active. When you open the watchface, ' +
      'earlier peaks from today may be included if the watch already stored minute ' +
      'heart-rate samples.</em>'
    );
    injectFieldHelp(
      'WeatherProvider',
      '<em>All models are served by Open-Meteo. Auto combines the highest-' +
      'resolution model available for your coordinates.</em>'
    );
    injectFieldHelp(
      'WeatherUpdateInterval',
      'Shorter intervals keep data fresher but use more phone and watch battery.'
    );
    injectFieldHelp(
      'GpsMaxAge',
      'This setting affects battery life.'
    );
  }

