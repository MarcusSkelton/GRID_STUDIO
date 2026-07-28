/* ================================================================
   Colour palettes for geoscience visualisations
   Each palette is an array of [r, g, b] anchor stops in 0-255.
   ================================================================ */

const PALETTES = {
  viridis: {
    label: 'Viridis',
    description: 'Perceptually uniform',
    stops: [
      [68, 1, 84],
      [72, 40, 120],
      [62, 74, 137],
      [49, 104, 142],
      [38, 130, 142],
      [31, 158, 137],
      [53, 183, 121],
      [109, 205, 89],
      [180, 222, 44],
      [253, 231, 37],
    ],
  },
  turbo: {
    label: 'Turbo',
    description: 'High-contrast rainbow',
    stops: [
      [48, 18, 59],
      [64, 71, 189],
      [43, 149, 236],
      [43, 200, 175],
      [128, 235, 96],
      [211, 233, 55],
      [253, 190, 45],
      [242, 108, 47],
      [186, 47, 25],
      [122, 4, 3],
    ],
  },
  rainbow: {
    label: 'Rainbow (Jet)',
    description: 'Classic geophysics',
    stops: [
      [0, 0, 143],
      [0, 0, 255],
      [0, 127, 255],
      [0, 255, 255],
      [127, 255, 127],
      [255, 255, 0],
      [255, 127, 0],
      [255, 0, 0],
      [143, 0, 0],
    ],
  },
  plasma: {
    label: 'Plasma',
    description: 'Perceptually uniform',
    stops: [
      [13, 8, 135],
      [75, 3, 161],
      [125, 3, 168],
      [168, 34, 150],
      [203, 70, 121],
      [229, 107, 93],
      [248, 148, 65],
      [253, 195, 40],
      [240, 249, 33],
    ],
  },
  inferno: {
    label: 'Inferno',
    description: 'Perceptually uniform',
    stops: [
      [0, 0, 4],
      [40, 11, 84],
      [101, 21, 110],
      [159, 42, 99],
      [212, 72, 66],
      [245, 125, 21],
      [250, 193, 39],
      [252, 255, 164],
    ],
  },
  magma: {
    label: 'Magma',
    description: 'Perceptually uniform',
    stops: [
      [0, 0, 4],
      [28, 16, 68],
      [79, 18, 123],
      [129, 37, 129],
      [181, 54, 122],
      [229, 80, 100],
      [251, 135, 97],
      [254, 194, 135],
      [252, 253, 191],
    ],
  },
  rdbu: {
    label: 'Red–Blue diverging',
    description: 'Residuals / anomalies',
    stops: [
      [5, 48, 97],
      [33, 102, 172],
      [67, 147, 195],
      [146, 197, 222],
      [209, 229, 240],
      [247, 247, 247],
      [253, 219, 199],
      [244, 165, 130],
      [214, 96, 77],
      [178, 24, 43],
      [103, 0, 31],
    ],
  },
  spectral: {
    label: 'Spectral',
    description: 'Colour-blind friendly',
    stops: [
      [94, 79, 162],
      [50, 136, 189],
      [102, 194, 165],
      [171, 221, 164],
      [230, 245, 152],
      [255, 255, 191],
      [254, 224, 139],
      [253, 174, 97],
      [244, 109, 67],
      [213, 62, 79],
      [158, 1, 66],
    ],
  },
  terrain: {
    label: 'Terrain',
    description: 'Elevation / topography',
    stops: [
      [51, 51, 153],
      [51, 102, 204],
      [102, 178, 178],
      [153, 204, 153],
      [204, 204, 102],
      [204, 153, 102],
      [153, 102, 51],
      [204, 204, 204],
    ],
  },
  earth: {
    label: 'Earth',
    description: 'Soil / regolith',
    stops: [
      [40, 80, 40],
      [90, 120, 60],
      [150, 150, 80],
      [180, 150, 100],
      [160, 110, 70],
      [130, 80, 50],
      [95, 55, 35],
    ],
  },
  grayscale: {
    label: 'Greyscale',
    description: 'Monochrome',
    stops: [
      [10, 10, 10],
      [245, 245, 245],
    ],
  },
  cividis: {
    label: 'Cividis',
    description: 'Colour-blind safe',
    stops: [
      [0, 32, 76],
      [0, 51, 108],
      [37, 71, 116],
      [67, 91, 117],
      [95, 111, 118],
      [125, 133, 119],
      [160, 156, 115],
      [200, 181, 102],
      [242, 210, 79],
      [253, 233, 69],
    ],
  },
};

/**
 * Sample a palette at a normalised 0-1 position.
 * Interpolates linearly between anchor stops.
 */
function samplePalette(paletteName, t, reverse = false) {
  const p = PALETTES[paletteName] || PALETTES.viridis;
  const stops = reverse ? [...p.stops].reverse() : p.stops;
  if (!isFinite(t) || t < 0) t = 0;
  if (t > 1) t = 1;
  const scaled = t * (stops.length - 1);
  const i = Math.floor(scaled);
  const f = scaled - i;
  const c0 = stops[i];
  const c1 = stops[Math.min(i + 1, stops.length - 1)];
  return [
    Math.round(c0[0] + (c1[0] - c0[0]) * f),
    Math.round(c0[1] + (c1[1] - c0[1]) * f),
    Math.round(c0[2] + (c1[2] - c0[2]) * f),
  ];
}

/** Build a CSS linear-gradient string for a palette. */
function paletteToGradient(paletteName, reverse = false, angle = '90deg') {
  const stops = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    const [r, g, b] = samplePalette(paletteName, t, reverse);
    stops.push(`rgb(${r},${g},${b}) ${(t * 100).toFixed(0)}%`);
  }
  return `linear-gradient(${angle}, ${stops.join(', ')})`;
}
