// js/firestoreUtils.js
// Firestore फंक्शन्स को इम्पोर्ट करें जिन्हें आप window ऑब्जेक्ट पर सेट करते हैं या सीधे इम्पोर्ट करें
const { db, doc, runTransaction } = window; // या सीधे इम्पोर्ट करें

/**
 * Firestore काउंटर से अगला ID प्राप्त करता है और काउंटर को अपडेट करता है।
 * @param {string} counterName 'customerCounter' या 'orderCounter'
 * @param {number} startId यदि काउंटर मौजूद नहीं है तो शुरुआती ID
 * @returns {Promise<number>} अगला नंबर
 */
export async function getNextNumericId(counterName, startId = 101) {
    if (!db || !doc || !runTransaction) throw new Error("Firestore functions not available for counter.");
    const counterRef = doc(db, "counters", counterName);
    try {
        const nextIdNum = await runTransaction(db, async (transaction) => {
            const counterDoc = await transaction.get(counterRef);
            let nextId = startId;
            if (counterDoc.exists() && counterDoc.data().lastId) {
                nextId = counterDoc.data().lastId + 1;
            } else {
                console.log(`Counter '${counterName}' not found, starting at ${startId}.`);
            }
            transaction.set(counterRef, { lastId: nextId }, { merge: true });
            return nextId;
        });
        return nextIdNum;
    } catch (error) {
        console.error(`Error getting next ID for ${counterName}:`, error);
        throw new Error(`Failed to generate numeric ID for ${counterName}.`);
    }
}

console.log("firestoreUtils.js loaded");