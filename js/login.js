(function () {
  var form = document.getElementById('login-form');
  var message = document.getElementById('login-message');

  function fakeLogin(email) {
    return new Promise(function (resolve) {
      setTimeout(function () {
        resolve({ email: email, role: 'Citizen' });
      }, 700);
    });
  }

  if (form) {
    form.addEventListener('submit', async function (event) {
      event.preventDefault();
      var result = WasteLoopValidation.validateRequired(form, [
        { name: 'email', label: 'Email', type: 'email' },
        { name: 'password', label: 'Password', minLength: 6 }
      ]);

      if (!result.valid) {
        WasteLoopValidation.setMessage(message, 'Please correct the login details.', 'error');
        return;
      }

      WasteLoopValidation.setMessage(message, 'Validating citizen credentials...', 'success');
      var user = await fakeLogin(form.elements.email.value.trim());
      WasteLoopValidation.setMessage(message, 'Login successful for ' + user.email + ' as ' + user.role + '.', 'success');
      form.reset();
    });
  }
}());
