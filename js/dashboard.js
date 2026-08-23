(function () {
  class DashboardManager {
    constructor() {
      this.storageKey = 'wasteloopDashboardState';
      this.defaultState = {
        name: 'Aarav Sharma',
        greenPoints: 2480,
        completedPickups: 18,
        pendingPickups: 2,
        certificatesEarned: 4,
        certificates: [
          'Plastic Recovery Champion',
          'Household Segregation Certificate',
          'E-Waste Responsible Disposal',
          'Community Recycling Volunteer'
        ],
        activities: [
          'Pickup completed for 2 kg dry waste in Jaipur.',
          'Plastic recovery bonus added from last week.',
          'Segregation awareness session attended.'
        ]
      };

      this.dashboard = document.getElementById('dashboard-cards');
      this.certificateList = document.getElementById('certificate-list');
      this.activityList = document.getElementById('activity-list');
      this.pointsValue = document.getElementById('dashboard-points');
      this.pointsButton = document.getElementById('simulate-points');
      this.state = this.loadState();
    }

    loadState() {
      try {
        const stored = JSON.parse(localStorage.getItem(this.storageKey));
        return stored ? { ...this.defaultState, ...stored } : { ...this.defaultState };
      } catch (error) {
        return { ...this.defaultState };
      }
    }

    saveState() {
      try {
        localStorage.setItem(this.storageKey, JSON.stringify(this.state));
      } catch (error) {
        return;
      }
    }

    renderCard(label, value) {
      const card = document.createElement('article');
      card.className = 'dashboard-card';
      card.innerHTML = '<span>' + label + '</span><strong>' + value + '</strong>';
      return card;
    }

    renderCards() {
      if (!this.dashboard) {
        return;
      }

      this.dashboard.innerHTML = '';
      [
        { label: 'Citizen Name', value: this.state.name },
        { label: 'Green Points', value: this.state.greenPoints },
        { label: 'Completed Pickups', value: this.state.completedPickups },
        { label: 'Pending Pickups', value: this.state.pendingPickups },
        { label: 'Certificates Earned', value: this.state.certificatesEarned }
      ].forEach((item) => {
        this.dashboard.appendChild(this.renderCard(item.label, item.value));
      });

      if (this.pointsValue) {
        this.pointsValue.dataset.count = String(this.state.greenPoints);
        this.pointsValue.textContent = this.state.greenPoints.toLocaleString();
      }
    }

    renderCertificates() {
      if (!this.certificateList) {
        return;
      }

      this.certificateList.innerHTML = '';
      this.state.certificates.forEach((certificate) => {
        const item = document.createElement('li');
        item.textContent = certificate;
        this.certificateList.appendChild(item);
      });
    }

    renderActivities() {
      if (!this.activityList) {
        return;
      }

      this.activityList.innerHTML = '';
      this.state.activities.slice(0, 4).forEach((activity) => {
        const item = document.createElement('li');
        item.textContent = activity;
        this.activityList.appendChild(item);
      });
    }

    attachRewardAction() {
      if (!this.pointsButton) {
        return;
      }

      this.pointsButton.addEventListener('click', () => {
        const bonus = 25;
        this.state.greenPoints += bonus;
        this.state.activities.unshift('Green Points bonus of ' + bonus + ' awarded for community recycling participation.');
        this.state.certificatesEarned = Math.min(this.state.certificatesEarned + 1, 6);
        this.saveState();
        this.renderCards();
        this.renderActivities();
      });
    }

    init() {
      this.renderCards();
      this.renderCertificates();
      this.renderActivities();
      this.attachRewardAction();
    }
  }

  new DashboardManager().init();
}());
