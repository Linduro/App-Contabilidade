(function () {
  'use strict';

  var container;

  function ensureContainer() {
    if (!container) {
      container = document.createElement('div');
      container.id = 'afs-toast-container';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    return container;
  }

  function show(message, type) {
    type = type || 'success';
    var root = ensureContainer();
    var el = document.createElement('div');
    el.className = 'toast toast-' + type;
    var icon = type === 'success' ? '✓' : type === 'error' ? '✕' : '!';
    el.innerHTML =
      '<span class="toast-icon">' + icon + '</span>' +
      '<span class="toast-msg">' + message + '</span>' +
      '<div class="toast-progress"></div>';
    root.appendChild(el);
    requestAnimationFrame(function () { el.classList.add('show'); });
    setTimeout(function () {
      el.classList.remove('show');
      setTimeout(function () { el.remove(); }, 300);
    }, 4000);
  }

  window.AFSToast = {
    success: function (m) { show(m, 'success'); },
    error: function (m) { show(m, 'error'); },
    warn: function (m) { show(m, 'warn'); },
  };
})();
