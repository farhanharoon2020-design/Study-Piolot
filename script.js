// 1. Select the form and the message paragraph.
const form = document.getElementById("studentForm");
const message = document.getElementById("message");
var attempts = 0; // var: older way to declare a variable.

// 2. These regular expressions describe allowed input formats.
const patterns = {
  fullName: /^[A-Za-z ]{3,80}$/,
  email: /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/,
  phone: /^03[0-9]{9}$/,
  cnic: /^[0-9]{5}-[0-9]{7}-[0-9]$/,
  username: /^[A-Za-z0-9_]{5,15}$/,
  password: /^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9\s])[^\s]{8,}$/
};

const fields = form.querySelectorAll("input:not([type=radio]), select");
const radios = form.querySelectorAll('input[name="gender"]');
const today = new Date();
// Use the local date rather than UTC for the date input maximum.
const dateLimit = today.getFullYear() + "-" +
  String(today.getMonth() + 1).padStart(2, "0") + "-" +
  String(today.getDate()).padStart(2, "0");
document.getElementById("dob").max = dateLimit;

// 3. Check one field and show an error below it.
function validateField(field) {
  let error = ""; // let: its value can change.
  const value = field.value;
  field.setCustomValidity(""); // Clear the previous custom error.

  if (field.type === "checkbox") {
    if (!field.checked) error = "Please accept the terms.";
  } else if (field.required && value.trim() === "") {
    error = "This field is required.";
  } else if (value !== "") {
    if (patterns[field.id] && !patterns[field.id].test(value)) {
      error = "Use the correct format shown in the field.";
    } else if (field.id === "fullName" && value.trim().length < 3) {
      error = "Enter at least 3 characters.";
    } else if (field.id === "confirmPassword" && value !== form.elements.password.value) {
      error = "Passwords do not match.";
    } else if (field.id === "age" && (!Number.isInteger(Number(value)) || value < 16 || value > 60)) {
      error = "Age must be a whole number between 16 and 60.";
    } else if (field.id === "dob") {
      const birth = new Date(value + "T00:00:00");
      if (Number.isNaN(birth.getTime()) || value > dateLimit) {
        error = "Enter a valid date, not a future date.";
      }
    } else if (field.id === "transcript") {
      const file = field.files[0];
      if (file && (!/\.(pdf|jpg|jpeg|png)$/i.test(file.name) || file.size > 5 * 1024 * 1024)) {
        error = "Choose a PDF, JPG or PNG no larger than 5 MB.";
      }
    }
    // Built-in HTML checks also cover numbers, URLs and input patterns.
    if (error === "" && !field.checkValidity()) {
      error = "Enter a valid value within the stated limits.";
    }
  }

  field.setCustomValidity(error);
  document.getElementById(field.id + "Error").textContent = error;
  field.setAttribute("aria-invalid", error !== "");
  field.classList.add("checked");
  return error === "";
}

// 4. Radio buttons form one group, so check them together.
function validateGender() {
  const selected = form.querySelector('input[name="gender"]:checked');
  document.getElementById("genderError").textContent = selected ? "" : "Select a gender.";
  for (const radio of radios) {
    radio.setAttribute("aria-invalid", !selected);
  }
  return selected !== null;
}

// 5. A loop adds the same events to all fields.
for (const field of fields) {
  field.addEventListener("blur", function () {
    validateField(field);
  });
  field.addEventListener("input", function () {
    message.textContent = "";
    validateField(field);
    if (field.id === "password" && form.elements.confirmPassword.value !== "") {
      validateField(form.elements.confirmPassword);
    }
  });
  field.addEventListener("change", function () {
    message.textContent = "";
    validateField(field);
  });
}
for (const radio of radios) {
  radio.addEventListener("change", function () {
    message.textContent = "";
    validateGender();
  });
}

// A click event gives simple feedback while the submit event does validation.
document.querySelector(".register-button").addEventListener("click", function () {
  message.textContent = "Checking your form...";
});

// 6. Validate everything when Register is pressed.
function handleSubmit(event) {
  event.preventDefault(); // Keep the page from refreshing.
  attempts++;
  let valid = true;

  for (const field of fields) {
    if (!validateField(field)) valid = false;
  }
  if (!validateGender()) valid = false;

  if (valid) {
    message.className = "success";
    message.textContent = "All registration details are valid. Your form is complete.";
    message.focus();
  } else {
    message.className = "failure";
    message.textContent = "Please fix the errors above.";
    form.querySelector('[aria-invalid="true"]').focus();
  }
}
form.addEventListener("submit", handleSubmit);
