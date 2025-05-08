// functions/index.js

// Firebase Admin SDK को इम्पोर्ट करें ताकि आप Firebase सेवाओं (जैसे Firestore) तक पहुँच सकें
const admin = require("firebase-admin");
// Firebase Functions SDK को इम्पोर्ट करें
const functions = require("firebase-functions");

// Firebase Admin SDK को शुरू करें
admin.initializeApp();

// Firestore का एक इंस्टैंस बनाएँ
const db = admin.firestore();

/**
 * यह Cloud Function तब चलेगा जब 'orders' कलेक्शन में कोई नया डॉक्यूमेंट (ऑर्डर) बनेगा।
 * यह ऑर्डर में मौजूद आइटम्स के आधार पर 'onlineProducts' कलेक्शन में स्टॉक अपडेट करेगा।
 */
exports.updateStockOnNewOrder = functions.firestore
    .document("orders/{orderId}") // "{orderId}" एक वाइल्डकार्ड है जो किसी भी ऑर्डर आईडी से मैच करेगा
    .onCreate(async (snap, context) => {
        // 'snap.data()' से नए बने ऑर्डर का डेटा मिलेगा
        const orderData = snap.data();
        const orderId = context.params.orderId; // बनाए गए ऑर्डर की आईडी

        // कंसोल में लॉगिंग (Firebase कंसोल में Functions के Logs टैब में दिखेगा)
        console.log(`Processing order ID: ${orderId}`);
        console.log("Order Data:", JSON.stringify(orderData, null, 2)); // ऑर्डर डेटा को विस्तार से लॉग करें

        // सुनिश्चित करें कि ऑर्डर डेटा और items मौजूद हैं
        if (!orderData || !orderData.items || !Array.isArray(orderData.items) || orderData.items.length === 0) {
            console.log(`Order ${orderId} has no items or items is not a valid array. Skipping stock update.`);
            return null; // फंक्शन को रोक दें
        }

        const items = orderData.items;
        let updatesMade = 0;

        // हर आइटम के लिए स्टॉक अपडेट करें
        for (const item of items) {
            const productId = item.productId;
            const quantityOrdered = item.quantity;

            // सुनिश्चित करें कि productId और quantityOrdered सही हैं
            if (!productId || typeof quantityOrdered !== 'number' || quantityOrdered <= 0) {
                console.warn(`Invalid item data in order <span class="math-inline">\{orderId\}\: productId\=</span>{productId}, quantityOrdered=${quantityOrdered}. Skipping this item.`);
                continue; // इस आइटम को छोड़कर अगले पर जाएँ
            }

            // 'onlineProducts' कलेक्शन में प्रोडक्ट का रेफरेंस पाएँ
            const productRef = db.collection("onlineProducts").doc(productId);

            try {
                // Firestore Transaction का उपयोग स्टॉक को पढ़ने और अपडेट करने के लिए करें
                // यह सुनिश्चित करता है कि अगर एक ही समय कई रिक्वेस्ट आती हैं तो भी डेटा सही रहे
                await db.runTransaction(async (transaction) => {
                    const productDoc = await transaction.get(productRef);

                    if (!productDoc.exists) {
                        console.warn(`Product with ID ${productId} in order ${orderId} not found in 'onlineProducts'. Skipping stock update for this item.`);
                        return; // इस प्रोडक्ट के लिए ट्रांज़ैक्शन रोकें
                    }

                    const productData = productDoc.data();
                    // सुनिश्चित करें कि 'stock' और 'currentStock' फ़ील्ड मौजूद हैं
                    const currentStock = productData.stock?.currentStock;

                    if (typeof currentStock !== 'number') {
                        console.warn(`Product ${productId} (order ${orderId}) does not have a valid 'stock.currentStock' field or it's not a number. Current value: ${currentStock}. Skipping stock update for this item.`);
                        return; // इस प्रोडक्ट के लिए ट्रांज़ैक्शन रोकें
                    }

                    // अगर स्टॉक कम है तो क्या करना है? (आप अपनी लॉजिक यहाँ डाल सकते हैं)
                    if (currentStock < quantityOrdered) {
                        console.warn(`Not enough stock for product ${productId} (order ${orderId}). Available: ${currentStock}, Ordered: ${quantityOrdered}. Stock will be set to 0 or update will be skipped based on business logic.`);
                        // उदाहरण: स्टॉक को 0 कर देते हैं या अपडेट नहीं करते
                        // transaction.update(productRef, { "stock.currentStock": 0 }); // स्टॉक को 0 करने के लिए
                        return; // अभी के लिए, अगर स्टॉक कम है तो अपडेट नहीं करते
                    }

                    const newStock = currentStock - quantityOrdered;
                    transaction.update(productRef, {
                        "stock.currentStock": newStock,
                        "updatedAt": admin.firestore.FieldValue.serverTimestamp() // प्रोडक्ट कब अपडेट हुआ, इसका टाइमस्टैम्प
                    });
                    updatesMade++;
                    console.log(`Stock for product ${productId} (order ${orderId}) transactionally updated from ${currentStock} to ${newStock}.`);
                });

            } catch (error) {
                console.error(`Error processing item ${productId} in order ${orderId} with transaction:`, error);
                // यहाँ आप किसी खास आइटम में गड़बड़ी होने पर क्या करना है, यह तय कर सकते हैं
                // जैसे, एडमिन को सूचना भेजना
            }
        }

        if (updatesMade > 0) {
            console.log(`Successfully processed stock updates for ${updatesMade} item(s) in order ${orderId}.`);
        } else {
            console.log(`No stock updates were made for order ${orderId} (possibly due to missing products, invalid stock data, or insufficient stock).`);
        }
        return null; // फंक्शन सफलतापूर्वक समाप्त
    });