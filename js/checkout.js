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


function invalidateMemberVerification() {
  if (!verifiedMember) return;

  verifiedMember = null;

  const message =
    document.getElementById("memberMessage");

  if (message) {
    message.textContent =
      "Buyer information changed. Please verify the Member ID again.";

    message.className =
      "member-message error";
  }

  renderCart();
}

function setupMemberIdentityListeners() {
  const element =
    document.getElementById("fullName");

  if (!element) return;

  element.addEventListener(
    "input",
    invalidateMemberVerification
  );

  element.addEventListener(
    "change",
    invalidateMemberVerification
  );
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
  const input = document.getElementById("memberId");
  const button = document.getElementById("verifyMemberButton");
  const message = document.getElementById("memberMessage");
  const fullNameInput = document.getElementById("fullName");

  const memberId = input.value.trim();
  const fullName = fullNameInput.value.trim();

  if (!memberId) {
    verifiedMember = null;

    message.textContent = "Please enter your Member ID.";
    message.className = "member-message error";

    renderCart();
    return;
  }

  if (!fullName) {
    verifiedMember = null;

    message.textContent = "Please enter your full name first.";
    message.className = "member-message error";

    renderCart();
    return;
  }

  button.disabled = true;
  button.textContent = "Verifying...";

  message.textContent = "Checking membership...";
  message.className = "member-message";

  try {
    const url =
      `${API_URL}?action=verifyMember` +
      `&memberId=${encodeURIComponent(memberId)}` +
      `&fullName=${encodeURIComponent(fullName)}` +
      `&t=${Date.now()}`;

    const response = await fetch(url, {
      cache: "no-store"
    });

    const result = await response.json();

    if (!result.ok) {
      verifiedMember = null;

      message.textContent =
        result.error || "Member verification failed.";

      message.className = "member-message error";

      renderCart();
      return;
    }

    verifiedMember = {
      memberId: result.memberId,
      memberName: result.memberName,
      pricingType: "JNX Member"
    };

    message.innerHTML =
      `✓ Member verified — <strong>${escapeHtml(result.memberName)}</strong><br>
       Member discount has been applied.`;

    message.className = "member-message success";

    renderCart();

  } catch (err) {
    verifiedMember = null;

    message.textContent =
      err.message || "Unable to verify membership.";

    message.className = "member-message error";

    renderCart();

  } finally {
    button.disabled = false;
    button.textContent = "Verify Member";
  }
}



function playOrderCourtBoom() {
  return new Promise(resolve => {

    const boom =
      document.getElementById(
        "orderCourtBoom"
      );

    if (!boom) {
      resolve();
      return;
    }

    boom.classList.remove(
      "is-active"
    );

    /*
     * Short dramatic pause.
     */
    window.setTimeout(() => {

      void boom.offsetWidth;

      boom.classList.add(
        "is-active"
      );

      /*
       * Gavel hits as COURT! lands.
       */
      window.setTimeout(() => {
        playGavelSmash();
      }, 600);

      /*
       * Let the full graffiti animation finish.
       */
      window.setTimeout(() => {

        boom.classList.remove(
          "is-active"
        );

        resolve();

      }, 2100);

    }, 700);
  });
}

function playGavelSmash() {
  try {
    const AudioContext =
      window.AudioContext ||
      window.webkitAudioContext;

    if (!AudioContext) return;

    const ctx = new AudioContext();
    const now = ctx.currentTime;

    // Low wooden impact.
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(125, now);
    osc.frequency.exponentialRampToValueAtTime(55, now + 0.12);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.75, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.25);

    // Sharp wooden click.
    const click = ctx.createOscillator();
    const clickGain = ctx.createGain();

    click.type = "square";
    click.frequency.setValueAtTime(240, now);
    click.frequency.exponentialRampToValueAtTime(90, now + 0.045);

    clickGain.gain.setValueAtTime(0.0001, now);
    clickGain.gain.exponentialRampToValueAtTime(0.22, now + 0.004);
    clickGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);

    click.connect(clickGain);
    clickGain.connect(ctx.destination);

    click.start(now);
    click.stop(now + 0.1);

    // Short noise burst for the physical "SMASH".
    const bufferSize = ctx.sampleRate * 0.12;
    const buffer = ctx.createBuffer(
      1,
      bufferSize,
      ctx.sampleRate
    );

    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      data[i] =
        (Math.random() * 2 - 1) *
        Math.pow(1 - i / bufferSize, 5);
    }

    const noise = ctx.createBufferSource();
    const noiseGain = ctx.createGain();

    noise.buffer = buffer;

    noiseGain.gain.setValueAtTime(0.28, now);
    noiseGain.gain.exponentialRampToValueAtTime(
      0.0001,
      now + 0.12
    );

    noise.connect(noiseGain);
    noiseGain.connect(ctx.destination);

    noise.start(now);
    noise.stop(now + 0.13);

    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 500);

  } catch (err) {
    console.warn("Gavel sound unavailable:", err);
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

  submitButton.classList.add(
    "order-smash"
  );

  const checkoutPage =
    document.querySelector(
      ".checkout-page"
    );

  if (checkoutPage) {
    checkoutPage.classList.remove(
      "order-impact"
    );

    void checkoutPage.offsetWidth;

    checkoutPage.classList.add(
      "order-impact"
    );
  }

  submitButton.classList.add(
    "order-processing"
  );

  submitButton.textContent =
    "Processing Order...";

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

  
  const courtBoomPromise =
      playOrderCourtBoom();

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

    // The graffiti has already been playing while the
    // order was being submitted. Finish it, then go
    // directly to the receipt/printing animation.

    await courtBoomPromise;

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

    submitButton.classList.remove(
      "order-smash",
      "order-processing"
    );

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


document.addEventListener('DOMContentLoaded', setupMemberIdentityListeners);
