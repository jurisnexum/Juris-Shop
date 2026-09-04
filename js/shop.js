
function normalizeProductImage(url) {
  const value = String(url || "").trim();

  if (!value) {
    return "assets/jnx-logo.png";
  }

  // Google Drive:
  // https://drive.google.com/file/d/FILE_ID/view
  let match = value.match(
    /drive\.google\.com\/file\/d\/([^/?#]+)/
  );

  if (match) {
    return "https://drive.google.com/uc?export=download&id=" +
      encodeURIComponent(match[1]);
  }

  // Google Drive:
  // https://drive.google.com/open?id=FILE_ID
  match = value.match(
    /drive\.google\.com\/open\?id=([^&#]+)/
  );

  if (match) {
    return "https://drive.google.com/uc?export=download&id=" +
      encodeURIComponent(match[1]);
  }

  // Google Drive:
  // https://drive.google.com/uc?id=FILE_ID
  match = value.match(
    /drive\.google\.com\/uc\?(?:export=[^&]*&)?id=([^&#]+)/
  );

  if (match) {
    return "https://drive.google.com/uc?export=download&id=" +
      encodeURIComponent(match[1]);
  }

  // Already a direct image URL
  return value;
}

const CART_KEY = "jnx_merch_cart_v1";

const FALLBACK_PRODUCTS = [
  {
    id: "JNX001",
    name: "LEGALISTA",
    category: "Bags",
    description: "JNX Tote Bag",
    price: 130,
    memberPrice: 110,
    stock: 100,
    image: "1.png",
    variants: ["S", "M", "L", "XL"],
    status: "Available"
  },
  {
    id: "JNX002",
    name: "IGNORANTIA",
    category: "Bags",
    description: "JNX Tote Bag",
    price: 130,
    memberPrice: 110,
    stock: 20,
    image: "2.png",
    variants: ["Small", "Medium", "Large", "XL"],
    variantDetails: [
      {
        variant: "Small",
        price: 130,
        memberPrice: 110,
        stock: 5,
        status: "Available"
      },
      {
        variant: "Medium",
        price: 140,
        memberPrice: 120,
        stock: 5,
        status: "Available"
      },
      {
        variant: "Large",
        price: 150,
        memberPrice: 130,
        stock: 5,
        status: "Available"
      },
      {
        variant: "XL",
        price: 160,
        memberPrice: 140,
        stock: 5,
        status: "Available"
      }
    ],
    status: "Available"
  },
  {
    id: "JNX003",
    name: "COFFEE DIGEST",
    category: "Bags",
    description: "JNX Tote Bag",
    price: 130,
    memberPrice: 110,
    stock: 100,
    image: "5.png",
    variants: ["S", "M", "L", "XL"],
    status: "Available"
  },
  {
    id: "JNX004",
    name: "BONA FIDE",
    category: "Bags",
    description: "JNX Tote Bag",
    price: 130,
    memberPrice: 110,
    stock: 100,
    image: "3.png",
    variants: ["S", "M", "L", "XL"],
    status: "Available"
  },
  {
    id: "JNX005",
    name: "ART. 1156",
    category: "Bags",
    description: "JNX Tote Bag",
    price: 130,
    memberPrice: 110,
    stock: 100,
    image: "4.png",
    variants: ["S", "M", "L", "XL"],
    status: "Available"
  }
];

let PRODUCTS = [];

const peso = n =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP"
  }).format(Number(n) || 0);

function getCart() {
  return JSON.parse(
    localStorage.getItem(CART_KEY) || "[]"
  );
}

function saveCart(cart) {
  localStorage.setItem(
    CART_KEY,
    JSON.stringify(cart)
  );

  updateCartCount();
}

function updateCartCount() {
  const el = document.getElementById("cartCount");

  if (!el) return;

  const count = getCart().reduce(
    (sum, item) =>
      sum + Number(item.quantity || 0),
    0
  );

  el.textContent = count;
}

function getVariantData(product, variant) {
  if (!product) return null;

  const details =
    Array.isArray(product.variantDetails)
      ? product.variantDetails
      : [];

  return details.find(
    v =>
      String(v.variant || "").trim().toLowerCase() ===
      String(variant || "").trim().toLowerCase()
  ) || null;
}

function getSelectedVariant(product) {
  if (!product) return null;

  const select = document.getElementById(
    `variant-${product.id}`
  );

  return select ? select.value : null;
}

function getProductPricing(product, variant) {
  const variantData =
    getVariantData(product, variant);

  if (variantData) {
    const regularPrice =
      Number(variantData.price);

    const memberPrice =
      Number(variantData.memberPrice);

    const stock =
      Number(variantData.stock);

    return {
      regularPrice:
        Number.isFinite(regularPrice)
          ? regularPrice
          : Number(product.price) || 0,

      memberPrice:
        Number.isFinite(memberPrice) &&
        memberPrice > 0
          ? memberPrice
          : Number.isFinite(regularPrice)
            ? regularPrice
            : Number(product.memberPrice) || 0,

      stock:
        Number.isFinite(stock)
          ? stock
          : Number(product.stock) || 0,

      status:
        String(
          variantData.status || "Available"
        )
    };
  }

  return {
    regularPrice:
      Number(product.price) || 0,

    memberPrice:
      Number(product.memberPrice) || Number(product.price) || 0,

    stock:
      Number(product.stock) || 0,

    status:
      String(product.status || "Available")
  };
}

function addToCart(productId, variant) {
  const product =
    PRODUCTS.find(
      p => String(p.id) === String(productId)
    );

  if (!product) return;

  const pricing =
    getProductPricing(product, variant);

  if (
    pricing.status.toLowerCase() !== "available" ||
    pricing.stock <= 0
  ) {
    alert(
      `${product.name} (${variant}) is out of stock.`
    );

    return;
  }

  const cart = getCart();

  const key =
    `${productId}__${variant}`;

  const existing =
    cart.find(item => item.key === key);

  if (existing) {
    if (
      existing.quantity >= pricing.stock
    ) {
      alert(
        "You have reached the available stock for this variant."
      );

      return;
    }

    existing.quantity++;

    existing.price =
      pricing.regularPrice;

    existing.memberPrice =
      pricing.memberPrice;

  } else {
    cart.push({
      key,
      productId: product.id,
      name: product.name,
      price: pricing.regularPrice,
      memberPrice: pricing.memberPrice,
      variant,
      quantity: 1
    });
  }

  saveCart(cart);

  updateCartCount();
  animateAddToCart(productId);

  showCartFeedback(
    `${product.name} (${variant}) added to cart at ${peso(pricing.regularPrice)}.`
  );
}

function showCartFeedback(message) {
  const oldToast =
    document.querySelector(".shop-toast");

  if (oldToast) oldToast.remove();

  const toast =
    document.createElement("div");

  toast.className = "shop-toast";

  toast.innerHTML = `
    <span>✓</span>
    <div>
      <strong>Added to cart</strong>
      <small>${escapeHtml(message)}</small>
    </div>
  `;

  document.body.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add("show");
  });

  setTimeout(() => {
    toast.classList.remove("show");

    setTimeout(() => {
      toast.remove();
    }, 250);
  }, 2200);
}

function renderProducts(
  filter = "all",
  searchTerm = ""
) {
  const grid =
    document.getElementById("productGrid");

  if (!grid) return;

  const search =
    searchTerm.trim().toLowerCase();

  const list =
    PRODUCTS.filter(product => {
      const categoryMatch =
        filter === "all" ||
        product.category === filter;

      const searchMatch =
        !search ||
        String(product.name || "")
          .toLowerCase()
          .includes(search) ||
        String(product.description || "")
          .toLowerCase()
          .includes(search) ||
        String(product.category || "")
          .toLowerCase()
          .includes(search);

      return categoryMatch && searchMatch;
    });

  if (!list.length) {
    grid.innerHTML = `
      <div class="empty modern-empty">
        <div style="font-size:35px;margin-bottom:10px;">⌕</div>
        <strong>No merchandise found</strong>
        <p>Try another search or category.</p>
      </div>
    `;

    return;
  }

  grid.innerHTML =
    list.map(product => {
      const variantDetails =
        Array.isArray(product.variantDetails)
          ? product.variantDetails
          : [];

      const variants =
        (product.variants || [])
          .map(variant => `
            <option value="${escapeHtml(variant)}">
              ${escapeHtml(variant)}
            </option>
          `)
          .join("");

      const firstVariant =
        variantDetails.find(
          v =>
            String(v.status || "Available")
              .toLowerCase() === "available" &&
            Number(v.stock || 0) > 0
        ) || null;

      const initialVariant =
        firstVariant
          ? firstVariant.variant
          : (product.variants || [])[0];

      const pricing =
        getProductPricing(
          product,
          initialVariant
        );

      const image = normalizeProductImage(product.image);

      return `
        <article class="modern-product-card">

          <div class="modern-product-image-wrap">

            <span class="product-category-tag">
              ${escapeHtml(
                product.category || "MERCH"
              ).toUpperCase()}
            </span>

            <span
              class="product-stock-tag ${pricing.stock <= 0 ? "out" : ""}"
              id="stock-${escapeHtml(product.id)}"
            >
              ${
                pricing.stock > 0
                  ? `${pricing.stock} LEFT`
                  : "SOLD OUT"
              }
            </span>

            <img
              class="modern-product-image"
              src="${escapeHtml(image)}"
              alt="${escapeHtml(product.name)}"
              loading="lazy"
            >

          </div>

          <div class="modern-product-info">

            <h3>
              ${escapeHtml(product.name)}
            </h3>

            <p class="modern-product-description">
              ${escapeHtml(
                product.description || ""
              )}
            </p>

            <div class="modern-price-row">

              <span
                class="modern-price"
                id="price-${escapeHtml(product.id)}"
              >
                ${peso(pricing.regularPrice)}
              </span>

              <span
                class="member-price"
                id="member-price-wrap-${escapeHtml(product.id)}"
                ${
                  pricing.memberPrice >=
                  pricing.regularPrice
                    ? 'style="display:none"'
                    : ""
                }
              >
                JNX Member
                <strong
                  id="member-price-${escapeHtml(product.id)}"
                >
                  ${peso(pricing.memberPrice)}
                </strong>
              </span>

            </div>

            <label>
              SIZE / VARIANT

              <select
                id="variant-${escapeHtml(product.id)}"
                data-product-id="${escapeHtml(product.id)}"
              >
                ${variants}
              </select>

            </label>

            <button
              class="modern-add-button"
              id="add-${escapeHtml(product.id)}"
              ${
                pricing.stock <= 0
                  ? "disabled"
                  : ""
              }
            >
              ${
                pricing.stock > 0
                  ? "Add to Cart"
                  : "Out of Stock"
              }
            </button>

          </div>

        </article>
      `;
    }).join("");

  list.forEach(product => {
    const select =
      document.getElementById(
        `variant-${product.id}`
      );

    const button =
      document.getElementById(
        `add-${product.id}`
      );

    if (select) {
      select.addEventListener(
        "change",
        () => {
          updateVariantPrice(product.id);
        }
      );
    }

    if (button) {
      button.addEventListener(
        "click",
        () => {
          const selectedVariant =
            select
              ? select.value
              : "";

          addToCart(
            product.id,
            selectedVariant
          );
        }
      );
    }
  });
}

function updateVariantPrice(productId) {
  const product =
    PRODUCTS.find(
      p => String(p.id) === String(productId)
    );

  if (!product) return;

  const select =
    document.getElementById(
      `variant-${productId}`
    );

  if (!select) return;

  const variant =
    select.value;

  const pricing =
    getProductPricing(
      product,
      variant
    );

  const priceEl =
    document.getElementById(
      `price-${productId}`
    );

  if (priceEl) {
    priceEl.textContent =
      peso(pricing.regularPrice);
  }

  const memberPriceEl =
    document.getElementById(
      `member-price-${productId}`
    );

  const memberWrap =
    document.getElementById(
      `member-price-wrap-${productId}`
    );

  if (memberPriceEl) {
    memberPriceEl.textContent =
      peso(pricing.memberPrice);
  }

  if (memberWrap) {
    memberWrap.style.display =
      pricing.memberPrice <
      pricing.regularPrice
        ? ""
        : "none";
  }

  const stockEl =
    document.getElementById(
      `stock-${productId}`
    );

  if (stockEl) {
    stockEl.textContent =
      pricing.stock > 0
        ? `${pricing.stock} LEFT`
        : "SOLD OUT";

    stockEl.classList.toggle(
      "out",
      pricing.stock <= 0
    );
  }

  const button =
    document.getElementById(
      `add-${productId}`
    );

  if (button) {
    button.disabled =
      pricing.stock <= 0;

    button.textContent =
      pricing.stock > 0
        ? "Add to Cart"
        : "Out of Stock";
  }
}

async function loadProducts() {
  if (
    !API_URL ||
    API_URL.includes("PASTE_YOUR")
  ) {
    PRODUCTS =
      FALLBACK_PRODUCTS;

    return;
  }

  try {
    const response =
      await fetch(
        `${API_URL}?action=products&t=${Date.now()}`,
        {
          cache: "no-store"
        }
      );

    const data =
      await response.json();

    if (!data.ok) {
      throw new Error(
        data.error ||
        "Unable to load products."
      );
    }

    PRODUCTS =
      Array.isArray(data.products)
        ? data.products
        : FALLBACK_PRODUCTS;

  } catch (err) {
    console.warn(
      "Using fallback products:",
      err
    );

    PRODUCTS =
      FALLBACK_PRODUCTS;
  }
}


function animateAddToCart(productId) {
  const card = document.querySelector(
    `.modern-product-card:has(#add-${productId})`
  );

  const button = document.getElementById(`add-${productId}`);
  const cartCount = document.getElementById("cartCount");

  if (button) {
    button.classList.remove("cart-button-smash");
    void button.offsetWidth;
    button.classList.add("cart-button-smash");

    setTimeout(() => {
      button.classList.remove("cart-button-smash");
    }, 450);
  }

  if (card) {
    const image = card.querySelector(".modern-product-image");

    if (image) {
      const rect = image.getBoundingClientRect();
      const flyingImage = image.cloneNode(true);

      flyingImage.classList.add("flying-cart-image");

      flyingImage.style.position = "fixed";
      flyingImage.style.left = `${rect.left}px`;
      flyingImage.style.top = `${rect.top}px`;
      flyingImage.style.width = `${rect.width}px`;
      flyingImage.style.height = `${rect.height}px`;

      document.body.appendChild(flyingImage);

      const cartTarget =
        document.querySelector("#cartCount") ||
        document.querySelector(".cart-link") ||
        document.querySelector("[href*='checkout']");

      if (cartTarget) {
        const targetRect = cartTarget.getBoundingClientRect();

        const targetX =
          targetRect.left + targetRect.width / 2;

        const targetY =
          targetRect.top + targetRect.height / 2;

        const startX =
          rect.left + rect.width / 2;

        const startY =
          rect.top + rect.height / 2;

        flyingImage.style.setProperty(
          "--fly-x",
          `${targetX - startX}px`
        );

        flyingImage.style.setProperty(
          "--fly-y",
          `${targetY - startY}px`
        );

        requestAnimationFrame(() => {
          flyingImage.classList.add(
            "flying-cart-image-active"
          );
        });

        setTimeout(() => {
          flyingImage.remove();
        }, 700);
      } else {
        flyingImage.remove();
      }
    }
  }

  if (cartCount) {
    cartCount.classList.remove("cart-count-pop");

    void cartCount.offsetWidth;

    cartCount.classList.add("cart-count-pop");

    setTimeout(() => {
      cartCount.classList.remove("cart-count-pop");
    }, 500);
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(
      /[&<>"']/g,
      character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
      }[character])
    );
}

async function init() {
  const filter =
    document.getElementById(
      "categoryFilter"
    );

  const search =
    document.getElementById(
      "productSearch"
    );

  await loadProducts();

  if (filter) {
    [
      ...new Set(
        PRODUCTS.map(
          product => product.category
        )
      )
    ].forEach(category => {
      filter.insertAdjacentHTML(
        "beforeend",
        `
          <option value="${escapeHtml(category)}">
            ${escapeHtml(category)}
          </option>
        `
      );
    });
  }

  const render =
    () =>
      renderProducts(
        filter
          ? filter.value
          : "all",
        search
          ? search.value
          : ""
      );

  if (filter) {
    filter.addEventListener(
      "change",
      render
    );
  }

  if (search) {
    search.addEventListener(
      "input",
      render
    );
  }

  render();

  updateCartCount();
}

document.addEventListener(
  "DOMContentLoaded",
  init
);
