var WasteLoopValidation = (function () {
  function getValue(form, name) {
    var field = form.elements[name];
    return field ? field.value.trim() : '';
  }

  function isEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  function isMobile(value) {
    return /^[6-9]\d{9}$/.test(value);
  }

  function isPincode(value) {
    return /^\d{6}$/.test(value);
  }

  function showError(field, message) {
    var wrapper = field.closest('.form-field');
    var error = wrapper ? wrapper.querySelector('.error-text') : null;
    if (wrapper) {
      wrapper.classList.add('field-invalid');
    }
    if (error) {
      error.textContent = message;
    }
  }

  function clearError(field) {
    var wrapper = field.closest('.form-field');
    var error = wrapper ? wrapper.querySelector('.error-text') : null;
    if (wrapper) {
      wrapper.classList.remove('field-invalid');
    }
    if (error) {
      error.textContent = '';
    }
  }

  function validateRequired(form, rules) {
    var valid = true;
    rules.forEach(function (rule) {
      var field = form.elements[rule.name];
      var value = getValue(form, rule.name);
      if (!field) {
        return;
      }
      clearError(field);
      if (!value) {
        showError(field, rule.label + ' is required.');
        valid = false;
        return;
      }
      if (rule.type === 'email' && !isEmail(value)) {
        showError(field, 'Enter a valid email address.');
        valid = false;
      }
      if (rule.type === 'mobile' && !isMobile(value)) {
        showError(field, 'Enter a valid 10 digit Indian mobile number.');
        valid = false;
      }
      if (rule.type === 'pincode' && !isPincode(value)) {
        showError(field, 'Enter a valid 6 digit pincode.');
        valid = false;
      }
      if (rule.minLength && value.length < rule.minLength) {
        showError(field, rule.label + ' must be at least ' + rule.minLength + ' characters.');
        valid = false;
      }
      if (rule.minNumber && Number(value) < rule.minNumber) {
        showError(field, rule.label + ' must be at least ' + rule.minNumber + '.');
        valid = false;
      }
    });
    return valid;
  }

  function setMessage(target, text, type) {
    if (!target) {
      return;
    }
    target.className = 'status-message ' + type;
    target.textContent = text;
  }

  function clearFormErrors(form) {
    form.querySelectorAll('input, select, textarea').forEach(clearError);
  }

  return {
    validateRequired: validateRequired,
    setMessage: setMessage,
    clearFormErrors: clearFormErrors,
    isEmail: isEmail
  };
}());
