const fs = require('fs');
const mongoose = require('mongoose');
const ExcelJS = require('exceljs');

function getMongoURI() {
  try {
    const envContent = fs.readFileSync('.env.local', 'utf8');
    const match = envContent.match(/MONGODB_URI=(.*)/);
    if (match && match[1]) {
      return match[1].trim();
    }
  } catch (e) {}
  return null;
}

function classifyPoi(name) {
  const upper = name.toUpperCase();
  if (upper.includes('TỔ ') || upper.startsWith('TỎ ')) {
    return {
      type: 'tdp_label',
      groupName: 'Điểm Nhãn Tổ Dân Phố',
      notes: `Điểm nhãn định danh trung tâm Tổ Dân Phố mới sau sát nhập: ${name}`
    };
  } else if (upper.includes('SHCĐ') || upper.includes('SHCD') || upper.includes('NSHCĐ') || upper.includes('TCVH')) {
    return {
      type: 'community_house',
      groupName: 'Nhà SHCĐ / Thiết Chế Văn Hóa',
      notes: `Công trình phục vụ sinh hoạt cộng đồng, hội họp nhân dân thuộc địa bàn: ${name}`
    };
  } else {
    return {
      type: 'info',
      groupName: 'Điểm Chú Ý Khác',
      notes: `Mốc chú ý GIS trên địa bàn: ${name}`
    };
  }
}

async function main() {
  const uri = getMongoURI();
  if (!uri) {
    console.error('Missing MONGODB_URI');
    process.exit(1);
  }

  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  const poisCol = db.collection('pois');

  const allPois = await poisCol.find({}).toArray();
  console.log(`Found ${allPois.length} POIs in database.`);

  const classifiedList = [];

  for (const poi of allPois) {
    const name = poi.properties?.name || 'Không tên';
    const classification = classifyPoi(name);

    await poisCol.updateOne(
      { _id: poi._id },
      {
        $set: {
          'properties.type': classification.type,
          'properties.notes': classification.notes
        }
      }
    );

    classifiedList.push({
      id: poi._id,
      name,
      type: classification.type,
      groupName: classification.groupName,
      notes: classification.notes,
      lng: poi.geometry?.coordinates?.[0] || 0,
      lat: poi.geometry?.coordinates?.[1] || 0
    });
  }

  console.log('Successfully updated POI classifications & notes in MongoDB!');

  // Now create Excel workbook
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Hệ Thống Bản Đồ Số TDP';
  workbook.created = new Date();

  // Helper to style header row
  function styleHeader(sheet) {
    const headerRow = sheet.getRow(1);
    headerRow.height = 28;
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1E3A8A' } // Deep Navy Blue
      };
      cell.font = {
        name: 'Arial',
        size: 11,
        bold: true,
        color: { argb: 'FFFFFFFF' }
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'medium' },
        right: { style: 'thin' }
      };
    });
  }

  function addDataToSheet(sheet, dataList) {
    sheet.columns = [
      { header: 'STT', key: 'stt', width: 8 },
      { header: 'Nhóm Điểm Chú Ý', key: 'groupName', width: 28 },
      { header: 'Tên Điểm Chú Ý / Tổ Dân Phố', key: 'name', width: 38 },
      { header: 'Chú Thích Chi Tiết', key: 'notes', width: 55 },
      { header: 'Kinh Độ (Lng)', key: 'lng', width: 16 },
      { header: 'Vĩ Độ (Lat)', key: 'lat', width: 16 }
    ];

    styleHeader(sheet);

    dataList.forEach((item, idx) => {
      const row = sheet.addRow({
        stt: idx + 1,
        groupName: item.groupName,
        name: item.name,
        notes: item.notes,
        lng: Number(item.lng.toFixed(6)),
        lat: Number(item.lat.toFixed(6))
      });

      row.height = 22;
      row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell(2).alignment = { vertical: 'middle', horizontal: 'left' };
      row.getCell(3).alignment = { vertical: 'middle', horizontal: 'left' };
      row.getCell(4).alignment = { vertical: 'middle', horizontal: 'left' };
      row.getCell(5).alignment = { vertical: 'middle', horizontal: 'right' };
      row.getCell(6).alignment = { vertical: 'middle', horizontal: 'right' };

      // Zebra stripes
      if (idx % 2 === 1) {
        row.eachCell((cell) => {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF3F4F6' }
          };
        });
      }

      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
        };
      });
    });
  }

  // Sheet 1: All POIs
  const sheetAll = workbook.addWorksheet('Tổng Hợp 57 Điểm Chú Ý');
  addDataToSheet(sheetAll, classifiedList);

  // Sheet 2: TDP Labels
  const sheetTdp = workbook.addWorksheet('Điểm Nhãn Tổ Dân Phố (27)');
  addDataToSheet(sheetTdp, classifiedList.filter(p => p.type === 'tdp_label'));

  // Sheet 3: Community Houses
  const sheetCommunity = workbook.addWorksheet('Nhà Sinh Hoạt Cộng Đồng (30)');
  addDataToSheet(sheetCommunity, classifiedList.filter(p => p.type === 'community_house'));

  const excelPath = 'Danh_sach_57_Diem_Chu_Y_TDP_25_6.xlsx';
  await workbook.xlsx.writeFile(excelPath);
  console.log(`Successfully generated Excel file: ${excelPath}`);

  await mongoose.disconnect();
}

main().catch(console.error);
