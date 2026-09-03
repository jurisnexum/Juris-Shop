const CART_KEY = "jnx_merch_cart_v1";
const ORDER_KEY = "jnx_merch_last_order_v1";

const peso = n => new Intl.NumberFormat("en-PH", {
  style: "currency", currency: "PHP"
}).format(n);

const getCart = () => JSON.parse(localStorage.getItem(CART_KEY) || "[]");
const saveCart = cart => localStorage.setItem(CART_KEY, JSON.stringify(cart));

function total(cart) {
  return cart.reduce((sum, item) => sum + Number(item.price) * Number(item.quantity), 0);
}

function renderCart() {
  const cart = getCart();
  const box = document.getElementById("cartItems");
  const amount = total(cart);

  if (!cart.length) {
    box.innerHTML = `<div class="empty">Your cart is empty.<br><br>
      <a href="index.html">Return to shop</a></div>`;
  } else {
    box.innerHTML = cart.map(item => `
      <div class="cart-row">
        <div class="cart-row-title">${escapeHtml(item.name)}</div>
        <div class="cart-row-meta">${escapeHtml(item.variant)} · ${peso(item.price)} each</div>
        <div class="cart-row-bottom">
          <div class="qty-control">
            <button type="button" onclick="changeQty('${escapeJs(item.key)}', -1)">−</button>
            <strong>${item.quantity}</strong>
            <button type="button" onclick="changeQty('${escapeJs(item.key)}', 1)">+</button>
          </div>
          <strong>${peso(item.price * item.quantity)}</strong>
        </div>
      </div>`).join("");
  }

  document.getElementById("cartTotal").textContent = peso(amount);
  document.getElementById("paymentTotal").textContent = peso(amount);
}

function changeQty(key, delta) {
  const cart = getCart();
  const item = cart.find(x => x.key === key);
  if (!item) return;

  item.quantity += delta;
  if (item.quantity <= 0) cart.splice(cart.indexOf(item), 1);

  saveCart(cart);
  renderCart();
}

function togglePayment() {
  const method = document.getElementById("paymentMethod").value;
  const panel = document.getElementById("paymentPanel");
  const ref = document.getElementById("paymentReference");
  const proof = document.getElementById("proof");

  panel.classList.toggle("hidden", method !== "GCash");
  ref.required = method === "GCash";
  proof.required = method === "GCash";
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve(null);
    if (file.size > 5 * 1024 * 1024) {
      reject(new Error("Proof of payment must be 5 MB or smaller."));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      const comma = result.indexOf(",");
      resolve({
        name: file.name,
        mimeType: file.type || "application/octet-stream",
        data: comma >= 0 ? result.slice(comma + 1) : result
      });
    };
    reader.onerror = () => reject(new Error("Could not read the proof-of-payment file."));
    reader.readAsDataURL(file);
  });
}

async function submitOrder(event) {
  event.preventDefault();

  const cart = getCart();
  if (!cart.length) {
    alert("Your cart is empty.");
    return;
  }

  if (!API_URL || API_URL.includes("PASTE_YOUR")) {
    alert("The Google Apps Script URL has not been configured yet.");
    return;
  }

  const method = document.getElementById("paymentMethod").value;
  const submitButton = event.submitter;
  submitButton.disabled = true;
  submitButton.textContent = "Submitting...";

  try {
    const proofFile = method === "GCash"
      ? await fileToBase64(document.getElementById("proof").files[0])
      : null;

    const payload = {
      action: "createOrder",
      fullName: document.getElementById("fullName").value.trim(),
      contact: document.getElementById("contact").value.trim(),
      email: document.getElementById("email").value.trim(),
      program: document.getElementById("program").value.trim(),
      institution: document.getElementById("institution").value.trim(),
      yearLevel: document.getElementById("yearLevel").value,
      section: document.getElementById("section").value.trim(),
      paymentMethod: method,
      paymentReference: method === "GCash"
        ? document.getElementById("paymentReference").value.trim() : "",
      // The server ignores browser prices and recalculates from Google Sheets.
      items: cart.map(item => ({
        productId: item.productId,
        variant: item.variant,
        quantity: item.quantity
      })),
      proof: proofFile
    };

    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    if (!result.ok) throw new Error(result.error || "Order could not be submitted.");

    localStorage.setItem(ORDER_KEY, JSON.stringify({
      orderNumber: result.orderNumber,
      totalAmount: result.totalAmount,
      paymentStatus: result.paymentStatus,
      orderStatus: result.orderStatus,
      createdAt: result.timestamp,
      // Buyer-side receipt details
      fullName: payload.fullName,
      contact: payload.contact,
      email: payload.email,
      program: payload.program,
      institution: payload.institution,
      yearLevel: payload.yearLevel,
      section: payload.section,
      paymentMethod: payload.paymentMethod,
      paymentReference: payload.paymentReference,
      items: cart
    }));

    localStorage.removeItem(CART_KEY);
    window.location.href = `order.html?orderNo=${encodeURIComponent(result.orderNumber)}`;
  } catch (err) {
    alert(err.message || "Something went wrong.");
    submitButton.disabled = false;
    submitButton.textContent = "Place Order";
  }
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;"
  }[c]));
}
function escapeJs(value) {
  return String(value ?? "").replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

document.addEventListener("DOMContentLoaded", () => {
  renderCart();
  document.getElementById("paymentMethod").addEventListener("change", togglePayment);
  document.getElementById("checkoutForm").addEventListener("submit", submitOrder);
});
