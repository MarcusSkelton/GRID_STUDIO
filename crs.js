/* ================================================================
   Curated EPSG list for the picker.

   Each entry:
     { code, label, kind: 'projected' | 'geographic', group }

   'code' 0 = no CRS (write bare tie-point / pixel-scale only).
   Anything not in this list is still supported via the custom EPSG input.
   ================================================================ */

const CRS_LIST = [
  // Convenience default
  { code: 0, label: 'No CRS (raw coordinates)', kind: 'none', group: 'None' },

  // Custom
  { code: -1, label: 'Custom EPSG code…', kind: 'custom', group: 'None' },

  // ---- Australia — GDA94 / MGA (most common in AU exploration) ----
  { code: 28349, label: 'GDA94 / MGA Zone 49 (WA — Perth region)', kind: 'projected', group: 'Australia · GDA94' },
  { code: 28350, label: 'GDA94 / MGA Zone 50 (WA — Kalgoorlie)', kind: 'projected', group: 'Australia · GDA94' },
  { code: 28351, label: 'GDA94 / MGA Zone 51 (WA/NT)', kind: 'projected', group: 'Australia · GDA94' },
  { code: 28352, label: 'GDA94 / MGA Zone 52 (NT — Darwin)', kind: 'projected', group: 'Australia · GDA94' },
  { code: 28353, label: 'GDA94 / MGA Zone 53 (NT/SA/QLD)', kind: 'projected', group: 'Australia · GDA94' },
  { code: 28354, label: 'GDA94 / MGA Zone 54 (SA/VIC)', kind: 'projected', group: 'Australia · GDA94' },
  { code: 28355, label: 'GDA94 / MGA Zone 55 (VIC/NSW/TAS)', kind: 'projected', group: 'Australia · GDA94' },
  { code: 28356, label: 'GDA94 / MGA Zone 56 (NSW/QLD)', kind: 'projected', group: 'Australia · GDA94' },

  // ---- Australia — GDA2020 / MGA ----
  { code: 7849, label: 'GDA2020 / MGA Zone 49', kind: 'projected', group: 'Australia · GDA2020' },
  { code: 7850, label: 'GDA2020 / MGA Zone 50', kind: 'projected', group: 'Australia · GDA2020' },
  { code: 7851, label: 'GDA2020 / MGA Zone 51', kind: 'projected', group: 'Australia · GDA2020' },
  { code: 7852, label: 'GDA2020 / MGA Zone 52', kind: 'projected', group: 'Australia · GDA2020' },
  { code: 7853, label: 'GDA2020 / MGA Zone 53', kind: 'projected', group: 'Australia · GDA2020' },
  { code: 7854, label: 'GDA2020 / MGA Zone 54', kind: 'projected', group: 'Australia · GDA2020' },
  { code: 7855, label: 'GDA2020 / MGA Zone 55', kind: 'projected', group: 'Australia · GDA2020' },
  { code: 7856, label: 'GDA2020 / MGA Zone 56', kind: 'projected', group: 'Australia · GDA2020' },

  // ---- Geographic ----
  { code: 4326, label: 'WGS 84 (lat/lon)', kind: 'geographic', group: 'Geographic' },
  { code: 4283, label: 'GDA94 (lat/lon)', kind: 'geographic', group: 'Geographic' },
  { code: 7844, label: 'GDA2020 (lat/lon)', kind: 'geographic', group: 'Geographic' },

  // ---- Global UTM WGS 84 (North) ----
  { code: 32601, label: 'WGS 84 / UTM Zone 1N', kind: 'projected', group: 'UTM · WGS 84 North' },
  { code: 32610, label: 'WGS 84 / UTM Zone 10N (US West Coast)', kind: 'projected', group: 'UTM · WGS 84 North' },
  { code: 32617, label: 'WGS 84 / UTM Zone 17N (Ontario / US East)', kind: 'projected', group: 'UTM · WGS 84 North' },
  { code: 32630, label: 'WGS 84 / UTM Zone 30N (UK / West Africa)', kind: 'projected', group: 'UTM · WGS 84 North' },
  { code: 32633, label: 'WGS 84 / UTM Zone 33N (Central Europe)', kind: 'projected', group: 'UTM · WGS 84 North' },

  // ---- Global UTM WGS 84 (South) ----
  { code: 32718, label: 'WGS 84 / UTM Zone 18S (Peru — Andean copper belt)', kind: 'projected', group: 'UTM · WGS 84 South' },
  { code: 32719, label: 'WGS 84 / UTM Zone 19S (Chile — copper belt)', kind: 'projected', group: 'UTM · WGS 84 South' },
  { code: 32720, label: 'WGS 84 / UTM Zone 20S (Argentina / Brazil)', kind: 'projected', group: 'UTM · WGS 84 South' },
  { code: 32734, label: 'WGS 84 / UTM Zone 34S (Southern Africa)', kind: 'projected', group: 'UTM · WGS 84 South' },
  { code: 32735, label: 'WGS 84 / UTM Zone 35S (Zambia — copperbelt)', kind: 'projected', group: 'UTM · WGS 84 South' },
  { code: 32736, label: 'WGS 84 / UTM Zone 36S (Southern Africa)', kind: 'projected', group: 'UTM · WGS 84 South' },
];

/** Look up an entry by EPSG code. Returns undefined if not in the curated list. */
function findCRS(code) {
  return CRS_LIST.find(c => c.code === code);
}

/**
 * Classify an arbitrary EPSG code as projected or geographic.
 * The EPSG registry follows conventions we can exploit for the common ranges:
 *   - 4000–4999 : geographic 2D CRSes
 *   - 32601–32660 : WGS84 UTM North
 *   - 32701–32760 : WGS84 UTM South
 *   - 28348–28358 : GDA94 MGA (projected)
 *   - 7842–7859 : GDA2020 (7844 is geographic, others projected)
 *   - Anything else in 20000–32760 range: assume projected
 * Users can override kind via the picker if needed.
 */
function classifyEPSG(code) {
  if (!code || code <= 0) return 'none';
  if (code >= 4000 && code <= 4999) return 'geographic';
  if (code === 4979 || code === 7844 || code === 4283) return 'geographic';
  if (code >= 20000 && code <= 32760) return 'projected';
  if (code >= 2000 && code <= 3999) return 'projected';
  if (code >= 5000 && code <= 6999) return 'projected';
  if (code >= 7000 && code <= 9999) return 'projected';
  // Default to projected; users can override the picker.
  return 'projected';
}
