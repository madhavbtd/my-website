// functions/index.js (Node.js)
const functions = require("firebase-functions");
const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

exports.calculatePrice = functions
    .region('asia-south1') // अपना क्षेत्र चुनें
    .https.onCall(async (data, context) => {
      const productId = data.productId;
      const unitType = data.unitType;
      const options = data.options || {};

      if (!productId || !unitType) {
        throw new functions.https.HttpsError('invalid-argument', 'उत्पाद आईडी और यूनिट प्रकार आवश्यक हैं।');
      }
      console.log("गणना अनुरोध प्राप्त:", { productId, unitType, options });

      try {
        const productRef = db.collection("products").doc(productId);
        const productSnap = await productRef.get();
        if (!productSnap.exists) {
          throw new functions.https.HttpsError('not-found', 'उत्पाद नहीं मिला।');
        }
        const productData = productSnap.data();

        let calculatedPrice = 0;

        // !!--- यहाँ अपना वास्तविक मूल्य निर्धारण लॉजिक डालें ---!!
        // नीचे केवल एक बहुत ही सरल उदाहरण है
        console.warn("चेतावनी: Cloud Function में वास्तविक मूल्य निर्धारण लॉजिक लागू करें!");

        const baseRate = parseFloat(productData.salePrice || 100); // उदाहरण बेस रेट
        const quantity = parseInt(options.quantity || 1);

        if (unitType === 'Sq Feet') {
             const width = parseFloat(options.width || 1);
             const height = parseFloat(options.height || 1);
             const flexRate = parseFloat(productData.baseRate || 15); // उदाहरण SqFt रेट
             let area = width * height; // सरल गणना
             calculatedPrice = area * flexRate;
             const minPrice = 300;
             calculatedPrice = Math.max(calculatedPrice, minPrice);
             calculatedPrice *= quantity; // यदि SqFt आइटम की मात्रा भी है
        } else {
            calculatedPrice = baseRate * quantity; // सरल मात्रा * दर
        }
        // !!--- वास्तविक लॉजिक यहाँ समाप्त ---!!


        console.log("गणना की गई कीमत:", calculatedPrice);
        return { price: calculatedPrice };

      } catch (error) {
        console.error("Cloud Function में मूल्य गणना त्रुटि:", error);
        if (error instanceof functions.https.HttpsError) { throw error; }
        throw new functions.https.HttpsError('internal', 'कीमत की गणना करने में असमर्थ।', error.message);
      }
    });