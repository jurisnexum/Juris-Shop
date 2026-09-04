const CART_KEY = "jnx_merch_cart_v1";
const ORDER_KEY = "jnx_merch_last_order_v1";

const peso = n => new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP"
}).format(n);

const getCart = () =>
  JSON.parse(localStorage.getItem(CART_KEY) || "[]");

const saveCart = cart =>
  localStorage.setItem(CART_KEY, JSON.stringify(cart));

let PRODUCTS = [];
let verifiedMember = null;

function regularTotal(cart) {
  return cart.reduce(
    (sum, item) =>
      sum +
      Number(item.price || 0) *
      Number(item.quantity || 0),
    0
  );
}

function getProduct(productId) {
  return PRODUCTS.find(
    product =>
      String(product.id) ===
      String(productId)
  );
}

function getItemVariant(item) {
  const product = getProduct(item.productId);

  if (!product || !item.variant) {
    return null;
  }

  return (
    product.variantDetails || []
  ).find(
    v =>
      String(v.variant).toLowerCase() ===
      String(item.variant).toLowerCase()
  ) || null;
}

function getItemRegularPrice(item) {
  const variant = getItemVariant(item);

  if (variant) {
    return Number(variant.price) || 0;
  }

  const product = getProduct(item.productId);

  if (product) {
    return Number(product.price) || 0;
  }

  return Number(item.price) || 0;
}

function getItemMemberPrice(item) {
  const variant = getItemVariant(item);

  if (variant) {
    const memberPrice =
      Number(variant.memberPrice) || 0;

    return memberPrice > 0
      ? memberPrice
      : Number(variant.price) || 0;
  }

  const product = getProduct(item.productId);

  if (product) {
    const memberPrice =
      Number(product.memberPrice) || 0;

    if (memberPrice > 0) {
      return memberPrice;
    }

    return Number(product.price) || 0;
  }

  return Number(item.price) || 0;
}

function getItemAppliedPrice(item) {
  return verifiedMember
    ? getItemMemberPrice(item)
    : getItemRegularPrice(item);
}

function total(cart) {
  return cart.reduce(
    (sum, item) =>
      sum +
      getItemAppliedPrice(item) *
      Number(item.quantity || 0),
    0
  );
}

async function loadProducts() {
  if (
    !API_URL ||
    API_URL.includes("PASTE_YOUR")
  ) {
    throw new Error(
      "The Google Apps Script URL has not been configured yet."
    );
  }

  const response = await fetch(
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
      : [];
}

function renderCart() {
  const cart = getCart();

  const box =
    document.getElementById(
      "cartItems"
    );

  const regular =
    regularTotal(cart);

  const amount =
    total(cart);

  if (!cart.length) {
    box.innerHTML = `
      <div class="empty">
        Your cart is empty.<br><br>
        <a href="shop.html">
          Return to shop
        </a>
      </div>`;
  } else {
    box.innerHTML =
      cart.map(item => {
        const regularPrice =
          getItemRegularPrice(item);

        const appliedPrice =
          getItemAppliedPrice(item);

        const hasDiscount =
          verifiedMember &&
          appliedPrice <
            regularPrice;

        return `
          <div class="cart-row">
            <div class="cart-row-title">
              ${escapeHtml(item.name)}
            </div>

            <div class="cart-row-meta">
              ${escapeHtml(item.variant || "")}
              ·
              ${
                hasDiscount
                  ? `
                    <span style="text-decoration:line-through;opacity:.6;">
                      ${peso(regularPrice)}
                    </span>
                    <strong>
                      ${peso(appliedPrice)}
                    </strong>
                    <span class="member-price-label">
                      MEMBER
                    </span>
                  `
                  : `${peso(appliedPrice)} each`
              }
            </div>

            <div class="cart-row-bottom">
              <div class="qty-control">
                <button
                  type="button"
                  onclick="changeQty('${escapeJs(item.key)}', -1)"
                >−</button>

                <strong>
                  ${item.quantity}
                </strong>

                <button
                  type="button"
                  onclick="changeQty('${escapeJs(item.key)}', 1)"
                >+</button>
              </div>

              <strong>
                ${peso(
                  appliedPrice *
                  Number(item.quantity || 0)
                )}
              </strong>
            </div>
          </div>
        `;
      }).join("");
  }

  const discount =
    Math.max(
      0,
      regular - amount
    );

  const regularTotalElement =
    document.getElementById(
      "regularCartTotal"
    );

  if (regularTotalElement) {
    regularTotalElement.textContent =
      peso(regular);
  }

  const discountRow =
    document.getElementById(
      "discountRow"
    );

  const discountAmount =
    document.getElementById(
      "discountAmount"
    );

  if (discountRow) {
    discountRow.classList.toggle(
      "hidden",
      !verifiedMember ||
      discount <= 0
    );
  }

  if (discountAmount) {
    discountAmount.textContent =
      "-" + peso(discount);
  }

  document.getElementById(
    "cartTotal"
  ).textContent = peso(amount);

  document.getElementById(
    "paymentTotal"
  ).textContent = peso(amount);
}

function changeQty(key, delta) {
  const cart = getCart();

  const item =
    cart.find(x =>
      x.key === key
    );

  if (!item) return;

  item.quantity += delta;

  if (item.quantity <= 0) {
    cart.splice(
      cart.indexOf(item),
      1
    );
  }

  saveCart(cart);
  renderCart();
}

function togglePayment() {
  const method =
    document.getElementById(
      "paymentMethod"
    ).value;

  const panel =
    document.getElementById(
      "paymentPanel"
    );

  const ref =
    document.getElementById(
      "paymentReference"
    );

  const proof =
    document.getElementById(
      "proof"
    );

  panel.classList.toggle(
    "hidden",
    method !== "GCash"
  );

  ref.required =
    method === "GCash";

  proof.required =
    method === "GCash";
}

function fileToBase64(file) {
  return new Promise(
    (resolve, reject) => {
      if (!file) {
        resolve(null);
        return;
      }

      if (
        file.size >
        5 * 1024 * 1024
      ) {
        reject(
          new Error(
            "Proof of payment must be 5 MB or smaller."
          )
        );
        return;
      }

      const reader =
        new FileReader();

      reader.onload = () => {
        const result =
          String(
            reader.result
          );

        const comma =
          result.indexOf(",");

        resolve({
          name: file.name,
          mimeType:
            file.type ||
            "application/octet-stream",
          data:
            comma >= 0
              ? result.slice(
                  comma + 1
                )
              : result
        });
      };

      reader.onerror =
        () => reject(
          new Error(
            "Could not read the proof-of-payment file."
          )
        );

      reader.readAsDataURL(file);
    }
  );
}

async function verifyMember() {
  const input =
    document.getElementById(
      "memberId"
    );

  const button =
    document.getElementById(
      "verifyMemberButton"
    );

  const message =
    document.getElementById(
      "memberMessage"
    );

  const memberId =
    input.value.trim();

  if (!memberId) {
    verifiedMember = null;

    message.textContent =
      "Please enter your Member ID.";

    message.className =
      "member-message error";

    renderCart();
    return;
  }

  button.disabled = true;
  button.textContent =
    "Verifying...";

  message.textContent =
    "Checking membership...";

  message.className =
    "member-message";

  try {
    const response =
      await fetch(
        `${API_URL}?action=verifyMember` +
        `&memberId=${encodeURIComponent(memberId)}` +
        `&fullName=${encodeURIComponent(document.getElementById("fullName").value.trim())}` +
        `&program=${encodeURIComponent(document.getElementById("program").value.trim())}` +
        `&yearLevel=${encodeURIComponent(document.getElementById("yearLevel").value)}` +
        `&section=${encodeURIComponent(document.getElementById("section").value.trim())}` +
        `&t=${Date.now()}`,
        {
          cache: "no-store"
        }
      );

    const result =
      await response.json();

    if (!result.ok) {
      verifiedMember = null;

      message.textContent =
        result.error ||
        "Member verification failed.";

      message.className =
        "member-message error";

      renderCart();
      return;
    }

    verifiedMember = {
      memberId:
        result.memberId,
      memberName:
        result.memberName,
      pricingType:
        result.pricingType
    };

    message.innerHTML =
      `✓ Member verified — <strong>${escapeHtml(result.memberName)}</strong><br>
       Member discount has been applied.`;

    message.className =
      "member-message success";

    renderCart();

  } catch (err) {
    verifiedMember = null;

    message.textContent =
      err.message ||
      "Unable to verify membership.";

    message.className =
      "member-message error";

    renderCart();

  } finally {
    button.disabled = false;
    button.textContent =
      "Verify Member";
  }
}

async function submitOrder(event) {
  event.preventDefault();

  const cart =
    getCart();

  if (!cart.length) {
    alert(
      "Your cart is empty."
    );
    return;
  }

  if (
    !API_URL ||
    API_URL.includes("PASTE_YOUR")
  ) {
    alert(
      "The Google Apps Script URL has not been configured yet."
    );
    return;
  }

  const method =
    document.getElementById(
      "paymentMethod"
    ).value;

  const submitButton =
    event.submitter;

  submitButton.disabled =
    true;

  submitButton.textContent =
    "Submitting...";

  try {
    const proofFile =
      method === "GCash"
        ? await fileToBase64(
            document.getElementById(
              "proof"
            ).files[0]
          )
        : null;

    const payload = {
      action:
        "createOrder",

      fullName:
        document.getElementById(
          "fullName"
        ).value.trim(),

      contact:
        document.getElementById(
          "contact"
        ).value.trim(),

      email:
        document.getElementById(
          "email"
        ).value.trim(),

      program:
        document.getElementById(
          "program"
        ).value.trim(),

      institution:
        document.getElementById(
          "institution"
        ).value.trim(),

      yearLevel:
        document.getElementById(
          "yearLevel"
        ).value,

      section:
        document.getElementById(
          "section"
        ).value.trim(),

      /*
       * Only the Member ID is sent.
       * The server independently verifies it.
       */
      memberId:
        verifiedMember
          ? verifiedMember.memberId
          : "",

      paymentMethod:
        method,

      paymentReference:
        method === "GCash"
          ? document.getElementById(
              "paymentReference"
            ).value.trim()
          : "",

      /*
       * Browser prices are deliberately
       * NOT sent.
       */
      items:
        cart.map(item => ({
          productId:
            item.productId,
          variant:
            item.variant,
          quantity:
            item.quantity
        })),

      proof:
        proofFile
    };

    const response =
      await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type":
            "text/plain;charset=utf-8"
        },
        body:
          JSON.stringify(
            payload
          )
      });

    const result =
      await response.json();

    if (!result.ok) {
      throw new Error(
        result.error ||
        "Order could not be submitted."
      );
    }

    localStorage.setItem(
      ORDER_KEY,
      JSON.stringify({
        orderNumber:
          result.orderNumber,

        totalAmount:
          result.totalAmount,

        regularTotal:
          result.regularTotal,

        discountAmount:
          result.discountAmount,

        pricingType:
          result.pricingType,

        memberId:
          result.memberId,

        memberName:
          result.memberName,

        paymentStatus:
          result.paymentStatus,

        orderStatus:
          result.orderStatus,

        createdAt:
          result.timestamp,

        fullName:
          payload.fullName,

        contact:
          payload.contact,

        email:
          payload.email,

        program:
          payload.program,

        institution:
          payload.institution,

        yearLevel:
          payload.yearLevel,

        section:
          payload.section,

        paymentMethod:
          payload.paymentMethod,

        paymentReference:
          payload.paymentReference,

        items:
          cart
      })
    );

    localStorage.removeItem(
      CART_KEY
    );

    sessionStorage.setItem(
      "jnx_new_order_animation",
      result.orderNumber
    );

    window.location.href =
      `order.html?orderNo=${encodeURIComponent(
        result.orderNumber
      )}`;

  } catch (err) {
    alert(
      err.message ||
      "Something went wrong."
    );

    submitButton.disabled =
      false;

    submitButton.textContent =
      "Place Order";
  }
}

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

function escapeJs(value) {
  return String(
    value ?? ""
  )
    .replace(
      /\\/g,
      "\\\\"
    )
    .replace(
      /'/g,
      "\\'"
    );
}

document.addEventListener(
  "DOMContentLoaded",
  async () => {
    try {
      await loadProducts();
    } catch (err) {
      console.error(
        "JNX PRODUCTS:",
        err
      );
    }

    renderCart();

    document
      .getElementById(
        "paymentMethod"
      )
      .addEventListener(
        "change",
        togglePayment
      );

    document
      .getElementById(
        "verifyMemberButton"
      )
      .addEventListener(
        "click",
        verifyMember
      );

    document
      .getElementById(
        "checkoutForm"
      )
      .addEventListener(
        "submit",
        submitOrder
      );
  }
);
