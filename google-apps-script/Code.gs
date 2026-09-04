/**
 * JNX MERCHANDISE SHOP
 * Google Apps Script backend
 *
 * Google Sheets tabs:
 * PRODUCTS
 * MEMBERS
 * ORDERS
 * ORDER_ITEMS
 * SETTINGS
 *
 * IMPORTANT:
 * 1. Put this code in a standalone Google Apps Script project.
 * 2. Run setupShop() once.
 * 3. Deploy as Web app:grep -n -E "image|product.image|modern-product-image|FALLBACK_PRODUCTS" js/shop.js
 *    Execute as: Me
 *    Who has access: Anyone
 * 4. Copy the Web App URL into js/config.js.
 */

const CONFIG = {
  TIMEZONE: "Asia/Manila",
  PRODUCTS_SHEET: "PRODUCTS",
  VARIANTS_SHEET: "PRODUCT_VARIANTS",
  MEMBERS_SHEET: "MEMBERS",
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
      return jsonOutput_({
        ok: true,
        products: getProducts_()
      });
    }

    if (action === "verifyMember") {
      const memberId = String(e.parameter.memberId || "").trim();

      if (!memberId) {
        return jsonOutput_({
          ok: false,
          error: "Member ID is required."
        });
      }

      return jsonOutput_(verifyMember_({
        memberId: memberId,
        fullName: e.parameter.fullName || "",
        program: e.parameter.program || "",
        yearLevel: e.parameter.yearLevel || "",
        section: e.parameter.section || ""
      }));
    }

    if (action === "order") {
      const orderNo = String(e.parameter.orderNo || "").trim();

      if (!orderNo) {
        return jsonOutput_({
          ok: false,
          error: "Order number is required."
        });
      }

      return jsonOutput_({
        ok: true,
        order: getPublicOrder_(orderNo)
      });
    }

    if (action === "health") {
      return jsonOutput_({
        ok: true,
        service: "JNX Merchandise Shop",
        version: "MEMBER-VERIFY-V2",
        verifyMemberExists: typeof verifyMember_ === "function",
        time: now_()
      });
    }

    return jsonOutput_({
      ok: false,
      error: "Unknown action."
    });

  } catch (err) {
    return jsonOutput_({
      ok: false,
      error: String(err.message || err)
    });
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

    if (action === "verifyMember") {
      return jsonOutput_(verifyMember_(data));
    }

    throw new Error("Unknown POST action.");

  } catch (err) {
    return jsonOutput_({
      ok: false,
      error: String(err.message || err)
    });
  }
}

/**
 * Run once to create the spreadsheet tabs and headers.
 * Existing product/order data is preserved.
 */
function setupShop() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const products = getOrCreateSheet_(ss, CONFIG.PRODUCTS_SHEET);
  const variants = getOrCreateSheet_(ss, CONFIG.VARIANTS_SHEET);
  const members = getOrCreateSheet_(ss, CONFIG.MEMBERS_SHEET);
  const orders = getOrCreateSheet_(ss, CONFIG.ORDERS_SHEET);
  const items = getOrCreateSheet_(ss, CONFIG.ITEMS_SHEET);
  const settings = getOrCreateSheet_(ss, CONFIG.SETTINGS_SHEET);

  setHeaders_(variants, [
    "Product ID",
    "Variant",
    "Price",
    "Member Price",
    "Stock",
    "Status"
  ]);

  setHeaders_(products, [
    "Product ID",
    "Product Name",
    "Category",
    "Description",
    "Price",
    "Stock",
    "Image URL",
    "Variants",
    "Status",
    "Member Price"
  ]);

  setHeaders_(members, [
    "Member ID",
    "Full Name",
    "Program",
    "Year Level",
    "Section",
    "Membership Status",
    "Membership Start",
    "Membership End"
  ]);

  setHeaders_(orders, [
    "Order No.",
    "Timestamp",
    "Full Name",
    "Contact Number",
    "Email",
    "Program",
    "Institution",
    "Year Level",
    "Section",
    "Total Amount",
    "Payment Method",
    "Payment Reference",
    "Proof of Payment",
    "Payment Status",
    "Order Status",
    "Member ID",
    "Member Name",
    "Discount Amount",
    "Pricing Type"
  ]);

  setHeaders_(items, [
    "Order No.",
    "Product ID",
    "Product Name",
    "Variant",
    "Quantity",
    "Unit Price",
    "Subtotal"
  ]);

  setHeaders_(settings, [
    "Key",
    "Value"
  ]);

  /*
   * Only add sample products if PRODUCTS is actually empty.
   * Existing products are never overwritten.
   */
  if (variants.getLastRow() <= 1) {
    variants.getRange(2, 1, 4, 6).setValues([
      ["JNX002", "Small", 130, 110, 5, "Available"],
      ["JNX002", "Medium", 140, 120, 5, "Available"],
      ["JNX002", "Large", 150, 130, 5, "Available"],
      ["JNX002", "XL", 160, 140, 5, "Available"]
    ]);
  }

  if (products.getLastRow() <= 1) {
    products.getRange(2, 1, 2, 10).setValues([
      [
        "JNX001",
        "JNX Classic Shirt",
        "Apparel",
        "Official Juris Nexum shirt.",
        250,
        20,
        "",
        "S,M,L,XL",
        "Available",
        220
      ],
      [
        "JNX002",
        "JNX Tote Bag",
        "Bags",
        "Juris Nexum tote bag for everyday use.",
        180,
        20,
        "",
        "Small,Medium,Large,XL",
        "Available",
        160
      ]
    ]);
  }

  const settingsData = settings.getDataRange().getValues();
  const keys = settingsData
    .slice(1)
    .map(r => String(r[0]).trim());

  if (!keys.includes(CONFIG.ORDER_SEQUENCE_KEY)) {
    settings.appendRow([
      CONFIG.ORDER_SEQUENCE_KEY,
      "1"
    ]);
  }

  if (!keys.includes(CONFIG.PROOF_FOLDER_KEY)) {
    const folder = DriveApp.createFolder(
      "JNX Merchandise - Proof of Payment"
    );

    settings.appendRow([
      CONFIG.PROOF_FOLDER_KEY,
      folder.getId()
    ]);
  }

  formatSheet_(products);
  formatSheet_(members);
  formatSheet_(orders);
  formatSheet_(items);
  formatSheet_(settings);

  return "JNX Merchandise Shop setup complete.";
}

/**
 * Verify whether a Member ID belongs to an active JNX member.
 */
function normalizeMemberName_(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function verifyMember_(data) {
  const memberId = String(data.memberId || "").trim();
  const buyerName = String(data.fullName || "").trim();

  if (!memberId) {
    return {
      ok: false,
      error: "Member ID is required."
    };
  }

  if (!buyerName) {
    return {
      ok: false,
      error: "Please enter your full name before verifying."
    };
  }

  const member = findMember_(memberId);

  if (!member) {
    return {
      ok: false,
      error: "Member ID not found."
    };
  }

  if (!isMemberActive_(member)) {
    return {
      ok: false,
      error: "This membership is not currently active."
    };
  }

  const enteredName = normalizeMemberName_(buyerName);
  const registeredName = normalizeMemberName_(member.fullName);

  if (enteredName !== registeredName) {
    return {
      ok: false,
      error: "The name does not match the name registered to this Member ID."
    };
  }

  return {
    ok: true,
    memberId: member.memberId,
    memberName: member.fullName,
    pricingType: "JNX Member"
  };
}

/**
 * Create an order.
 *
 * IMPORTANT:
 * The browser NEVER determines the final price.
 * Prices are recalculated here from PRODUCTS.
 */
function createOrder_(data) {
  validateBuyer_(data);

  const incomingItems = Array.isArray(data.items)
    ? data.items
    : [];

  if (!incomingItems.length) {
    throw new Error("Your cart is empty.");
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const productSheet =
    ss.getSheetByName(CONFIG.PRODUCTS_SHEET);

  const ordersSheet =
    ss.getSheetByName(CONFIG.ORDERS_SHEET);

  const itemsSheet =
    ss.getSheetByName(CONFIG.ITEMS_SHEET);

  if (!productSheet || !ordersSheet || !itemsSheet) {
    throw new Error(
      "Shop is not configured. Run setupShop() first."
    );
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    /*
     * Verify membership again on the server.
     * This prevents users from manipulating browser requests.
     */
    const requestedMemberId =
      String(data.memberId || "").trim();

    let member = null;

    if (requestedMemberId) {
      member = findMember_(requestedMemberId);

      if (!member) {
        throw new Error("Member ID not found.");
      }

      if (!isMemberActive_(member)) {
        throw new Error(
          "This membership is not currently active."
        );
      }
    }

    /*
     * FINAL MEMBER IDENTITY CHECK
     *
     * Never trust the browser's verifiedMember state.
     * The buyer's submitted identity must match the
     * official Members sheet before member pricing
     * can be used.
     */
    let isMember = false;

    if (member) {
      const buyerName =
        String(data.fullName || "").trim();

      const buyerProgram =
        String(data.program || "").trim();

      const buyerYearLevel =
        String(data.yearLevel || "").trim();

      const buyerSection =
        String(data.section || "").trim();

      const normalizeName = value =>
        String(value || "")
          .trim()
          .replace(/\s+/g, " ")
          .toLowerCase();

      const identityMatches =
        normalizeMemberName_(buyerName) ===
        normalizeMemberName_(member.fullName);

      if (identityMatches) {
        isMember = true;
      } else {
        /*
         * Member ID may be valid, but the submitted
         * buyer information does not belong to that
         * member. Continue the order as REGULAR pricing.
         */
        member = null;
        isMember = false;
      }
    }

    const products = readProductsMap_(productSheet);

    const variantSheet =
      ss.getSheetByName(CONFIG.VARIANTS_SHEET);

    const variants =
      readProductVariantsMap_(variantSheet);

    const normalizedItems = [];

    let regularTotal = 0;
    let total = 0;

    for (const incoming of incomingItems) {
      const productId =
        String(incoming.productId || "").trim();

      const variant =
        String(incoming.variant || "").trim();

      const quantity =
        Number(incoming.quantity);

      if (
        !productId ||
        !Number.isInteger(quantity) ||
        quantity < 1 ||
        quantity > 50
      ) {
        throw new Error("Invalid cart item.");
      }

      const product = products[productId];

      if (!product) {
        throw new Error(
          "A product in your cart is no longer available."
        );
      }

      if (
        product.status.toLowerCase() !== "available"
      ) {
        throw new Error(
          product.name + " is currently unavailable."
        );
      }


      /*
       * Validate variants against PRODUCT_VARIANTS when
       * variant-specific entries exist.
       * Comparison ignores capitalization and spaces.
       */
      const normalizedVariant =
        String(variant || "")
          .trim()
          .toLowerCase();

      const productVariantEntries =
        Object.values(variants).filter(
          v =>
            v.productId === productId &&
            String(v.variant || "")
              .trim()
              .toLowerCase() ===
              normalizedVariant
        );

      if (
        productVariantEntries.length === 0 &&
        product.variants.length &&
        !product.variants.some(
          v =>
            String(v || "")
              .trim()
              .toLowerCase() ===
            normalizedVariant
        )
      ) {
        throw new Error(
          "Invalid variant for " +
          product.name +
          "."
        );
      }

      /*
       * Price and stock come from PRODUCT_VARIANTS
       * when the product has a variant-specific entry.
       *
       * This allows sizes such as Small, Medium, Large,
       * and XL to have different prices.
       */
      const variantKey =
        productId + "__" +
        String(variant || "")
          .trim()
          .toLowerCase();

      const variantData =
        variants[variantKey];

      let regularUnitPrice;
      let memberUnitPrice;
      let availableStock;

      if (variantData) {
        regularUnitPrice =
          variantData.price;

        memberUnitPrice =
          variantData.memberPrice > 0
            ? variantData.memberPrice
            : regularUnitPrice;

        availableStock =
          variantData.stock;

        if (
          variantData.status.toLowerCase() !==
          "available"
        ) {
          throw new Error(
            product.name + " (" + variant + ") is currently unavailable."
          );
        }
      } else {
        /*
         * Backward compatibility:
         * products without variant-specific pricing
         * continue using PRODUCTS columns E and J.
         */
        regularUnitPrice =
          product.price;

        memberUnitPrice =
          product.memberPrice > 0
            ? product.memberPrice
            : regularUnitPrice;

        availableStock =
          product.stock;
      }

      if (
        regularUnitPrice < 0 ||
        memberUnitPrice < 0
      ) {
        throw new Error(
          "Invalid price for " + product.name + " (" + variant + ")."
        );
      }

      if (availableStock < quantity) {
        throw new Error(
          "Not enough stock for " + product.name + " (" + variant + "). Available: " + availableStock + "."
        );
      }

      const unitPrice =
        isMember
          ? memberUnitPrice
          : regularUnitPrice;

      const regularSubtotal =
        regularUnitPrice * quantity;

      const subtotal =
        unitPrice * quantity;

      regularTotal += regularSubtotal;
      total += subtotal;

        normalizedItems.push({
          productId,
          name: product.name,
          variant,
          quantity,
          unitPrice,
          subtotal,
          row: product.row,
          variantRow: variantData
            ? variantData.row
            : null
        });
    }

    regularTotal = roundMoney_(regularTotal);
    total = roundMoney_(total);

    const discountAmount =
      roundMoney_(Math.max(0, regularTotal - total));

    const paymentMethod =
      String(data.paymentMethod || "").trim();

    if (paymentMethod !== "GCash") {
      throw new Error("Invalid payment method.");
    }

    if (
      paymentMethod === "GCash" &&
      !String(data.paymentReference || "").trim()
    ) {
      throw new Error(
        "GCash reference number is required."
      );
    }

    const proofUrl =
      saveProof_(data.proof);

    const orderNo =
      nextOrderNumber_();

    const timestamp =
      now_();

    const paymentStatus =
      "Pending Verification";

    /*
     * IMPORTANT:
     * Existing A-O columns remain unchanged.
     * Member information is appended as P-S.
     */
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
      "Pending",

      isMember ? member.memberId : "",
      isMember ? member.fullName : "",
      discountAmount,
      isMember ? "JNX Member" : "Regular"
    ]);

    const itemRows =
      normalizedItems.map(item => [
        orderNo,
        item.productId,
        item.name,
        item.variant,
        item.quantity,
        item.unitPrice,
        item.subtotal
      ]);

    if (itemRows.length) {
      itemsSheet
        .getRange(
          itemsSheet.getLastRow() + 1,
          1,
          itemRows.length,
          7
        )
        .setValues(itemRows);
    }

      /*
       * Deduct stock only after all validation succeeds.
       *
       * Variant products deduct stock from PRODUCT_VARIANTS.
       * Products without variant-specific rows use PRODUCTS.
       */
      for (const item of normalizedItems) {
        if (item.variantRow) {
          const variantValues =
            variantSheet
              .getRange(item.variantRow, 5, 1, 2)
              .getValues()[0];

          const currentStock =
            Number(variantValues[0]) || 0;

          const newStock =
            currentStock - item.quantity;

          variantSheet
            .getRange(item.variantRow, 5)
            .setValue(newStock);

          if (newStock <= 0) {
            variantSheet
              .getRange(item.variantRow, 6)
              .setValue("Out of Stock");
          }
        } else {
          const newStock =
            products[item.productId].stock -
            item.quantity;

          productSheet
            .getRange(item.row, 6)
            .setValue(newStock);

          if (newStock <= 0) {
            productSheet
              .getRange(item.row, 9)
              .setValue("Out of Stock");
          }
        }
      }

      
    return {
      ok: true,
      orderNumber: orderNo,
      totalAmount: total,
      regularTotal,
      discountAmount,
      pricingType:
        isMember
          ? "JNX Member"
          : "Regular",
      memberId:
        isMember
          ? member.memberId
          : "",
      memberName:
        isMember
          ? member.fullName
          : "",
      paymentStatus,
      orderStatus: "Pending",
      timestamp
    };

  } finally {
    lock.releaseLock();
  }
}

function getProducts_() {
  const ss =
    SpreadsheetApp.getActiveSpreadsheet();

  const sheet =
    ss.getSheetByName(
      CONFIG.PRODUCTS_SHEET
    );

  const variantSheet =
    ss.getSheetByName(
      CONFIG.VARIANTS_SHEET
    );

  if (
    !sheet ||
    sheet.getLastRow() < 2
  ) {
    return [];
  }

  const values =
    sheet.getDataRange().getValues();

  const variantMap =
    readProductVariantsMap_(variantSheet);

  return values
    .slice(1)
    .filter(r => r[0])
    .map(r => {
      const productId =
        String(r[0]).trim();

      const variantDetails =
        Object.values(variantMap)
          .filter(v => v.productId === productId)
          .map(v => ({
            variant: v.variant,
            price: v.price,
            memberPrice: v.memberPrice,
            stock: v.stock,
            status: v.status
          }));

      const variants =
        variantDetails.length
          ? variantDetails
              .filter(
                v =>
                  v.status.toLowerCase() ===
                    "available" &&
                  v.stock > 0
              )
              .map(v => v.variant)
          : String(r[7] || "")
              .split(",")
              .map(x => x.trim())
              .filter(Boolean);

      return {
        id: productId,
        name: String(r[1]),
        category: String(r[2]),
        description: String(r[3]),
        price: Number(r[4]) || 0,
        stock: Number(r[5]) || 0,
        image: String(r[6] || ""),
        variants,
        variantDetails,
        status: String(r[8] || "Available"),
        memberPrice: Number(r[9]) || 0
      };
    })
    .filter(
      p =>
        p.status.toLowerCase() === "available" &&
        (
          p.variantDetails.some(
            v =>
              v.status.toLowerCase() ===
                "available" &&
              v.stock > 0
          ) ||
          p.stock > 0
        )
    );
}

function getPublicOrder_(orderNo) {
  const ss =
    SpreadsheetApp.getActiveSpreadsheet();

  const orders =
    ss.getSheetByName(
      CONFIG.ORDERS_SHEET
    );

  const items =
    ss.getSheetByName(
      CONFIG.ITEMS_SHEET
    );

  if (!orders || !items) {
    throw new Error(
      "Shop is not configured."
    );
  }

  const orderValues =
    orders.getDataRange().getValues();

  let order = null;

  for (
    let i = 1;
    i < orderValues.length;
    i++
  ) {
    if (
      String(orderValues[i][0]) ===
      orderNo
    ) {
      const r =
        orderValues[i];

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

        /*
         * NEW P-S fields.
         */
        memberId: String(r[15] || ""),
        memberName: String(r[16] || ""),
        discountAmount: Number(r[17]) || 0,
        pricingType:
          String(r[18] || "Regular"),

        items: []
      };

      break;
    }
  }

  if (!order) {
    throw new Error(
      "Order not found."
    );
  }

  const itemValues =
    items.getDataRange().getValues();

  for (
    let i = 1;
    i < itemValues.length;
    i++
  ) {
    const r =
      itemValues[i];

    if (
      String(r[0]) ===
      orderNo
    ) {
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
  const values =
    sheet.getDataRange().getValues();

  const map = {};

  for (
    let i = 1;
    i < values.length;
    i++
  ) {
    const r =
      values[i];

    const id =
      String(r[0] || "").trim();

    if (!id) continue;

    map[id] = {
      row: i + 1,
      name: String(r[1] || ""),
      price: Number(r[4]) || 0,
      stock: Number(r[5]) || 0,

      /*
       * J = Member Price.
       */
      memberPrice:
        Number(r[9]) || 0,

      variants:
        String(r[7] || "")
          .split(",")
          .map(x => x.trim())
          .filter(Boolean),

      status:
        String(
          r[8] || "Available"
        )
    };
  }

  return map;
}

function readProductVariantsMap_(sheet) {
  const map = {};

  if (!sheet || sheet.getLastRow() < 2) {
    return map;
  }

  const values =
    sheet.getDataRange().getValues();

  for (let i = 1; i < values.length; i++) {
    const r = values[i];

    const productId =
      String(r[0] || "").trim();

    const variant =
      String(r[1] || "").trim();

    if (!productId || !variant) {
      continue;
    }

    const key =
      productId + "__" + variant.toLowerCase();

    map[key] = {
      row: i + 1,
      productId,
      variant,
      price: Number(r[2]) || 0,
      memberPrice: Number(r[3]) || 0,
      stock: Number(r[4]) || 0,
      status: String(r[5] || "Available")
    };
  }

  return map;
}

/**
 * Find a member by Member ID.
 */
function findMember_(memberId) {
  const sheet =
    SpreadsheetApp
      .getActiveSpreadsheet()
      .getSheetByName(
        CONFIG.MEMBERS_SHEET
      );

  if (
    !sheet ||
    sheet.getLastRow() < 2
  ) {
    return null;
  }

  const values =
    sheet.getDataRange().getValues();

  const target =
    String(memberId)
      .trim()
      .toLowerCase();

  for (
    let i = 1;
    i < values.length;
    i++
  ) {
    const r =
      values[i];

    const id =
      String(r[0] || "")
        .trim();

    if (
      id.toLowerCase() !==
      target
    ) {
      continue;
    }

    return {
      memberId: id,
      fullName: String(r[1] || ""),
      program: String(r[2] || ""),
      yearLevel: String(r[3] || ""),
      section: String(r[4] || ""),
      membershipStatus:
        String(r[5] || ""),
      membershipStart: r[6],
      membershipEnd: r[7]
    };
  }

  return null;
}

/**
 * Member must have:
 * - Membership Status = Active
 * - Current date within membership dates when dates exist.
 */
function isMemberActive_(member) {
  const status =
    String(
      member.membershipStatus || ""
    )
      .trim()
      .toLowerCase();

  if (status !== "active") {
    return false;
  }

  const today =
    new Date();

  today.setHours(
    0, 0, 0, 0
  );

  if (
    member.membershipStart
  ) {
    const start =
      new Date(
        member.membershipStart
      );

    if (
      !isNaN(start.getTime())
    ) {
      start.setHours(
        0, 0, 0, 0
      );

      if (today < start) {
        return false;
      }
    }
  }

  if (
    member.membershipEnd
  ) {
    const end =
      new Date(
        member.membershipEnd
      );

    if (
      !isNaN(end.getTime())
    ) {
      end.setHours(
        23, 59, 59, 999
      );

      if (today > end) {
        return false;
      }
    }
  }

  return true;
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

  required.forEach(
    ([key, label]) => {
      if (
        !String(
          data[key] || ""
        ).trim()
      ) {
        throw new Error(
          label + " is required."
        );
      }
    }
  );

  if (
    String(data.fullName).length >
    100
  ) {
    throw new Error(
      "Full name is too long."
    );
  }

  if (
    String(data.contact).length >
    30
  ) {
    throw new Error(
      "Contact number is too long."
    );
  }

  if (
    String(data.email || "").length >
    120
  ) {
    throw new Error(
      "Email is too long."
    );
  }
}

function saveProof_(proof) {
  if (
    !proof ||
    !proof.data
  ) {
    return "";
  }

  const name =
    String(
      proof.name ||
      "payment-proof"
    )
      .replace(
        /[^\w.\- ]/g,
        "_"
      );

  const mime =
    String(
      proof.mimeType ||
      "application/octet-stream"
    );

  const base64 =
    String(proof.data);

  const bytes =
    Utilities.base64Decode(
      base64
    );

  if (
    bytes.length >
    CONFIG.MAX_PROOF_BYTES
  ) {
    throw new Error(
      "Proof of payment must be 5 MB or smaller."
    );
  }

  const folderId =
    getSetting_(
      CONFIG.PROOF_FOLDER_KEY
    );

  if (!folderId) {
    throw new Error(
      "Proof-of-payment folder is not configured."
    );
  }

  const folder =
    DriveApp.getFolderById(
      folderId
    );

  const file =
    folder.createFile(
      Utilities.newBlob(
        bytes,
        mime,
        name
      )
    );

  return file.getUrl();
}

function nextOrderNumber_() {
  const settings =
    SpreadsheetApp
      .getActiveSpreadsheet()
      .getSheetByName(
        CONFIG.SETTINGS_SHEET
      );

  if (!settings) {
    throw new Error(
      "SETTINGS sheet is missing."
    );
  }

  const values =
    settings
      .getDataRange()
      .getValues();

  let row = -1;
  let current = 1;

  for (
    let i = 1;
    i < values.length;
    i++
  ) {
    if (
      String(values[i][0]) ===
      CONFIG.ORDER_SEQUENCE_KEY
    ) {
      row = i + 1;
      current =
        Number(values[i][1]) || 1;
      break;
    }
  }

  if (row === -1) {
    row =
      settings.getLastRow() + 1;

    settings
      .getRange(
        row,
        1,
        1,
        2
      )
      .setValues([
        [
          CONFIG.ORDER_SEQUENCE_KEY,
          2
        ]
      ]);

  } else {
    settings
      .getRange(
        row,
        2
      )
      .setValue(
        current + 1
      );
  }

  const year =
    Utilities.formatDate(
      new Date(),
      CONFIG.TIMEZONE,
      "yyyy"
    );

  return "JNX-" + year + "-" + String(current).padStart(5, "0");
}

function getSetting_(key) {
  const sheet =
    SpreadsheetApp
      .getActiveSpreadsheet()
      .getSheetByName(
        CONFIG.SETTINGS_SHEET
      );

  if (!sheet) return "";

  const values =
    sheet
      .getDataRange()
      .getValues();

  for (
    let i = 1;
    i < values.length;
    i++
  ) {
    if (
      String(values[i][0]) ===
      String(key)
    ) {
      return String(
        values[i][1] || ""
      ).trim();
    }
  }

  return "";
}

function getOrCreateSheet_(ss, name) {
  return (
    ss.getSheetByName(name) ||
    ss.insertSheet(name)
  );
}

function setHeaders_(sheet, headers) {
  sheet
    .getRange(
      1,
      1,
      1,
      headers.length
    )
    .setValues([headers]);
}

function formatSheet_(sheet) {
  const lastColumn =
    sheet.getLastColumn();

  if (lastColumn < 1) return;

  sheet
    .getRange(
      1,
      1,
      1,
      lastColumn
    )
    .setFontWeight("bold");

  sheet.setFrozenRows(1);
}

function roundMoney_(amount) {
  return Math.round(
    (Number(amount) + Number.EPSILON) *
      100
  ) / 100;
}

function clean_(value) {
  return String(
    value == null
      ? ""
      : value
  ).trim();
}

function now_() {
  return Utilities.formatDate(
    new Date(),
    CONFIG.TIMEZONE,
    "yyyy-MM-dd HH:mm:ss"
  );
}

function jsonOutput_(data) {
  return ContentService
    .createTextOutput(
      JSON.stringify(data)
    )
    .setMimeType(
      ContentService.MimeType.JSON
    );
}
