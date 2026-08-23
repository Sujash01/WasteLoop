(function () {
  class LeaderboardManager {
    constructor() {
      this.citizens = [
        { name: 'Meera Iyer', city: 'Bengaluru', greenPoints: 4220 },
        { name: 'Rohan Verma', city: 'Delhi', greenPoints: 3890 },
        { name: 'Aarav Sharma', city: 'Jaipur', greenPoints: 2480 },
        { name: 'Fatima Khan', city: 'Lucknow', greenPoints: 3610 },
        { name: 'Kabir Das', city: 'Bhopal', greenPoints: 3145 },
        { name: 'Ananya Rao', city: 'Pune', greenPoints: 4555 },
        { name: 'Nikhil Sen', city: 'Kolkata', greenPoints: 2760 }
      ];

      this.tableBody = document.getElementById('leaderboard-body');
      this.searchInput = document.getElementById('leaderboard-search');
      this.sortSelect = document.getElementById('leaderboard-sort');
      this.searchTerm = '';
      this.sortBy = 'points';
    }

    sortCitizens(items) {
      const sorted = [...items];
      if (this.sortBy === 'city') {
        return sorted.sort((a, b) => a.city.localeCompare(b.city) || b.greenPoints - a.greenPoints);
      }
      return sorted.sort((a, b) => b.greenPoints - a.greenPoints || a.name.localeCompare(b.name));
    }

    filterCitizens(items) {
      const term = this.searchTerm.trim().toLowerCase();
      if (!term) {
        return items;
      }
      return items.filter((citizen) => {
        return citizen.name.toLowerCase().includes(term) || citizen.city.toLowerCase().includes(term);
      });
    }

    render() {
      if (!this.tableBody) {
        return;
      }

      const filtered = this.filterCitizens(this.citizens);
      const sorted = this.sortCitizens(filtered);

      this.tableBody.innerHTML = '';

      if (!sorted.length) {
        const row = document.createElement('tr');
        row.innerHTML = '<td colspan="4"><div class="empty-state">No citizens match your search.</div></td>';
        this.tableBody.appendChild(row);
        return;
      }

      sorted.forEach((citizen, index) => {
        const row = document.createElement('tr');
        row.innerHTML = '<td>' + (index + 1) + '</td><td>' + citizen.name + '</td><td>' + citizen.city + '</td><td>' + citizen.greenPoints.toLocaleString() + '</td>';
        this.tableBody.appendChild(row);
      });
    }

    bindEvents() {
      if (this.searchInput) {
        this.searchInput.addEventListener('input', (event) => {
          this.searchTerm = event.target.value;
          this.render();
        });
      }

      if (this.sortSelect) {
        this.sortSelect.addEventListener('change', (event) => {
          this.sortBy = event.target.value;
          this.render();
        });
      }
    }

    init() {
      this.bindEvents();
      this.render();
    }
  }

  new LeaderboardManager().init();
}());
