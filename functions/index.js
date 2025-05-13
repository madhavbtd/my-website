const functions = require("firebase-functions");
const admin = require("firebase-admin");
const bcrypt = require("bcrypt");

admin.initializeApp();

// === Helper Functions ===

// डेटा को सुरक्षित करने के लिए (उदाहरण के लिए, SQL इंजेक्शन से बचाव)
function escapeString(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
}

// === API Endpoints ===

// 1. एजेंट बनाने के लिए फ़ंक्शन
exports.createAgent = functions.https.onCall(async (data, context) => {
  // प्रमाणीकरण की जाँच करें (केवल व्यवस्थापक ही कर सकते हैं)
  if (!context.auth || context.auth.token.role !== 'admin') {
    throw new functions.https.HttpsError('permission-denied', 'Only admins can create agents.');
  }

  // डेटा को सुरक्षित करें और मान्य करें
  const name = escapeString(data.name);
  const email = escapeString(data.email);
  const password = data.password;
  const permissions = data.permissions || [];
  const userType = data.userType || 'agent'; // Default to 'agent'

  if (!name || !email || !password) {
    throw new functions.https.HttpsError('invalid-argument', 'Name, email, and password are required.');
  }

  if (password.length < 6) {
    throw new functions.https.HttpsError('invalid-argument', 'Password must be at least 6 characters long.');
  }

  try {
    // 1. Firebase Authentication में उपयोगकर्ता बनाएँ
    const userRecord = await admin.auth().createUser({
      email: email,
      password: password,
    });
    const uid = userRecord.uid;

    // 2. पासवर्ड हैश करें (bcrypt का उपयोग करके)
    const hashedPassword = await bcrypt.hash(password, 10);

    // 3. डेटाबेस में एजेंट सहेजें (उदाहरण: Firestore)
    const agentData = {
      name: name,
      email: email,
      password: hashedPassword,
      permissions: permissions,
      userType: userType,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      firebaseUid: uid, // Firebase UID
    };

    await admin.firestore().collection('agents').doc(uid).set(agentData);

    return { message: 'Agent created successfully!', uid: uid };

  } catch (error) {
    console.error('Error creating agent:', error);
    // Firebase Authentication त्रुटियों को संभालें
    if (error.code === 'auth/email-already-exists') {
      throw new functions.https.HttpsError('already-exists', 'Email address is already in use.');
    }
    throw new functions.https.HttpsError('internal', 'Could not create agent.', error);
  }
});

// 2. एजेंट को अपडेट करने के लिए फ़ंक्शन (वैकल्पिक, यदि आपको इसकी आवश्यकता है)
exports.updateAgent = functions.https.onCall(async (data, context) => {
  // प्रमाणीकरण और अनुमति जाँचें (केवल व्यवस्थापक या एजेंट स्वयं ही कर सकते हैं)
  if (!context.auth || (context.auth.token.role !== 'admin' && context.auth.uid !== data.id)) {
    throw new functions.https.HttpsError('permission-denied', 'You do not have permission to update this agent.');
  }

  // डेटा को सुरक्षित करें और मान्य करें
  const name = escapeString(data.name);
  const email = escapeString(data.email);
  const permissions = data.permissions || [];
  const userType = data.userType || 'agent';

  if (!name || !email) {
    throw new functions.https.HttpsError('invalid-argument', 'Name and email are required.');
  }

  try {
    const updateData = {
      name: name,
      email: email,
      permissions: permissions,
      userType: userType,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await admin.firestore().collection('agents').doc(data.id).update(updateData);

    return { message: 'Agent updated successfully!' };

  } catch (error) {
    console.error('Error updating agent:', error);
    throw new functions.https.HttpsError('internal', 'Could not update agent.', error);
  }
});

// 3. एजेंट को हटाने के लिए फ़ंक्शन (सावधानी बरतें)
exports.deleteAgent = functions.https.onCall(async (data, context) => {
  // प्रमाणीकरण और अनुमति जाँचें (केवल व्यवस्थापक ही कर सकते हैं)
  if (!context.auth || context.auth.token.role !== 'admin') {
    throw new functions.https.HttpsError('permission-denied', 'Only admins can delete agents.');
  }

  if (!data.id) {
    throw new functions.https.HttpsError('invalid-argument', 'Agent ID is required.');
  }

  try {
    // 1. Firebase Authentication से उपयोगकर्ता को हटाएँ
    await admin.auth().deleteUser(data.id);

    // 2. डेटाबेस से एजेंट को हटाएँ
    await admin.firestore().collection('agents').doc(data.id).delete();

    return { message: 'Agent deleted successfully!' };

  } catch (error) {
    console.error('Error deleting agent:', error);
    throw new functions.https.HttpsError('internal', 'Could not delete agent.', error);
  }
});

// ... अन्य फ़ंक्शन (जैसे OTP, आदि) ...