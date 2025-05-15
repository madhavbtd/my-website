// functions/index.js (C:\Users\MADHAV OFFSET\Desktop\Madhav_Multy_Print\agentfunctions\index.js)

const functions = require("firebase-functions");
const admin = require("firebase-admin");

// Firebase Admin SDK को प्रारंभ करें
admin.initializeApp();

/**
 * HTTPs Callable Function: एक नया एजेंट Auth यूजर और Firestore रिकॉर्ड बनाता है।
 */
// .region("asia-south1") को यहाँ से हटा दिया गया है
exports.createAgentUser = functions.https.onCall(async (data, context) => {
    // स्टेप 1: सुनिश्चित करें कि कॉल करने वाला यूजर प्रमाणित है
    if (!context.auth) {
        console.error("Unauthenticated call to createAgentUser.");
        throw new functions.https.HttpsError(
            "unauthenticated",
            "The function must be called by an authenticated user."
        );
    }

    // स्टेप 2: (महत्वपूर्ण!) सुनिश्चित करें कि कॉल करने वाला यूजर एक एडमिन है
    const adminUid = context.auth.uid;
    // ---- वास्तविक एडमिन जांच यहाँ जोड़ें ----
    // उदाहरण के लिए, यदि आपके एडमिन का UID 'your_actual_admin_uid_here' है:
    // if (adminUid !== 'your_actual_admin_uid_here') {
    //     console.error(`Permission denied for createAgentUser: User ${adminUid} is not an authorized admin.`);
    //     throw new functions.https.HttpsError(
    //         "permission-denied",
    //         "User is not authorized to perform this action."
    //     );
    // }
    // बेहतर तरीका: Firestore में 'admins' कलेक्शन से जांचें
    // try {
    //     const adminDoc = await admin.firestore().collection('admins').doc(adminUid).get();
    //     if (!adminDoc.exists) {
    //         console.error(`Permission denied for createAgentUser: User ${adminUid} not found in admins collection.`);
    //         throw new functions.https.HttpsError(
    //             "permission-denied",
    //             "User is not authorized to perform this action."
    //         );
    //     }
    // } catch (dbError) {
    //     console.error("Error checking admin status:", dbError);
    //     throw new functions.https.HttpsError("internal", "Could not verify admin status.");
    // }
    // ---- एडमिन जांच समाप्त ----
    console.log(`Admin user ${adminUid} invoked createAgentUser function.`);


    // स्टेप 3: क्लाइंट से भेजे गए डेटा को निकालें
    const email = data.email;
    const password = data.password;
    const agentName = data.name;
    const contact = data.contact || null;
    const status = data.status || "active";
    const userType = data.userType || "agent";
    const permissions = data.permissions || [];
    const allowedCategories = data.allowedCategories || [];
    const canAddCustomers = data.canAddCustomers !== undefined ? data.canAddCustomers : false;

    // स्टेप 4: आवश्यक फ़ील्ड्स की जांच करें
    if (!email || !password || !agentName) {
        console.error("Validation failed for createAgentUser: Missing required fields.", { email, agentName, password_provided: !!password });
        throw new functions.https.HttpsError(
            "invalid-argument",
            "Missing required fields (email, password, name) in the payload."
        );
    }
    if (password.length < 6) {
        console.error("Validation failed for createAgentUser: Password too short.");
         throw new functions.https.HttpsError(
            "invalid-argument",
            "Password must be at least 6 characters long."
        );
    }

    try {
        // स्टेप 5: Firebase Authentication में नया उपयोगकर्ता बनाएं
        console.log(`Attempting to create auth user for: ${email} by admin ${adminUid}`);
        const userRecord = await admin.auth().createUser({
            email: email,
            password: password,
            displayName: agentName,
            emailVerified: false, // आप इसे true कर सकते हैं यदि आप चाहते हैं
        });

        const newAgentAuthUid = userRecord.uid;
        console.log(`Successfully created new auth user: ${newAgentAuthUid} for email: ${email}`);

        // स्टेप 6: Firestore में एजेंट का डेटा सहेजें
        const agentDataForFirestore = {
            authUid: newAgentAuthUid,
            name: agentName,
            name_lowercase: agentName.toLowerCase(),
            email: email,
            contact: contact,
            status: status,
            userType: userType,
            permissions: permissions,
            allowedCategories: allowedCategories,
            canAddCustomers: canAddCustomers,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            createdBy: adminUid, // किसने एजेंट बनाया
        };

        await admin.firestore().collection("agents").doc(newAgentAuthUid).set(agentDataForFirestore);
        console.log(`Successfully wrote agent data to Firestore for UID: ${newAgentAuthUid}`);

        return { success: true, message: "Agent created successfully!", uid: newAgentAuthUid };

    } catch (error) {
        console.error("Error during agent creation process for " + email + ":", JSON.stringify(error));
        if (error.code === "auth/email-already-exists") {
            throw new functions.https.HttpsError("already-exists", `The email address ${email} is already in use by another account.`);
        }
        if (error.code === "auth/invalid-password" || (error.message && error.message.toLowerCase().includes("password"))) {
             throw new functions.https.HttpsError("invalid-argument", `The password is invalid: ${error.message}. It must be a string with at least six characters.`);
        }
        // सामान्य त्रुटि
        throw new functions.https.HttpsError("internal", `An error occurred: ${error.message}`);
    }
});