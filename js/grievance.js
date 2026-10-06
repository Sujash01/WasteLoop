/**
 * WasteLoop — Feature 4: Citizen Grievance / Complaint Portal
 *
 * A citizen registers a complaint, the portal stores it as a JSON file through
 * the Node.js backend (data/grievances.json — no database), and returns a
 * grievance ID such as GRV-2026-10482 that can be used to track progress.
 *
 * Status flow:  Submitted -> Under Review -> Assigned -> Resolved
 *
 * Demonstrates: async/await, try/catch, fetch(), Promises, setTimeout(),
 * event listeners, form validation, DOM manipulation, array methods.
 */

(function () {
  var els = {
    form: document.getElementById('grievance-form'),
    message: document.getElementById('grievance-message'),
    submit: document.getElementById('grievance-submit'),
    ticket: document.getElementById('grievance-ticket'),
    ticketId: document.getElementById('ticket-id'),
    ticketStatus: document.getElementById('ticket-status'),
    ticketType: document.getElementById('ticket-type'),
    ticketPickup: document.getElementById('ticket-pickup'),
    ticketRef: document.getElementById('ticket-reference'),
    ticketMobile: document.getElementById('ticket-mobile'),
    ticketDescription: document.getElementById('ticket-description'),
    ticketFlow: document.getElementById('ticket-flow'),
    trackForm: document.getElementById('grievance-track-form'),
    trackInput: document.getElementById('grievance-track-id'),
    trackMessage: document.getElementById('grievance-track-message'),
    pickupList: document.getElementById('grievance-pickups')
  };

  var STATUS_FLOW = ['Submitted', 'Under Review', 'Assigned', 'Resolved'];

  /* ------------------------------------------------------------------
     Validation rules
     ------------------------------------------------------------------ */
  function rules() {
    return [
      { name: 'citizenName', label: 'Citizen name', minLength: 3 },
      { name: 'complaintType', label: 'Complaint type' },
      { name: 'pickupId', label: 'Pickup Request ID' },
      { name: 'description', label: 'Description of the complaint', minLength: 15 },
      { name: 'mobile', label: 'Mobile number', type: 'mobile' },
      { name: 'contactMethod', label: 'Preferred contact method' }
    ];
  }

  function collectPayload() {
    return {
      citizenName: els.form.elements.citizenName.value.trim(),
      complaintType: els.form.elements.complaintType.value,
      pickupId: els.form.elements.pickupId.value.trim().toUpperCase(),
      description: els.form.elements.description.value.trim(),
      mobile: els.form.elements.mobile.value.trim(),
      email: els.form.elements.email.value.trim(),
      contactMethod: els.form.elements.contactMethod.value
    };
  }

  /* ------------------------------------------------------------------
     Rendering the tracking ticket
     ------------------------------------------------------------------ */
  function setText(element, value) {
    if (element) element.textContent = value;
  }

  function renderStatusFlow(status) {
    if (!els.ticketFlow) return;
    els.ticketFlow.innerHTML = '';

    var currentIndex = STATUS_FLOW.indexOf(status);

    STATUS_FLOW.forEach(function (step, index) {
      var item = document.createElement('li');
      item.textContent = step;
      if (index < currentIndex) item.classList.add('done');
      if (index === currentIndex) item.classList.add('current');
      els.ticketFlow.appendChild(item);
    });
  }

  function renderTicket(grievance) {
    if (!els.ticket || !grievance) return;

    setText(els.ticketId, grievance.id);
    setText(els.ticketStatus, grievance.status);
    setText(els.ticketType, grievance.complaintType);
    setText(els.ticketPickup, grievance.pickupId || 'Not linked to a pickup');
    setText(els.ticketRef, grievance.reference);
    setText(els.ticketMobile, grievance.mobile + ' (' + grievance.contactMethod + ')');
    setText(els.ticketDescription, grievance.description);

    renderStatusFlow(grievance.status);

    els.ticket.hidden = false;

    var empty = document.getElementById('grievance-empty');
    if (empty) empty.hidden = true;
  }

  /* ------------------------------------------------------------------
     Populate the pickup ID field with real requests
     ------------------------------------------------------------------ */
  function loadPickupSuggestions() {
    if (!els.pickupList) return;

    WasteLoopApi.listPickups('limit=50')
      .then(function (data) {
        els.pickupList.innerHTML = '';
        data.pickups.forEach(function (pickup) {
          var option = document.createElement('option');
          option.value = pickup.id;
          option.textContent = pickup.id + ' — ' + pickup.citizenName + ' (' + pickup.status + ')';
          els.pickupList.appendChild(option);
        });
      })
      .catch(function () {
        /* the citizen can still type an ID by hand */
      });
  }

  /* ------------------------------------------------------------------
     Submitting the grievance
     ------------------------------------------------------------------ */
  if (els.form) {
    els.form.addEventListener('submit', async function (event) {
      event.preventDefault();

      var result = WasteLoopValidation.validateRequired(els.form, rules());
      if (!result.valid) {
        WasteLoopValidation.setMessage(
          els.message,
          'Please correct the highlighted fields before submitting.',
          'error'
        );
        if (result.firstInvalid) result.firstInvalid.focus();
        return;
      }

      els.submit.disabled = true;
      els.submit.textContent = 'Submitting...';
      WasteLoopValidation.setMessage(
        els.message,
        'Registering your grievance with the WasteLoop Grievance Redressal Cell...',
        'success'
      );

      try {
        var data = await WasteLoopApi.createGrievance(collectPayload());

        WasteLoopValidation.setMessage(
          els.message,
          'Grievance registered successfully. Your Grievance ID is ' + data.grievance.id + '.',
          'success'
        );

        renderTicket(data.grievance);
        if (els.trackInput) els.trackInput.value = data.grievance.id;

        els.form.reset();
        WasteLoopValidation.clearFormErrors(els.form);

        // Walk the citizen through the redressal progress so the status flow
        // is visible. setTimeout staggers each step for readability.
        advanceWithDelay(data.grievance.id, 1);
      } catch (error) {
        WasteLoopValidation.setMessage(els.message, error.message, 'error');
        if (error.field && els.form.elements[error.field]) {
          WasteLoopValidation.showFieldError(els.form.elements[error.field], error.message);
        }
      } finally {
        els.submit.disabled = false;
        els.submit.textContent = 'Submit Grievance';
      }
    });
  }

  /* ------------------------------------------------------------------
     Tracking an existing grievance
     ------------------------------------------------------------------ */
  function advanceWithDelay(id, step) {
    if (step >= STATUS_FLOW.length) return;

    setTimeout(function () {
      WasteLoopApi.advanceGrievance(id)
        .then(function (data) {
          renderTicket(data.grievance);
          advanceWithDelay(id, step + 1);
        })
        .catch(function () {
          /* stop the animation; the citizen can refresh to see the real status */
        });
    }, 2200);
  }

  function trackGrievance(id) {
    if (!id) {
      WasteLoopValidation.setMessage(
        els.trackMessage,
        'Please enter a Grievance ID such as GRV-2026-10482.',
        'error'
      );
      return;
    }

    WasteLoopValidation.setMessage(
      els.trackMessage,
      'Fetching grievance ' + id + '...',
      'success'
    );

    WasteLoopApi.getGrievance(id)
      .then(function (data) {
        renderTicket(data.grievance);
        WasteLoopValidation.setMessage(
          els.trackMessage,
          'Grievance ' + data.grievance.id + ' is currently ' + data.grievance.status + '.',
          'success'
        );
      })
      .catch(function (error) {
        WasteLoopValidation.setMessage(els.trackMessage, error.message, 'error');
      });
  }

  if (els.trackForm) {
    els.trackForm.addEventListener('submit', function (event) {
      event.preventDefault();
      trackGrievance(els.trackInput.value.trim().toUpperCase());
    });
  }

  /* ------------------------------------------------------------------
     Deep link: grievance.html?id=GRV-2026-10482
     ------------------------------------------------------------------ */
  loadPickupSuggestions();

  var initialId = new URLSearchParams(window.location.search).get('id');
  if (initialId) {
    els.trackInput.value = initialId;
    trackGrievance(initialId);
  }
})();
