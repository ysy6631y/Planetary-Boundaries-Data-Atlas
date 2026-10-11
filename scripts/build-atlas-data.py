"""Read source archives without extraction or mutation; generate a deduplicated atlas."""
import csv
import hashlib
import io
import json
import re
from pathlib import Path
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public' / 'atlas-data'
OUT.mkdir(parents=True, exist_ok=True)
C, B, L, W, N, E = ('climate-change', 'biosphere-integrity', 'land-system-change',
                     'freshwater-change', 'biogeochemical-flows', 'novel-entities')
SECTIONS = {'01': [B, L, W], '02': [L], '03': [W, N, E], '04': [C], '05': [B, L, C]}
INDICATORS = {
    1: [L], 2: [W], 3: [B], 4: [L], 5: [L], 6: [L], 7: [L],
    8: [W], 9: [N], 10: [N], 11: [E], 12: [W, E],
    13: [C], 14: [C], 15: [C], 16: [C], 17: [L], 18: [B, L], 19: [B], 20: [B], 21: [C],
}
# Each axis and association is from the supplied CSV labels or accompanying README.
ANALYSES = {
 'raw_xyz': (['forest cover (%)', 'freshwater (m3/person/year)', 'Red List Index'], [B, L, W]),
 'raw_xyz_land_production_forest': (['agricultural land (%)', 'cereal yield (t/ha)', 'forest change (%)'], [L]),
 'raw_xy_land_structure': (['agricultural land (%)', 'arable land (%)'], [L]),
 'section02_main_01_xy_land_occupation_cultivation': (['agricultural land (%)', 'arable land (%)'], [L]),
 'section02_main_02_xy_land_occupation_productivity': (['agricultural land (%)', 'cereal yield (t/ha)'], [L]),
 'section02_main_03_xy_land_occupation_forest_change': (['agricultural land (%)', 'forest change (%)'], [L]),
 'section02_main_04_xy_productivity_forest_change': (['cereal yield (t/ha)', 'forest change (%)'], [L]),
 'projection_xy_agri_yield': (['agricultural land (%)', 'cereal yield (t/ha)'], [L]),
 'projection_xz_agri_forest_change': (['agricultural land (%)', 'forest change (%)'], [L]),
 'projection_yz_yield_forest_change': (['cereal yield (t/ha)', 'forest change (%)'], [L]),
 'section03_main_01_xy_extraction_material_use': (['water stress (%)', 'material consumption (tonnes/person)'], [W, E]),
 'section03_main_02_xyz_nutrient_chemical_input': (['nitrogen (kg/ha)', 'phosphate (kg/ha)', 'pesticide (kg/ha)'], [N, E]),
 'section03_main_03_xy_nutrient_input_balance': (['nitrogen (kg/ha)', 'phosphate (kg/ha)'], [N]),
 'section03_main_04_xy_nutrient_chemical_pressure': (['nitrogen (kg/ha)', 'pesticide (kg/ha)'], [N, E]),
 'section03_main_05_xy_phosphate_chemical_pressure': (['phosphate (kg/ha)', 'pesticide (kg/ha)'], [N, E]),
 'section03_main_06_xy_extraction_nutrient_input': (['water stress (%)', 'nitrogen (kg/ha)'], [W, N]),
 'section03_main_07_xy_material_chemical_pressure': (['material consumption (tonnes/person)', 'pesticide (kg/ha)'], [E]),
 'section04_optional_xyz_energy_co2_n2o': (['fossil electricity (%)', 'consumption CO2 (tonnes/person)', 'N2O (tonnes CO2e/person)'], [C]),
 'section04_main_01_xy_energy_dependence_co2_output': (['fossil electricity (%)', 'consumption CO2 (tonnes/person)'], [C]),
 'section04_main_02_xy_co2_n2o_per_capita': (['consumption CO2 (tonnes/person)', 'N2O (tonnes CO2e/person)'], [C]),
 'section04_main_03_xy_energy_dependence_n2o_output': (['fossil electricity (%)', 'N2O (tonnes CO2e/person)'], [C]),
 'section04_main_04_xy_energy_dependence_methane_total': (['fossil electricity (%)', 'CH4 (tonnes CO2e)'], [C]),
 'section04_main_05_xy_co2_methane_total': (['consumption CO2 (tonnes/person)', 'CH4 (tonnes CO2e)'], [C]),
 'OUTPUT_01_land_marine_kba_XYZ': (['terrestrial protection (%)', 'marine protection (%)', 'marine KBA protection (%)'], [B, L]),
 'OUTPUT_02_land_renewable_XY': (['renewable energy (%)', 'terrestrial protection (%)'], [C, B, L]),
 'OUTPUT_03_marine_renewable_XY': (['renewable energy (%)', 'marine protection (%)'], [C, B]),
 'OUTPUT_04_marine_kba_renewable_XY': (['renewable energy (%)', 'marine KBA protection (%)'], [C, B]),
}

def digest(value):
    return hashlib.sha256(value).hexdigest()

datasets, by_content, coverage, archive_hashes = [], {}, [], {}
archives = sorted(ROOT.glob('[0-9][0-9]_*.zip')) + [ROOT / 'final_csv_bundle.zip', ROOT / 'planetary_boundaries_redpoints_finalreading_bundle.zip']
for archive in archives:
    archive_hashes[archive.name] = digest(archive.read_bytes())
    with ZipFile(archive) as bundle:
        for path in sorted(bundle.namelist()):
            if path.startswith('__MACOSX/') or not path.endswith('.csv'):
                continue
            text = bundle.read(path).decode('utf-8-sig')
            parsed = list(csv.reader(io.StringIO(text)))
            columns, rows = parsed[0], parsed[1:]
            assert all(len(row) == len(columns) for row in rows), path
            source = {'archive': archive.name, 'path': path, 'sha256': digest(bundle.read(path))}
            if Path(path).name.startswith('ALL_'):
                coverage.append({**source, 'rows': len(rows), 'status': 'union index; section files retained separately'})
                continue
            content_id = digest(json.dumps([columns, rows], ensure_ascii=False).encode())[:20]
            if content_id in by_content:
                by_content[content_id]['sources'].append(source)
                coverage.append({**source, 'rows': len(rows), 'status': 'duplicate', 'dataset': content_id})
                continue
            section = re.search(r'(0[1-5])_[a-z]', path).group(1)
            stem = Path(path).stem
            role, axes, mappings, kind = 'records', [], SECTIONS[section], 'records'
            reason = 'Shared section analysis; not a planetary control variable.'
            if stem in ANALYSES:
                axes, mappings = ANALYSES[stem]
                role, kind = 'analysis', 'xyz' if 'z' in columns else 'xy'
                reason = 'Variables explicitly occur in this supplied analysis; contextual membership, not causal attribution.'
            elif columns[:3] == ['Entity', 'Code', 'Year'] or columns == ['iso', 'value']:
                number = int(re.search(r'/(\d\d)_[^/]+/', path).group(1))
                mappings = INDICATORS[number]
                if columns == ['iso', 'value']:
                    original = list(csv.reader(io.StringIO(bundle.read(path.replace('processed.csv', 'source.csv')).decode('utf-8-sig'))))[0][3]
                    role, kind, axes = 'processed', 'category', ['Entity (categorical layout)', original]
                else:
                    role, kind, axes = 'history', 'history', ['Year', columns[3]]
                reason = 'Source indicator belongs to this boundary topic; raw units and years retained.'
                if number == 12:
                    reason = 'Context only: material consumption is co-analysed with water and pesticides in section03. Not a direct PB measure.'
            elif stem == 'red_points':
                role = 'red-points'
                reason = 'Source-defined red record; no transfer to another cohort or source series.'
            elif stem == 'final_reading_relations':
                role = 'relations'
                reason = 'Source-defined variable relations, not country-to-country edges.'
            elif stem == 'final_reading_summary':
                role = 'summary'
            elif stem.startswith('stat_'):
                role = 'statistics'
                if section == '03' and 'water_stress' in stem:
                    mappings = [W]
            else:
                raise ValueError(f'Unreviewed CSV: {path}')
            item = {'id': content_id, 'title': Path(path).parent.name + '/' + Path(path).name if kind in ('history', 'category') else Path(path).name,
                    'section': section, 'role': role, 'kind': kind, 'axes': axes, 'boundaries': mappings,
                    'mappingReason': reason, 'rowCount': len(rows), 'columns': columns, 'sources': [source],
                    'url': f'/atlas-data/{content_id}.json', 'defaultMode': 'log' if stem == 'section04_optional_xyz_energy_co2_n2o' else 'linear'}
            (OUT / f'{content_id}.json').write_text(json.dumps({'columns': columns, 'rows': rows}, ensure_ascii=False, separators=(',', ':')) + '\n')
            datasets.append(item)
            by_content[content_id] = item
            coverage.append({**source, 'rows': len(rows), 'status': 'included', 'dataset': content_id})

defaults = {C: 'section04_optional_xyz_energy_co2_n2o.csv', B: 'raw_xyz.csv', L: 'raw_xyz_land_production_forest.csv',
            W: 'raw_xyz.csv', N: 'section03_main_02_xyz_nutrient_chemical_input.csv', E: 'section03_main_02_xyz_nutrient_chemical_input.csv'}
boundaries = {key: {'datasets': [d['id'] for d in datasets if key in d['boundaries']],
                    'default': next(d['id'] for d in datasets if d['title'] == title)} for key, title in defaults.items()}
for key in ['ocean-acidification', 'atmospheric-aerosol-loading', 'stratospheric-ozone-depletion']:
    boundaries[key] = {'datasets': [], 'default': None, 'reason': 'No directly corresponding local analysis in supplied archives. Global PB controls remain available.'}
for archive in archives:
    assert digest(archive.read_bytes()) == archive_hashes[archive.name], 'Source archive changed'
manifest = {'datasets': datasets, 'boundaries': boundaries, 'coverage': coverage, 'archiveHashes': archive_hashes,
            'counts': {'csvFiles': len(coverage), 'uniqueDatasets': len(datasets), 'uniqueFileRows': sum(d['rowCount'] for d in datasets)}}
(ROOT / 'src/atlas-manifest.generated.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({**manifest['counts'], 'boundaries': {key: len(value['datasets']) for key, value in boundaries.items()}}))
