(function () {
  var citizen = {
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
    ]
  };

  var dashboard = document.getElementById('dashboard-cards');
  var certificateList = document.getElementById('certificate-list');

  function renderCard(label, value) {
    var card = document.createElement('article');
    card.className = 'dashboard-card';
    card.innerHTML = '<span>' + label + '</span><strong>' + value + '</strong>';
    return card;
  }

  if (dashboard) {
    [
      { label: 'Citizen Name', value: citizen.name },
      { label: 'Green Points', value: citizen.greenPoints },
      { label: 'Completed Pickups', value: citizen.completedPickups },
      { label: 'Pending Pickups', value: citizen.pendingPickups },
      { label: 'Certificates Earned', value: citizen.certificatesEarned }
    ].forEach(function (item) {
      dashboard.appendChild(renderCard(item.label, item.value));
    });
  }

  if (certificateList) {
    citizen.certificates.forEach(function (certificate) {
      var item = document.createElement('li');
      item.textContent = certificate;
      certificateList.appendChild(item);
    });
  }
}());
