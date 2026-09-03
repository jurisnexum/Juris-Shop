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

  const local =
    JSON.parse(
      localStorage.getItem(ORDER_KEY) || "null"
    );

  let order = local;


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

    setTimeout(() => showPrintingAnimation(order), 100);

  } else {

    renderReceipt(order);

  }

}


/* =========================================================
   PHOTObooth RECEIPT PRINTING
   ========================================================= */

function showPrintingAnimation(order) {

  const overlay =
    document.getElementById("printOverlay");

  if (!overlay) {

    renderReceipt(order);

    return;

  }


  /*
   * Populate the small printed receipt.
   */

  const orderNumber =
    document.getElementById(
      "printOrderNumber"
    );

  const total =
    document.getElementById(
      "printTotal"
    );

  const itemsBox =
    document.getElementById(
      "printReceiptItems"
    );


  orderNumber.textContent =
    order.orderNumber || "";


  total.textContent =
    peso(order.totalAmount || 0);


  itemsBox.innerHTML = "";


  (order.items || []).forEach(item => {

    const row =
      document.createElement("div");

    row.style.display = "flex";
    row.style.justifyContent = "space-between";
    row.style.alignItems = "flex-start";
    row.style.gap = "10px";
    row.style.marginBottom = "9px";


    const name =
      document.createElement("div");

    name.style.flex = "1";

    name.innerHTML = `
      <strong>${escapeHtml(item.name)}</strong>
      <br>
      <small>
        ${escapeHtml(item.variant || "")}
        × ${item.quantity}
      </small>
    `;


    const amount =
      document.createElement("strong");

    amount.textContent =
      peso(
        item.subtotal ??
        (
          Number(item.price || 0) *
          Number(item.quantity || 0)
        )
      );


    row.appendChild(name);
    row.appendChild(amount);

    itemsBox.appendChild(row);

  });


  /*
   * Show printer.
   */

  overlay.classList.add("show");


  /*
   * Small pause before the paper begins
   * coming out.
   */

  setTimeout(() => {

    overlay.classList.add("printing");

  }, 400);


  /*
   * Receipt finishes printing.
   */

  setTimeout(() => {

    const status =
      document.getElementById(
        "printingStatus"
      );

    if (status) {

      status.textContent =
        "Receipt printed. 🫡";

    }

    overlay.classList.add("finished");

  }, 3400);


  /*
   * Remove animation and show actual receipt.
   */

  setTimeout(() => {

    overlay.classList.remove(
      "show",
      "printing",
      "finished"
    );

    renderReceipt(order);

  }, 4600);

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

document.addEventListener(
  "DOMContentLoaded",
  loadOrder
);
