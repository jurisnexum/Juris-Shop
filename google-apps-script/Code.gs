/**
 * JNX MERCHANDISE SHOP
 * Google Apps Script backend
 *
 * Google Sheets tabs:
 * PRODUCTS
 * ORDERS
 * ORDER_ITEMS
 * SETTINGS
 *
 * IMPORTANT:
 * 1. Put this code in a standalone Google Apps Script project.
 * 2. Run setupShop() once.
 * 3. Deploy as Web app:
 *    Execute as: Me
 *    Who has access: Anyone
 * 4. Copy the Web App URL into js/config.js.
 */

const CONFIG = {
  TIMEZONE: "Asia/Manila",
  PRODUCTS_SHEET: "PRODUCTS",
  ORDERS_SHEET: "ORDERS",
  ITEMS_SHEET: "ORDER_ITEMS",
  SETTINGS_SHEET: "SETTINGS",
  PROOF_FOLDER_KEY: "PROOF_FOLDER_ID",
  ORDER_SEQUENCE_KEY: "NEXT_ORDER_NUMBER",
  MAX_PROOF_BYTES: 5 * 1024 * 1024
};

function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || "products";

  try {
    if (action === "products") {
      return jsonOutput_({ ok: true, products: getProducts_() });
    }

    if (action === "order") {
      const orderNo = String(e.parameter.orderNo || "").trim();
      if (!orderNo) return jsonOutput_({ ok: false, error: "Order number is required." });
      return jsonOutput_({ ok: true, order: getPublicOrder_(orderNo) });
    }

    if (action === "health") {
      return jsonOutput_({ ok: true, service: "JNX Merchandise Shop", time: now_() });
    }

    return jsonOutput_({ ok: false, error: "Unknown action." });
  } catch (err) {
    return jsonOutput_({ ok: false, error: String(err.message || err) });
  }
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      throw new Error("No request data received.");
    }

    const data = JSON.parse(e.postData.contents);
    const action = String(data.action || "createOrder");

    if (action === "createOrder") {
      return jsonOutput_(createOrder_(data));
    }

    throw new Error("Unknown POST action.");
  } catch (err) {
    return jsonOutput_({ ok: false, error: String(err.message || err) });
  }
}

/**
 * Run once to create the spreadsheet tabs and headers.
 * It also adds sample products if PRODUCTS is empty.
 */
function setupShop() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const products = getOrCreateSheet_(ss, CONFIG.PRODUCTS_SHEET);
  const orders = getOrCreateSheet_(ss, CONFIG.ORDERS_SHEET);
  const items = getOrCreateSheet_(ss, CONFIG.ITEMS_SHEET);
  const settings = getOrCreateSheet_(ss, CONFIG.SETTINGS_SHEET);

  setHeaders_(products, [
    "Product ID", "Product Name", "Category", "Description", "Price",
    "Stock", "Image URL", "Variants", "Status"
  ]);

  setHeaders_(orders, [
    "Order No.", "Timestamp", "Full Name", "Contact Number", "Email",
    "Program", "Institution", "Year Level", "Section",
    "Total Amount", "Payment Method", "Payment Reference",
    "Proof of Payment", "Payment Status", "Order Status"
  ]);

  setHeaders_(items, [
    "Order No.", "Product ID", "Product Name", "Variant",
    "Quantity", "Unit Price", "Subtotal"
  ]);

  setHeaders_(settings, ["Key", "Value"]);

  if (products.getLastRow() <= 1) {
    products.getRange(2, 1, 2, 9).setValues([
      ["JNX001", "JNX Classic Shirt", "Apparel",
       "Official Juris Nexum shirt.", 250, 20, "", "S,M,L,XL", "Available"],
      ["JNX002", "JNX Tote Bag", "Bags",
       "Juris Nexum tote bag for everyday use.", 180, 20, "", "Free Size", "Available"]
    ]);
  }

  const settingsData = settings.getDataRange().getValues();
  const keys = settingsData.slice(1).map(r => String(r[0]).trim());

  if (!keys.includes(CONFIG.ORDER_SEQUENCE_KEY)) {
    settings.appendRow([CONFIG.ORDER_SEQUENCE_KEY, "1"]);
  }

  // Create a Drive folder for proof-of-payment files if one is not configured.
  if (!keys.includes(CONFIG.PROOF_FOLDER_KEY)) {
    const folder = DriveApp.createFolder("JNX Merchandise - Proof of Payment");
    settings.appendRow([CONFIG.PROOF_FOLDER_KEY, folder.getId()]);
  }

  formatSheet_(products);
  formatSheet_(orders);
  formatSheet_(items);
  formatSheet_(settings);

  return "JNX Merchandise Shop setup complete.";
}

function createOrder_(data) {
  validateBuyer_(data);

  const incomingItems = Array.isArray(data.items) ? data.items : [];
  if (!incomingItems.length) throw new Error("Your cart is empty.");

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const productSheet = ss.getSheetByName(CONFIG.PRODUCTS_SHEET);
  const ordersSheet = ss.getSheetByName(CONFIG.ORDERS_SHEET);
  const itemsSheet = ss.getSheetByName(CONFIG.ITEMS_SHEET);

  if (!productSheet || !ordersSheet || !itemsSheet) {
    throw new Error("Shop is not configured. Run setupShop() first.");
  }

  // Prevent two buyers from modifying the same inventory simultaneously.
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const products = readProductsMap_(productSheet);
    const normalizedItems = [];
    let total = 0;

    for (const incoming of incomingItems) {
      const productId = String(incoming.productId || "").trim();
      const variant = String(incoming.variant || "").trim();
      const quantity = Number(incoming.quantity);

      if (!productId || !Number.isInteger(quantity) || quantity < 1 || quantity > 50) {
        throw new Error("Invalid cart item.");
      }

      const product = products[productId];
      if (!product) throw new Error("A product in your cart is no longer available.");

      if (product.status.toLowerCase() !== "available") {
        throw new Error(`${product.name} is currently unavailable.`);
      }

      if (product.stock < quantity) {
        throw new Error(`Not enough stock for ${product.name}. Available: ${product.stock}.`);
      }

      if (product.variants.length && !product.variants.includes(variant)) {
        throw new Error(`Invalid variant for ${product.name}.`);
      }

      const subtotal = product.price * quantity;
      total += subtotal;

      normalizedItems.push({
        productId,
        name: product.name,
        variant,
        quantity,
        unitPrice: product.price,
        subtotal,
        row: product.row
      });
    }

    total = roundMoney_(total);

    const paymentMethod = String(data.paymentMethod || "").trim();
    if (paymentMethod !== "GCash") {
      throw new Error("Invalid payment method.");
    }

    if (paymentMethod === "GCash" && !String(data.paymentReference || "").trim()) {
      throw new Error("GCash reference number is required.");
    }

    const proofUrl = saveProof_(data.proof);

    const orderNo = nextOrderNumber_();
    const timestamp = now_();
    const paymentStatus = "Pending Verification";

    ordersSheet.appendRow([
      orderNo,
      timestamp,
      clean_(data.fullName),
      clean_(data.contact),
      clean_(data.email),
      clean_(data.program),
      clean_(data.institution),
      clean_(data.yearLevel),
      clean_(data.section),
      total,
      paymentMethod,
      clean_(data.paymentReference),
      proofUrl,
      paymentStatus,
      "Pending"
    ]);

    const itemRows = normalizedItems.map(item => [
      orderNo,
      item.productId,
      item.name,
      item.variant,
      item.quantity,
      item.unitPrice,
      item.subtotal
    ]);

    if (itemRows.length) {
      itemsSheet.getRange(itemsSheet.getLastRow() + 1, 1, itemRows.length, 7).setValues(itemRows);
    }

    // Deduct stock only after all validation has succeeded.
    for (const item of normalizedItems) {
      const newStock = products[item.productId].stock - item.quantity;
      productSheet.getRange(item.row, 6).setValue(newStock);

      if (newStock <= 0) {
        productSheet.getRange(item.row, 9).setValue("Out of Stock");
      }
    }

    return {
      ok: true,
      orderNumber: orderNo,
      totalAmount: total,
      paymentStatus,
      orderStatus: "Pending",
      timestamp
    };
  } finally {
    lock.releaseLock();
  }
}

function getProducts_() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.PRODUCTS_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return [];

  const values = sheet.getDataRange().getValues();
  return values.slice(1).filter(r => r[0]).map(r => ({
    id: String(r[0]),
    name: String(r[1]),
    category: String(r[2]),
    description: String(r[3]),
    price: Number(r[4]) || 0,
    stock: Number(r[5]) || 0,
    image: String(r[6] || ""),
    variants: String(r[7] || "").split(",").map(x => x.trim()).filter(Boolean),
    status: String(r[8] || "Available")
  })).filter(p => p.status.toLowerCase() === "available" && p.stock > 0);
}

function getPublicOrder_(orderNo) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const orders = ss.getSheetByName(CONFIG.ORDERS_SHEET);
  const items = ss.getSheetByName(CONFIG.ITEMS_SHEET);

  if (!orders || !items) throw new Error("Shop is not configured.");

  const orderValues = orders.getDataRange().getValues();
  let order = null;

  for (let i = 1; i < orderValues.length; i++) {
    if (String(orderValues[i][0]) === orderNo) {
      const r = orderValues[i];
      order = {
        orderNumber: String(r[0]),
        timestamp: String(r[1]),
        fullName: String(r[2]),
        contact: String(r[3]),
        email: String(r[4]),
        program: String(r[5]),
        institution: String(r[6]),
        yearLevel: String(r[7]),
        section: String(r[8]),
        totalAmount: Number(r[9]) || 0,
        paymentMethod: String(r[10]),
        paymentReference: String(r[11]),
        paymentStatus: String(r[13]),
        orderStatus: String(r[14]),
        items: []
      };
      break;
    }
  }

  if (!order) throw new Error("Order not found.");

  const itemValues = items.getDataRange().getValues();
  for (let i = 1; i < itemValues.length; i++) {
    const r = itemValues[i];
    if (String(r[0]) === orderNo) {
      order.items.push({
        productId: String(r[1]),
        name: String(r[2]),
        variant: String(r[3]),
        quantity: Number(r[4]),
        unitPrice: Number(r[5]),
        subtotal: Number(r[6])
      });
    }
  }

  return order;
}

function readProductsMap_(sheet) {
  const values = sheet.getDataRange().getValues();
  const map = {};

  for (let i = 1; i < values.length; i++) {
    const r = values[i];
    const id = String(r[0] || "").trim();
    if (!id) continue;

    map[id] = {
      row: i + 1,
      name: String(r[1] || ""),
      price: Number(r[4]) || 0,
      stock: Number(r[5]) || 0,
      variants: String(r[7] || "").split(",").map(x => x.trim()).filter(Boolean),
      status: String(r[8] || "Available")
    };
  }
  return map;
}

function validateBuyer_(data) {
  const required = [
    ["fullName", "Full name"],
    ["contact", "Contact number"],
    ["program", "Program"],
    ["institution", "Institution"],
    ["yearLevel", "Year level"],
    ["section", "Section"]
  ];

  required.forEach(([key, label]) => {
    if (!String(data[key] || "").trim()) throw new Error(`${label} is required.`);
  });

  if (String(data.fullName).length > 100) throw new Error("Full name is too long.");
  if (String(data.contact).length > 30) throw new Error("Contact number is too long.");
  if (String(data.email || "").length > 120) throw new Error("Email is too long.");
}

function saveProof_(proof) {
  if (!proof || !proof.data) return "";

  const name = String(proof.name || "payment-proof").replace(/[^\w.\- ]/g, "_");
  const mime = String(proof.mimeType || "application/octet-stream");
  const base64 = String(proof.data);

  const bytes = Utilities.base64Decode(base64);
  if (bytes.length > CONFIG.MAX_PROOF_BYTES) {
    throw new Error("Proof of payment must be 5 MB or smaller.");
  }

  const folderId = getSetting_(CONFIG.PROOF_FOLDER_KEY);
  if (!folderId) throw new Error("Proof-of-payment folder is not configured.");

  const folder = DriveApp.getFolderById(folderId);
  const file = folder.createFile(Utilities.newBlob(bytes, mime, name));
  return file.getUrl();
}

function nextOrderNumber_() {
  const settings = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SETTINGS_SHEET);
  if (!settings) throw new Error("SETTINGS sheet is missing.");

  const values = settings.getDataRange().getValues();
  let row = -1;
  let current = 1;

  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]) === CONFIG.ORDER_SEQUENCE_KEY) {
      row = i + 1;
      current = Number(values[i][1]) || 1;
      break;
    }
  }

  if (row === -1) {
    row = settings.getLastRow() + 1;
    settings.getRange(row, 1, 1, 2).setValues([[CONFIG.ORDER_SEQUENCE_KEY, 2]]);
  } else {
    settings.getRange(row, 2).setValue(current + 1);
  }

  const year = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, "yyyy");
  return `JNX-${year}-${String(current).padStart(5, "0")}`;
}

function getSetting_(key) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SETTINGS_SHEET);
  if (!sheet) return "";

  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]) === key) return String(values[i][1] || "");
  }
  return "";
}

function getOrCreateSheet_(ss, name) {
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

function setHeaders_(sheet, headers) {
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  } else {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  sheet.setFrozenRows(1);
}

function formatSheet_(sheet) {
  const lastColumn = sheet.getLastColumn();
  if (!lastColumn) return;
  sheet.getRange(1, 1, 1, lastColumn).setFontWeight("bold");
  sheet.autoResizeColumns(1, lastColumn);
}

function roundMoney_(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

function clean_(value) {
  return String(value == null ? "" : value).trim();
}

function now_() {
  return Utilities.formatDate(new Date(), CONFIG.TIMEZONE, "yyyy-MM-dd HH:mm:ss");
}

function jsonOutput_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
