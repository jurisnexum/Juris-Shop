const CART_KEY = "jnx_merch_cart_v1";

const FALLBACK_PRODUCTS = [
  { id: "JNX001", name: "JNX Classic Shirt", category: "Apparel",
    description: "Official Juris Nexum shirt.", price: 250, stock: 20,
    image: "assets/jnx-logo.png", variants: ["S", "M", "L", "XL"], status: "Available" },
  { id: "JNX002", name: "JNX Tote Bag", category: "Bags",
    description: "Juris Nexum tote bag for everyday use.", price: 180, stock: 20,
    image: "assets/jnx-logo.png", variants: ["Free Size"], status: "Available" }
];

let PRODUCTS = [];

const peso = n => new Intl.NumberFormat("en-PH", {
  style: "currency", currency: "PHP"
}).format(n);

function getCart() {
  return JSON.parse(localStorage.getItem(CART_KEY) || "[]");
}
function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  updateCartCount();
}
function updateCartCount() {
  const el = document.getElementById("cartCount");
  if (el) el.textContent = getCart().reduce((sum, x) => sum + x.quantity, 0);
}
function addToCart(productId, variant) {
  const product = PRODUCTS.find(p => p.id === productId);
  if (!product) return;

  const cart = getCart();
  const key = `${productId}__${variant}`;
  const existing = cart.find(x => x.key === key);

  if (existing) {
    if (existing.quantity >= product.stock) {
      alert("You have reached the available stock for this product.");
      return;
    }
    existing.quantity++;
  } else {
    cart.push({
      key, productId, name: product.name, price: product.price,
      variant, quantity: 1
    });
  }

  saveCart(cart);
  alert(`${product.name} added to cart.`);
}
function renderProducts(filter = "all") {
  const grid = document.getElementById("productGrid");
  const list = PRODUCTS.filter(p => filter === "all" || p.category === filter);

  if (!list.length) {
    grid.innerHTML = `<div class="empty">No products available.</div>`;
    return;
  }

  grid.innerHTML = list.map(p => {
    const variants = (p.variants || []).map(v =>
      `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`
    ).join("");

    const image = p.image || "assets/jnx-logo.png";
    return `
      <article class="product-card">
        <img class="product-image" src="${escapeHtml(image)}" alt="${escapeHtml(p.name)}">
        <div class="product-info">
          <h3>${escapeHtml(p.name)}</h3>
          <p>${escapeHtml(p.description || "")}</p>
          <div class="price">${peso(p.price)}</div>
          <div class="stock">${p.stock > 0 ? `${p.stock} in stock` : "Out of stock"}</div>
          <label style="margin-bottom:10px;">
            Size / Variant
            <select id="variant-${escapeHtml(p.id)}">${variants}</select>
          </label>
          <button class="add-button" ${p.stock <= 0 ? "disabled" : ""}
            onclick="addToCart('${escapeJs(p.id)}', document.getElementById('variant-${escapeJs(p.id)}').value)">
            Add to Cart
          </button>
        </div>
      </article>`;
  }).join("");
}
async function loadProducts() {
  if (!API_URL || API_URL.includes("PASTE_YOUR")) {
    PRODUCTS = FALLBACK_PRODUCTS;
    return;
  }

  try {
    const response = await fetch(`${API_URL}?action=products`, { cache: "no-store" });
    const data = await response.json();
    if (!data.ok) throw new Error(data.error || "Unable to load products.");
    PRODUCTS = data.products;
  } catch (err) {
    console.warn("Using fallback products:", err);
    PRODUCTS = FALLBACK_PRODUCTS;
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
async function init() {
  const filter = document.getElementById("categoryFilter");
  await loadProducts();

  [...new Set(PRODUCTS.map(p => p.category))].forEach(c => {
    filter.insertAdjacentHTML("beforeend",
      `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`);
  });

  filter.addEventListener("change", e => renderProducts(e.target.value));
  renderProducts();
  updateCartCount();
}
document.addEventListener("DOMContentLoaded", init);
