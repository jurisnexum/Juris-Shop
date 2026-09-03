const ORDER_KEY = "jnx_merch_last_order_v1";
const peso = n => new Intl.NumberFormat("en-PH", {
  style: "currency", currency: "PHP"
}).format(n);

async function loadOrder() {
  const params = new URLSearchParams(location.search);
  const orderNo = params.get("orderNo");
  const local = JSON.parse(localStorage.getItem(ORDER_KEY) || "null");

  let order = local;

  if (API_URL && !API_URL.includes("PASTE_YOUR") && orderNo) {
    try {
      const response = await fetch(
        `${API_URL}?action=order&orderNo=${encodeURIComponent(orderNo)}`,
        { cache: "no-store" }
      );
      const data = await response.json();
      if (data.ok) {
        order = data.order;
        localStorage.setItem(ORDER_KEY, JSON.stringify(order));
      }
    } catch (err) {
      console.warn("Could not refresh order from server:", err);
    }
  }

  renderReceipt(order);
}

function renderReceipt(order) {
  const box = document.getElementById("receiptContent");

  if (!order) {
    box.innerHTML = `<div class="empty">No order was found.</div>`;
    return;
  }

  const itemRows = (order.items || []).map(item => `
    <tr>
      <td>${escapeHtml(item.name)}<br><small>${escapeHtml(item.variant || "")}</small></td>
      <td>${item.quantity}</td>
      <td>${peso(item.unitPrice ?? item.price)}</td>
      <td>${peso(item.subtotal ?? (item.price * item.quantity))}</td>
    </tr>
  `).join("");

  box.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:20px;">
      <div><strong>Order No.</strong><br>${escapeHtml(order.orderNumber)}</div>
      <div><strong>Date</strong><br>${escapeHtml(order.timestamp || order.createdAt || "")}</div>
      <div><strong>Buyer</strong><br>${escapeHtml(order.fullName)}</div>
      <div><strong>Contact</strong><br>${escapeHtml(order.contact)}</div>
      <div><strong>Program</strong><br>${escapeHtml(order.program)}</div>
      <div><strong>Institution</strong><br>${escapeHtml(order.institution)}</div>
      <div><strong>Year Level</strong><br>${escapeHtml(order.yearLevel)}</div>
      <div><strong>Section</strong><br>${escapeHtml(order.section)}</div>
    </div>

    <table class="receipt-table">
      <thead>
        <tr><th>Item</th><th>Qty</th><th>Unit Price</th><th>Amount</th></tr>
      </thead>
      <tbody>${itemRows}</tbody>
    </table>

    <div class="receipt-total">TOTAL: ${peso(order.totalAmount)}</div>

    <div style="margin-top:25px;">
      <strong>Payment Method:</strong> ${escapeHtml(order.paymentMethod)}<br>
      ${order.paymentReference ? `<strong>Reference:</strong> ${escapeHtml(order.paymentReference)}<br>` : ""}
      <strong>Payment Status:</strong>
      <span class="status-badge">${escapeHtml(order.paymentStatus || order.status || "Pending")}</span><br><br>
      <strong>Order Status:</strong> ${escapeHtml(order.orderStatus || "Pending")}
    </div>

    <p style="margin-top:30px;text-align:center;color:#6d6875;">
      Thank you for supporting Juris Nexum!
    </p>
  `;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;"
  }[c]));
}

document.addEventListener("DOMContentLoaded", loadOrder);
