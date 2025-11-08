#!/usr/bin/env python3
"""
Analyze Proposition 50 votes by precinct and create mapping data.
"""

import json
from collections import defaultdict
from typing import Dict, Tuple

# Load manifest files
print("Loading manifest files...")
with open('PrecinctPortionManifest.json', 'r') as f:
    portion_manifest = json.load(f)
    portion_to_precinct = {p['Id']: p['PrecinctId'] for p in portion_manifest['List']}

with open('PrecinctManifest.json', 'r') as f:
    precinct_manifest = json.load(f)
    precinct_id_to_name = {p['Id']: p['Description'] for p in precinct_manifest['List']}

with open('CandidateManifest.json', 'r') as f:
    candidate_manifest = json.load(f)
    # Contest 1 (Proposition 50): CandidateId 1 = NO, CandidateId 2 = YES
    contest1_candidates = {c['Id']: c['Description'] for c in candidate_manifest['List'] if c['ContestId'] == 1}
    print(f"Contest 1 candidates: {contest1_candidates}")

with open('CountingGroupManifest.json', 'r') as f:
    counting_group_manifest = json.load(f)
    # CountingGroupId 1 = Election Day (in-person), 2 = Vote by Mail (mail-in)
    counting_groups = {cg['Id']: cg['Description'] for cg in counting_group_manifest['List']}
    print(f"Counting groups: {counting_groups}")

# Track votes by precinct and counting group
# Structure: precinct_name -> counting_group_id -> {'yes': count, 'no': count, 'total': count}
precinct_votes_by_method: Dict[str, Dict[int, Dict[str, int]]] = defaultdict(lambda: defaultdict(lambda: {'yes': 0, 'no': 0, 'total': 0}))

# Also track total votes by precinct (for backward compatibility)
precinct_votes: Dict[str, Dict[str, int]] = defaultdict(lambda: {'yes': 0, 'no': 0, 'total': 0})

print("Processing CvrExport.json (this may take a while for large files)...")
# Process CvrExport.json
with open('CvrExport.json', 'r') as f:
    # Read the entire file
    data = json.load(f)
    
    # The file has a 'Sessions' key containing the vote records
    sessions = data.get('Sessions', [])
    total_records = len(sessions)
    print(f"Processing {total_records:,} vote records...")
    
    for i, record in enumerate(sessions):
        if (i + 1) % 100000 == 0:
            print(f"  Processed {i + 1:,} / {total_records:,} records...")
        
        # Get PrecinctPortionId from the record
        original = record.get('Original', {})
        cards = original.get('Cards', [])
        
        for card in cards:
            contests = card.get('Contests', [])
            
            for contest in contests:
                contest_id = contest.get('Id')
                
                # Only process Contest 1 (Proposition 50)
                if contest_id != 1:
                    continue
                
                # Get PrecinctPortionId from the card's parent
                # Actually, PrecinctPortionId is in the Original object
                precinct_portion_id = original.get('PrecinctPortionId')
                
                if not precinct_portion_id:
                    continue
                
                # Map to PrecinctId
                precinct_id = portion_to_precinct.get(precinct_portion_id)
                if not precinct_id:
                    continue
                
                # Map to precinct name
                precinct_name = precinct_id_to_name.get(precinct_id)
                if not precinct_name:
                    continue
                
                # Get CountingGroupId from the record
                counting_group_id = record.get('CountingGroupId')
                
                # Count votes
                marks = contest.get('Marks', [])
                if not isinstance(marks, list):
                    continue
                    
                for mark in marks:
                    if not isinstance(mark, dict):
                        continue
                    if mark.get('IsVote', False):
                        candidate_id = mark.get('CandidateId')
                        if candidate_id == 2:  # YES
                            precinct_votes[precinct_name]['yes'] += 1
                            precinct_votes[precinct_name]['total'] += 1
                            if counting_group_id:
                                precinct_votes_by_method[precinct_name][counting_group_id]['yes'] += 1
                                precinct_votes_by_method[precinct_name][counting_group_id]['total'] += 1
                        elif candidate_id == 1:  # NO
                            precinct_votes[precinct_name]['no'] += 1
                            precinct_votes[precinct_name]['total'] += 1
                            if counting_group_id:
                                precinct_votes_by_method[precinct_name][counting_group_id]['no'] += 1
                                precinct_votes_by_method[precinct_name][counting_group_id]['total'] += 1

print(f"\nFound votes in {len(precinct_votes)} precincts")

# Also include precincts that appear in CvrExport but have no votes (zero turnout or all undervotes)
# Get all precincts that appear in the data
all_precincts_in_data = set()
for record in sessions:
    original = record.get('Original', {})
    precinct_portion_id = original.get('PrecinctPortionId')
    if precinct_portion_id:
        precinct_id = portion_to_precinct.get(precinct_portion_id)
        if precinct_id:
            precinct_name = precinct_id_to_name.get(precinct_id)
            if precinct_name:
                all_precincts_in_data.add(precinct_name)
                # Initialize if not already in precinct_votes
                if precinct_name not in precinct_votes:
                    precinct_votes[precinct_name] = {'yes': 0, 'no': 0, 'total': 0}
                if precinct_name not in precinct_votes_by_method:
                    precinct_votes_by_method[precinct_name] = defaultdict(lambda: {'yes': 0, 'no': 0, 'total': 0})

print(f"Total precincts in data: {len(all_precincts_in_data)}")
print(f"Precincts with votes: {len([p for p, v in precinct_votes.items() if v['total'] > 0])}")
print(f"Precincts with zero votes: {len([p for p, v in precinct_votes.items() if v['total'] == 0])}")

# Include ALL precincts from manifest, even if they don't appear in CvrExport
# (they may have had zero turnout)
all_manifest_precincts = set(precinct_id_to_name.values())
for precinct_name in all_manifest_precincts:
    if precinct_name not in precinct_votes:
        precinct_votes[precinct_name] = {'yes': 0, 'no': 0, 'total': 0}
    if precinct_name not in precinct_votes_by_method:
        precinct_votes_by_method[precinct_name] = defaultdict(lambda: {'yes': 0, 'no': 0, 'total': 0})

print(f"Total precincts in manifest: {len(all_manifest_precincts)}")
print(f"Total precincts in results: {len(precinct_votes)}")
print(f"Precincts with votes: {len([p for p, v in precinct_votes.items() if v['total'] > 0])}")
print(f"Precincts with zero votes: {len([p for p, v in precinct_votes.items() if v['total'] == 0])}")

# Calculate percentages and create summary
results = []
for precinct_name, votes in sorted(precinct_votes.items()):
    total = votes['total']
    yes_count = votes['yes']
    no_count = votes['no']
    
    if total > 0:
        yes_pct = (yes_count / total) * 100
        no_pct = (no_count / total) * 100
    else:
        yes_pct = 0
        no_pct = 0
    
    # Get vote method breakdown
    method_votes = precinct_votes_by_method.get(precinct_name, {})
    
    # CountingGroupId 1 = Election Day (in-person), 2 = Vote by Mail (mail-in)
    mail_in_votes = method_votes.get(2, {'yes': 0, 'no': 0, 'total': 0})
    in_person_votes = method_votes.get(1, {'yes': 0, 'no': 0, 'total': 0})
    
    # Calculate mail-in percentages
    mail_in_total = mail_in_votes['total']
    if mail_in_total > 0:
        mail_in_yes_pct = (mail_in_votes['yes'] / mail_in_total) * 100
        mail_in_no_pct = (mail_in_votes['no'] / mail_in_total) * 100
    else:
        mail_in_yes_pct = 0
        mail_in_no_pct = 0
    
    # Calculate in-person percentages
    in_person_total = in_person_votes['total']
    if in_person_total > 0:
        in_person_yes_pct = (in_person_votes['yes'] / in_person_total) * 100
        in_person_no_pct = (in_person_votes['no'] / in_person_total) * 100
    else:
        in_person_yes_pct = 0
        in_person_no_pct = 0
    
    # Calculate percentage of total for each method
    mail_in_pct_of_total = (mail_in_total / total * 100) if total > 0 else 0
    in_person_pct_of_total = (in_person_total / total * 100) if total > 0 else 0
    
    result = {
        'precinct': precinct_name,
        'votes': {
            'yes': yes_count,
            'no': no_count,
            'total': total
        },
        'percentage': {
            'yes': round(yes_pct, 2),
            'no': round(no_pct, 2)
        },
        'vote_method': {
            'mail_in': {
                'votes': {
                    'yes': mail_in_votes['yes'],
                    'no': mail_in_votes['no'],
                    'total': mail_in_total
                },
                'percentage': {
                    'yes': round(mail_in_yes_pct, 2),
                    'no': round(mail_in_no_pct, 2)
                },
                'percentage_of_total': round(mail_in_pct_of_total, 2)
            },
            'in_person': {
                'votes': {
                    'yes': in_person_votes['yes'],
                    'no': in_person_votes['no'],
                    'total': in_person_total
                },
                'percentage': {
                    'yes': round(in_person_yes_pct, 2),
                    'no': round(in_person_no_pct, 2)
                },
                'percentage_of_total': round(in_person_pct_of_total, 2)
            }
        }
    }
    
    results.append(result)

# Save results to JSON
output_file = 'prop50_precinct_results.json'
with open(output_file, 'w') as f:
    json.dump(results, f, indent=2)

# Also save to results.json to match the expected format
results_file = 'results.json'
with open(results_file, 'w') as f:
    json.dump(results, f, indent=2)

print(f"\nResults saved to {output_file} and results.json")
print(f"\nSample results (first 10 precincts):")
for r in results[:10]:
    print(f"  {r['precinct']}: YES {r['percentage']['yes']:.1f}% ({r['votes']['yes']}/{r['votes']['total']}), "
          f"NO {r['percentage']['no']:.1f}% ({r['votes']['no']}/{r['votes']['total']})")
    vm = r['vote_method']
    print(f"    Mail-in: {vm['mail_in']['percentage_of_total']:.1f}% of total, "
          f"In-person: {vm['in_person']['percentage_of_total']:.1f}% of total")

# Create geojson with vote data
print("\nCreating geojson with vote data...")
# Use the consolidated precincts file
geojson_filename = 'Consolidated_Precincts_-_November_4%2C_2025_Statewide_Special_Election.geojson'
with open(geojson_filename, 'r') as f:
    geojson = json.load(f)

# Create lookup by precinct name
results_lookup = {r['precinct']: r for r in results}

# Add vote data to geojson features
features_updated = 0
for feature in geojson['features']:
    props = feature['properties']
    # Use Precinct_ID from consolidated file
    precinct_name = str(props.get('Precinct_ID', props.get('precinct', props.get('ID', ''))))
    
    if precinct_name in results_lookup:
        vote_data = results_lookup[precinct_name]
        # Use nested structure only
        props['votes'] = vote_data['votes']
        props['percentage'] = vote_data['percentage']
        props['vote_method'] = vote_data['vote_method']
        features_updated += 1
    else:
        # Precinct exists in geojson but no vote data (shouldn't happen now, but just in case)
        props['votes'] = {'yes': 0, 'no': 0, 'total': 0}
        props['percentage'] = {'yes': 0, 'no': 0}
        props['vote_method'] = {
            'mail_in': {
                'votes': {'yes': 0, 'no': 0, 'total': 0},
                'percentage': {'yes': 0, 'no': 0},
                'percentage_of_total': 0
            },
            'in_person': {
                'votes': {'yes': 0, 'no': 0, 'total': 0},
                'percentage': {'yes': 0, 'no': 0},
                'percentage_of_total': 0
            }
        }

print(f"Updated {features_updated} features with vote data")

# Save updated geojson
geojson_output = 'prop50_precincts_map.geojson'
with open(geojson_output, 'w') as f:
    json.dump(geojson, f)

print(f"Geojson with vote data saved to {geojson_output}")
print("\nDone! You can now use the geojson file for mapping.")

