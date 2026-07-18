  var WEATHER_LOG_STORAGE_KEY = 'argus-weather-debug-log';

  function clayToggleOn(item) {
    if (!item) {
      return false;
    }
    var value = item.get();
    return value === true || value === 1 || value === '1' || value === 'true';
  }

  function formatWeatherLogTime(ts) {
    var d = new Date(ts);
    var h = ('0' + d.getHours()).slice(-2);
    var m = ('0' + d.getMinutes()).slice(-2);
    var s = ('0' + d.getSeconds()).slice(-2);
    return h + ':' + m + ':' + s;
  }

  function readWeatherLogEntries() {
    try {
      var raw = localStorage.getItem(WEATHER_LOG_STORAGE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch (e) {
      // Fall through to DOM scrape.
    }
    return null;
  }

  function formatWeatherLogFromDom(root) {
    var lines = root.querySelectorAll('.argus-wlog-line');
    if (!lines || !lines.length) {
      return '';
    }
    var out = [];
    var i;
    // Panel is newest-first; reverse for a chronological .log dump.
    for (i = lines.length - 1; i >= 0; i -= 1) {
      var text = String(lines[i].textContent || '')
        .replace(/\s+/g, ' ')
        .trim();
      if (text) {
        out.push(text);
      }
    }
    return out.join('\n');
  }

  function formatWeatherLogPlainText(root) {
    var entries = readWeatherLogEntries();
    if (entries && entries.length) {
      var lines = [];
      var i;
      for (i = 0; i < entries.length; i += 1) {
        var entry = entries[i];
        var msg = entry.msg ? ' ' + entry.msg : '';
        lines.push(formatWeatherLogTime(entry.t) + ' ' + (entry.tag || '') + msg);
      }
      return lines.join('\n');
    }
    return formatWeatherLogFromDom(root);
  }

  function setWeatherLogCopyStatus(root, message) {
    var status = root.querySelector('.argus-weather-log-copy-status');
    if (status) {
      status.textContent = message || '';
    }
  }

  function copyTextLegacy(text) {
    var area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.top = '0';
    area.style.left = '0';
    area.style.width = '2em';
    area.style.height = '2em';
    area.style.padding = '0';
    area.style.border = 'none';
    area.style.outline = 'none';
    area.style.boxShadow = 'none';
    area.style.background = 'transparent';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.focus();
    area.select();
    area.setSelectionRange(0, text.length);
    var ok = false;
    try {
      ok = document.execCommand('copy');
    } catch (e) {
      ok = false;
    }
    document.body.removeChild(area);
    return ok;
  }

  function copyWeatherLog(root) {
    var text = formatWeatherLogPlainText(root);
    if (!text) {
      setWeatherLogCopyStatus(root, 'No log to copy.');
      return;
    }

    function onCopied() {
      setWeatherLogCopyStatus(root, 'Copied.');
    }

    function onFailed() {
      setWeatherLogCopyStatus(root, 'Copy failed.');
    }

    if (
      typeof navigator !== 'undefined' &&
      navigator.clipboard &&
      typeof navigator.clipboard.writeText === 'function'
    ) {
      navigator.clipboard.writeText(text).then(onCopied, function () {
        if (copyTextLegacy(text)) {
          onCopied();
        } else {
          onFailed();
        }
      });
      return;
    }

    if (copyTextLegacy(text)) {
      onCopied();
    } else {
      onFailed();
    }
  }

  function ensureWeatherLogCopyButton(root) {
    var existingShare = root.querySelector('.argus-weather-log-share-bar');
    if (existingShare) {
      existingShare.parentNode.removeChild(existingShare);
    }

    var bar = root.querySelector('.argus-weather-log-copy-bar');
    if (!bar) {
      bar = document.createElement('div');
      bar.className = 'argus-weather-log-copy-bar';
      bar.innerHTML =
        '<button type="button" class="argus-weather-log-copy">Copy log</button>' +
        '<span class="argus-weather-log-copy-status" aria-live="polite"></span>';

      var button = bar.querySelector('.argus-weather-log-copy');
      button.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        copyWeatherLog(root);
      });
    }

    // Keep the control under the log panel content.
    root.appendChild(bar);
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
      var current = String(logItem.get() || '').trim();
      if (!current) {
        logItem.set(
          '<div class="argus-weather-log-empty">Save settings to apply.</div>'
        );
      }
      ensureWeatherLogCopyButton(root);
      return;
    }

    root.classList.add('hide');
    root.classList.remove('argus-row', 'argus-weather-log-panel');
  }
