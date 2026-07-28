/* ================================================================
   File exporters:
     - Surfer 6 ASCII GRD (.grd)
     - Gmsh 4.1 ASCII mesh with node scalar data (.msh)
     - Single-band Float32 GeoTIFF (.tif)
     - Rendered PNG of the coloured grid (.png)
   ================================================================ */

/** Trigger a download from a Blob. */
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ---------------- Surfer 6 ASCII GRD ---------------- */
/*
   Header:
     DSAA
     <nx> <ny>
     <xmin> <xmax>
     <ymin> <ymax>
     <zmin> <zmax>
   Then ny rows of nx values (bottom-up), NaN values written as 1.70141e+038.
*/
function exportGRD(grid, filename = 'grid.grd') {
  const xmax = grid.xmin + (grid.nx - 1) * grid.cellSize;
  const ymax = grid.ymin + (grid.ny - 1) * grid.cellSize;
  const lines = [
    'DSAA',
    `${grid.nx} ${grid.ny}`,
    `${grid.xmin.toFixed(6)} ${xmax.toFixed(6)}`,
    `${grid.ymin.toFixed(6)} ${ymax.toFixed(6)}`,
    `${grid.vmin.toFixed(6)} ${grid.vmax.toFixed(6)}`,
  ];
  const BLANK = '1.70141e+038';
  for (let j = 0; j < grid.ny; j++) {
    const row = [];
    for (let i = 0; i < grid.nx; i++) {
      const v = grid.values[j * grid.nx + i];
      row.push(isFinite(v) ? v.toFixed(4) : BLANK);
    }
    lines.push(row.join(' '));
  }
  const blob = new Blob([lines.join('\n') + '\n'], { type: 'text/plain' });
  downloadBlob(blob, filename);
}

/* ---------------- Gmsh 4.1 ASCII mesh with node data ---------------- */
/*
   $MeshFormat 4.1 0 8  ...  $EndMeshFormat
   $Nodes  1 entity block with all nodes  $EndNodes
   $Elements 1 entity block of quads      $EndElements
   $NodeData  1 field  $EndNodeData
*/
function exportMSH(grid, filename = 'grid.msh') {
  const nx = grid.nx,
    ny = grid.ny;
  const nnodes = nx * ny;
  const nelems = (nx - 1) * (ny - 1);

  const out = [];
  out.push('$MeshFormat');
  out.push('4.1 0 8');
  out.push('$EndMeshFormat');

  // one 2D entity (surface, tag 1) for coherence
  out.push('$Entities');
  out.push('0 0 1 0');
  out.push('1 ' + `${grid.xmin} ${grid.ymin} 0 ` + `${grid.xmin + (nx - 1) * grid.cellSize} ${grid.ymin + (ny - 1) * grid.cellSize} 0 ` + '0 0');
  out.push('$EndEntities');

  // Nodes: single block with dim=2 tag=1
  out.push('$Nodes');
  out.push(`1 ${nnodes} 1 ${nnodes}`);
  out.push(`2 1 0 ${nnodes}`);
  // node tags
  for (let k = 1; k <= nnodes; k++) out.push(String(k));
  // node coords
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const x = grid.xmin + i * grid.cellSize;
      const y = grid.ymin + j * grid.cellSize;
      out.push(`${x} ${y} 0`);
    }
  }
  out.push('$EndNodes');

  // Elements: quads, type 3
  out.push('$Elements');
  out.push(`1 ${nelems} 1 ${nelems}`);
  out.push(`2 1 3 ${nelems}`);
  let etag = 1;
  for (let j = 0; j < ny - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const n0 = j * nx + i + 1;
      const n1 = j * nx + (i + 1) + 1;
      const n2 = (j + 1) * nx + (i + 1) + 1;
      const n3 = (j + 1) * nx + i + 1;
      out.push(`${etag} ${n0} ${n1} ${n2} ${n3}`);
      etag++;
    }
  }
  out.push('$EndElements');

  // Node scalar field
  out.push('$NodeData');
  out.push('1'); // number of string tags
  out.push('"value"');
  out.push('1'); // number of real tags
  out.push('0.0'); // time
  out.push('3'); // number of int tags
  out.push('0'); // time step
  out.push('1'); // components
  out.push(String(nnodes));
  for (let k = 0; k < nnodes; k++) {
    const v = grid.values[k];
    out.push(`${k + 1} ${isFinite(v) ? v : 0}`);
  }
  out.push('$EndNodeData');

  const blob = new Blob([out.join('\n') + '\n'], { type: 'text/plain' });
  downloadBlob(blob, filename);
}

/* ---------------- Minimal GeoTIFF (Float32, single band) ----------------

   Structure:
     - 8-byte little-endian TIFF header
     - Single IFD with the standard raster tags + GeoTIFF-specific tags
       (ModelTiepoint, ModelPixelScale, GeoKeyDirectory, GeoAsciiParams)
     - Float32 raster data (single strip)

   The GeoKeyDirectory keys we emit depend on the CRS kind:
     - projected  : GTModelType=1, ProjectedCSType=<epsg>
     - geographic : GTModelType=2, GeographicType=<epsg>
     - none       : GTModelType=0 (undefined) — tie-point + pixel-scale only

   opts:
     epsgCode: integer or 0/undefined for no CRS
     epsgKind: 'projected' | 'geographic' | 'none' (inferred if omitted)
     citation: optional ASCII citation string to embed
*/
function exportGeoTIFF(grid, filename = 'grid.tif', opts = {}) {
  const nx = grid.nx,
    ny = grid.ny;

  const epsgCode = opts.epsgCode | 0;
  const epsgKind =
    opts.epsgKind || (typeof classifyEPSG === 'function' ? classifyEPSG(epsgCode) : epsgCode > 0 ? 'projected' : 'none');
  const citation = opts.citation || (epsgCode > 0 ? `EPSG:${epsgCode}` : '');

  // Compose the pixel array. TIFF is top-down (row 0 is north), but our grid's
  // row 0 is at ymin (south). Flip vertically for TIFF, and set the tie-point
  // to the top-left corner accordingly.
  const pixels = new Float32Array(nx * ny);
  for (let j = 0; j < ny; j++) {
    const srcRow = ny - 1 - j;
    for (let i = 0; i < nx; i++) {
      pixels[j * nx + i] = grid.values[srcRow * nx + i];
    }
  }

  const pixelBytes = pixels.byteLength;

  // Tie point: top-left corner (i=0, j=0, k=0) → (xmin, ymax, 0)
  const ymax = grid.ymin + (ny - 1) * grid.cellSize;
  const tiePoint = new Float64Array([0, 0, 0, grid.xmin, ymax, 0]);
  const pixelScale = new Float64Array([grid.cellSize, grid.cellSize, 0]);

  /* ---- GeoKeyDirectory ----
     Format: header (4 SHORTS: keyDir version, key revision major/minor, N keys)
     followed by N * 4 SHORTS per key:
       [ keyID, tiffTagLocation, count, value_or_offset ]
     tiffTagLocation=0 means the value is stored inline in the fourth SHORT.
     tiffTagLocation=34737 means the value is stored in the GeoAsciiParams tag,
     starting at offset `value` for `count` characters.
  */
  const keys = [];
  // GTRasterTypeGeoKey = 1 (RasterPixelIsArea) — always present
  keys.push([1025, 0, 1, 1]);

  let modelType = 0; // 0 = undefined
  if (epsgKind === 'projected') modelType = 1;
  else if (epsgKind === 'geographic') modelType = 2;
  keys.push([1024, 0, 1, modelType]); // GTModelTypeGeoKey

  // GTCitationGeoKey (1026) — points into GeoAsciiParams
  let geoAscii = '';
  if (citation) {
    // TIFF spec: GeoAscii strings are terminated by '|' (converted to \0 by readers).
    const cite = citation + '|';
    keys.push([1026, 34737, cite.length, geoAscii.length]);
    geoAscii += cite;
  }

  if (epsgKind === 'projected' && epsgCode > 0) {
    keys.push([3072, 0, 1, epsgCode]); // ProjectedCSTypeGeoKey
    // PCSCitationGeoKey (3073)
    const cite = `EPSG:${epsgCode}|`;
    keys.push([3073, 34737, cite.length, geoAscii.length]);
    geoAscii += cite;
    // ProjLinearUnitsGeoKey (3076) = 9001 (metre) — the vast majority of the curated list
    keys.push([3076, 0, 1, 9001]);
  } else if (epsgKind === 'geographic' && epsgCode > 0) {
    keys.push([2048, 0, 1, epsgCode]); // GeographicTypeGeoKey
    const cite = `EPSG:${epsgCode}|`;
    keys.push([2049, 34737, cite.length, geoAscii.length]); // GeogCitationGeoKey
    geoAscii += cite;
    keys.push([2054, 0, 1, 9102]); // GeogAngularUnitsGeoKey = 9102 (degree)
  }

  // Sort keys by ID (required by the GeoTIFF spec).
  keys.sort((a, b) => a[0] - b[0]);

  // Build the flat Uint16Array: header + keys.
  const geoKeyDir = new Uint16Array(4 + keys.length * 4);
  geoKeyDir[0] = 1; // KeyDirectoryVersion
  geoKeyDir[1] = 1; // KeyRevision
  geoKeyDir[2] = 1; // MinorRevision
  geoKeyDir[3] = keys.length; // NumberOfKeys
  for (let k = 0; k < keys.length; k++) {
    const off = 4 + k * 4;
    geoKeyDir[off] = keys[k][0];
    geoKeyDir[off + 1] = keys[k][1];
    geoKeyDir[off + 2] = keys[k][2];
    geoKeyDir[off + 3] = keys[k][3];
  }

  const geoAsciiBytes = geoAscii ? new TextEncoder().encode(geoAscii + '\0') : null;

  // NoData: written as GDAL_NODATA ASCII tag.
  const nodataStr = 'nan\0';
  const nodataBytes = new TextEncoder().encode(nodataStr);

  // ------ Build IFD ------
  // Each IFD entry: 2 tag + 2 type + 4 count + 4 value/offset = 12 bytes.
  //
  // Types: 1=BYTE 2=ASCII 3=SHORT 4=LONG 11=FLOAT 12=DOUBLE
  //
  // Tags used:
  //   256 ImageWidth (LONG)
  //   257 ImageLength (LONG)
  //   258 BitsPerSample (SHORT) = 32
  //   259 Compression (SHORT) = 1
  //   262 PhotometricInterpretation (SHORT) = 1 (BlackIsZero)
  //   273 StripOffsets (LONG) → offset to pixel data
  //   277 SamplesPerPixel (SHORT) = 1
  //   278 RowsPerStrip (LONG) = ny
  //   279 StripByteCounts (LONG) = pixelBytes
  //   282 XResolution (RATIONAL) — not needed; skip
  //   339 SampleFormat (SHORT) = 3 (IEEE FP)
  //   33550 ModelPixelScaleTag (DOUBLE ×3)
  //   33922 ModelTiepointTag (DOUBLE ×6)
  //   34735 GeoKeyDirectoryTag (SHORT ×12)
  //   42113 GDAL_NODATA (ASCII)

  const entries = [
    { tag: 256, type: 4, count: 1, value: nx },
    { tag: 257, type: 4, count: 1, value: ny },
    { tag: 258, type: 3, count: 1, value: 32 },
    { tag: 259, type: 3, count: 1, value: 1 },
    { tag: 262, type: 3, count: 1, value: 1 },
    { tag: 273, type: 4, count: 1, value: null, dataBytes: null, dataKind: 'stripOffset' },
    { tag: 277, type: 3, count: 1, value: 1 },
    { tag: 278, type: 4, count: 1, value: ny },
    { tag: 279, type: 4, count: 1, value: pixelBytes },
    { tag: 339, type: 3, count: 1, value: 3 },
    { tag: 33550, type: 12, count: 3, dataBytes: new Uint8Array(pixelScale.buffer) },
    { tag: 33922, type: 12, count: 6, dataBytes: new Uint8Array(tiePoint.buffer) },
    { tag: 34735, type: 3, count: geoKeyDir.length, dataBytes: new Uint8Array(geoKeyDir.buffer) },
    { tag: 42113, type: 2, count: nodataBytes.length, dataBytes: nodataBytes },
  ];
  if (geoAsciiBytes) {
    // Tag 34737 GeoAsciiParams — must come after 34735 in the sorted IFD.
    entries.push({ tag: 34737, type: 2, count: geoAsciiBytes.length, dataBytes: geoAsciiBytes });
  }
  // TIFF requires IFD entries to be sorted by tag number.
  entries.sort((a, b) => a.tag - b.tag);

  const numEntries = entries.length;
  const headerSize = 8;
  const ifdSize = 2 + numEntries * 12 + 4;

  // Pool for tag payloads > 4 bytes.
  let poolOffset = headerSize + ifdSize;
  for (const e of entries) {
    if (e.dataBytes && e.dataBytes.length > 4) {
      e.dataOffset = poolOffset;
      poolOffset += e.dataBytes.length;
      // pad to 2-byte alignment
      if (poolOffset % 2 === 1) poolOffset += 1;
    }
  }
  // Now pixel data offset
  const stripOffset = poolOffset;
  const totalSize = stripOffset + pixelBytes;

  const buf = new ArrayBuffer(totalSize);
  const dv = new DataView(buf);
  const u8 = new Uint8Array(buf);

  // Header: little-endian "II", version 42, IFD offset = 8
  dv.setUint16(0, 0x4949, true);
  dv.setUint16(2, 42, true);
  dv.setUint32(4, 8, true);

  // IFD entry count
  dv.setUint16(8, numEntries, true);

  let ep = 10;
  for (const e of entries) {
    dv.setUint16(ep, e.tag, true);
    dv.setUint16(ep + 2, e.type, true);
    dv.setUint32(ep + 4, e.count, true);
    if (e.dataKind === 'stripOffset') {
      dv.setUint32(ep + 8, stripOffset, true);
    } else if (e.dataBytes) {
      if (e.dataBytes.length <= 4) {
        // fits inline
        for (let k = 0; k < e.dataBytes.length; k++) u8[ep + 8 + k] = e.dataBytes[k];
      } else {
        dv.setUint32(ep + 8, e.dataOffset, true);
      }
    } else {
      // numeric value stored inline. For SHORT (type 3) and LONG (type 4).
      if (e.type === 3) {
        dv.setUint16(ep + 8, e.value, true);
      } else {
        dv.setUint32(ep + 8, e.value >>> 0, true);
      }
    }
    ep += 12;
  }
  // Next IFD offset = 0 (no more IFDs)
  dv.setUint32(ep, 0, true);

  // Write pool
  for (const e of entries) {
    if (e.dataBytes && e.dataBytes.length > 4) {
      u8.set(e.dataBytes, e.dataOffset);
    }
  }

  // Write pixels
  new Uint8Array(pixels.buffer).forEach((byte, k) => {
    u8[stripOffset + k] = byte;
  });
  // Faster: copy via set
  u8.set(new Uint8Array(pixels.buffer), stripOffset);

  const blob = new Blob([buf], { type: 'image/tiff' });
  downloadBlob(blob, filename);
}

/* ---------------- Rendered PNG (bonus) ---------------- */
function exportPNG(canvas, filename = 'grid.png') {
  canvas.toBlob(blob => downloadBlob(blob, filename), 'image/png');
}
