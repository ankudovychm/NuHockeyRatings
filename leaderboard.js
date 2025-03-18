document.addEventListener("DOMContentLoaded", function() {
  // URL for the raw CSV file. Ensure your repository is public.
  const csvUrl = "https://raw.githubusercontent.com/ankudovychm/NuHockeyRatings/main/submissions.csv";

  fetch(csvUrl)
    .then(response => response.text())
    .then(text => {
      const data = parseCSV(text);
      const leaderboards = computeLeaderboards(data);
      console.log("Computed Leaderboards:", leaderboards);
      updateLeaderboardTables(leaderboards);
    })
    .catch(err => {
      console.error("Error fetching CSV:", err);
    });
});

/**
 * Parse CSV text handling quoted fields and special characters.
 * Normalizes each field to NFC form and trims whitespace.
 * Returns an array of record objects with header keys.
 */
function parseCSV(text) {
  const lines = text.split(/\r?\n/);
  if (!lines || lines.length < 2) return [];
  const header = parseCSVLine(lines[0]).map(val => val.normalize("NFC").trim());
  const records = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const values = parseCSVLine(lines[i]).map(val => val.normalize("NFC").trim());
    if (values.length === header.length) {
      let record = {};
      header.forEach((col, idx) => {
        record[col] = values[idx];
      });
      records.push(record);
    }
  }
  return records;
}

/**
 * Parse a single CSV line into an array of values.
 * Supports quoted fields with escaped quotes.
 */
function parseCSVLine(line) {
  const result = [];
  let current = "";
  let insideQuote = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (insideQuote && line[i+1] === '"') {
        // Escaped quote
        current += '"';
        i++;
      } else {
        insideQuote = !insideQuote;
      }
    } else if (char === ',' && !insideQuote) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

/**
 * Compute leaderboards: group by team, then row, then col.
 * Normalizes the team field by trimming and converting to lowercase.
 * Returns an object:
 *   leaderboards[team][row][col] = { playerName: count, ... }
 */
function computeLeaderboards(records) {
  const leaderboards = {};
  records.forEach(record => {
    // Normalize team: trim whitespace and lowercase.
    const team = record.team.trim().toLowerCase();
    const row = record.row;
    const col = record.col;
    const selection = record.selection;
    if (!leaderboards[team]) leaderboards[team] = {};
    if (!leaderboards[team][row]) leaderboards[team][row] = {};
    if (!leaderboards[team][row][col]) leaderboards[team][row][col] = {};
    if (!leaderboards[team][row][col][selection]) {
      leaderboards[team][row][col][selection] = 0;
    }
    leaderboards[team][row][col][selection]++;
  });
  return leaderboards;
}

/**
 * Update both womens and mens leaderboard tables.
 * If no data exists for a team, an empty object is used.
 */
function updateLeaderboardTables(leaderboards) {
  updateTable("womensLeaderboardTable", leaderboards["womens"] || {});
  updateTable("mensLeaderboardTable", leaderboards["mens"] || {});
}

/**
 * Update each cell's scrollable container (.cell-content) with an unordered list
 * of all players (sorted by vote count descending) and their vote counts.
 */
function updateTable(tableId, teamData) {
  const table = document.getElementById(tableId);
  if (!table) return;
  const tbody = table.getElementsByTagName("tbody")[0];
  const rows = tbody.getElementsByTagName("tr");

  for (let rowEl of rows) {
    const rowCategory = rowEl.getAttribute("data-row");
    // For each cell in this row:
    const cells = rowEl.querySelectorAll("td");
    cells.forEach(cell => {
      const colCategory = cell.getAttribute("data-col");
      const contentDiv = cell.querySelector(".cell-content");
      contentDiv.innerHTML = ""; // Clear previous content

      if (teamData[rowCategory] && teamData[rowCategory][colCategory]) {
        let cellData = teamData[rowCategory][colCategory];
        // Sort player names by vote count descending
        let sortedPlayers = Object.keys(cellData).sort((a, b) => cellData[b] - cellData[a]);
        const ul = document.createElement("ul");
        sortedPlayers.forEach(player => {
          const li = document.createElement("li");
          li.textContent = `${player} (${cellData[player]})`;
          ul.appendChild(li);
        });
        contentDiv.appendChild(ul);
      } else {
        contentDiv.textContent = "No votes";
      }
    });
  }
}