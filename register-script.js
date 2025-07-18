function showToaster(message, type = 'error') {
  const toaster = document.getElementById('toaster');
  toaster.textContent = message;
  toaster.className = 'toaster ' + type;
  toaster.style.display = 'block';
  setTimeout(() => {
    toaster.style.display = 'none';
  }, 3000);
}

async function checkEmailExists(email) {
  try {
    const response = await fetch(`/check-email?email=${encodeURIComponent(email)}`);
    const data = await response.json();
    return data.exists;
  } catch (error) {
    console.error('Error checking email:', error);
    showToaster('Error checking email. Please try again later.', 'error');
    return false;
  }
}

async function validateForm(event) {
  event.preventDefault();
  const requiredFields = ['email', 'firstName', 'lastName', 'jobTitle', 'company', 'department', 'streetAddress', 'postalCode', 'phoneNumber', 'selectedState', 'selectedCountry', 'allowNotifications'];
  let allFieldsFilled = true;

  // Collect form data
  const formData = new FormData(document.getElementById('registrationForm'));
  const formValues = {};
  requiredFields.forEach(fieldName => {
    const fieldValue = formData.get(fieldName);
    formValues[fieldName] = fieldValue.trim();
    if (fieldValue === '') {
      allFieldsFilled = false;
    }
  });


  if (allFieldsFilled) {
    // Check if email already exists
    const email = formValues['email'];
    const emailExists = await checkEmailExists(email);

    if (emailExists) {
      showToaster('Email is already in use. Please use a different email.', 'error');
      return;
    }

    try {
      // Store form data in local storage (optional)
      localStorage.setItem('formData', JSON.stringify(formValues));

      // Submit form data to server
      document.getElementById('registrationForm').submit();
    } catch (error) {
      console.error('Error submitting form:', error);
      showToaster('Error submitting form. Please try again later.', 'error');
    }
  } else {
    showToaster('Please fill all required fields.', 'error');
  }
}

function checkRequiredFields() {
  const requiredFields = ['email', 'firstName', 'lastName', 'jobTitle', 'company', 'department', 'streetAddress', 'postalCode', 'phoneNumber', 'selectedState', 'selectedCountry', 'allowNotifications'];
  let allFieldsFilled = true;

  requiredFields.forEach(fieldName => {
    const field = document.getElementById(fieldName);
    if (fieldName === 'allowNotifications') {
      if (!field.checked) {
        allFieldsFilled = false;
      }
    } else {
      const fieldValue = field.value.trim();
      if (fieldValue === '') {
        allFieldsFilled = false;
      }
    }
  });

  const nextButton = document.getElementById('nextButton');
  if (allFieldsFilled) {
    nextButton.disabled = false;
    nextButton.style.cursor = 'pointer';
    nextButton.style.backgroundColor = '#4CAF50';
    nextButton.style.border = '1px solid #4CAF50';
    nextButton.style.color = '#fff';
  } else {
    nextButton.disabled = true;
    nextButton.style.cursor = 'not-allowed';
    nextButton.style.backgroundColor = '#dcdcdc';
    nextButton.style.border = '1px solid #dcdcdc';
    nextButton.style.color = '#a2a2a2';
  }
}

// Attach event listeners to required fields to enable/disable the button
const requiredFields = ['email', 'firstName', 'lastName', 'jobTitle', 'company', 'department', 'streetAddress', 'postalCode', 'phoneNumber', 'selectedState', 'selectedCountry', 'allowNotifications'];
requiredFields.forEach(fieldName => {
  document.getElementById(fieldName).addEventListener('input', checkRequiredFields);
});

// Call checkRequiredFields on page load to account for autofill
document.addEventListener('DOMContentLoaded', () => {
  checkRequiredFields();
  // Manually trigger input event for auto-filled fields
  requiredFields.forEach(fieldName => {
    const field = document.getElementById(fieldName);
    const event = new Event('input', { bubbles: true });
    field.dispatchEvent(event);
  });
});


      async function fetchCountries() {
        try {
          const response = await fetch(
            "https://restcountries.com/v3.1/all"
          );
          
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          
          const data = await response.json();
          
          // Validate that data is an array
          if (!Array.isArray(data)) {
            console.error("API response is not an array:", data);
            return [];
          }
          
          // Filter out any countries that don't have a name.common property
          const countries = data
            .filter(country => country.name && country.name.common)
            .map(country => country.name.common)
            .sort(); // Sort alphabetically
          
          return countries;
        } catch (error) {
          console.error("Error fetching countries:", error);
          // Return a fallback list of common countries
          return [
            "United States",
            "Canada",
            "United Kingdom",
            "Germany",
            "France",
            "Australia",
            "India",
            "China",
            "Japan",
            "Brazil"
          ].sort();
        }
      }

      // Function to show the country modal
      async function showCountryModal() {
        var modal = document.getElementById("countryModal");
        modal.style.display = "block";

        var countryOptionsWrapper = document.getElementById(
          "countryOptionsWrapper"
        );
        countryOptionsWrapper.style.display = "flex"; // Show the wrapper
        countryOptionsWrapper.style.flexDirection = "column"; // Show the wrapper
        countryOptionsWrapper.style.alignItems = "flex-end"; // Show the wrapper

        var countryOptions = document.getElementById("countryOptions");
        countryOptions.innerHTML = "";

        var selectedCountry =
          document.getElementById("selectedCountry").value; // Get the initially selected country

        var countries = await fetchCountries();

        countries.forEach(function (country) {
          var label = document.createElement("label");
          label.setAttribute("for", "country");
          label.className = "country-label"; // Add class to identify country labels
          var input = document.createElement("input");
          input.type = "radio"; // Use radio buttons
          input.name = "countryOption";
          input.value = country;

          // Create container for the SVG icon and country name
          var container = document.createElement("div");
          container.style.display = "flex";
          container.style.alignItems = "center"; // Align items vertically

          // Create SVG element for tick icon
          var svg = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "svg"
          );
          svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
          svg.setAttribute("width", "16");
          svg.setAttribute("height", "16");
          svg.setAttribute("viewBox", "0 0 24 24");

          var path = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "path"
          );
          path.setAttribute(
            "d",
            "M12 0c-6.627 0-12 5.373-12 12s5.373 12 12 12 12-5.373 12-12-5.373-12-12-12zm-1.959 17l-4.5-4.319 1.395-1.435 3.08 2.937 7.021-7.183 1.422 1.409-8.418 8.591"
          );
          path.setAttribute("fill", "green");

          svg.appendChild(path);

          // Check if the country is initially selected
          if (selectedCountry === country) {
            input.checked = true;
            svg.style.display = "inline-block";
            input.style.display = "none";
            container.style.border = "1px solid #d0ebb4"; // Add green border to the container
            container.style.gap = "3px"; // Add green border to the container
            container.style.padding = "5px";
            container.style.width = "min-content";
            container.style.marginTop = "10px";
            container.style.borderRadius = "3px";
          } else {
            svg.style.display = "none";
          }

          // Add event listener to the radio button
          input.addEventListener("change", function () {
            // Show SVG icon and hide radio buttons for the selected country
            var allRadioButtons =
              document.getElementsByName("countryOption");
            var selectedOptionFound = false; // Flag to track if the selected option is found

            // Reset styles for all options before checking the selected option
            for (var i = 0; i < allRadioButtons.length; i++) {
              allRadioButtons[i].nextElementSibling.style.display = "none";
              allRadioButtons[
                i
              ].nextElementSibling.parentElement.style.border = "none"; // Reset border
              allRadioButtons[
                i
              ].nextElementSibling.parentElement.style.padding = "0px"; // Add padding to the container
              allRadioButtons[
                i
              ].nextElementSibling.parentElement.style.marginTop = "0px";
            }

            for (var i = 0; i < allRadioButtons.length; i++) {
              if (allRadioButtons[i].checked) {
                selectedOptionFound = true;
                if (allRadioButtons[i].value === country) {
                  allRadioButtons[i].nextElementSibling.style.display =
                    "inline-block";
                  allRadioButtons[i].style.display = "none";
                  allRadioButtons[
                    i
                  ].nextElementSibling.parentElement.style.border =
                    "1px solid #d0ebb4"; // Add green border to the container
                  allRadioButtons[
                    i
                  ].nextElementSibling.parentElement.style.padding = "5px"; // Add padding to the container
                  allRadioButtons[
                    i
                  ].nextElementSibling.parentElement.style.width = "100%";
                  allRadioButtons[
                    i
                  ].nextElementSibling.parentElement.style.marginTop =
                    "0px";
                  allRadioButtons[
                    i
                  ].nextElementSibling.parentElement.style.borderRadius =
                    "3px";
                  allRadioButtons[
                    i
                  ].nextElementSibling.parentElement.style.gap = "3px";
                  document.getElementById("continueButton").style.display =
                    "block";
                } else {
                  allRadioButtons[i].nextElementSibling.style.display =
                    "none";
                  allRadioButtons[i].style.display = "none"; // Hide non-selected options
                }
              } else {
                allRadioButtons[i].nextElementSibling.style.display =
                  "none";
                allRadioButtons[i].style.display = "inline-block";
              }
            }
            if (!selectedOptionFound) {
              // If no option is selected, show all options
              for (var i = 0; i < allRadioButtons.length; i++) {
                allRadioButtons[i].nextElementSibling.style.display =
                  "none";
                allRadioButtons[i].style.display = "inline-block";
              }
            }
          });

          container.appendChild(input);
          container.appendChild(svg);
          container.appendChild(document.createTextNode(country));
          label.appendChild(container);
          countryOptions.appendChild(label);
        });

        // Reset the height to auto
        var ul = document.getElementById("countryOptions");
        ul.style.height = "auto";
      }

      // Function to close the country modal
      function closeCountryModal() {
        var modal = document.getElementById("countryModal");
        modal.style.display = "none";

        var countryOptionsWrapper = document.getElementById(
          "countryOptionsWrapper"
        );
        countryOptionsWrapper.style.display = "none"; // Hide the wrapper
      }

      // Function to select a country from the modal
      // Function to select a country from the modal
      function selectCountry() {
        var selectedCountry = document.querySelector(
          'input[name="countryOption"]:checked'
        ).value;
        document.getElementById("selectedCountry").value = selectedCountry;
        closeCountryModal();

        // Hide all other label options
        var allRadioButtons = document.getElementsByName("countryOption");
        for (var i = 0; i < allRadioButtons.length; i++) {
          var label = allRadioButtons[i].parentNode; // Get the label element
          if (allRadioButtons[i].value !== selectedCountry) {
            label.style.display = "none";
          } else {
            // Show the selected label with the SVG icon
            var svgIcon = label.querySelector("svg");
            svgIcon.style.display = "inline-block";
          }
        }
      }

      // Function to show the state modal
      async function showStateModal() {
        var selectedCountry =
          document.getElementById("selectedCountry").value;
        if (!selectedCountry) {
          showToaster("Please select a country first.");
          return;
        }

        var modal = document.getElementById("stateModal");
        modal.style.display = "block";
      }

      // Function to close the state modal
      function closeStateModal() {
        var modal = document.getElementById("stateModal");
        modal.style.display = "none";
      }

      // Function to select a state from the modal
      function selectState() {
        // Get the selected state from the input field in the modal
        var selectedState = document.getElementById("stateOptions").value;

        // Set the selected state in the input field on the main form
        document.getElementById("selectedState").value = selectedState;

        // Close the state modal
        closeStateModal();
      }

      // Function to search for countries
      // Function to search for countries
      function searchCountry() {
        var input,
          filter,
          ul,
          li,
          i,
          txtValue,
          countryValue,
          exactMatchFound;
        input = document.getElementById("countrySearch");
        filter = input.value.toUpperCase();
        ul = document.getElementById("countryOptions");
        li = ul.getElementsByTagName("label");
        exactMatchFound = false; // Flag to track if an exact match is found

        // Filter matching options and move exact match to top
        for (i = 0; i < li.length; i++) {
          txtValue = li[i].textContent || li[i].innerText;
          countryValue = li[i]
            .getElementsByTagName("input")[0]
            .value.trim()
            .toUpperCase(); // Trim the country name and convert to uppercase
          if (countryValue.startsWith(filter)) {
            // Show the option if it starts with the filter text
            li[i].style.display = "";
            if (countryValue === filter) {
              exactMatchFound = true;
              // Move the exact match option to the top
              ul.insertBefore(li[i], ul.firstChild);
            }
          } else {
            // Hide the option if it doesn't start with the filter text
            li[i].style.display = "none";
          }
        }

        // If no exact match found, reset order of options
        if (!exactMatchFound) {
          for (i = 0; i < li.length; i++) {
            li[i].style.display = "";
          }
        }

        // If search results found, set height of countryOptions to 10vh
        if (exactMatchFound || filter === "") {
          ul.style.height = filter === "" ? "auto" : "10vh"; // Revert to auto height when filter is empty
        } else {
          // Otherwise, set height to auto
          ul.style.height = "auto";
        }
      }

      function showLoading() {
        // Change button text to "Registering"
        const button = document.querySelector('.interphex-24-submit-btn');
        button.textContent = 'Registering';

        // Change button styles
        button.style.backgroundColor = 'white';
        button.style.color = '#121212';
        button.style.border = '3px solid #2980b9';
        button.style.borderColor = '#2980b9';

        // Create the loading bubbles div
        const loadingBubblesDiv = document.createElement('div');
        loadingBubblesDiv.classList.add('loading-bubbles');

        // Create three bubble divs
        for (let i = 0; i < 4; i++) {
          const bubbleDiv = document.createElement('div');
          bubbleDiv.classList.add('bubble');
          loadingBubblesDiv.appendChild(bubbleDiv);
        }

        // Append the loading bubbles div to the button after a delay
        setTimeout(() => {
          loadingBubblesDiv.style.display = 'inline-block'; // Show the loading bubbles
          button.appendChild(loadingBubblesDiv);
        }, 100); // Adjust delay as needed
      }