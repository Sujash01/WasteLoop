/**
 * WasteLoop — Request Pickup page
 *
 * Handles the CRITICAL booking-date bug on three levels:
 *   1. the <input type="date"> min attribute is set dynamically to tomorrow,
 *   2. the date is validated again in JavaScript on submit,
 *   3. the Node.js backend validates it a third time before saving.
 * Nothing about the current date is hard coded anywhere.
 *
 * Also demonstrates: async/await, try/catch, fetch(), Promises, event listeners.
 */

(function () {
  var form = document.getElementById('pickup-form');
  var message = document.getElementById('pickup-message');
  var dateInput = document.getElementById('pickupDate');
  var policyNote = document.getElementById('pickup-date-policy');
  var submitButton = document.getElementById('pickup-submit');
  var receipt = document.getElementById('pickup-receipt');

  if (!form) return;

  /* ---------------------------------------------------------------
     STEP 1 — block past dates in the date picker itself.
     The minimum is calculated from the visitor's clock, never typed in.
     --------------------------------------------------------------- */
  function applyDatePolicy(minimumIso) {
    if (!dateInput) return;

    dateInput.min = minimumIso;
    // Pre-select tomorrow so the form is usable straight away.
    if (!dateInput.value || dateInput.value < minimumIso) {
      dateInput.value = minimumIso;
    }

    if (policyNote) {
      policyNote.textContent =
        'Bookings are accepted for future dates only. The earliest selectable date is ' +
        WasteLoopDates.formatLongDate(minimumIso) +
        ' (tomorrow). Today and past dates are rejected.';
    }
  }

  // Fall back to the local clock immediately, then reconcile with the server
  // clock so the browser and the backend can never disagree.
  applyDatePolicy(WasteLoopDates.tomorrowIso());

  WasteLoopDates.fetchMinimumDate()
    .then(applyDatePolicy)
    .catch(function () {
      /* offline — the local calculation above is already correct */
    });

  /* ---------------------------------------------------------------
     STEP 2 — the citizen edits the date: give immediate feedback.
     --------------------------------------------------------------- */
  if (dateInput) {
    dateInput.addEventListener('change', function () {
      var result = WasteLoopDates.validateBookingDate(dateInput.value);
      var wrapper = dateInput.closest('.form-field');
      var error = wrapper ? wrapper.querySelector('.error-text') : null;

      if (!result.valid) {
        if (wrapper) wrapper.classList.add('field-invalid');
        if (error) error.textContent = result.reason;
      } else {
        if (wrapper) wrapper.classList.remove('field-invalid');
        if (error) error.textContent = '';
      }
    });
  }

  /* ---------------------------------------------------------------
     STEP 3 — submit: validate, then POST /api/pickups with fetch().
     --------------------------------------------------------------- */
  function collectPayload() {
    return {
      citizenName: form.elements.citizenName.value.trim(),
      mobile: form.elements.mobile.value.trim(),
      email: form.elements.email.value.trim(),
      address: form.elements.address.value.trim(),
      city: form.elements.city.value.trim(),
      pincode: form.elements.pincode.value.trim(),
      wasteCategory: form.elements.wasteCategory.value,
      weight: Number(form.elements.weight.value),
      pickupDate: form.elements.pickupDate.value,
      remarks: form.elements.remarks.value.trim(),
      // Lets the server validate against the citizen's calendar day too.
      clientTimezoneOffset: new Date().getTimezoneOffset()
    };
  }

  function rules() {
    return [
      { name: 'citizenName', label: 'Citizen name', minLength: 3 },
      { name: 'mobile', label: 'Mobile number', type: 'mobile' },
      { name: 'email', label: 'Email', type: 'email' },
      { name: 'city', label: 'City' },
      { name: 'address', label: 'Address', minLength: 8 },
      { name: 'pincode', label: 'Pincode', type: 'pincode' },
      { name: 'wasteCategory', label: 'Waste category' },
      { name: 'weight', label: 'Estimated weight', minNumber: 1, maxNumber: 500 },
      {
        name: 'pickupDate',
        label: 'Preferred pickup date',
        // The JavaScript half of the date bug fix. Returning a string makes
        // this exact message appear under the field.
        validate: function (value) {
          var result = WasteLoopDates.validateBookingDate(value);
          return result.valid ? true : result.reason;
        }
      }
    ];
  }

  function showReceipt(pickup) {
    if (!receipt || !pickup) return;

    receipt.innerHTML = '';

    var heading = document.createElement('h2');
    heading.textContent = 'Pickup Request Registered';

    var grid = document.createElement('dl');
    grid.className = 'receipt-grid';

    [
      ['Pickup Request ID', pickup.id],
      ['Pickup Date', WasteLoopDates.formatLongDate(pickup.pickupDate)],
      ['Current Status', pickup.status],
      ['Waste Category', pickup.wasteCategory],
      ['Estimated Weight', pickup.weight + ' kg'],
      ['Allocated Collector', pickup.collector ? pickup.collector.name : 'Being allotted'],
      ['Vehicle Number', pickup.collector ? pickup.collector.vehicle : '—'],
      ['Estimated Distance', pickup.distanceKm ? pickup.distanceKm + ' km' : '—']
    ].forEach(function (pair) {
      var term = document.createElement('dt');
      var value = document.createElement('dd');
      term.textContent = pair[0];
      value.textContent = pair[1];
      grid.appendChild(term);
      grid.appendChild(value);
    });

    var actions = document.createElement('div');
    actions.className = 'form-actions';

    var track = document.createElement('a');
    track.className = 'btn btn-primary';
    track.href = 'track.html?id=' + encodeURIComponent(pickup.id);
    track.textContent = 'Track Live Collection';

    var certificate = document.createElement('a');
    certificate.className = 'btn btn-secondary';
    certificate.href = 'certificate.html?pickup=' + encodeURIComponent(pickup.id);
    certificate.textContent = 'Recycling Certificate';

    actions.appendChild(track);
    actions.appendChild(certificate);

    receipt.appendChild(heading);
    receipt.appendChild(grid);
    receipt.appendChild(actions);
    receipt.hidden = false;

    // Reveal the surrounding section too.
    var section = document.getElementById('pickup-receipt-section');
    if (section) {
      section.hidden = false;
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  form.addEventListener('submit', async function (event) {
    event.preventDefault();

    var result = WasteLoopValidation.validateRequired(form, rules());

    if (!result.valid) {
      WasteLoopValidation.setMessage(
        message,
        'Please correct the highlighted fields before submitting.',
        'error'
      );
      if (result.firstInvalid) result.firstInvalid.focus();
      return;
    }

    var payload = collectPayload();

    // Belt and braces: re-check the date immediately before the network call,
    // in case the page has been open across midnight.
    var dateCheck = WasteLoopDates.validateBookingDate(payload.pickupDate);
    if (!dateCheck.valid) {
      WasteLoopValidation.showFieldError(form.elements.pickupDate, dateCheck.reason);
      WasteLoopValidation.setMessage(message, dateCheck.reason, 'error');
      return;
    }

    submitButton.disabled = true;
    submitButton.textContent = 'Submitting...';
    WasteLoopValidation.setMessage(
      message,
      'Registering pickup request with the WasteLoop server...',
      'success'
    );

    try {
      // fetch() returns a Promise — awaited inside a try/catch.
      var data = await WasteLoopApi.createPickup(payload);

      WasteLoopValidation.setMessage(
        message,
        'Pickup request registered successfully. Your Request ID is ' + data.pickup.id + '.',
        'success'
      );

      showReceipt(data.pickup);
      form.reset();
      WasteLoopValidation.clearFormErrors(form);
      applyDatePolicy(dateCheck.minIso);
    } catch (error) {
      // The server rejected the request: show the exact reason it sent back.
      WasteLoopValidation.setMessage(message, error.message, 'error');
      if (error.field && form.elements[error.field]) {
        WasteLoopValidation.showFieldError(form.elements[error.field], error.message);
      }
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = 'Submit Request';
    }
  });
})();
