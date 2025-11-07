# Proposition 50 Vote Results Map

Interactive map showing Proposition 50 vote results by precinct for Alameda County, November 2025 Election.

## Features

- **Two visualization modes:**
  - **Shaded mode** (default): Color-coded precinct polygons showing YES percentage
  - **Proportional symbols mode**: Circles scaled by vote count, colored by YES percentage
  
- **Interactive features:**
  - Hover over precincts to see detailed vote counts and percentages
  - Command/Ctrl-click to select multiple precincts and view aggregated totals
  - City shortcuts (e.g., `#/mode/shaded/city/alameda`) to quickly view city-level data
  - URL-based state management - share links with specific views

- **Data display:**
  - County-level totals when no precinct is selected
  - Individual precinct data on hover
  - Aggregated totals for selected precincts
  - County average marker in bar graphs for comparison

## Usage

### URL Parameters

The map uses hash-based routing for clean URLs:

- `#/mode/shaded` - Shaded precinct view (default)
- `#/mode/proportional` - Proportional symbols view
- `#/mode/shaded/city/alameda` - View specific city
- `#/mode/proportional/precincts/305110+304800` - View specific precincts

**Mode synonyms:**
- `choropleth` = `shaded`
- `bubble` or `bubbles` = `proportional`

### Keyboard Shortcuts

- `M` - Toggle between shaded and proportional modes
- `Escape` - Clear precinct selection

### Selecting Precincts

- **Command/Ctrl-click** on a precinct to add it to selection
- Selected precincts show aggregated vote totals
- Selected precincts are highlighted with black borders
- URL updates automatically with selected precinct IDs

## Methodology

Uses data from Alameda County Registrar of Voters:

- [Statewide Special Election - November 04, 2025 - Unofficial Final Results](https://alamedacountyca.gov/rovresults/258/)
- [Cast Voter Records](https://airtable.com/appzbg5Z60K8CbQiB/shr1TpBYl4CY91fkS)
- ["Consolidated Precincts - November 4, 2025 Statewide Special Election"](https://data.acgov.org/datasets/5a0fa695ceb042c482d21ff7558628ff_0/explore)

## Files

- `index.html` - Main map page
- `app.js` - Map logic and interactivity
- `precincts_consolidated.geojson` - Precinct boundaries with vote data
- `preview.jpg` - Social media preview image

## GitHub Pages Setup

1. Push these files to a GitHub repository
2. Enable GitHub Pages in repository settings
3. Select the branch and folder (usually `main` branch, `/root` folder)
4. The map will be available at `https://[username].github.io/[repo-name]/`

## Required Files for GitHub Pages

Make sure these files are in the repository root:
- `index.html`
- `precincts_consolidated.geojson`

The map uses relative paths, so it will work when served from GitHub Pages.
