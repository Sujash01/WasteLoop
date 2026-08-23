(function () {
  class WasteLoopApp {
    constructor() {
      this.root = document.documentElement;
      this.storageKey = 'wasteloopTheme';
      this.navToggle = document.querySelector('.nav-toggle');
      this.primaryNav = document.querySelector('.primary-nav');
      this.headerActions = document.querySelector('.header-actions');
      this.announcementList = document.getElementById('announcement-list');
    }

    getSavedTheme() {
      try {
        return localStorage.getItem(this.storageKey);
      } catch (error) {
        return null;
      }
    }

    saveTheme(theme) {
      try {
        localStorage.setItem(this.storageKey, theme);
      } catch (error) {
        return;
      }
    }

    getPreferredTheme() {
      const savedTheme = this.getSavedTheme();
      if (savedTheme === 'dark' || savedTheme === 'light') {
        return savedTheme;
      }
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark';
      }
      return 'light';
    }

    applyTheme(theme) {
      this.root.setAttribute('data-theme', theme);
      document.querySelectorAll('.theme-toggle').forEach((button) => {
        const nextMode = theme === 'dark' ? 'light' : 'dark';
        button.textContent = theme === 'dark' ? 'Light' : 'Dark';
        button.setAttribute('aria-label', 'Switch to ' + nextMode + ' mode');
        button.setAttribute('aria-pressed', String(theme === 'dark'));
      });
    }

    createThemeToggle() {
      const button = document.createElement('button');
      button.className = 'theme-toggle';
      button.type = 'button';
      button.addEventListener('click', () => {
        const nextTheme = this.root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        this.applyTheme(nextTheme);
        this.saveTheme(nextTheme);
      });
      return button;
    }

    setupThemeToggle() {
      if (!this.headerActions) {
        return;
      }
      if (!this.headerActions.querySelector('.theme-toggle')) {
        this.headerActions.appendChild(this.createThemeToggle());
      }
      this.applyTheme(this.getPreferredTheme());
    }

    setupNavigation() {
      if (this.navToggle && this.primaryNav) {
        this.navToggle.addEventListener('click', () => {
          const isOpen = this.primaryNav.classList.toggle('open');
          this.navToggle.setAttribute('aria-expanded', String(isOpen));
        });
      }

      const currentPage = window.location.pathname.split('/').pop() || 'index.html';
      document.querySelectorAll('.nav-list a').forEach((link) => {
        const linkPage = link.getAttribute('href').split('/').pop();
        if (linkPage === currentPage) {
          link.classList.add('active');
        }
      });
    }

    renderAnnouncements() {
      if (!this.announcementList) {
        return;
      }

      const announcements = [
        { date: '06 Aug 2026', text: 'Pilot integration opened for urban local bodies in 40 additional cities.' },
        { date: '22 Jul 2026', text: 'Green Points certificates are now available for completed pickup milestones.' },
        { date: '10 Jul 2026', text: 'Updated dry and wet waste segregation advisory published for households.' }
      ];

      announcements.forEach((item) => {
        const listItem = document.createElement('li');
        const date = document.createElement('time');
        const text = document.createElement('span');
        date.textContent = item.date;
        text.textContent = item.text;
        listItem.appendChild(date);
        listItem.appendChild(text);
        this.announcementList.appendChild(listItem);
      });
    }

    animateCounters() {
      const counters = document.querySelectorAll('[data-count]');
      if (!counters.length) {
        return;
      }

      const animateValue = (element) => {
        const target = Number(element.dataset.count || 0);
        const suffix = element.dataset.suffix || '';
        const duration = 1000;
        const start = performance.now();

        const tick = (now) => {
          const progress = Math.min((now - start) / duration, 1);
          const eased = 1 - Math.pow(1 - progress, 3);
          const value = Math.round(target * eased);
          element.textContent = value.toLocaleString() + suffix;
          if (progress < 1) {
            requestAnimationFrame(tick);
          } else {
            element.textContent = target.toLocaleString() + suffix;
          }
        };

        requestAnimationFrame(tick);
      };

      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            animateValue(entry.target);
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.4 });

      counters.forEach((counter) => observer.observe(counter));
    }

    init() {
      this.setupThemeToggle();
      this.setupNavigation();
      this.renderAnnouncements();
      this.animateCounters();
    }
  }

  new WasteLoopApp().init();
}());