// --- GitHub API Configuration ---
const GITHUB_OWNER = "ankudovychm";
const GITHUB_REPO = "NuHockeyRatings";
const GITHUB_BRANCH = "main";
const GITHUB_TOKEN = (typeof process !== 'undefined' && process.env && process.env.GITHUB_PAT) || "FAIL";

// Global variables for storing CSV player data
let womensPlayers = [];
let mensPlayers = [];

// Sets to track currently selected players in each grid
let selectedWomens = new Set();
let selectedMens = new Set();

// When the page loads, fetch CSV data, initialize dropdowns and set up tabs and submissions
window.addEventListener("DOMContentLoaded", async () => {
  setupTabs();

  // Fetch CSV files
  try {
    const womensResponse = await fetch("womens.csv");
    const womensText = await womensResponse.text();
    womensPlayers = parseCsvToArray(womensText);
  } catch (err) {
    console.error("Error fetching womens.csv:", err);
  }

  try {
    const mensResponse = await fetch("mens.csv");
    const mensText = await mensResponse.text();
    mensPlayers = parseCsvToArray(mensText);
  } catch (err) {
    console.error("Error fetching mens.csv:", err);
  }

  // Initialize dropdowns for each grid cell
  initGridCells("womens", womensPlayers, selectedWomens);
  initGridCells("mens", mensPlayers, selectedMens);

  // Attach submit button listeners
  document.querySelectorAll(".submit-button").forEach(button => {
    button.addEventListener("click", () => {
      const gridType = button.getAttribute("data-grid");
      submitGrid(gridType);
    });
  });
});

// --- CSV Parsing Utility ---
function parseCsvToArray(csvText) {
  const lines = csvText.trim().split(/\r?\n/);
  lines.shift(); // Remove header
  return lines.map(line => line.trim()).filter(line => line !== "");
}

// --- Initialize Grid Cells ---
// For each cell in the specified grid, set up the dropdown and search input.
function initGridCells(gridType, playersArray, selectedSet) {
  const cells = document.querySelectorAll(`.grid-cell[data-grid="${gridType}"]`);
  cells.forEach(cell => {
    const searchInput = cell.querySelector(".search-input");
    const dropdown = cell.querySelector(".dropdown");

    // Initially populate the dropdown
    updateDropdownOptions(dropdown, searchInput.value, playersArray, selectedSet);

    // On search input change, update the dropdown options based on the filter term.
    searchInput.addEventListener("input", () => {
      updateDropdownOptions(dropdown, searchInput.value, playersArray, selectedSet);
    });

    // When a selection is made, update the global selected set and refresh all dropdowns in this grid.
    dropdown.addEventListener("change", () => {
      updateSelectedSet(gridType, playersArray, selectedSet);
      refreshDropdowns(gridType, playersArray, selectedSet);
    });
  });
}

// --- Update Dropdown Options ---
// Rebuild the <select> options based on the search term and unique selections.
function updateDropdownOptions(dropdown, searchTerm, baseOptions, selectedSet) {
  // Preserve the current selection (if any)
  const currentSelection = dropdown.value;
  dropdown.innerHTML = "";

  // Add the blank option
  const blankOption = document.createElement("option");
  blankOption.value = "";
  blankOption.textContent = "Select a player...";
  dropdown.appendChild(blankOption);

  // Re-populate options that match the search term OR that are already selected in this dropdown.
  baseOptions.forEach(player => {
    if (
      player.toLowerCase().includes(searchTerm.toLowerCase()) ||
      player === currentSelection
    ) {
      const option = document.createElement("option");
      option.value = player;
      option.textContent = player;
      // Disable the option if it's already selected in another cell (unless it's the current selection)
      if (selectedSet.has(player) && player !== currentSelection) {
        option.disabled = true;
      }
      dropdown.appendChild(option);
    }
  });

  // Restore previous selection if still available
  dropdown.value = currentSelection;
}

// --- Refresh All Dropdowns in a Grid ---
// Re-run the filtering update for each dropdown in the grid (taking into account its own search input).
function refreshDropdowns(gridType, baseOptions, selectedSet) {
  const cells = document.querySelectorAll(`.grid-cell[data-grid="${gridType}"]`);
  cells.forEach(cell => {
    const searchInput = cell.querySelector(".search-input");
    const dropdown = cell.querySelector(".dropdown");
    updateDropdownOptions(dropdown, searchInput.value, baseOptions, selectedSet);
  });
}

// --- Update the Selected Set ---
// Scan all dropdowns in the grid and record the chosen players.
function updateSelectedSet(gridType, baseOptions, selectedSet) {
  selectedSet.clear();
  const cells = document.querySelectorAll(`.grid-cell[data-grid="${gridType}"]`);
  cells.forEach(cell => {
    const dropdown = cell.querySelector(".dropdown");
    if (dropdown.value) {
      selectedSet.add(dropdown.value);
    }
  });
}

// --- Submit Grid Data ---
// Gather each cell's selection and update the submissions.csv file in the repository.
function submitGrid(gridType) {
  const cells = document.querySelectorAll(`.grid-cell[data-grid="${gridType}"]`);
  let submission = [];
  let incomplete = false;

  cells.forEach(cell => {
    const row = cell.getAttribute("data-row");
    const col = cell.getAttribute("data-col");
    const dropdown = cell.querySelector(".dropdown");
    if (!dropdown.value) {
      incomplete = true;
    }
    submission.push({ row, col, selection: dropdown.value });
  });

  if (incomplete) {
    alert("Please make a selection for every cell before submitting.");
    return;
  }

  // Prepare the data payload (including team type, timestamp, and cell submissions)
  const payload = {
    team: gridType, // 'mens' or 'womens'
    timestamp: new Date().toISOString(),
    data: submission
  };

  // Update the submissions.csv file via GitHub API
  updateCsvInRepo(payload);
}

// --- Update CSV File in GitHub Repository ---
// This function fetches the current submissions.csv file (if it exists), appends new submission data,
// and commits the updated CSV back to your repository using the GitHub API.
async function updateCsvInRepo(submissionPayload) {
  const fileName = "submissions.csv";
  const fileUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${fileName}?ref=${GITHUB_BRANCH}`;

  let currentContent = "";
  let sha = null;
  try {
    const response = await fetch(fileUrl, {
      headers: {
        "Authorization": `token ${GITHUB_TOKEN}`,
        "Accept": "application/vnd.github+json"
      }
    });
    if (response.ok) {
      const data = await response.json();
      sha = data.sha;
      // Decode base64 content
      currentContent = atob(data.content);
    } else if (response.status === 404) {
      // File doesn't exist – initialize with a header row.
      currentContent = "team,timestamp,row,col,selection\n";
    } else {
      throw new Error("Error fetching file: " + response.statusText);
    }
  } catch (error) {
    console.error("Error fetching file:", error);
    alert("Error fetching the submissions file.");
    return;
  }

  // Append new submission rows to the current CSV content.
  const { team, timestamp, data } = submissionPayload;
  data.forEach(entry => {
    currentContent += `${team},${timestamp},${entry.row},${entry.col},${entry.selection}\n`;
  });

  // Prepare the commit payload (content must be base64-encoded)
  const updateUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${fileName}`;
  const payload = {
    message: `Update ${fileName} with new submission`,
    content: btoa(currentContent),
    branch: GITHUB_BRANCH,
    sha: sha
  };

  try {
    const updateResponse = await fetch(updateUrl, {
      method: "PUT",
      headers: {
        "Authorization": `token ${GITHUB_TOKEN}`,
        "Accept": "application/vnd.github+json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    if (updateResponse.ok) {
      alert("Submission updated successfully!");
    } else {
      const errorData = await updateResponse.json();
      console.error("Error updating file:", errorData);
      alert("Error updating the CSV file in the repo.");
    }
  } catch (error) {
    console.error("Error updating file:", error);
    alert("Error updating the CSV file in the repo.");
  }
}

// --- Tab Switching ---
function setupTabs() {
  const buttons = document.querySelectorAll(".tab-button");
  const contents = document.querySelectorAll(".tab-content");

  buttons.forEach(button => {
    button.addEventListener("click", () => {
      // Remove "active" from all buttons and hide all contents
      buttons.forEach(b => b.classList.remove("active"));
      contents.forEach(c => c.classList.remove("active"));

      // Activate the clicked button and corresponding tab content
      button.classList.add("active");
      const tabId = button.getAttribute("data-tab");
      document.getElementById(tabId).classList.add("active");
    });
  });
}