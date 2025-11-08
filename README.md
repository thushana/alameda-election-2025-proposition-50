# Alameda City and County – image.pngProposition 50 Vote Results Map

An interactive map showing Proposition 50 vote results by precinct for Alameda County in the November 2025 Election. The data in it comes from a ACVote's Nov 7th, 2025 @ 3:32 PM data release.

[Proposition 50](https://voterguide.sos.ca.gov/quick-reference-guide/50.htm) was approved by voters on November 4, 2025, with 64% support, temporarily replacing the state's independent redistricting commission's congressional maps with Democrat-drawn districts through 2030. The measure, promoted by Governor Newsom as a response to Trump-backed Republican redistricting in Texas, could flip up to five GOP-held House seats to Democrats in the 2026 midterms.

## The Tool
I geeked out building this Election Results map for the November 2025 special election with data from Alameda County. My goal was to see how Alameda Island's voters went for Prop. 50 – a very partisan ballot item – as well as analyze the "Cast Voter Record" data files from the county.* This tool allows you to see city-wide and county-wide data at the precinct level. Hover or click a precinct for specific details including vote breakdowns as well as mail-in/in-person tallies, with a comparison against the county average. There's also a mode switch button that changes from [geographical boundary shading (choropleth)](https://thushana.github.io/alameda-election-2025-proposition-50/#city/alameda) to [proportional circles of the total votes](https://thushana.github.io/alameda-election-2025-proposition-50/#mode/proportional/city/alameda/). It's particularly useful at a county level to see it in that mode since some precincts had very low vote counts. [Land doesn't vote](https://storymaps.arcgis.com/stories/0e636a652d44484b9457f953994b212b). I wouldn't say there are major takeaways beyond Alameda's slightly increased swing leftward compared to last year's Harris/Trump breakdown, and the slight variabilty in neighborhood voting.

I wanted to do this for last year's election but – _incomprehensibly_ – they only had PDFs of the raw JSON data files, making any scripting on top of it nigh-impossible. Not the case for this year. Data sources are listed below.

## Analysis

- Islandwide Prop. 50 earned 83.9% of the vote.
- In November 2024, the Harris/Trump breakdown was 79.6%/20.4%, suggesting a +4.3% shift leftwards from 2024 to 2025 for ALameda voters who turned out.
- Alameda as a whole, and most city precincts, voted at higher levels of "Yes" than the county average. The three precincts in Bay Farm voted _below_ the county average for "Yes".
- Compared to other cities, Alameda vote percent for "Yes" was behind [Berkeley (94.3%)](https://thushana.github.io/alameda-election-2025-proposition-50/#city/berkeley), [Emeryville (92%)](https://thushana.github.io/alameda-election-2025-proposition-50/#city/emeryville), [Albany (90.8%)](https://thushana.github.io/alameda-election-2025-proposition-50/#city/albany) and [Oakland (91.8%)](https://thushana.github.io/alameda-election-2025-proposition-50/#city/oakland), and just slightly above [Piedmont (83.6%)](https://thushana.github.io/alameda-election-2025-proposition-50/#city/piedmont).
- Turnout in this election in Alameda was 27,207 voters. That's 51.4% of the 52,931 registered voters in Alameda for this special off-cycle election. This is ~70% of the 2024 General Election turnout, which was 38,349 or 72.5% of estimated registered voters. (There is no easily accessible city-level registered voter data for last year. Countywide registration was 1% smaller in 2024; if we apply that to a city level, there were an estimated 52,661 registered voters.) Alameda's turnout was noteably better than the [43.4% statewide registered voter turnout](https://electionresults.sos.ca.gov/returns/maps/voter-turnout).
- Mail-in votes dominated the returns at 94.6%. 
- Interestingly, there's a noticeable delta between in-person votes vs. mailed, with those voting in-person significantly more likely to vote "No" at 24.5% (vs. 15.7% for mail-in).

If you see something off, feel free to [email me](mailto:thushan@thushan.net).

## Methodology

This tool uses data from the Alameda County Registrar of Voters and others:

- ["Alameda County - Statewide Special Election - November 04, 2025 - Unofficial Final Results](https://alamedacountyca.gov/rovresults/258/)
- ["Alameda County - Cast Voter Records](https://airtable.com/appzbg5Z60K8CbQiB/shr1TpBYl4CY91fkS)
- ["Alameda County - Consolidated Precincts - November 4, 2025 Statewide Special Election"](https://data.acgov.org/datasets/5a0fa695ceb042c482d21ff7558628ff_0/explore)
- ["Alameda County - Official Election Site of Alameda County - Data Page"](https://alamedacountyca.gov/rov_app/edata?reportType=totalRegistered)
- ["State of California – Statewide Special Election Voter Turnout"](https://electionresults.sos.ca.gov/returns/maps/voter-turnout)
- ["The New York Times – An Extremely Detailed Map of the 2024 Election"](https://www.nytimes.com/interactive/2025/us/elections/2024-election-map-precinct-results.html)


*_To be wildly transparent, I actively canvassed for Prop. 50 at Alameda's ferries a couple times, and had a lawn sign in support of this proposition in our yard._


## Features

- **Two visualization modes:**
  - **Shaded mode** (default): Color-coded precinct polygons showing YES percentage
  - **Proportional symbols mode**: Circles scaled by vote count, colored by YES percentage
  
- **Interactive features:**
  - Hover over precincts to see detailed vote counts and percentages
  - Command/Ctrl-click to select multiple precincts and view aggregated totals
  - City shortcuts (e.g., `#city/alameda` or `#mode/proportional/city/alameda`) to quickly view city-level data
  - URL-based state management - share links with specific views

- **Data display:**
  - County-level totals when no precinct is selected
  - Individual precinct data on hover
  - Aggregated totals for selected precincts
  - County average marker in bar graphs for comparison

## Usage

### URL Parameters

The map uses hash-based routing for clean URLs:

- `#city/alameda` - View specific city (shaded mode, default)
- `#mode/proportional` - Proportional symbols view
- `#mode/proportional/city/alameda` - Proportional mode with specific city
- `#mode/proportional/precincts/305110+304800` - Proportional mode with specific precincts

**Note:** The `mode/shaded/` parameter is omitted from URLs since shaded mode is the default. Only include `mode/proportional/` when using proportional symbols mode.

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
