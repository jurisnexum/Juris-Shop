const ORDER_KEY = "jnx_merch_last_order_v1";

const peso = n => new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP"
}).format(n);


/* =========================================================
   LOAD ORDER
   ========================================================= */

async function loadOrder() {

  const params =
    new URLSearchParams(location.search);

  const orderNo =
    params.get("orderNo");

  let order = null;

  /*
   * Google Sheets is the source of truth.
   * Always fetch the order using the order number.
   */
  if (
    API_URL &&
    !API_URL.includes("PASTE_YOUR") &&
    orderNo
  ) {

    try {

      const response =
        await fetch(
          `${API_URL}?action=order&orderNo=${encodeURIComponent(orderNo)}&t=${Date.now()}`,
          {
            cache: "no-store"
          }
        );

      const data =
        await response.json();

      if (data.ok && data.order) {

        order = data.order;

        localStorage.setItem(
          ORDER_KEY,
          JSON.stringify(order)
        );

      } else {

        console.warn(
          "Order lookup failed:",
          data.error || "Order not found."
        );

      }

    } catch (err) {

      console.warn(
        "Could not refresh order from server:",
        err
      );

      /*
       * If the server cannot be reached, use the locally
       * saved order as a fallback.
       */
      try {
        const saved =
          JSON.parse(
            localStorage.getItem(ORDER_KEY) || "null"
          );

        if (
          saved &&
          saved.orderNumber === orderNo
        ) {
          order = saved;
        }

      } catch (localError) {
        console.warn(
          "Could not load saved order:",
          localError
        );
      }

    }

  }


  /*
   * Determine whether this is the order that was JUST created.
   *
   * sessionStorage is used so the printing animation does not
   * replay every time the customer refreshes or tracks the order.
   */
  const newOrderNumber =
    sessionStorage.getItem(
      "jnx_new_order_animation"
    );

  const isNewOrder =
    Boolean(
      order &&
      orderNo &&
      newOrderNumber === orderNo
    );


  if (isNewOrder) {

    // Consume the flag immediately.
    // Refreshing the page will therefore NOT replay the animation.
    sessionStorage.removeItem(
      "jnx_new_order_animation"
    );

    setTimeout(() => {
      showPrintingAnimation(order);
    }, 150);

  } else {

    renderReceipt(order);

  }

}


/* =========================================================
   RECEIPT PRINTING ANIMATION
   ========================================================= */

function showPrintingAnimation(order) {

  const overlay =
    document.getElementById("printOverlay");

  const printOrderNumber =
    document.getElementById("printOrderNumber");

  const printReceiptItems =
    document.getElementById("printReceiptItems");

  const printTotal =
    document.getElementById("printTotal");

  const printingText =
    document.getElementById("printingText");

  const printingStatus =
    document.getElementById("printingStatus");

  const printedPaper =
    document.getElementById("printedPaper");


  if (!overlay) {
    renderReceipt(order);
    return;
  }


  /*
   * Populate the small animated receipt.
   */
  if (printOrderNumber) {
    printOrderNumber.textContent =
      order.orderNumber || "";
  }


  if (printReceiptItems) {

    printReceiptItems.innerHTML =
      (order.items || [])
        .map(item => `
          <div style="
            display:flex;
            justify-content:space-between;
            gap:10px;
            margin:6px 0;
            font-size:12px;
          ">
            <span>
              ${escapeHtml(item.name)}
              ${item.variant
                ? ` (${escapeHtml(item.variant)})`
                : ""}
              ×${Number(item.quantity) || 0}
            </span>

            <strong>
              ${peso(
                Number(
                  item.subtotal ??
                  (
                    Number(item.unitPrice || item.price || 0) *
                    Number(item.quantity || 0)
                  )
                )
              )}
            </strong>
          </div>
        `)
        .join("");

  }


  if (printTotal) {
    printTotal.textContent =
      peso(Number(order.totalAmount) || 0);
  }


  if (printingText) {
    printingText.textContent =
      "Printing your receipt...";
  }


  if (printingStatus) {
    printingStatus.textContent =
      "Printing your JNX receipt...";
  }


  /*
   * Reset animation state in case the page is revisited
   * within the same browser session.
   */
  if (printedPaper) {
    printedPaper.style.animation = "none";

    // Force browser reflow so the animation can restart.
    void printedPaper.offsetWidth;

    printedPaper.style.animation = "";
  }


  /*
   * Show printer overlay.
   */
  overlay.style.display = "flex";
  overlay.style.visibility = "visible";
  overlay.style.opacity = "1";
  overlay.style.pointerEvents = "auto";


  /*
   * Animation sequence:
   *
   * 0.0s  Printer appears
   * 0.5s  Printing message
   * 1.0s  Paper starts coming out
   * 3.5s  Receipt finishes printing
   * 4.2s  Overlay fades
   * 4.8s  Actual receipt appears
   */
  setTimeout(() => {

    if (printingText) {
      printingText.textContent =
        "Receipt printing...";
    }

    if (printingStatus) {
      printingStatus.textContent =
        "Printing your JNX receipt...";
    }

  }, 500);


  setTimeout(() => {

    if (printingText) {
      printingText.textContent =
        "Receipt printed!";
    }

    if (printingStatus) {
      printingStatus.textContent =
        "Your receipt is ready!";

    }

  }, 3500);


  setTimeout(() => {

    overlay.style.opacity = "0";

  }, 4100);


  setTimeout(() => {

    overlay.style.display = "none";
    overlay.style.pointerEvents = "none";

    renderReceipt(order);

  }, 4700);

}


/* =========================================================
   PHOTObooth RECEIPT PRINTING
   ========================================================= */

function normalizeStatus(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}


function getStatusStage(order) {
  const paymentStatus = normalizeStatus(order.paymentStatus);
  const orderStatus = normalizeStatus(order.orderStatus);

  if (
    orderStatus.includes("completed") ||
    orderStatus.includes("complete")
  ) {
    return 5;
  }

  if (
    orderStatus.includes("ready") ||
    orderStatus.includes("pickup") ||
    orderStatus.includes("pick up")
  ) {
    return 4;
  }

  if (
    orderStatus.includes("processing") ||
    orderStatus.includes("preparing")
  ) {
    return 3;
  }

  if (
    paymentStatus.includes("verified") ||
    paymentStatus.includes("paid") ||
    paymentStatus.includes("confirmed") ||
    paymentStatus.includes("approved")
  ) {
    return 2;
  }

  return 1;
}


function renderStatusTimeline(order) {
  const currentStage = getStatusStage(order);

  const stages = [
    "Order Placed",
    "Payment Verified",
    "Processing",
    "Ready for Pickup",
    "Completed"
  ];

  return `
    <div class="order-tracking-box" style="
      margin-top:30px;
      padding:22px;
      border:1px solid #e5e1ea;
      border-radius:16px;
      background:#faf9fc;
    ">
      <div style="
        display:flex;
        justify-content:space-between;
        align-items:center;
        gap:15px;
        margin-bottom:20px;
        flex-wrap:wrap;
      ">
        <div>
          <strong style="font-size:18px;">
            Order Tracking
          </strong>
          <div style="
            margin-top:4px;
            color:#777;
            font-size:13px;
          ">
            Current status:
            <strong>
              ${escapeHtml(order.orderStatus || "Pending")}
            </strong>
          </div>
        </div>

        <button
          type="button"
          class="secondary-button"
          id="refreshStatusButton" onclick="handleRefreshStatus()"
        >
          Refresh Status
        </button>
      </div>

      <div style="
        display:flex;
        flex-direction:column;
        gap:14px;
      ">
        ${stages.map((stage, index) => {
          const stageNumber = index + 1;
          const completed = stageNumber <= currentStage;

          return `
            <div style="
              display:flex;
              align-items:center;
              gap:12px;
            ">
              <div style="
                width:30px;
                height:30px;
                min-width:30px;
                border-radius:50%;
                display:flex;
                align-items:center;
                justify-content:center;
                font-weight:700;
                background:${completed ? "#111" : "#e9e6ed"};
                color:${completed ? "#fff" : "#777"};
              ">
                ${completed ? "✓" : stageNumber}
              </div>

              <div style="
                font-weight:${completed ? "700" : "500"};
                color:${completed ? "#111" : "#777"};
              ">
                ${stage}
              </div>
            </div>
          `;
        }).join("")}
      </div>
    </div>
  `;
}


/* =========================================================
   REFRESH ORDER
   ========================================================= */

async function refreshOrder() {
  const button =
    document.getElementById("refreshStatusButton");

  if (button) {
    button.disabled = true;
    button.textContent = "Refreshing...";
  }

  try {
    const params =
      new URLSearchParams(location.search);

    const orderNo =
      params.get("orderNo");

    if (!orderNo) {
      return;
    }

    const response =
      await fetch(
        `${API_URL}?action=order&orderNo=${encodeURIComponent(orderNo)}&t=${Date.now()}`,
        {
          cache: "no-store"
        }
      );

    const data =
      await response.json();

    if (!data.ok || !data.order) {
      throw new Error(
        data.error || "Order not found."
      );
    }

    localStorage.setItem(
      ORDER_KEY,
      JSON.stringify(data.order)
    );

    renderReceipt(data.order);

  } catch (err) {

    console.error(
      "Could not refresh order:",
      err
    );

    alert(
      "Unable to refresh the order status right now. Please try again."
    );

  } finally {

    if (button) {
      button.disabled = false;
      button.textContent = "Refresh Status";
    }

  }
}


/* =========================================================
   ACTUAL RECEIPT
   ========================================================= */

function renderReceipt(order) {

  const box =
    document.getElementById(
      "receiptContent"
    );


  if (!order) {

    box.innerHTML =
      `<div class="empty">
        No order was found.
      </div>`;

    return;

  }


  const itemRows =
    (order.items || [])
      .map(item => `

        <tr>

          <td>
            ${escapeHtml(item.name)}
            <br>
            <small>
              ${escapeHtml(item.variant || "")}
            </small>
          </td>

          <td>
            ${item.quantity}
          </td>

          <td>
            ${peso(
              item.unitPrice ??
              item.price
            )}
          </td>

          <td>
            ${peso(
              item.subtotal ??
              (
                item.price *
                item.quantity
              )
            )}
          </td>

        </tr>

      `)
      .join("");


  box.innerHTML = `

    <div
      style="
        display:grid;
        grid-template-columns:1fr 1fr;
        gap:20px;
        margin-top:20px;
      "
    >

      <div>
        <strong>Order No.</strong>
        <br>
        ${escapeHtml(
          order.orderNumber
        )}
      </div>

      <div>
        <strong>Date</strong>
        <br>
        ${escapeHtml(
          order.timestamp ||
          order.createdAt ||
          ""
        )}
      </div>

      <div>
        <strong>Buyer</strong>
        <br>
        ${escapeHtml(
          order.fullName
        )}
      </div>

      <div>
        <strong>Contact</strong>
        <br>
        ${escapeHtml(
          order.contact
        )}
      </div>

      <div>
        <strong>Program</strong>
        <br>
        ${escapeHtml(
          order.program
        )}
      </div>

      <div>
        <strong>Institution</strong>
        <br>
        ${escapeHtml(
          order.institution
        )}
      </div>

      <div>
        <strong>Year Level</strong>
        <br>
        ${escapeHtml(
          order.yearLevel
        )}
      </div>

      <div>
        <strong>Section</strong>
        <br>
        ${escapeHtml(
          order.section
        )}
      </div>

    </div>


    <table class="receipt-table">

      <thead>

        <tr>
          <th>Item</th>
          <th>Qty</th>
          <th>Unit Price</th>
          <th>Amount</th>
        </tr>

      </thead>

      <tbody>
        ${itemRows}
      </tbody>

    </table>


    <div class="receipt-total">
      TOTAL:
      ${peso(order.totalAmount)}
    </div>


    <div style="margin-top:25px;">

      <strong>
        Payment Method:
      </strong>

      ${escapeHtml(
        order.paymentMethod
      )}

      <br>


      ${
        order.paymentReference
          ? `
            <strong>
              Reference:
            </strong>

            ${escapeHtml(
              order.paymentReference
            )}

            <br>
          `
          : ""
      }


      <strong>
        Payment Status:
      </strong>

      <span class="status-badge">
        ${escapeHtml(
          order.paymentStatus ||
          order.status ||
          "Pending"
        )}
      </span>

      <br><br>


      <strong>
        Order Status:
      </strong>

      ${escapeHtml(
        order.orderStatus ||
        "Pending"
      )}

    </div>


    ${renderStatusTimeline(order)}


    <p
      style="
        margin-top:30px;
        text-align:center;
        color:#6d6875;
      "
    >
      You're locked in. 🫡
      <br>
      Thank you for supporting Juris Nexum!
    </p>

  `;

}


/* =========================================================
   SECURITY / HTML ESCAPING
   ========================================================= */

function escapeHtml(value) {

  return String(
    value ?? ""
  ).replace(
    /[&<>"']/g,
    c => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    }[c])
  );

}


/* =========================================================
   START
   ========================================================= */

document.addEventListener("DOMContentLoaded", async () => {
  await loadOrder();
});

async function handleRefreshStatus() {
  const button = document.getElementById("refreshStatusButton");

  if (!button) return;

  button.disabled = true;
  button.textContent = "Refreshing...";

  try {
    await refreshOrder();
  } finally {
    button.disabled = false;
    button.textContent = "Refresh Status";
  }
}

document.addEventListener("click", function (event) {
  if (event.target && event.target.id === "refreshStatusButton") {
    handleRefreshStatus();
  }
});


async function downloadReceiptPDF() {
  const receipt = document.getElementById("receipt");
  const button = document.getElementById("downloadReceiptButton");

  if (!receipt || !window.html2pdf) {
    alert("Unable to create the PDF. Please try again.");
    return;
  }

  const orderNumber =
    new URLSearchParams(window.location.search).get("orderNo") ||
    "JNX-Receipt";

  if (button) {
    button.disabled = true;
    button.textContent = "Creating PDF...";
  }

  try {
    const options = {
      margin: 10,
      filename: `${orderNumber}-Receipt.pdf`,
      image: {
        type: "jpeg",
        quality: 0.98
      },
      html2canvas: {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff"
      },
      jsPDF: {
        unit: "mm",
        format: "a4",
        orientation: "portrait"
      }
    };

    await html2pdf()
      .set(options)
      .from(receipt)
      .save();

  } catch (error) {
    console.error("PDF generation failed:", error);
    alert("Unable to download the receipt. Please try again.");
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = "Download Receipt as PDF";
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const button = document.getElementById("downloadReceiptButton");

  if (button) {
    button.addEventListener("click", downloadReceiptPDF);
  }
});
