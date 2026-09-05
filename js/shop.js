
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

function playAddToCartSound() {
  try {
    const AudioContext =
      window.AudioContext ||
      window.webkitAudioContext;

    if (!AudioContext) return;

    const ctx = new AudioContext();

    const play = () => {
      const now = ctx.currentTime;

      // Main cart "pop"
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";

      osc.frequency.setValueAtTime(
        420,
        now
      );

      osc.frequency.exponentialRampToValueAtTime(
        900,
        now + 0.09
      );

      osc.frequency.exponentialRampToValueAtTime(
        650,
        now + 0.18
      );

      gain.gain.setValueAtTime(
        0.0001,
        now
      );

      gain.gain.exponentialRampToValueAtTime(
        0.45,
        now + 0.008
      );

      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        now + 0.22
      );

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.23);

      // Bright confirmation tone
      const chime = ctx.createOscillator();
      const chimeGain = ctx.createGain();

      chime.type = "triangle";

      chime.frequency.setValueAtTime(
        1100,
        now
      );

      chime.frequency.exponentialRampToValueAtTime(
        1500,
        now + 0.06
      );

      chimeGain.gain.setValueAtTime(
        0.0001,
        now
      );

      chimeGain.gain.exponentialRampToValueAtTime(
        0.20,
        now + 0.006
      );

      chimeGain.gain.exponentialRampToValueAtTime(
        0.0001,
        now + 0.14
      );

      chime.connect(chimeGain);
      chimeGain.connect(ctx.destination);

      chime.start(now);
      chime.stop(now + 0.15);

      setTimeout(() => {
        ctx.close().catch(() => {});
      }, 500);
    };

    // Some browsers create the AudioContext suspended.
    if (ctx.state === "suspended") {
      ctx.resume()
        .then(play)
        .catch(() => {});
    } else {
      play();
    }

  } catch (err) {
    console.warn(
      "Add-to-cart sound unavailable:",
      err
    );
  }
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

  playAddToCartSound();

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
  const button = document.getElementById(`add-${productId}`);

  const card = button
    ? button.closest(".modern-product-card")
    : null;

  const cartCount =
    document.getElementById("cartCount");


  /* =========================================
     BUTTON SMASH
     ========================================= */

  if (button) {
    const originalTransform =
      button.style.transform;

    button.style.transition =
      "transform 120ms cubic-bezier(.2,.8,.2,1)";

    button.style.transform =
      "scale(.78)";

    setTimeout(() => {
      button.style.transition =
        "transform 120ms cubic-bezier(.2,.8,.2,1)";

      button.style.transform =
        "scale(1.13) rotate(-2deg)";

    }, 120);

    setTimeout(() => {
      button.style.transform =
        "scale(.94) rotate(1deg)";

    }, 240);

    setTimeout(() => {
      button.style.transform =
        "scale(1)";

    }, 340);

    setTimeout(() => {
      button.style.transform =
        originalTransform;

      button.style.transition = "";

    }, 500);
  }


  /* =========================================
     PRODUCT CARD IMPACT
     ========================================= */

  if (card) {
    card.classList.remove("jnx-card-impact");

    void card.offsetWidth;

    card.classList.add("jnx-card-impact");

    setTimeout(() => {
      card.classList.remove("jnx-card-impact");
    }, 700);
  }


  /* =========================================
     CART COUNTER POP
     ========================================= */

  if (cartCount) {
    const originalTransform =
      cartCount.style.transform;

    cartCount.style.transition =
      "transform 130ms cubic-bezier(.2,.8,.2,1)";

    cartCount.style.transform =
      "scale(1.55)";

    setTimeout(() => {
      cartCount.style.transform =
        "scale(.82) rotate(-6deg)";
    }, 130);

    setTimeout(() => {
      cartCount.style.transform =
        "scale(1.25) rotate(5deg)";
    }, 260);

    setTimeout(() => {
      cartCount.style.transform =
        "scale(1)";
    }, 390);

    setTimeout(() => {
      cartCount.style.transform =
        originalTransform;

      cartCount.style.transition = "";

    }, 550);
  }


  /* =========================================
     +1 FLOATING EFFECT
     ========================================= */

  if (button) {
    const rect =
      button.getBoundingClientRect();

    const plus =
      document.createElement("div");

    plus.textContent = "+1";

    /* Force all important visual properties */
    Object.assign(
      plus.style,
      {
        position: "fixed",
        left: `${rect.left + rect.width / 2}px`,
        top: `${rect.top + rect.height / 2}px`,

        zIndex: "2147483647",

        pointerEvents: "none",

        display: "block",
        visibility: "visible",

        opacity: "1",

        padding: "8px 14px",

        borderRadius: "999px",

        background: "#ffffff",

        color: "#111111",

        fontFamily:
          "Arial, Helvetica, sans-serif",

        fontSize: "26px",

        fontWeight: "900",

        lineHeight: "1",

        whiteSpace: "nowrap",

        boxShadow:
          "0 8px 30px rgba(0,0,0,.30)",

        transform:
          "translate(-50%, -50%) scale(.5)"
      }
    );

    document.body.appendChild(plus);

    /* Animate directly with Web Animations API */
    const animation =
      plus.animate(
        [
          {
            opacity: 1,
            transform:
              "translate(-50%, -50%) scale(.5)"
          },

          {
            opacity: 1,
            transform:
              "translate(-50%, -85%) scale(1.3)",
            offset: .20
          },

          {
            opacity: 1,
            transform:
              "translate(-50%, -145%) scale(1.1)",
            offset: .50
          },

          {
            opacity: 0,
            transform:
              "translate(-50%, -220%) scale(.8)"
          }
        ],
        {
          duration: 850,
          easing:
            "cubic-bezier(.2,.8,.2,1)"
        }
      );

    animation.onfinish = () => {
      plus.remove();
    };
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
