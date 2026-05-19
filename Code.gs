const SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID_HERE'; // Replace with your Spreadsheet ID
const SHEET_NAME_PMT = 'PMT_Observation';
const SHEET_NAME_ATTEMPTED = 'PMT_Attempted';
const SHEET_NAME_CONVEYANCE = 'Conveyance';
const SHEET_NAME_CRQ_DATA = 'CRQ_Data'; // Sheet containing lookup data

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const formType = data.formType;
    let sheetName = '';
    
    if (formType === 'pmt-observation') sheetName = SHEET_NAME_PMT;
    else if (formType === 'pmt-attempted') sheetName = SHEET_NAME_ATTEMPTED;
    else if (formType === 'conveyance') sheetName = SHEET_NAME_CONVEYANCE;
    else return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Invalid form type' })).setMimeType(ContentService.MimeType.JSON);
    
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(sheetName);
    
    // Convert object properties to array row based on expected columns
    // We will dump the raw JSON string in one column and timestamp in another for simplicity,
    // or you can map them column by column
    
    const rowData = [
      new Date(), // Timestamp
      data.email || '',
      data.engineerName || '',
      data.hostName || '',
      JSON.stringify(data.formData) // All other fields
    ];
    
    sheet.appendRow(rowData);
    
    return ContentService.createTextOutput(JSON.stringify({ status: 'success' })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: error.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  // Use to fetch CRQ Data based on date and engineer name
  const date = e.parameter.date;
  const engineer = e.parameter.engineer;
  const host = e.parameter.host;
  
  if (host) {
    // Mock response for now, in a real scenario you would search SHEET_NAME_CRQ_DATA
    const mockData = {
      crq: "CRQ-999901",
      crqCreateDate: "2026-04-12",
      workArea: "North Zone",
      finalTier: "Tier 1",
      teamLeader: "John Doe",
      engineerNumber: "ENG-001",
      productName: "Fiber Node X",
      city: "New Delhi",
      state: "Delhi",
      tngCircle: "DL",
      region: "NCR",
      address: "123 Telecom Street, Sector 4, New Delhi"
    };
    
    return ContentService.createTextOutput(JSON.stringify({ status: 'success', data: mockData })).setMimeType(ContentService.MimeType.JSON);
  }
  
  return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Missing parameters' })).setMimeType(ContentService.MimeType.JSON);
}

// NOTE: Remember to configure CORS headers if you run into cross-origin issues
function doOptions(e) {
  var headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400"
  };
  return ContentService.createTextOutput("").setHeaders(headers);
}
