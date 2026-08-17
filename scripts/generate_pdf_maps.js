const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const turf = require('@turf/turf');

// Distinct palette for polygons
const PALETTE = [
  '#2563eb', '#16a34a', '#d97706', '#dc2626', '#7c3aed',
  '#db2777', '#0891b2', '#65a30d', '#ea580c', '#4f46e5',
  '#059669', '#b45309', '#e11d48', '#9333ea', '#0284c7',
  '#15803d', '#c2410c', '#6d28d9', '#be185d', '#0e7490',
  '#4d7c0f', '#9a3412', '#4338ca', '#047857', '#a16207',
  '#be123c', '#7e22ce'
];

function getBoundingBox(features) {
  let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
  features.forEach(f => {
    turf.coordEach(f, ([lng, lat]) => {
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    });
  });
  return { minLng, maxLng, minLat, maxLat };
}

function projectToSvg(lng, lat, bbox, width, height, padding = 40) {
  // Simple Mercator-like projection fitting bbox to width/height with padding
  const mapW = width - padding * 2;
  const mapH = height - padding * 2;

  const lngSpan = bbox.maxLng - bbox.minLng;
  const latSpan = bbox.maxLat - bbox.minLat;

  // Aspect ratio adjustment to preserve geographical proportions at ~16° Latitude (cos(16 deg) ~= 0.96)
  const cosLat = Math.cos(((bbox.minLat + bbox.maxLat) / 2) * Math.PI / 180);
  const geoAspect = (lngSpan * cosLat) / latSpan;
  const canvasAspect = mapW / mapH;

  let scaleX, scaleY, offsetX, offsetY;

  if (geoAspect > canvasAspect) {
    // Width is constraint
    scaleX = mapW / lngSpan;
    scaleY = scaleX / cosLat;
    offsetX = padding;
    offsetY = padding + (mapH - (latSpan * scaleY)) / 2;
  } else {
    // Height is constraint
    scaleY = mapH / latSpan;
    scaleX = scaleY * cosLat;
    offsetY = padding;
    offsetX = padding + (mapW - (lngSpan * scaleX)) / 2;
  }

  const x = offsetX + (lng - bbox.minLng) * scaleX;
  const y = height - (offsetY + (lat - bbox.minLat) * scaleY); // Invert Y for SVG

  return [x, y];
}

function generateSvgPath(geometry, bbox, width, height, padding) {
  const ringsToPath = (rings) => {
    return rings.map(ring => {
      return ring.map((coord, idx) => {
        const [x, y] = projectToSvg(coord[0], coord[1], bbox, width, height, padding);
        return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
      }).join(' ') + ' Z';
    }).join(' ');
  };

  if (geometry.type === 'Polygon') {
    return ringsToPath(geometry.coordinates);
  } else if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.map(poly => ringsToPath(poly)).join(' ');
  }
  return '';
}

function generateMapHtml({ title, subtitle, features, isNew, dateStr }) {
  const bbox = getBoundingBox(features);
  const svgWidth = 1100;
  const svgHeight = 780;
  const padding = 30;

  // Filter polygon zones
  const zones = features.filter(f => f.geometry && f.geometry.type.includes('Polygon'));

  // Sort zones by name if possible
  zones.sort((a, b) => {
    const nameA = (a.properties?.name || '').toLowerCase();
    const nameB = (b.properties?.name || '').toLowerCase();
    return nameA.localeCompare(nameB, 'vi', { numeric: true });
  });

  const svgPaths = [];
  const svgLabels = [];

  zones.forEach((zone, idx) => {
    const color = PALETTE[idx % PALETTE.length];
    const pathD = generateSvgPath(zone.geometry, bbox, svgWidth, svgHeight, padding);
    const props = zone.properties || {};
    const name = props.name || `TDP ${idx + 1}`;

    svgPaths.push(`
      <path 
        d="${pathD}" 
        fill="${color}" 
        fill-opacity="${isNew ? '0.35' : '0.28'}" 
        stroke="${isNew ? '#0284c7' : '#d97706'}" 
        stroke-width="${isNew ? '2.5' : '1.8'}" 
        stroke-dasharray="${isNew ? 'none' : '4,3'}"
        stroke-linejoin="round"
      />
    `);

    try {
      const center = turf.centerOfMass(zone);
      const [lng, lat] = center.geometry.coordinates;
      const [cx, cy] = projectToSvg(lng, lat, bbox, svgWidth, svgHeight, padding);

      // Shorten display name for label
      let labelText = name.replace(/^Tổ dân phố\s+/i, 'TDP ').replace(/^TDP\s+/i, '');
      if (labelText.length > 25) labelText = labelText.slice(0, 22) + '...';

      svgLabels.push(`
        <g transform="translate(${cx.toFixed(2)}, ${cy.toFixed(2)})">
          <rect x="-35" y="-10" width="70" height="20" rx="4" fill="#0f172a" fill-opacity="0.85" stroke="#ffffff" stroke-width="0.75" />
          <text text-anchor="middle" y="4" font-family="'Segoe UI', Arial, sans-serif" font-size="9.5" font-weight="bold" fill="#ffffff">${labelText}</text>
        </g>
      `);
    } catch (e) {}
  });

  // Table rows
  const tableRows = zones.map((z, i) => {
    const p = z.properties || {};
    const area = p.area ? `${p.area} ha` : '—';
    return `
      <tr>
        <td style="text-align: center; font-weight: bold; width: 35px;">${i + 1}</td>
        <td style="font-weight: 600; color: #0f172a;">${p.name || 'Không tên'}</td>
        <td style="text-align: right; color: #0369a1; font-weight: bold;">${area}</td>
      </tr>
    `;
  }).join('');

  return `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    @page {
      size: A3 landscape;
      margin: 10mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: 'Segoe UI', Arial, Helvetica, sans-serif;
      background-color: #ffffff;
      color: #0f172a;
      width: 400mm;
      height: 277mm;
      display: flex;
      flex-direction: column;
      padding: 5mm;
      border: 3px solid #0f172a;
      position: relative;
    }
    .header-box {
      border-bottom: 2px solid #0f172a;
      padding-bottom: 8px;
      margin-bottom: 10px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .gov-title {
      font-size: 11pt;
      font-weight: bold;
      text-transform: uppercase;
      color: #334155;
    }
    .main-title {
      font-size: 20pt;
      font-weight: 900;
      text-transform: uppercase;
      color: #0f172a;
      letter-spacing: 0.5px;
      margin: 3px 0;
    }
    .sub-title {
      font-size: 11pt;
      font-style: italic;
      color: #475569;
    }
    .meta-box {
      text-align: right;
      font-size: 9.5pt;
      color: #334155;
    }
    .content-container {
      display: flex;
      flex: 1;
      gap: 15px;
      overflow: hidden;
    }
    .map-frame {
      flex: 3;
      border: 1.5px solid #cbd5e1;
      border-radius: 8px;
      background-color: #f8fafc;
      position: relative;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .side-panel {
      flex: 1.2;
      border: 1.5px solid #cbd5e1;
      border-radius: 8px;
      padding: 12px;
      background-color: #ffffff;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .panel-title {
      font-size: 12pt;
      font-weight: bold;
      text-transform: uppercase;
      color: #0f172a;
      border-bottom: 2px solid #0284c7;
      padding-bottom: 6px;
      margin-bottom: 8px;
    }
    .table-wrapper {
      flex: 1;
      overflow-y: auto;
      border: 1px solid #e2e8f0;
      border-radius: 4px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 8.5pt;
    }
    th {
      background-color: #f1f5f9;
      color: #334155;
      font-weight: bold;
      text-align: left;
      padding: 6px 8px;
      position: sticky;
      top: 0;
      border-bottom: 1.5px solid #cbd5e1;
    }
    td {
      padding: 4px 8px;
      border-bottom: 1px solid #f1f5f9;
    }
    tr:nth-child(even) {
      background-color: #f8fafc;
    }
    .legend-box {
      margin-top: 10px;
      padding: 8px;
      background-color: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      font-size: 9pt;
    }
    .legend-item {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 4px;
    }
    .legend-line {
      width: 25px;
      height: 4px;
      border-radius: 2px;
    }
    .compass {
      position: absolute;
      top: 15px;
      right: 15px;
      width: 45px;
      height: 45px;
      background: rgba(255,255,255,0.9);
      border: 1px solid #cbd5e1;
      border-radius: 50%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      font-size: 9pt;
      box-shadow: 0 2px 6px rgba(0,0,0,0.1);
    }
    .footer-bar {
      margin-top: 8px;
      display: flex;
      justify-content: space-between;
      font-size: 8.5pt;
      color: #64748b;
      border-top: 1px solid #e2e8f0;
      padding-top: 6px;
    }
  </style>
</head>
<body>
  <div class="header-box">
    <div>
      <div class="gov-title">ỦY BAN NHÂN DÂN PHƯỜNG LIÊN CHIỂU - CÔNG AN PHƯỜNG LIÊN CHIỂU</div>
      <h1 class="main-title">${title}</h1>
      <div class="sub-title">${subtitle}</div>
    </div>
    <div class="meta-box">
      <div><b>Hệ quy chiếu:</b> WGS-84 / Tọa độ vệ tinh GIS</div>
      <div><b>Tổng số vùng quản lý:</b> ${zones.length} Tổ dân phố</div>
      <div><b>Ngày kết xuất:</b> ${dateStr}</div>
    </div>
  </div>

  <div class="content-container">
    <div class="map-frame">
      <div class="compass">
        <span>▲</span>
        <span style="font-size: 7.5pt;">BẮC</span>
      </div>

      <svg viewBox="0 0 ${svgWidth} ${svgHeight}" width="100%" height="100%" style="display: block;">
        <!-- Background Grid Gridlines -->
        <defs>
          <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
            <path d="M 60 0 L 0 0 0 60" fill="none" stroke="#e2e8f0" stroke-width="0.75"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />

        <!-- Boundaries -->
        <g id="boundaries">
          ${svgPaths.join('\n')}
        </g>

        <!-- Centroid Labels -->
        <g id="labels">
          ${svgLabels.join('\n')}
        </g>
      </svg>
    </div>

    <div class="side-panel">
      <div class="panel-title">DANH MỤC TỔ DÂN PHỐ (${zones.length})</div>
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th style="text-align: center;">STT</th>
              <th>Tên Tổ Dân Phố</th>
              <th style="text-align: right;">Diện tích</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
      </div>

      <div class="legend-box">
        <div style="font-weight: bold; margin-bottom: 3px;">CHÚ GIẢI KỸ THUẬT:</div>
        <div class="legend-item">
          <div class="legend-line" style="background: ${isNew ? '#0284c7' : '#d97706'}; ${isNew ? '' : 'border-top: 2px dashed #d97706; background: transparent;'}"></div>
          <span>${isNew ? 'Ranh giới TDP mới (Nét liền xanh - 27 TDP)' : 'Ranh giới TDP cũ (Nét đứt vàng hổ phách - 95 TDP)'}</span>
        </div>
        <div class="legend-item">
          <div style="width: 14px; height: 14px; background: #0f172a; border: 1px solid #ffffff; border-radius: 3px;"></div>
          <span>Nhãn định vị trọng tâm Tổ dân phố</span>
        </div>
      </div>
    </div>
  </div>

  <div class="footer-bar">
    <div>Hệ thống Số hóa Bản đồ Địa chính GIS &bull; Công an Liên Chiểu, TP. Đà Nẵng</div>
    <div>Bản đồ phục vụ công tác quản lý địa bàn & an ninh trật tự cơ sở</div>
  </div>
</body>
</html>
  `;
}

async function main() {
  const edgePath = "C:\\\\Program Files (x86)\\\\Microsoft\\\\Edge\\\\Application\\\\msedge.exe";
  const dateStr = new Date().toLocaleDateString('vi-VN');

  // 1. Export 27 New TDPs
  console.log('Generating 27 New TDP Map HTML & PDF...');
  const newGeo = JSON.parse(fs.readFileSync('public/Dean_Sat_Nhap_TDP_25_6_Zones_Only.geojson', 'utf8'));
  const newHtml = generateMapHtml({
    title: 'BẢN ĐỒ RANH GIỚI 27 TỔ DÂN PHỐ MỚI',
    subtitle: 'Đề án quy hoạch & sáp nhập Tổ dân phố phường Liên Chiểu (27 TDP chuẩn hóa)',
    features: newGeo.features,
    isNew: true,
    dateStr
  });
  fs.writeFileSync('temp_map_27_new.html', newHtml, 'utf8');

  // 2. Export 95 Old TDPs
  console.log('Generating 95 Old TDP Map HTML & PDF...');
  const oldGeo = JSON.parse(fs.readFileSync('public/lien_chieu_95_tdp_cu.geojson', 'utf8'));
  const oldHtml = generateMapHtml({
    title: 'BẢN ĐỒ RANH GIỚI 95 TỔ DÂN PHỐ CŨ',
    subtitle: 'Dữ liệu địa giới hành chính lịch sử 95 Tổ dân phố phường Liên Chiểu (theo KML)',
    features: oldGeo.features,
    isNew: false,
    dateStr
  });
  fs.writeFileSync('temp_map_95_old.html', oldHtml, 'utf8');

  // Convert HTML to PDF via Edge Headless
  const outPdf27 = path.resolve('Ban_Do_27_To_Dan_Pho_Moi_Lien_Chieu.pdf');
  const outPdf95 = path.resolve('Ban_Do_95_To_Dan_Pho_Cu_Lien_Chieu.pdf');
  const html27 = path.resolve('temp_map_27_new.html');
  const html95 = path.resolve('temp_map_95_old.html');

  console.log('Printing to PDF via Headless Edge...');
  execSync(`"${edgePath}" --headless --disable-gpu --no-pdf-header-footer --print-to-pdf="${outPdf27}" "${html27}"`);
  console.log(`✓ Exported: ${outPdf27}`);

  execSync(`"${edgePath}" --headless --disable-gpu --no-pdf-header-footer --print-to-pdf="${outPdf95}" "${html95}"`);
  console.log(`✓ Exported: ${outPdf95}`);

  // Also copy to public/ so users can download directly from the browser or URL if desired
  fs.copyFileSync(outPdf27, 'public/Ban_Do_27_To_Dan_Pho_Moi_Lien_Chieu.pdf');
  fs.copyFileSync(outPdf95, 'public/Ban_Do_95_To_Dan_Pho_Cu_Lien_Chieu.pdf');
  console.log('✓ Copied PDFs to public/ directory for instant web download.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
