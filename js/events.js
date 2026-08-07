(function () {
  var contactForm = document.getElementById('contact-form');
  var message = document.getElementById('contact-message');

  if (contactForm) {
    contactForm.addEventListener('submit', function (event) {
      event.preventDefault();
      var valid = WasteLoopValidation.validateRequired(contactForm, [
        { name: 'name', label: 'Name' },
        { name: 'email', label: 'Email', type: 'email' },
        { name: 'subject', label: 'Subject' },
        { name: 'message', label: 'Message', minLength: 10 }
      ]);

      if (!valid) {
        WasteLoopValidation.setMessage(message, 'Please complete the highlighted fields.', 'error');
        return;
      }

      WasteLoopValidation.setMessage(message, 'Your message has been recorded for citizen support review.', 'success');
      contactForm.reset();
      WasteLoopValidation.clearFormErrors(contactForm);
    });
  }
}());
