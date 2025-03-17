
import sys
import csv
import re
import requests
from bs4 import BeautifulSoup


def clean_name(text):
    """
    Remove digits from the player name and trim extra whitespace.
    """
    return re.sub(r'\d+', '', text).strip()


def scrape_roster(team, season):
    """
    For the given team ('mens' or 'womens') and season (e.g. "2023-24"),
    build the roster URL, fetch the page, and return a list of cleaned player names.
    """
    team = team.lower()
    if team == "mens":
        url = f"https://nuhuskies.com/sports/mens-ice-hockey/roster/{season}"
    elif team == "womens":
        url = f"https://nuhuskies.com/sports/womens-ice-hockey/roster/{season}"
    else:
        print(f"Unknown team type: {team}. Expected 'mens' or 'womens'.")
        return []

    print(f"Scraping {url}")
    try:
        response = requests.get(url)
        response.raise_for_status()
    except Exception as e:
        print(f"Error fetching page for season {season}: {e}")
        return []

    soup = BeautifulSoup(response.content, "html.parser")

    player_elements = soup.select("div.sidearm-roster-player-name")
    names = [clean_name(elem.get_text(strip=True)) for elem in player_elements]

    if not names:
        player_elements = soup.find_all("a", class_="sidearm-roster-player-name")
        names = [clean_name(elem.get_text(strip=True)) for elem in player_elements]

    if names:
        print(f"Found {len(names)} players for season {season}")
    else:
        print(f"No players found for season {season}. Check the page structure.")
    return names


def main(team, seasons):
    """
    Scrape each season for the specified team, deduplicate player names,
    and write the unique names to the corresponding CSV file.
    """
    unique_players = set()

    for season in seasons:
        names = scrape_roster(team, season)
        if names:
            unique_players.update(names)

    if unique_players:
        print(f"Total unique players found: {len(unique_players)}")
        csv_file = f"{team.lower()}.csv"
        with open(csv_file, "w", newline="", encoding="utf-8") as csvfile:
            writer = csv.writer(csvfile)
            writer.writerow(["name"])
            for name in sorted(unique_players):
                writer.writerow([name])
        print(f"Data written to {csv_file}")
    else:
        print("No player data was collected.")


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python scrape.py <team: mens|womens> <season1> <season2> ...")
        sys.exit(1)

    team = sys.argv[1]
    seasons = sys.argv[2:]
    main(team, seasons)