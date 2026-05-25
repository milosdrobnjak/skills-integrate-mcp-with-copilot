document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const messageDiv = document.getElementById("message");
  const teacherLoginBtn = document.getElementById("teacher-login-btn");
  const teacherLogoutBtn = document.getElementById("teacher-logout-btn");
  const teacherStatus = document.getElementById("teacher-status");
  const teacherModal = document.getElementById("teacher-modal");
  const teacherLoginForm = document.getElementById("teacher-login-form");
  const teacherCancelBtn = document.getElementById("teacher-cancel-btn");

  const TOKEN_KEY = "teacher_token";
  const USERNAME_KEY = "teacher_username";

  function getTeacherToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  function getTeacherUsername() {
    return localStorage.getItem(USERNAME_KEY);
  }

  function isTeacherLoggedIn() {
    return Boolean(getTeacherToken());
  }

  function getAuthHeaders() {
    const token = getTeacherToken();
    if (!token) {
      return {};
    }
    return {
      Authorization: `Bearer ${token}`,
    };
  }

  function showMessage(text, type) {
    messageDiv.textContent = text;
    messageDiv.className = type;
    messageDiv.classList.remove("hidden");

    setTimeout(() => {
      messageDiv.classList.add("hidden");
    }, 5000);
  }

  function renderTeacherState() {
    const loggedIn = isTeacherLoggedIn();
    const username = getTeacherUsername();

    teacherLoginBtn.classList.toggle("hidden", loggedIn);
    teacherLogoutBtn.classList.toggle("hidden", !loggedIn);

    if (loggedIn && username) {
      teacherStatus.textContent = `Teacher mode enabled (${username})`;
    } else {
      teacherStatus.textContent = "Viewing as student (read-only)";
    }
  }

  function openTeacherModal() {
    teacherModal.classList.remove("hidden");
  }

  function closeTeacherModal() {
    teacherModal.classList.add("hidden");
    teacherLoginForm.reset();
  }

  // Function to fetch activities from API
  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      const activities = await response.json();

      // Clear loading message
      activitiesList.innerHTML = "";
      activitySelect.innerHTML =
        '<option value="">-- Select an activity --</option>';

      // Populate activities list
      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const spotsLeft =
          details.max_participants - details.participants.length;

        // Create participants HTML with delete icons instead of bullet points
        const participantsHTML =
          details.participants.length > 0
            ? `<div class="participants-section">
              <h5>Participants:</h5>
              <ul class="participants-list">
                ${details.participants
                  .map(
                    (email) =>
                      `<li><span class="participant-email">${email}</span>${
                        isTeacherLoggedIn()
                          ? `<button class="delete-btn" data-activity="${name}" data-email="${email}">❌</button>`
                          : ""
                      }</li>`
                  )
                  .join("")}
              </ul>
            </div>`
            : `<p><em>No participants yet</em></p>`;

        activityCard.innerHTML = `
          <h4>${name}</h4>
          <p>${details.description}</p>
          <p><strong>Schedule:</strong> ${details.schedule}</p>
          <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
          <div class="participants-container">
            ${participantsHTML}
          </div>
        `;

        activitiesList.appendChild(activityCard);

        // Add option to select dropdown
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        activitySelect.appendChild(option);
      });

      if (isTeacherLoggedIn()) {
        // Add event listeners to delete buttons
        document.querySelectorAll(".delete-btn").forEach((button) => {
          button.addEventListener("click", handleUnregister);
        });
      }
    } catch (error) {
      activitiesList.innerHTML =
        "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  // Handle unregister functionality
  async function handleUnregister(event) {
    if (!isTeacherLoggedIn()) {
      showMessage("Only teachers can unregister students.", "error");
      return;
    }

    const button = event.target;
    const activity = button.getAttribute("data-activity");
    const email = button.getAttribute("data-email");

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/unregister?email=${encodeURIComponent(email)}`,
        {
          method: "DELETE",
          headers: {
            ...getAuthHeaders(),
          },
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        showMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showMessage("Failed to unregister. Please try again.", "error");
      console.error("Error unregistering:", error);
    }
  }

  // Handle teacher login
  teacherLoginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const username = document.getElementById("teacher-username").value;
    const password = document.getElementById("teacher-password").value;

    try {
      const response = await fetch("/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      const result = await response.json();

      if (response.ok) {
        localStorage.setItem(TOKEN_KEY, result.token);
        localStorage.setItem(USERNAME_KEY, result.username);
        renderTeacherState();
        closeTeacherModal();
        showMessage(`Logged in as ${result.username}.`, "success");
        fetchActivities();
      } else {
        showMessage(result.detail || "Login failed.", "error");
      }
    } catch (error) {
      showMessage("Failed to login. Please try again.", "error");
      console.error("Error logging in:", error);
    }
  });

  // Handle teacher logout
  teacherLogoutBtn.addEventListener("click", async () => {
    try {
      await fetch("/auth/logout", {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
        },
      });
    } catch (error) {
      // Ignore network errors on logout and clear local state anyway.
      console.error("Error logging out:", error);
    }

    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USERNAME_KEY);
    renderTeacherState();
    showMessage("Logged out.", "info");
    fetchActivities();
  });

  teacherLoginBtn.addEventListener("click", openTeacherModal);
  teacherCancelBtn.addEventListener("click", closeTeacherModal);

  teacherModal.addEventListener("click", (event) => {
    if (event.target === teacherModal) {
      closeTeacherModal();
    }
  });

  // Handle form submission
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!isTeacherLoggedIn()) {
      showMessage("Only teachers can register students.", "error");
      return;
    }

    const email = document.getElementById("email").value;
    const activity = document.getElementById("activity").value;

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
          headers: {
            ...getAuthHeaders(),
          },
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");
        signupForm.reset();

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        showMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showMessage("Failed to sign up. Please try again.", "error");
      console.error("Error signing up:", error);
    }
  });

  // Initialize app
  renderTeacherState();
  fetchActivities();
});
