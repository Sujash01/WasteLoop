(function () {
  var navToggle = document.querySelector('.nav-toggle');
  var primaryNav = document.querySelector('.primary-nav');
  var headerActions = document.querySelector('.header-actions');
  var root = document.documentElement;
  var storageKey = 'wasteloopTheme';

  function getSavedTheme() {
    try {
      return localStorage.getItem(storageKey);
    } catch (error) {
      return null;
    }
  }

  function saveTheme(theme) {
    try {
      localStorage.setItem(storageKey, theme);
    } catch (error) {
      return;
    }
  }

  function getPreferredTheme() {
    var savedTheme = getSavedTheme();
    if (savedTheme === 'dark' || savedTheme === 'light') {
      return savedTheme;
    }
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  }

  function applyTheme(theme) {
    root.setAttribute('data-theme', theme);
    document.querySelectorAll('.theme-toggle').forEach(function (button) {
      button.textContent = theme === 'dark' ? 'Light' : 'Dark';
      button.setAttribute('aria-label', 'Switch to ' + (theme === 'dark' ? 'light' : 'dark') + ' mode');
      button.setAttribute('aria-pressed', String(theme === 'dark'));
    });
  }

  function createThemeToggle() {
    var button = document.createElement('button');
    button.className = 'theme-toggle';
    button.type = 'button';
    button.addEventListener('click', function () {
      var nextTheme = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      applyTheme(nextTheme);
      saveTheme(nextTheme);
    });
    return button;
  }

  applyTheme(getPreferredTheme());

  if (headerActions) {
    headerActions.appendChild(createThemeToggle());
  }

  if (navToggle && primaryNav) {
    navToggle.addEventListener('click', function () {
      var isOpen = primaryNav.classList.toggle('open');
      navToggle.setAttribute('aria-expanded', String(isOpen));
    });
  }

  var currentPage = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-list a').forEach(function (link) {
    var linkPage = link.getAttribute('href').split('/').pop();
    if (linkPage === currentPage) {
      link.classList.add('active');
    }
  });

  var announcements = [
    { date: '06 Aug 2026', text: 'Pilot integration opened for urban local bodies in 40 additional cities.' },
    { date: '22 Jul 2026', text: 'Green Points certificates are now available for completed pickup milestones.' },
    { date: '10 Jul 2026', text: 'Updated dry and wet waste segregation advisory published for households.' }
  ];

  var announcementList = document.getElementById('announcement-list');
  if (announcementList) {
    announcements.forEach(function (item) {
      var listItem = document.createElement('li');
      var date = document.createElement('time');
      var text = document.createElement('span');
      date.textContent = item.date;
      text.textContent = item.text;
      listItem.appendChild(date);
      listItem.appendChild(text);
      announcementList.appendChild(listItem);
    });
  }
}());