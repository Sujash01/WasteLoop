(function () {
  var form = document.getElementById('track-form');
  var input = document.getElementById('request-id');
  var message = document.getElementById('track-message');
  var steps = Array.prototype.slice.call(document.querySelectorAll('.timeline-list li'));

  function wait(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  }

  function resetSteps() {
    steps.forEach(function (step) {
      step.classList.remove('active', 'completed');
    });
  }

  function updateStep(index) {
    steps.forEach(function (step, stepIndex) {
      step.classList.toggle('completed', stepIndex < index);
      step.classList.toggle('active', stepIndex === index);
    });
  }

  async function simulateTracking(requestId) {
    WasteLoopValidation.setMessage(message, 'Fetching status for Request ID ' + requestId + '...', 'success');
    resetSteps();
    for (var i = 0; i < steps.length; i += 1) {
      await wait(800);
      updateStep(i);
    }
    await wait(500);
    steps[steps.length - 1].classList.add('completed');
    WasteLoopValidation.setMessage(message, 'Request ' + requestId + ' status: Completed.', 'success');
  }

  if (form) {
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var requestId = input.value.trim().toUpperCase();
      if (!requestId) {
        WasteLoopValidation.setMessage(message, 'Please enter a Request ID.', 'error');
        input.focus();
        return;
      }
      simulateTracking(requestId);
    });
  }
}());
