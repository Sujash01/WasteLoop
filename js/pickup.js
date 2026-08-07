(function () {
  var form = document.getElementById('pickup-form');
  var message = document.getElementById('pickup-message');
  var mockPickupRequests = [];

  function generateRequestId() {
    return 'WL-' + Date.now().toString().slice(-6) + '-' + Math.floor(100 + Math.random() * 900);
  }

  function saveMockRequest(request) {
    mockPickupRequests.push(request);
  }

  if (form) {
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var rules = [
        { name: 'citizenName', label: 'Citizen name' },
        { name: 'mobile', label: 'Mobile number', type: 'mobile' },
        { name: 'email', label: 'Email', type: 'email' },
        { name: 'address', label: 'Address', minLength: 8 },
        { name: 'city', label: 'City' },
        { name: 'pincode', label: 'Pincode', type: 'pincode' },
        { name: 'wasteCategory', label: 'Waste category' },
        { name: 'weight', label: 'Estimated weight', minNumber: 1 },
        { name: 'pickupDate', label: 'Preferred pickup date' }
      ];

      if (!WasteLoopValidation.validateRequired(form, rules)) {
        WasteLoopValidation.setMessage(message, 'Please correct the highlighted fields before submitting.', 'error');
        return;
      }

      var requestId = generateRequestId();
      saveMockRequest({
        id: requestId,
        name: form.elements.citizenName.value.trim(),
        city: form.elements.city.value.trim(),
        category: form.elements.wasteCategory.value,
        createdAt: new Date().toISOString()
      });
      WasteLoopValidation.setMessage(message, 'Pickup request submitted successfully. Your Request ID is ' + requestId + '.', 'success');
      form.reset();
      WasteLoopValidation.clearFormErrors(form);
    });
  }
}());
