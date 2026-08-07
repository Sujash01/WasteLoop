(function () {
  var citizens = [
    { name: 'Meera Iyer', city: 'Bengaluru', greenPoints: 4220 },
    { name: 'Rohan Verma', city: 'Delhi', greenPoints: 3890 },
    { name: 'Aarav Sharma', city: 'Jaipur', greenPoints: 2480 },
    { name: 'Fatima Khan', city: 'Lucknow', greenPoints: 3610 },
    { name: 'Kabir Das', city: 'Bhopal', greenPoints: 3145 },
    { name: 'Ananya Rao', city: 'Pune', greenPoints: 4555 },
    { name: 'Nikhil Sen', city: 'Kolkata', greenPoints: 2760 }
  ];

  var tableBody = document.getElementById('leaderboard-body');

  function renderLeaderboard(data, callback) {
    data.sort(function (a, b) {
      return b.greenPoints - a.greenPoints;
    });
    callback(data);
  }

  if (tableBody) {
    renderLeaderboard(citizens, function (sortedCitizens) {
      sortedCitizens.forEach(function (citizen, index) {
        var row = document.createElement('tr');
        row.innerHTML = '<td>' + (index + 1) + '</td><td>' + citizen.name + '</td><td>' + citizen.city + '</td><td>' + citizen.greenPoints + '</td>';
        tableBody.appendChild(row);
      });
    });
  }
}());
