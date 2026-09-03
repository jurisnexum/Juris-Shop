# JNX Merchandise Shop

Guest checkout merchandise shop for Juris Nexum.

## Architecture

- GitHub Pages = customer storefront
- Google Apps Script = backend/API
- Google Sheets = products, inventory, orders, order items, settings
- Google Drive = proof-of-payment files

## Current features

- No buyer accounts
- Product catalog loaded from Google Sheets
- Cart
- Automatic total
- Guest checkout
- Program, Institution, Year Level, Section
- InstaPay QR
- Exact computed amount displayed
- Payment reference
- Proof-of-payment upload to Google Drive
- Server-side price calculation
- Server-side stock validation
- Automatic inventory deduction
- Automatic order number
- Receipt page
- Print / Save as PDF
- Order tracking by order number

## Google Sheets setup

1. Create a NEW Google Sheet for the merchandise shop.
2. Open Extensions > Apps Script.
3. Copy `google-apps-script/Code.gs` into the Apps Script editor.
4. Save.
5. Select `setupShop` from the function dropdown and Run it once.
6. Authorize the script.
7. Return to the spreadsheet. The following tabs should exist:
   - PRODUCTS
   - ORDERS
   - ORDER_ITEMS
   - SETTINGS
8. Replace sample products in PRODUCTS with the real merchandise.
9. In PRODUCTS, put public image URLs for product photos if desired.
10. The setup creates a Google Drive folder for payment proofs automatically.

## Deploy Apps Script

1. Apps Script > Deploy > New deployment.
2. Select type: Web app.
3. Execute as: Me.
4. Who has access: Anyone.
5. Deploy.
6. Copy the Web app URL ending in `/exec`.

## Connect GitHub

Open `js/config.js` and replace:

PASTE_YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE

with the deployed `/exec` URL.

Then push the project to GitHub and enable GitHub Pages.

## Important payment rule

The browser's cart prices are NOT trusted by the backend.

When an order is submitted, Apps Script reads each Product ID from PRODUCTS, gets the current price and stock, recalculates the total, validates variants, then records the order and deducts stock.

This is required so a buyer cannot simply edit browser JavaScript to submit a lower amount.

## Important proof-of-payment rule

The uploaded proof is stored in Google Drive and its link is recorded in ORDERS.

InstaPay orders are initially:

Payment Status = Pending Verification
Order Status = Pending

An officer should verify the payment before treating the order as paid.

## Do not put a Google Sheet password or service-account credential in GitHub.

Only the Apps Script Web App URL belongs in `js/config.js`.
