// functions/index.js (Node.js)
// This is the backend code that runs on Google's servers.

const functions = require("firebase-functions");
const admin = require("firebase-admin");

// Initialize Firebase Admin SDK only once
if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

/**
 * Calculates the price based on product ID and selected options.
 * Called from the product detail page.
 */
exports.calculatePrice = functions
    .region('asia-south1') // Choose your preferred region
    .https.onCall(async (data, context) => {

      // 1. Get input data from the frontend
      const productId = data.productId;
      const unitType = data.unitType; // e.g., 'Sq Feet', 'Qty', 'Set', 'FixedQty'
      const options = data.options || {}; // e.g., { width: '5', height: '3', quantity: '100', size: 'A5', sets: '1', cardType: 'standard' }

      // Basic validation
      if (!productId || !unitType) {
        console.error("Missing productId or unitType", data);
        throw new functions.https.HttpsError('invalid-argument', 'Product ID and Unit Type are required.');
      }

      console.log("Calculating price for:", { productId, unitType, options });

      try {
        // 2. Fetch base product data from Firestore
        const productRef = db.collection("products").doc(productId);
        const productSnap = await productRef.get();
        if (!productSnap.exists) {
          console.error(`Product not found: ${productId}`);
          throw new functions.https.HttpsError('not-found', 'Product not found.');
        }
        const productData = productSnap.data();

        // 3. Apply Pricing Logic based on Product Type and Options
        //    !!! THIS IS WHERE YOU NEED TO ADD YOUR SPECIFIC RULES !!!
        let calculatedPrice = 0;
        const productType = productData.type || 'default'; // Get product type

        console.log(`Product Type: ${productType}`);

        // --- YOUR PRICING LOGIC HERE ---
        // Use productData (base rates, tiers from Firestore) and options (user input)
        // Implement Requirement 3 rules carefully.

        switch (productType) {
          case 'flex':
            const width = parseFloat(options.width || 0);
            const height = parseFloat(options.height || 0);
            // Get your actual rate per SqFt from productData or a settings collection
            const flexRatePerSqFt = parseFloat(productData.sqftRate || 15); // EXAMPLE Rate
            const minFlexPrice = 300; // Your minimum price
            if (width > 0 && height > 0) {
               // Use your precise SqFt calculation logic (maybe same as in new_po.js)
               // This example uses simple area - REPLACE with your logic
               let area = width * height;
               // Add logic for print area vs real area if needed here
               calculatedPrice = area * flexRatePerSqFt;
               calculatedPrice = Math.max(calculatedPrice, minFlexPrice); // Apply minimum
            } else {
                 calculatedPrice = 0; // Or throw error for invalid dimensions
            }
            break;

          case 'wedding_card':
            const qtyCard = parseInt(options.quantity || 0);
            // Fetch rates for quantity tiers from productData (e.g., productData.rate50, productData.rate100)
            const rate50 = parseFloat(productData.rate50 || 10); // EXAMPLE Rate for 50
            const rate100 = parseFloat(productData.rate100 || 8); // EXAMPLE Rate for 100+
            if (qtyCard < 50) {
                 throw new functions.https.HttpsError('invalid-argument', 'Minimum quantity is 50.');
            } else if (qtyCard < 100) { // Example tier
                calculatedPrice = qtyCard * rate50;
            } else {
                calculatedPrice = qtyCard * rate100;
            }
            break;

           case 'bill_book':
             const size = options.size; // e.g., 'A5'
             const sets = parseInt(options.sets || 1); // e.g., 1 or 2
             // Fetch rate based on size and set count from productData
             // Example: rate_A5_1set, rate_A4_2set
             const rateKey = `rate_${size}_${sets}set`;
             const billBookRate = parseFloat(productData[rateKey] || 150); // EXAMPLE Rate
             calculatedPrice = billBookRate; // Assume fixed price per size/set combo
             break;

           case 'visiting_card':
             const cardType = options.cardType; // e.g., 'standard'
             const qtyVC = parseInt(options.quantity || 1000); // Should always be 1000 from frontend for calculation base
             // Fetch base rate for 1000 pcs based on type
             const rateKeyVC = `rate_${cardType}_1000`;
             const baseRate1000 = parseFloat(productData[rateKeyVC] || 500); // EXAMPLE Rate for 1000
             calculatedPrice = baseRate1000;
             // Note: Discount for 2000 pcs should ideally be handled in the *cart*
             // when quantity there is 2, not here based on options.quantity.
             // Or, pass cart quantity to this function if needed.
             break;

          default:
            // Default calculation (e.g., quantity * base price)
            const qtyOther = parseInt(options.quantity || 1);
            const basePrice = parseFloat(productData.salePrice || 0); // Use salePrice
            calculatedPrice = qtyOther * basePrice;
        }

        // --- END OF YOUR PRICING LOGIC ---

        console.log(`Calculated price for ${productId}: ${calculatedPrice}`);

        // 4. Return the calculated price
        return { price: calculatedPrice };

      } catch (error) {
        console.error("Error in calculatePrice Cloud Function:", error);
        // Throw appropriate HTTPS error for the client
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        // Log the detailed error for backend debugging
        console.error("Internal calculation error details:", error.message);
        throw new functions.https.HttpsError('internal', 'Could not calculate price due to an internal error.');
      }
    });