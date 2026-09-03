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
          `${API_URL}?action=order&orderNo=${encodeURIComponent(orderNo)}`,
          {
            cache: "no-store"
          }
        );

      const data =
        await response.json();

      if (data.ok) {

        order = data.order;

        localStorage.setItem(
          ORDER_KEY,
          JSON.stringify(order)
        );

      }

    } catch (err) {

      console.warn(
        "Could not refresh order from server:",
        err
      );

    }

  }


  /*
   * If this is a newly created order,
   * show the printer animation first.
   */
  if (
    order &&
    orderNo &&
    order.orderNumber === orderNo
  ) {

    setTimeout(() => showPrintingAnimation(order), 150);

  } else {

    renderReceipt(order);

  }

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
