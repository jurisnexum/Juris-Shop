const ORDER_KEY = "jnx_merch_last_order_v1";

const peso = n => new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP"
}).format(Number(n) || 0);


/* =========================================================
   LOAD ORDER
   ========================================================= */

async function loadOrder() {

  const params = new URLSearchParams(location.search);
  const orderNo = params.get("orderNo");

  if (!orderNo) {
    renderReceipt(null);
    return;
  }

  let order = null;

  /*
   * GOOGLE SHEETS IS THE SOURCE OF TRUTH.
   */
  if (
    API_URL &&
    !API_URL.includes("PASTE_YOUR")
  ) {

    try {

      const response = await fetch(
        `${API_URL}?action=order&orderNo=${encodeURIComponent(orderNo)}&t=${Date.now()}`,
        {
          cache: "no-store"
        }
      );

      const data = await response.json();

      if (!data.ok || !data.order) {
        throw new Error(
          data.error || "Order not found."
        );
      }

      order = data.order;

      localStorage.setItem(
        ORDER_KEY,
        JSON.stringify(order)
      );

    } catch (error) {

      console.warn(
        "Could not load order from Google Sheets:",
        error
      );

      /*
       * FALLBACK TO LOCAL ORDER
       */
      try {

        const saved =
          JSON.parse(
            localStorage.getItem(ORDER_KEY)
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
   * JNX RECEIPT PRINTING ANIMATION
   */
  if (order) {

    showPrintingAnimation(order);

  } else {

    renderReceipt(order);

  }

}


/* =========================================================
   RECEIPT PRINTING ANIMATION
   ========================================================= */

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


function showPrintingAnimation(order) {

  const overlay =
    document.getElementById(
      "printOverlay"
    );

  const printer =
    overlay
      ? overlay.querySelector(".printer")
      : null;

  const printedPaper =
    document.getElementById(
      "printedPaper"
    );

  const printOrderNumber =
    document.getElementById(
      "printOrderNumber"
    );

  const printReceiptItems =
    document.getElementById(
      "printReceiptItems"
    );

  const printTotal =
    document.getElementById(
      "printTotal"
    );

  const printingText =
    document.getElementById(
      "printingText"
    );

  const printingStatus =
    document.getElementById(
      "printingStatus"
    );


  if (!overlay) {

    console.error(
      "JNX PRINTING ANIMATION: #printOverlay not found."
    );

    renderReceipt(order);
    return;

  }


  /*
   * ORDER NUMBER
   */
  if (printOrderNumber) {

    printOrderNumber.textContent =
      order.orderNumber || "";

  }


  /*
   * ITEMS
   */
  if (printReceiptItems) {

    let html = "";

    (order.items || []).forEach(
      item => {

        const regularUnitPrice =
          Number(
            item.regularUnitPrice ??
            item.originalUnitPrice ??
            item.unitPrice ??
            item.price ??
            0
          );

        const unitPrice =
          Number(
            item.unitPrice ??
            item.price ??
            0
          );

        const quantity =
          Number(
            item.quantity
          ) || 0;

        const subtotal =
          Number(
            item.subtotal ??
            unitPrice * quantity
          ) || 0;

        const isMember =
          String(
            order.pricingType || ""
          )
            .toLowerCase()
            .includes("member");

        html += `
          <div style="
            margin:7px 0;
            font-size:12px;
          ">

            <div style="
              display:flex;
              justify-content:space-between;
              gap:10px;
            ">

              <span>
                ${escapeHtml(item.name)}
                ${item.variant
                  ? ` (${escapeHtml(item.variant)})`
                  : ""}
                ×${quantity}
              </span>

              <strong>
                ${peso(subtotal)}
              </strong>

            </div>

            ${
              isMember && regularUnitPrice > unitPrice
                ? `
                  <div style="
                    font-size:10px;
                    opacity:.75;
                    margin-top:2px;
                  ">
                    Regular: ${peso(regularUnitPrice)}
                    &nbsp;→&nbsp;
                    Member: ${peso(unitPrice)}
                  </div>
                `
                : `
                  <div style="
                    font-size:10px;
                    opacity:.75;
                    margin-top:2px;
                  ">
                    Unit Price: ${peso(unitPrice)}
                  </div>
                `
            }

          </div>
        `;

      }
    );

    /*
     * FINANCIAL SUMMARY
     */
    const regularTotal =
      Number(
        order.regularTotal ??
        order.totalAmount ??
        0
      ) || 0;

    const totalAmount =
      Number(
        order.totalAmount
      ) || 0;

    const discountAmount =
      Number(
        order.discountAmount
      ) || Math.max(
        0,
        regularTotal - totalAmount
      );

    const isMember =
      String(
        order.pricingType || ""
      )
        .toLowerCase()
        .includes("member");

    html += `
      <div style="
        border-top:1px dashed #999;
        margin-top:8px;
        padding-top:8px;
        font-size:11px;
      ">

        <div style="
          display:flex;
          justify-content:space-between;
          margin:3px 0;
        ">
          <span>Regular Total</span>
          <span>${peso(regularTotal)}</span>
        </div>

        ${
          isMember
            ? `
              <div style="
                display:flex;
                justify-content:space-between;
                margin:3px 0;
              ">
                <span>Member Discount</span>
                <span>-${peso(discountAmount)}</span>
              </div>
            `
            : ""
        }

        <div style="
          display:flex;
          justify-content:space-between;
          margin-top:6px;
          font-size:13px;
          font-weight:700;
        ">
          <span>TOTAL</span>
          <span>${peso(totalAmount)}</span>
        </div>

      </div>
    `;

    printReceiptItems.innerHTML =
      html;

  }


  /*
   * FINAL TOTAL
   */
  if (printTotal) {

    printTotal.textContent =
      peso(
        Number(
          order.totalAmount
        ) || 0
      );

  }


  /*
   * PRINTER SOUND EFFECT
   * Generated with Web Audio API — no audio file required.
   */
  let jnxPrinterAudioContext = null;
  let jnxPrinterMasterGain = null;
  let jnxPrinterMotor = null;
  let jnxPrinterMotorGain = null;
  let jnxPrinterPaperTimer = null;

  function startJnxPrinterSound() {
    try {
      const AudioContext =
        window.AudioContext || window.webkitAudioContext;

      if (!AudioContext) return;

      if (!jnxPrinterAudioContext) {
        jnxPrinterAudioContext = new AudioContext();
      }

      const ctx = jnxPrinterAudioContext;

      if (ctx.state === "suspended") {
        ctx.resume();
      }

      /*
       * Master volume
       */
      jnxPrinterMasterGain = ctx.createGain();
      jnxPrinterMasterGain.gain.setValueAtTime(
        0.0001,
        ctx.currentTime
      );

      jnxPrinterMasterGain.gain.exponentialRampToValueAtTime(
        0.055,
        ctx.currentTime + 0.08
      );

      jnxPrinterMasterGain.connect(ctx.destination);

      /*
       * Low mechanical printer motor
       */
      jnxPrinterMotor = ctx.createOscillator();
      jnxPrinterMotorGain = ctx.createGain();

      jnxPrinterMotor.type = "sawtooth";
      jnxPrinterMotor.frequency.setValueAtTime(
        72,
        ctx.currentTime
      );

      jnxPrinterMotorGain.gain.setValueAtTime(
        0.0001,
        ctx.currentTime
      );

      jnxPrinterMotorGain.gain.exponentialRampToValueAtTime(
        0.22,
        ctx.currentTime + 0.12
      );

      jnxPrinterMotor.connect(jnxPrinterMotorGain);
      jnxPrinterMotorGain.connect(jnxPrinterMasterGain);

      jnxPrinterMotor.start();

      /*
       * Slight motor variation for a more mechanical sound
       */
      jnxPrinterMotor.frequency.linearRampToValueAtTime(
        82,
        ctx.currentTime + 0.7
      );

      jnxPrinterMotor.frequency.linearRampToValueAtTime(
        68,
        ctx.currentTime + 1.6
      );

      jnxPrinterMotor.frequency.linearRampToValueAtTime(
        78,
        ctx.currentTime + 2.7
      );

      jnxPrinterMotor.frequency.linearRampToValueAtTime(
        64,
        ctx.currentTime + 3.7
      );

      /*
       * Paper-feed clicks / mechanical pulses
       */
      const paperPulse = () => {
        if (!jnxPrinterAudioContext || !jnxPrinterMasterGain) {
          return;
        }

        const now = jnxPrinterAudioContext.currentTime;

        const osc =
          jnxPrinterAudioContext.createOscillator();

        const gain =
          jnxPrinterAudioContext.createGain();

        osc.type = "square";

        osc.frequency.setValueAtTime(
          105,
          now
        );

        osc.frequency.exponentialRampToValueAtTime(
          55,
          now + 0.045
        );

        gain.gain.setValueAtTime(
          0.0001,
          now
        );

        gain.gain.exponentialRampToValueAtTime(
          0.12,
          now + 0.008
        );

        gain.gain.exponentialRampToValueAtTime(
          0.0001,
          now + 0.055
        );

        osc.connect(gain);
        gain.connect(jnxPrinterMasterGain);

        osc.start(now);
        osc.stop(now + 0.06);
      };

      paperPulse();

      jnxPrinterPaperTimer =
        setInterval(paperPulse, 145);

    } catch (error) {
      console.warn(
        "JNX printer sound could not start:",
        error
      );
    }
  }


  function stopJnxPrinterSound() {
    try {
      if (jnxPrinterPaperTimer) {
        clearInterval(jnxPrinterPaperTimer);
        jnxPrinterPaperTimer = null;
      }

      if (
        jnxPrinterAudioContext &&
        jnxPrinterMasterGain
      ) {
        const ctx = jnxPrinterAudioContext;
        const now = ctx.currentTime;

        jnxPrinterMasterGain.gain.cancelScheduledValues(
          now
        );

        jnxPrinterMasterGain.gain.setValueAtTime(
          Math.max(
            jnxPrinterMasterGain.gain.value,
            0.0001
          ),
          now
        );

        jnxPrinterMasterGain.gain.exponentialRampToValueAtTime(
          0.0001,
          now + 0.15
        );
      }

      if (jnxPrinterMotor) {
        setTimeout(() => {
          try {
            jnxPrinterMotor.stop();
          } catch (_) {}

          jnxPrinterMotor = null;
          jnxPrinterMotorGain = null;
          jnxPrinterMasterGain = null;
        }, 180);
      }

    } catch (error) {
      console.warn(
        "JNX printer sound could not stop:",
        error
      );
    }
  }


  /*
   * ORDER IN THE COURT
   *
   * The checkout page sets this flag when a new order
   * has just been placed. The animation is now handled
   * on the order page so navigation cannot cut it off.
   */
  /*
   * A freshly placed order includes ?court=1 in the URL.
   * This is more reliable than relying on sessionStorage
   * during the checkout -> order page navigation.
   */
  const params =
    new URLSearchParams(location.search);

  const playCourtBoom =
    params.get("court") === "1";

  /*
   * RESET ANIMATION
   */
  overlay.classList.remove(
    "show",
    "printing",
    "finished"
  );

  overlay.style.display =
    "flex";

  overlay.style.visibility =
    "visible";

  overlay.style.opacity =
    "1";

  overlay.style.pointerEvents =
    "auto";


  if (printedPaper) {

    printedPaper.style.animation =
      "none";

    printedPaper.style.clipPath =
      "inset(0 0 100% 0)";

    printedPaper.style.transform =
      "translateY(0)";

    void printedPaper.offsetWidth;

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
   * START PRINTER
   *
   * If this is a freshly placed order, play the courtroom
   * animation first. The printer starts immediately after
   * the graffiti disappears.
   */
  const startPrinter = () => {

    requestAnimationFrame(() => {

      overlay.classList.add(
        "show",
        "printing"
      );

      startJnxPrinterSound();


      if (printedPaper) {

        printedPaper.style.animation =
          "paperFeedDown 3.8s cubic-bezier(.22,.61,.36,1) forwards";

      }

    });

  };


  if (playCourtBoom) {

    const boom =
      document.getElementById(
        "orderCourtBoom"
      );

    if (boom) {

      boom.classList.remove(
        "is-active"
      );

      /*
       * Short dramatic pause before the reveal.
       */
      setTimeout(() => {

        void boom.offsetWidth;

        boom.classList.add(
          "is-active"
        );

        /*
         * Gavel smash as COURT! lands.
         */
        setTimeout(() => {

          if (typeof playGavelSmash === "function") {
            playGavelSmash();
          }

        }, 600);

        /*
         * Let the graffiti finish, then immediately
         * hand control to the receipt printer.
         */
        setTimeout(() => {

          boom.classList.remove(
            "is-active"
          );

          startPrinter();

        }, 2100);

      }, 700);

    } else {

      startPrinter();

    }

  } else {

    startPrinter();

  }


  /*
   * STATUS
   */
  setTimeout(() => {

    if (printingText) {

      printingText.textContent =
        "Receipt printing...";

    }

  }, 800);


  /*
   * FINISHED
   */
  setTimeout(() => {

    if (printingText) {

      printingText.textContent =
        "Receipt printed!";

    }

    if (printingStatus) {

      printingStatus.textContent =
        "Your receipt is ready!";

    }

  }, 3800);


  /*
   * STOP PRINTER SOUND
   */
  setTimeout(() => {

    stopJnxPrinterSound();

  }, 3900);


  setTimeout(() => {

    overlay.classList.add(
      "finished"
    );

  }, 4000);


  setTimeout(() => {

    overlay.style.opacity =
      "0";

  }, 4500);


  /*
   * REVEAL REAL RECEIPT
   */
  setTimeout(() => {

    overlay.classList.remove(
      "show",
      "printing",
      "finished"
    );

    overlay.style.display =
      "none";

    overlay.style.visibility =
      "hidden";

    overlay.style.opacity =
      "0";

    overlay.style.pointerEvents =
      "none";

    renderReceipt(order);

  }, 5000);

}


/* =========================================================
   STATUS HELPERS
   ========================================================= */

function normalizeStatus(value) {

  return String(
    value || ""
  )
    .trim()
    .toLowerCase()
    .replace(
      /[_-]+/g,
      " "
    )
    .replace(
      /\s+/g,
      " "
    );

}


function getStatusStage(order) {

  const paymentStatus =
    normalizeStatus(
      order.paymentStatus
    );

  const orderStatus =
    normalizeStatus(
      order.orderStatus
    );


  if (
    orderStatus.includes(
      "completed"
    ) ||
    orderStatus.includes(
      "complete"
    )
  ) {

    return 5;

  }


  if (
    orderStatus.includes(
      "ready"
    ) ||
    orderStatus.includes(
      "pickup"
    ) ||
    orderStatus.includes(
      "pick up"
    )
  ) {

    return 4;

  }


  if (
    orderStatus.includes(
      "processing"
    ) ||
    orderStatus.includes(
      "preparing"
    )
  ) {

    return 3;

  }


  if (
    paymentStatus.includes(
      "verified"
    ) ||
    paymentStatus.includes(
      "paid"
    ) ||
    paymentStatus.includes(
      "confirmed"
    ) ||
    paymentStatus.includes(
      "approved"
    )
  ) {

    return 2;

  }


  return 1;

}


function renderStatusTimeline(
  order
) {

  const currentStage =
    getStatusStage(
      order
    );


  const stages = [

    "Order Placed",

    "Payment Verified",

    "Processing",

    "Ready for Pickup",

    "Completed"

  ];


  return `

    <div
      class="order-tracking-box"
      style="
        margin-top:30px;
        padding:22px;
        border:1px solid #e5e1ea;
        border-radius:16px;
        background:#faf9fc;
      "
    >

      <div style="
        display:flex;
        justify-content:space-between;
        align-items:center;
        gap:15px;
        margin-bottom:20px;
        flex-wrap:wrap;
      ">

        <div>

          <strong
            style="font-size:18px;"
          >
            Order Tracking
          </strong>

          <div style="
            margin-top:4px;
            color:#777;
            font-size:13px;
          ">

            Current status:

            <strong>
              ${escapeHtml(
                order.orderStatus ||
                "Pending"
              )}
            </strong>

          </div>

        </div>


        <button
          type="button"
          class="secondary-button"
          id="refreshStatusButton"
          onclick="handleRefreshStatus()"
        >
          Refresh Status
        </button>

      </div>


      <div style="
        display:flex;
        flex-direction:column;
        gap:14px;
      ">

        ${stages.map(
          (stage, index) => {

            const stageNumber =
              index + 1;

            const completed =
              stageNumber <=
              currentStage;


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
                  background:${
                    completed
                      ? "#111"
                      : "#e9e6ed"
                  };
                  color:${
                    completed
                      ? "#fff"
                      : "#777"
                  };
                ">

                  ${
                    completed
                      ? "✓"
                      : stageNumber
                  }

                </div>


                <div style="
                  font-weight:${
                    completed
                      ? "700"
                      : "500"
                  };
                  color:${
                    completed
                      ? "#111"
                      : "#777"
                  };
                ">

                  ${stage}

                </div>

              </div>

            `;

          }
        ).join("")}

      </div>

    </div>

  `;

}


/* =========================================================
   REFRESH ORDER
   ========================================================= */

async function refreshOrder() {

  const button =
    document.getElementById(
      "refreshStatusButton"
    );


  if (button) {

    button.disabled =
      true;

    button.textContent =
      "Refreshing...";

  }


  try {

    const params =
      new URLSearchParams(
        location.search
      );


    const orderNo =
      params.get(
        "orderNo"
      );


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


    if (
      !data.ok ||
      !data.order
    ) {

      throw new Error(
        data.error ||
        "Order not found."
      );

    }


    localStorage.setItem(
      ORDER_KEY,
      JSON.stringify(
        data.order
      )
    );


    renderReceipt(
      data.order
    );


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

      button.disabled =
        false;

      button.textContent =
        "Refresh Status";

    }

  }

}


/* =========================================================
   ACTUAL RECEIPT
   ========================================================= */

function renderReceipt(
  order
) {

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


  /*
   * MEMBER / REGULAR
   */
  const isMember =
    String(
      order.pricingType || ""
    )
      .toLowerCase()
      .includes(
        "member"
      );


  /*
   * FINANCIAL TOTALS
   */
  const totalAmount =
    Number(
      order.totalAmount
    ) || 0;


  const regularTotal =
    Number(
      order.regularTotal ??
      totalAmount
    ) || 0;


  const discountAmount =
    Number(
      order.discountAmount
    ) || Math.max(
      0,
      regularTotal -
      totalAmount
    );


  /*
   * ITEMS
   */
  const itemRows =
    (order.items || [])
      .map(
        item => {

          const unitPrice =
            Number(
              item.unitPrice ??
              item.price ??
              0
            );


          const quantity =
            Number(
              item.quantity
            ) || 0;


          const subtotal =
            Number(
              item.subtotal ??
              unitPrice *
              quantity
            ) || 0;


          /*
           * The current backend does not store
           * each item's original regular unit price.
           *
           * We calculate it proportionally from
           * the order regular total when possible.
           *
           * If member pricing is active and the
           * member price is lower, show a clear
           * member-price label.
           */
          const memberLabel =
            isMember
              ? `
                <small style="
                  display:block;
                  margin-top:3px;
                  color:#6d6875;
                ">
                  Member Price
                </small>
              `
              : "";


          return `

            <tr>

              <td>

                ${escapeHtml(
                  item.name
                )}

                <br>

                <small>
                  ${
                    item.variant
                      ? escapeHtml(
                          item.variant
                        )
                      : ""
                  }
                </small>

                ${memberLabel}

              </td>


              <td>
                ${quantity}
              </td>


              <td>

                ${peso(
                  unitPrice
                )}

                ${
                  isMember
                    ? `
                      <small style="
                        display:block;
                        color:#6d6875;
                      ">
                        member
                      </small>
                    `
                    : ""
                }

              </td>


              <td>
                ${peso(
                  subtotal
                )}
              </td>

            </tr>

          `;

        }
      )
      .join("");


  /*
   * MEMBERSHIP SECTION
   */
  const membershipSection =
    isMember
      ? `

        <div style="
          margin-top:20px;
          padding:18px;
          border:1px solid #e5e1ea;
          border-radius:14px;
          background:#faf9fc;
        ">

          <h3 style="
            margin:0 0 12px;
          ">
            JNX Membership
          </h3>


          <div style="
            display:grid;
            grid-template-columns:
              1fr 1fr;
            gap:14px;
          ">

            <div>

              <strong>
                Member ID
              </strong>

              <br>

              ${escapeHtml(
                order.memberId ||
                ""
              )}

            </div>


            <div>

              <strong>
                Member Name
              </strong>

              <br>

              ${escapeHtml(
                order.memberName ||
                order.fullName ||
                ""
              )}

            </div>


            <div>

              <strong>
                Pricing Type
              </strong>

              <br>

              <span class="status-badge">
                JNX Member
              </span>

            </div>

          </div>

        </div>

      `
      : `

        <div style="
          margin-top:20px;
          padding:16px;
          border:1px solid #e5e1ea;
          border-radius:14px;
          background:#faf9fc;
        ">

          <strong>
            Pricing Type:
          </strong>

          Regular

        </div>

      `;


  box.innerHTML = `

    <!-- ORDER / BUYER INFORMATION -->

    <div style="
      display:grid;
      grid-template-columns:
        1fr 1fr;
      gap:20px;
      margin-top:20px;
    ">


      <div>

        <strong>
          Order No.
        </strong>

        <br>

        ${escapeHtml(
          order.orderNumber
        )}

      </div>


      <div>

        <strong>
          Date
        </strong>

        <br>

        ${escapeHtml(
          order.timestamp ||
          order.createdAt ||
          ""
        )}

      </div>


      <div>

        <strong>
          Buyer
        </strong>

        <br>

        ${escapeHtml(
          order.fullName
        )}

      </div>


      <div>

        <strong>
          Contact
        </strong>

        <br>

        ${escapeHtml(
          order.contact
        )}

      </div>


      <div>

        <strong>
          Email
        </strong>

        <br>

        ${escapeHtml(
          order.email ||
          "—"
        )}

      </div>


      <div>

        <strong>
          Program
        </strong>

        <br>

        ${escapeHtml(
          order.program
        )}

      </div>


      <div>

        <strong>
          Institution
        </strong>

        <br>

        ${escapeHtml(
          order.institution
        )}

      </div>


      <div>

        <strong>
          Year Level
        </strong>

        <br>

        ${escapeHtml(
          order.yearLevel
        )}

      </div>


      <div>

        <strong>
          Section
        </strong>

        <br>

        ${escapeHtml(
          order.section
        )}

      </div>

    </div>


    ${membershipSection}


    <!-- ITEMS -->

    <h3 style="
      margin-top:30px;
      margin-bottom:12px;
    ">
      Order Items
    </h3>


    <table class="receipt-table">

      <thead>

        <tr>

          <th>
            Item
          </th>

          <th>
            Qty
          </th>

          <th>
            Unit Price
          </th>

          <th>
            Amount
          </th>

        </tr>

      </thead>


      <tbody>

        ${itemRows}

      </tbody>

    </table>


    <!-- FINANCIAL SUMMARY -->

    <div
      id="receiptFinancialSummary"
      style="
        margin-top:25px;
        margin-left:auto;
        max-width:420px;
      "
    >

      <div style="
        display:flex;
        justify-content:space-between;
        padding:8px 0;
      ">

        <span>
          Regular Total
        </span>

        <strong>
          ${peso(
            regularTotal
          )}
        </strong>

      </div>


      <div style="
        display:flex;
        justify-content:space-between;
        padding:8px 0;
        color:#6d6875;
      ">

        <span>
          ${
            isMember
              ? "Member Discount"
              : "Discount"
          }
        </span>

        <strong>
          ${
            discountAmount > 0
              ? `-${peso(
                  discountAmount
                )}`
              : peso(0)
          }
        </strong>

      </div>


      <div
        class="receipt-total"
        style="
          margin-top:8px;
        "
      >

        TOTAL:

        ${peso(
          totalAmount
        )}

      </div>

    </div>


    <!-- PAYMENT INFORMATION -->

    <div style="
      margin-top:30px;
      padding-top:20px;
      border-top:1px solid #e5e1ea;
    ">

      <h3>
        Payment Information
      </h3>


      <strong>
        Payment Method:
      </strong>

      ${escapeHtml(
        order.paymentMethod ||
        "—"
      )}

      <br>


      ${
        order.paymentReference
          ? `

            <strong>
              Payment Reference:
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


    <!-- ORDER TRACKING -->

    ${renderStatusTimeline(
      order
    )}


    <p style="
      margin-top:30px;
      text-align:center;
      color:#6d6875;
    ">

      You're locked in. 🫡

      <br>

      Thank you for supporting
      Juris Nexum!

    </p>

  `;

}


/* =========================================================
   SECURITY / HTML ESCAPING
   ========================================================= */

function escapeHtml(
  value
) {

  return String(
    value ?? ""
  ).replace(
    /[&<>"']/g,
    c => ({
      "&":
        "&amp;",
      "<":
        "&lt;",
      ">":
        "&gt;",
      '"':
        "&quot;",
      "'":
        "&#039;"
    }[c])
  );

}


/* =========================================================
   START
   ========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  async () => {

    await loadOrder();

  }
);


async function handleRefreshStatus() {

  const button =
    document.getElementById(
      "refreshStatusButton"
    );


  if (!button) {
    return;
  }


  button.disabled =
    true;

  button.textContent =
    "Refreshing...";


  try {

    await refreshOrder();

  } finally {

    button.disabled =
      false;

    button.textContent =
      "Refresh Status";

  }

}


document.addEventListener(
  "click",
  function(event) {

    if (
      event.target &&
      event.target.id ===
        "refreshStatusButton"
    ) {

      handleRefreshStatus();

    }

  }
);


/* =========================================================
   DOWNLOAD RECEIPT PDF
   ========================================================= */

async function downloadReceiptPDF() {

  const receipt =
    document.getElementById(
      "receipt"
    );

  const button =
    document.getElementById(
      "downloadReceiptButton"
    );

  if (
    !receipt ||
    !window.html2pdf
  ) {

    alert(
      "Unable to create the PDF. Please try again."
    );

    return;

  }

  const orderNumber =
    new URLSearchParams(
      window.location.search
    ).get(
      "orderNo"
    ) ||
    "JNX-Receipt";

  if (button) {

    button.disabled =
      true;

    button.textContent =
      "Creating PDF...";

  }

  const hiddenElements = [];

  try {

    /*
     * The downloadable receipt must end at the
     * financial summary / final price.
     *
     * Temporarily hide everything after the
     * financial summary while html2pdf captures
     * the REAL receipt element.
     */

    const financialSummary =
      document.getElementById(
        "receiptFinancialSummary"
      );

    if (!financialSummary) {

      throw new Error(
        "Receipt financial summary was not found."
      );

    }

    /*
     * Hide every element in receiptContent that
     * comes after the financial summary.
     *
     * This removes Payment Information and anything
     * else after the final price from the PDF.
     */
    let current =
      financialSummary.nextElementSibling;

    while (current) {

      hiddenElements.push({
        element: current,
        display: current.style.display
      });

      current.style.display =
        "none";

      current =
        current.nextElementSibling;

    }

    /*
     * Also hide any tracking section that may
     * appear elsewhere inside the receipt.
     */
    receipt
      .querySelectorAll(
        ".order-tracking-box, [data-pdf-exclude='true']"
      )
      .forEach(
        element => {

          if (
            !hiddenElements.some(
              item =>
                item.element ===
                element
            )
          ) {

            hiddenElements.push({
              element,
              display:
                element.style.display
            });

            element.style.display =
              "none";

          }

        }
      );

    const options = {

      margin: 10,

      filename:
        `${orderNumber}-Receipt.pdf`,

      image: {

        type:
          "jpeg",

        quality:
          0.98

      },

      html2canvas: {

        scale:
          2,

        useCORS:
          true,

        backgroundColor:
          "#ffffff"

      },

      jsPDF: {

        unit:
          "mm",

        format:
          "a4",

        orientation:
          "portrait"

      }

    };

    /*
     * Capture the actual visible receipt.
     */
    await html2pdf()
      .set(options)
      .from(receipt)
      .save();

  } catch (error) {

    console.error(
      "PDF generation failed:",
      error
    );

    alert(
      "Unable to download the receipt. Please try again."
    );

  } finally {

    /*
     * Restore everything exactly as it was
     * after PDF generation.
     */
    hiddenElements.forEach(
      item => {

        item.element.style.display =
          item.display;

      }
    );

    if (button) {

      button.disabled =
        false;

      button.textContent =
        "Download Receipt as PDF";

    }

  }

}

document.addEventListener(
  "DOMContentLoaded",
  () => {

    const button =
      document.getElementById(
        "downloadReceiptButton"
      );


    if (button) {

      button.addEventListener(
        "click",
        downloadReceiptPDF
      );

    }

  }
);
