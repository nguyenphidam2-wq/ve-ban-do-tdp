const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function generateHtmlWithGoogleMap({ title, subtitle, geojsonPath, isNew, dateStr }) {
  const geojson = JSON.parse(fs.readFileSync(geojsonPath, 'utf8'));
  const zones = geojson.features.filter(f => f.geometry && f.geometry.type.includes('Polygon'));
  
  zones.sort((a, b) => {
    const nameA = (a.properties?.name || '').toLowerCase();
    const nameB = (b.properties?.name || '').toLowerCase();
    return nameA.localeCompare(nameB, 'vi', { numeric: true });
  });

  const tableRows = zones.map((z, i) => {
    const p = z.properties || {};
    const area = p.area ? `${p.area} ha` : '—';
    return `
      <tr>
        <td style="text-align: center; font-weight: bold; width: 35px;">${i + 1}</td>
        <td style="font-weight: 600; color: #0f172a;">${p.name || 'Không tên'}</td>
        <td style="text-align: right; color: #0284c7; font-weight: bold;">${area}</td>
      </tr>
    `;
  }).join('');

  return `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    @page {
      size: A3 landscape;
      margin: 8mm;
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
      width: 404mm;
      height: 281mm;
      display: flex;
      flex-direction: column;
      padding: 6mm;
      border: 3px solid #0f172a;
      position: relative;
    }
    .header-box {
      border-bottom: 2px solid #0f172a;
      padding-bottom: 8px;
      margin-bottom: 8px;
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
      font-size: 21pt;
      font-weight: 900;
      text-transform: uppercase;
      color: #0f172a;
      letter-spacing: 0.5px;
      margin: 2px 0;
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
      gap: 12px;
      overflow: hidden;
    }
    .map-frame {
      flex: 3;
      border: 2px solid #0f172a;
      border-radius: 8px;
      position: relative;
      overflow: hidden;
    }
    #map {
      width: 100%;
      height: 100%;
      background: #0f172a;
    }
    .side-panel {
      flex: 1.1;
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
      margin-top: 8px;
      padding: 8px;
      background-color: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      font-size: 8.5pt;
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
    .footer-bar {
      margin-top: 6px;
      display: flex;
      justify-content: space-between;
      font-size: 8.5pt;
      color: #64748b;
      border-top: 1px solid #e2e8f0;
      padding-top: 4px;
    }
    /* Map label styling */
    .tdp-map-label {
      background: rgba(15, 23, 42, 0.88);
      border: 1px solid #ffffff;
      color: #ffffff;
      border-radius: 4px;
      padding: 2px 5px;
      font-size: 9pt;
      font-weight: bold;
      white-space: nowrap;
      box-shadow: 0 2px 4px rgba(0,0,0,0.5);
      text-align: center;
    }
    .leaflet-popup-content-wrapper {
      background: #0f172a;
      color: #fff;
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
      <div><b>Nền bản đồ:</b> Vệ tinh Google Maps Hybrid (Độ phân giải cao)</div>
      <div><b>Tổng số vùng quản lý:</b> ${zones.length} Tổ dân phố</div>
      <div><b>Ngày kết xuất:</b> ${dateStr}</div>
    </div>
  </div>

  <div class="content-container">
    <div class="map-frame">
      <div id="map"></div>
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
          <div class="legend-line" style="background: ${isNew ? '#0284c7' : '#f59e0b'}; ${isNew ? 'border: 1px solid #fff;' : 'border-top: 2px dashed #f59e0b; background: transparent;'}"></div>
          <span>${isNew ? 'Ranh giới 27 TDP Mới (Nét liền xanh)' : 'Ranh giới 95 TDP Cũ (Nét đứt vàng hổ phách)'}</span>
        </div>
        <div class="legend-item">
          <div style="width: 14px; height: 14px; background: #0f172a; border: 1px solid #ffffff; border-radius: 3px;"></div>
          <span>Nhãn tên Tổ dân phố</span>
        </div>
        <div class="legend-item">
          <span style="font-size: 10pt;">🛰️</span>
          <span>Nền không ảnh vệ tinh Google Maps</span>
        </div>
      </div>
    </div>
  </div>

  <div class="footer-bar">
    <div>Hệ thống Số hóa Bản đồ Địa chính GIS &bull; Công an Liên Chiểu, TP. Đà Nẵng</div>
    <div>Bản đồ phục vụ công tác quản lý địa bàn & an ninh trật tự cơ sở</div>
  </div>

  <script>
    const geojsonData = ${JSON.stringify(geojson)};
    
    // Initialize map
    const map = L.map('map', {
      zoomControl: false,
      attributionControl: false
    });

    // Add Google Maps Hybrid Satellite TileLayer
    L.tileLayer('https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
      maxZoom: 20,
      subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
    }).addTo(map);

    const PALETTE = [
      '#2563eb', '#16a34a', '#d97706', '#dc2626', '#7c3aed',
      '#db2777', '#0891b2', '#65a30d', '#ea580c', '#4f46e5',
      '#059669', '#b45309', '#e11d48', '#9333ea', '#0284c7',
      '#15803d', '#c2410c', '#6d28d9', '#be185d', '#0e7490'
    ];

    let colorIdx = 0;
    const geoLayer = L.geoJSON(geojsonData, {
      filter: function(feature) {
        return feature.geometry && feature.geometry.type.includes('Polygon');
      },
      style: function(feature) {
        const color = PALETTE[colorIdx % PALETTE.length];
        colorIdx++;
        return {
          color: '${isNew ? "#38bdf8" : "#f59e0b"}',
          fillColor: color,
          fillOpacity: ${isNew ? '0.38' : '0.32'},
          weight: ${isNew ? '3' : '2.2'},
          dashArray: '${isNew ? "" : "5, 4"}'
        };
      },
      onEachFeature: function(feature, layer) {
        const name = feature.properties?.name || '';
        if (name) {
          let labelText = name.replace(/^Tổ dân phố\s+/i, 'TDP ').replace(/^TDP\s+/i, '');
          if (labelText.length > 25) labelText = labelText.slice(0, 22) + '...';

          layer.bindTooltip(labelText, {
            permanent: true,
            direction: 'center',
            className: 'tdp-map-label'
          });
        }
      }
    }).addTo(map);

    // Fit map perfectly to bounds with padding
    map.fitBounds(geoLayer.getBounds(), {
      padding: [25, 25]
    });
  </script>
</body>
</html>
  `;
}

async function main() {
  const edgePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
  const dateStr = new Date().toLocaleDateString('vi-VN');

  // 1. Export 27 New TDPs with Google Map Satellite Background
  console.log('Generating 27 New TDP Map with Google Satellite Basemap...');
  const newHtml = generateHtmlWithGoogleMap({
    title: 'BẢN ĐỒ RANH GIỚI 27 TỔ DÂN PHỐ MỚI',
    subtitle: 'Đề án quy hoạch & sáp nhập Tổ dân phố phường Liên Chiểu (Nền không ảnh vệ tinh Google Maps)',
    geojsonPath: 'public/Dean_Sat_Nhap_TDP_25_6_Zones_Only.geojson',
    isNew: true,
    dateStr
  });
  fs.writeFileSync('temp_map_27_google.html', newHtml, 'utf8');

  // 2. Export 95 Old TDPs with Google Map Satellite Background
  console.log('Generating 95 Old TDP Map with Google Satellite Basemap...');
  const oldHtml = generateHtmlWithGoogleMap({
    title: 'BẢN ĐỒ RANH GIỚI 95 TỔ DÂN PHỐ CŨ',
    subtitle: 'Dữ liệu địa giới hành chính lịch sử 95 Tổ dân phố phường Liên Chiểu (Nền không ảnh vệ tinh Google Maps)',
    geojsonPath: 'public/lien_chieu_95_tdp_cu.geojson',
    isNew: false,
    dateStr
  });
  fs.writeFileSync('temp_map_95_google.html', oldHtml, 'utf8');

  // Convert HTML to PDF via Edge Headless with virtual-time-budget so all Google tiles load completely
  const outPdf27 = path.resolve('Ban_Do_27_To_Dan_Pho_Moi_Lien_Chieu.pdf');
  const outPdf95 = path.resolve('Ban_Do_95_To_Dan_Pho_Cu_Lien_Chieu.pdf');
  const html27 = path.resolve('temp_map_27_google.html');
  const html95 = path.resolve('temp_map_95_google.html');

  console.log('Rendering 27 TDP PDF with Google Satellite Tiles via Edge Headless...');
  execSync(`"${edgePath}" --headless --disable-gpu --virtual-time-budget=6000 --no-pdf-header-footer --print-to-pdf="${outPdf27}" "${html27}"`);
  console.log(`✓ Exported: ${outPdf27}`);

  console.log('Rendering 95 TDP PDF with Google Satellite Tiles via Edge Headless...');
  execSync(`"${edgePath}" --headless --disable-gpu --virtual-time-budget=6000 --no-pdf-header-footer --print-to-pdf="${outPdf95}" "${html95}"`);
  console.log(`✓ Exported: ${outPdf95}`);

  // Copy to public/
  fs.copyFileSync(outPdf27, 'public/Ban_Do_27_To_Dan_Pho_Moi_Lien_Chieu.pdf');
  fs.copyFileSync(outPdf95, 'public/Ban_Do_95_To_Dan_Pho_Cu_Lien_Chieu.pdf');
  console.log('✓ Successfully refreshed public PDF files with Google Maps layer.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
