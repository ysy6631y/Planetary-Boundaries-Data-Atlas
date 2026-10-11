# Catalog Overview

The application starts with no selected boundary. The Full view button clears selection and restores the system overview. H or the eye button hides interface overlays. The download button saves the current camera view at 3840 pixels wide, preserving viewport aspect ratio, without HTML UI or labels.

`planetary-data-atlas-4k.png` is a 3840 x 2160 capture. `overview-preview.png` includes interface and labels for reference. The JSON file records source datasets, camera, and radius validation.

Overview shows nine global boundary groups and six default local-analysis fields: 998 contextual point instances representing 649 rows from four distinct source datasets. Biosphere/freshwater and biogeochemical/novel-entities share source datasets; these are not independent observations. Ocean acidification, aerosols, and ozone have no matching local-analysis field. Their existing global controls remain visible. No missing data is fabricated, and all 96 datasets are not superimposed.

Verification: `node scripts/overview-browser-check.mjs`. All eleven risk radii remain unchanged. The export contains existing scene geometry, including the pre-existing non-data background layer; background marks must not be counted as observations.
