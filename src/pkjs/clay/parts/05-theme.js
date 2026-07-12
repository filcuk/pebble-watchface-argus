  function injectTheme() {
    document.documentElement.classList.add('argus-settings');

    var meta = document.querySelector('meta[name="color-scheme"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'color-scheme');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', 'dark');

    var existingTheme = document.getElementById('argus-theme');
    if (existingTheme) {
      existingTheme.parentNode.removeChild(existingTheme);
    }

    var style = document.createElement('style');
    style.id = 'argus-theme';
    style.type = 'text/css';
    style.appendChild(document.createTextNode(THEME_CSS));
    document.head.appendChild(style);
  }

