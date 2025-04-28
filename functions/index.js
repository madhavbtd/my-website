// ज़रूरी मॉड्यूल्स इम्पोर्ट करें
const functions = require("firebase-functions"); // Firebase Functions SDK
const admin = require("firebase-admin");      // Firebase Admin SDK
const otpGenerator = require("otp-generator"); // OTP Generator लाइब्रेरी
const nodemailer = require("nodemailer");     // Nodemailer ईमेल भेजने के लिए

// Firebase एडमिन SDK को शुरू करें (सिर्फ एक बार)
admin.initializeApp();

// --- OTP रिक्वेस्ट करने के लिए फंक्शन ---
// यह फंक्शन मानता है कि पासवर्ड क्लाइंट-साइड (login.js) पर पहले ही वेरीफाई हो चुका है।
// यह उम्मीद करता है कि सफल पासवर्ड चेक के बाद login.js से userId डेटा में भेजा जाएगा।
exports.requestOtp = functions.https.onCall(async (data, context) => {

  // 1. login.js से भेजे गए डेटा से यूजर ID प्राप्त करें
  const userId = data.userId;
  if (!userId) {
      console.error("अनुरोध डेटा में यूजर ID गायब है।");
      throw new functions.https.HttpsError('invalid-argument', 'यूजर ID आवश्यक है।');
  }

  console.log(`यूजर ID के लिए OTP का अनुरोध: ${userId}`);

  try {
      // 2. एडमिन SDK का उपयोग करके यूजर का ईमेल प्राप्त करें
      const userRecord = await admin.auth().getUser(userId);
      const email = userRecord.email;
      if (!email) {
          console.error(`यूजर ${userId} के साथ कोई ईमेल एड्रेस संबद्ध नहीं है।`);
          throw new functions.https.HttpsError('not-found', 'यूजर ईमेल नहीं मिला।');
      }
      console.log(`ईमेल मिला: ${email} यूजर के लिए: ${userId}`);

      // 3. OTP जनरेट करें (6 अंकों का)
      const otp = otpGenerator.generate(6, {
          upperCaseAlphabets: false,
          specialChars: false,
          lowerCaseAlphabets: false
      });
      console.log(`OTP जनरेट हुआ: ${otp} यूजर के लिए: ${userId}`);

      // 4. एक्सपायरी टाइम सेट करें (उदाहरण: अब से 10 मिनट)
      const expiryTime = Date.now() + 10 * 60 * 1000; // मिलीसेकंड में 10 मिनट

      // 5. OTP को Firestore में स्टोर करें (या Realtime Database)
      // सुनिश्चित करें कि आपने अपने Firebase प्रोजेक्ट में Firestore इनेबल किया है
      const db = admin.firestore();
      await db.collection('otps').doc(userId).set({
          otp: otp,
          email: email, // संभावित रीसेंड संदर्भ के लिए ईमेल स्टोर करें
          expires: expiryTime
      });
      console.log(`OTP Firestore में स्टोर किया गया यूजर के लिए: ${userId}`);

      // 6. ईमेल ट्रांसपोर्टर कॉन्फ़िगर करें (Nodemailer उदाहरण)
      // महत्वपूर्ण: क्रेडेंशियल यहाँ हार्डकोड न करें। Firebase Functions Environment कॉन्फ़िगरेशन का उपयोग करें।
      const gmailEmail = functions.config().nodemailer?.user;
      const gmailPassword = functions.config().nodemailer?.pass;

      if (!gmailEmail || !gmailPassword) {
          console.error("Nodemailer कॉन्फ़िगरेशन गायब है। `firebase functions:config:set nodemailer.user=... nodemailer.pass=...` का उपयोग करके सेट करें");
          throw new functions.https.HttpsError('internal', 'ईमेल कॉन्फ़िगरेशन त्रुटि।');
      }

      let transporter = nodemailer.createTransport({
          service: 'gmail', // Gmail का उदाहरण
          auth: {
              user: gmailEmail,
              pass: gmailPassword, // Gmail के लिए App Password का उपयोग करें यदि 2FA सक्षम है
          },
      });

      // 7. ईमेल विकल्प
      const mailOptions = {
          from: `"Madhav MultyPrint App" <${gmailEmail}>`, // भेजने वाले का पता (ऐप का नाम बदल सकते हैं)
          to: email, // प्राप्तकर्ता का ईमेल (यूजर का ईमेल)
          subject: "आपका लॉगिन OTP", // विषय
          text: `लॉगिन के लिए आपका वन-टाइम पासवर्ड (OTP) है: ${otp}। यह 10 मिनट के लिए वैध है।`, // टेक्स्ट बॉडी
          html: `<b>लॉगिन के लिए आपका वन-टाइम पासवर्ड (OTP) है: ${otp}</b>। यह 10 मिनट के लिए वैध है।`, // HTML बॉडी
      };

      // 8. ईमेल भेजें
      await transporter.sendMail(mailOptions);
      console.log(`OTP ईमेल सफलतापूर्वक भेजा गया: ${email}`);

      // 9. क्लाइंट (login.js) को सफलता का संदेश भेजें
      return { status: 'success', message: 'OTP सफलतापूर्वक आपके ईमेल पर भेजा गया।' };

  } catch (error) {
      console.error("requestOtp फंक्शन में त्रुटि:", error);
      // HttpsError भेजें ताकि क्लाइंट को सार्थक त्रुटि मिले
      if (error instanceof functions.https.HttpsError) {
          throw error; // मौजूदा HttpsError को फिर से भेजें
      } else {
          throw new functions.https.HttpsError('internal', 'OTP अनुरोध संसाधित करने में विफल।', error.message);
      }
  }
});


// --- OTP वेरीफाई करने के लिए फंक्शन ---
exports.verifyOtp = functions.https.onCall(async (data, context) => {
  const userId = data.userId; // login.js से भेजा गया यूजर ID
  const userOtp = data.otp;  // login.js से भेजा गया यूजर द्वारा डाला गया OTP

  // बेसिक जांच: userId और otp मौजूद हैं या नहीं
  if (!userId || !userOtp) {
    console.error("verifyOtp अनुरोध में userId या OTP गायब है।");
    throw new functions.https.HttpsError('invalid-argument', 'यूजर ID और OTP आवश्यक हैं।');
  }

  console.log(`OTP वेरीफाई किया जा रहा है यूजर ID के लिए: ${userId}, OTP: ${userOtp}`);

  // Firestore का रेफरेंस लें
  const db = admin.firestore();
  const otpRef = db.collection('otps').doc(userId); // Firestore में OTP डॉक्यूमेंट का पाथ

  try {
    // Firestore से OTP डॉक्यूमेंट पढ़ें
    const otpDoc = await otpRef.get();

    // जांचें कि डॉक्यूमेंट मिला या नहीं
    if (!otpDoc.exists) {
      console.log(`यूजर ID के लिए कोई OTP डॉक्यूमेंट नहीं मिला: ${userId}`);
      throw new functions.https.HttpsError('not-found', 'OTP नहीं मिला या पहले ही इस्तेमाल हो चुका है। कृपया दोबारा अनुरोध करें।');
    }

    // डॉक्यूमेंट से स्टोर किया गया OTP और एक्सपायरी टाइम निकालें
    const storedOtpData = otpDoc.data();
    const storedOtp = storedOtpData.otp;
    const expires = storedOtpData.expires;

    // जांचें कि यूजर का OTP स्टोर किए गए OTP से मेल खाता है या नहीं
    if (storedOtp !== userOtp) {
      console.log(`यूजर ID के लिए गलत OTP: ${userId}. डाला गया: ${userOtp}, स्टोर किया गया: ${storedOtp}`);
      // यहाँ चाहें तो गलत प्रयासों को गिनने का लॉजिक जोड़ सकते हैं
      throw new functions.https.HttpsError('invalid-argument', 'गलत OTP डाला गया है।');
    }

    // जांचें कि OTP एक्सपायर तो नहीं हो गया
    if (Date.now() > expires) {
      console.log(`यूजर ID के लिए OTP एक्सपायर हो गया: ${userId}.`);
      await otpRef.delete(); // एक्सपायर OTP को डिलीट करें
      throw new functions.https.HttpsError('deadline-exceeded', 'OTP एक्सपायर हो गया है। कृपया दोबारा अनुरोध करें।');
    }

    // --- OTP सही है और एक्सपायर नहीं हुआ ---
    console.log(`यूजर ID के लिए OTP सफलतापूर्वक वेरीफाई हुआ: ${userId}`);

    // अब जब OTP वेरीफाई हो गया है, तो इसे Firestore से डिलीट कर दें
    await otpRef.delete();
    console.log(`यूजर ID के लिए OTP डॉक्यूमेंट डिलीट किया गया: ${userId}`);

    // यूजर के लिए कस्टम ऑथेंटिकेशन टोकन जेनरेट करें
    console.log(`यूजर ID के लिए कस्टम टोकन जेनरेट किया जा रहा है: ${userId}`);
    const customToken = await admin.auth().createCustomToken(userId);

    // कस्टम टोकन क्लाइंट (login.js) को वापस भेजें
    return { status: 'success', token: customToken };

  } catch (error) {
    console.error(`यूजर ID के लिए OTP वेरीफाई करने में त्रुटि: ${userId}:`, error);
    // जानी-पहचानी त्रुटियों को वैसे ही भेजें
    if (error instanceof functions.https.HttpsError) {
      throw error;
    } else {
      // अनजानी त्रुटियों के लिए सामान्य संदेश भेजें
      throw new functions.https.HttpsError('internal', 'OTP वेरीफाई करने में विफल।', error.message);
    }
  }
});