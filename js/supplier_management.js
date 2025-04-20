// js/supplier_management.js - v6 (Using Imports from firebase-init.js)

// +++++ Import PDF function +++++
import { generatePoPdf } from './utils.js';
// ++++++++++++++++++++++++++++++++

// +++++ Import from firebase-init.js +++++
import {
    db, // auth को इम्पोर्ट करें यदि आवश्यक हो
    collection, onSnapshot, addDoc, doc, getDoc, getDocs, updateDoc, deleteDoc,
    query, orderBy, where, Timestamp, serverTimestamp // serverTimestamp इम्पोर्ट करें यदि उपयोग में हो
} from './firebase-init.js';
// +++++++++++++++++++++++++++++++++++++++

// --- DOM Elements ---
const addSupplierBtn = document.getElementById('addSupplierBtn');
const createPoBtn = document.getElementById('createPoBtn'); // सुनिश्चित करें कि यह id आपके HTML में है (यदि उपयोग किया जाता है)
const supplierTableBody = document.getElementById('supplierTableBody');
const poTableBody = document.getElementById('poTableBody');

// Supplier Modal Elements
const supplierModal = document.getElementById('supplierModal');
const supplierModalTitle = document.getElementById('supplierModalTitle');
const closeSupplierModalBtn = document.getElementById('closeSupplierModal'); // HTML में id="closeSupplierModal" सुनिश्चित करें
const cancelSupplierBtn = document.getElementById('cancelSupplierBtn');
const saveSupplierBtn = document.getElementById('saveSupplierBtn');
const supplierForm = document.getElementById('supplierForm');
const supplierIdInput = document.getElementById('supplierIdInput'); // HTML में id="supplierIdInput" सुनिश्चित करें
const supplierNameInput = document.getElementById('supplierNameInput');
const supplierCompanyInput = document.getElementById('supplierCompanyInput');
const supplierWhatsappInput = document.getElementById('supplierWhatsappInput');
const supplierEmailInput = document.getElementById('supplierEmailInput');
const supplierAddressInput = document.getElementById('supplierAddressInput');
const supplierGstInput = document.getElementById('supplierGstInput');
const supplierErrorMsg = document.getElementById('supplierErrorMsg');

// PO Filter Elements (यदि उपयोग किए जाते हैं)
const poSearchInput = document.getElementById('poSearchInput');
const poStatusFilter = document.getElementById('poStatusFilter');
const poFilterBtn = document.getElementById('poFilterBtn');

let currentEditingSupplierId = null;

// --- Helper checkFirestoreReady और waitForDbConnection हटा दिए गए ---

// --- Modal Handling ---
function openSupplierModal(mode = 'add', supplierData = null, supplierId = null) {
    // सुनिश्चित करें कि सभी modal तत्व मौजूद हैं
    if (!supplierModal || !supplierForm || !supplierModalTitle || !supplierErrorMsg || !supplierIdInput || !supplierNameInput || !supplierCompanyInput || !supplierWhatsappInput || !supplierEmailInput || !supplierAddressInput || !supplierGstInput) {
        console.error("Supplier modal elements not found!");
        alert("Error: Could not open supplier form. Required elements missing in HTML or JS references are incorrect.");
        return;
    }
    supplierForm.reset();
    supplierErrorMsg.textContent = '';
    supplierErrorMsg.style.display = 'none';
    currentEditingSupplierId = null; // रीसेट करें

    if (mode === 'edit' && supplierData && supplierId) {
        supplierModalTitle.textContent = 'Edit Supplier';
        supplierIdInput.value = supplierId; // सेट करें
        currentEditingSupplierId = supplierId; // ट्रैक करें
        supplierNameInput.value = supplierData.name || '';
        supplierCompanyInput.value = supplierData.companyName || '';
        supplierWhatsappInput.value = supplierData.whatsappNo || '';
        supplierEmailInput.value = supplierData.email || '';
        supplierAddressInput.value = supplierData.address || '';
        supplierGstInput.value = supplierData.gstNo || '';
    } else {
        supplierModalTitle.textContent = 'Add New Supplier';
        supplierIdInput.value = ''; // सुनिश्चित करें कि यह खाली है
    }
    supplierModal.classList.add('active'); // CSS class का उपयोग करें दिखाने के लिए
}

function closeSupplierModal() {
    if (supplierModal) {
        supplierModal.classList.remove('active');
        // Optionally reset form again on close
        // if(supplierForm) supplierForm.reset();
        // currentEditingSupplierId = null;
    }
}

// --- Firestore Operations ---

// Function to display suppliers
async function displaySupplierList() {
    if (!supplierTableBody) { console.error("Supplier table body (supplierTableBody) not found!"); return; }
    // सीधे db और collection का उपयोग करें
    if (!db || !collection || !getDocs || !query || !orderBy) {
        console.error("Firestore functions (db, collection, getDocs, query, orderBy) not available in displaySupplierList.");
        supplierTableBody.innerHTML = '<tr><td colspan="5" style="color:red;">Error: Required functions missing. Cannot load suppliers.</td></tr>';
        return;
    }

    supplierTableBody.innerHTML = '<tr><td colspan="5"><i class="fas fa-spinner fa-spin"></i> Loading suppliers...</td></tr>';
    try {
        const q = query(collection(db, "suppliers"), orderBy("name"));
        const querySnapshot = await getDocs(q);
        supplierTableBody.innerHTML = ''; // Clear loading/previous data
        if (querySnapshot.empty) {
            supplierTableBody.innerHTML = '<tr><td colspan="5">No suppliers found. Add one using the button above!</td></tr>';
            return;
        }

        querySnapshot.forEach((docSnapshot) => { // Use docSnapshot to avoid conflict
            const supplier = docSnapshot.data();
            const supplierId = docSnapshot.id;
            const tr = document.createElement('tr');
            tr.setAttribute('data-id', supplierId);
            // HTML स्ट्रक्चर को आपके supplier_management.html के टेबल हेडर से मिलाएं
            tr.innerHTML = `
                <td>${supplier.name || 'N/A'}</td>
                <td>${supplier.companyName || '-'}</td>
                <td>${supplier.whatsappNo || '-'}</td>
                <td>${supplier.email || '-'}</td>
                <td class="action-buttons">
                    <button class="button edit-button" data-id="${supplierId}" title="Edit Supplier"><i class="fas fa-edit"></i></button>
                    <button class="button delete-button" data-name="${supplier.name || ''}" data-id="${supplierId}" title="Delete Supplier"><i class="fas fa-trash-alt"></i></button>
                </td>
            `;
            // Event listeners जोड़ें
            const editBtn = tr.querySelector('.edit-button');
            if (editBtn) {
                editBtn.addEventListener('click', () => openSupplierModal('edit', supplier, supplierId));
            }
            const deleteBtn = tr.querySelector('.delete-button');
            if (deleteBtn) {
                // Get name from data attribute for confirmation message
                deleteBtn.addEventListener('click', () => deleteSupplier(supplierId, deleteBtn.dataset.name));
            }
            supplierTableBody.appendChild(tr);
        });
        console.log("Suppliers list displayed successfully.");
    } catch (error) {
        console.error("Error fetching suppliers: ", error);
        supplierTableBody.innerHTML = `<tr><td colspan="5" style="color:red;">Error loading suppliers: ${error.message}</td></tr>`;
    }
}

// Function to save/update supplier
async function saveSupplier(event) {
    event.preventDefault();
    // Check required functions from import
    if (!db || !collection || !addDoc || !doc || !updateDoc || !Timestamp) {
        showSupplierError("Error: Required functions missing for saving supplier.");
        return;
    }
    // Check DOM elements
    if (!saveSupplierBtn || !supplierNameInput || !supplierErrorMsg || !supplierIdInput || !supplierCompanyInput || !supplierWhatsappInput || !supplierEmailInput || !supplierAddressInput || !supplierGstInput) {
         console.error("Save Supplier prerequisites missing (DOM Elements).");
         alert("Error: Cannot save supplier. Form elements missing.");
         return;
    }

    const supplierData = {
        name: supplierNameInput.value.trim(),
        companyName: supplierCompanyInput.value.trim(),
        whatsappNo: supplierWhatsappInput.value.trim(),
        email: supplierEmailInput.value.trim(),
        address: supplierAddressInput.value.trim(),
        gstNo: supplierGstInput.value.trim(),
    };

    if (!supplierData.name) {
        showSupplierError("Supplier Name is required.");
        supplierNameInput.focus();
        return;
    }

    saveSupplierBtn.disabled = true;
    saveSupplierBtn.textContent = 'Saving...';
    supplierErrorMsg.style.display = 'none';
    supplierErrorMsg.textContent = '';

    try {
        const supplierIdToUse = supplierIdInput.value; // Get ID from hidden input
        if (supplierIdToUse) { // If ID exists, update
            // Add updatedAt timestamp
            supplierData.updatedAt = Timestamp.now();
            const supplierRef = doc(db, "suppliers", supplierIdToUse);
            await updateDoc(supplierRef, supplierData);
            console.log("Supplier updated with ID: ", supplierIdToUse);
        } else { // Otherwise, add new
            // Add createdAt and updatedAt timestamps
            supplierData.createdAt = Timestamp.now();
            supplierData.updatedAt = Timestamp.now();
            const docRef = await addDoc(collection(db, "suppliers"), supplierData);
            console.log("Supplier added with ID: ", docRef.id);
        }
        closeSupplierModal();
        await displaySupplierList(); // Refresh list after saving
    } catch (error) {
        console.error("Error saving supplier: ", error);
        showSupplierError("Error saving supplier: " + error.message);
    } finally {
        // Ensure button is re-enabled
        if(saveSupplierBtn) {
             saveSupplierBtn.disabled = false;
             saveSupplierBtn.textContent = 'Save Supplier';
        }
    }
}

// Function to delete supplier
async function deleteSupplier(supplierId, supplierName) {
    if (!db || !doc || !deleteDoc) {
        alert("Error: Required functions missing for deleting supplier.");
        return;
    }
    // Use the name passed for confirmation
    if (confirm(`Are you sure you want to delete supplier "${supplierName || supplierId}"? This cannot be undone.`)) {
        console.log(`Attempting to delete supplier: ${supplierId}`);
        try {
            await deleteDoc(doc(db, "suppliers", supplierId));
            console.log("Supplier deleted: ", supplierId);
            alert(`Supplier "${supplierName || supplierId}" deleted successfully.`);
            await displaySupplierList(); // Refresh list
        } catch (error) {
            console.error("Error deleting supplier: ", error);
            alert("Error deleting supplier: " + error.message);
        }
    } else {
        console.log("Supplier delete cancelled by user.");
    }
}

// Function to delete PO
async function handleDeletePO(poId, poNumber) {
     if (!db || !doc || !deleteDoc) {
        alert("Error: Required functions missing for deleting PO.");
        return;
    }
    if (confirm(`Are you sure you want to delete Purchase Order "${poNumber || poId}"? This cannot be undone.`)) {
        console.log(`Attempting to delete PO: ${poId}`);
        try {
            const poRef = doc(db, "purchaseOrders", poId);
            await deleteDoc(poRef);
            console.log("Purchase Order deleted successfully:", poId);
            alert(`Purchase Order ${poNumber || poId} deleted successfully.`);
            await displayPoList(); // Refresh PO list
        } catch (error) {
            console.error("Error deleting Purchase Order:", error);
            alert("Error deleting Purchase Order: " + error.message);
        }
    } else {
        console.log("PO deletion cancelled by user.");
    }
}

// Function to display POs
async function displayPoList() {
    if (!poTableBody) { console.error("PO table body (poTableBody) not found!"); return; }
    if (!db || !collection || !getDocs || !query || !orderBy || !doc || !getDoc || !deleteDoc) {
        console.error("Firestore functions not available in displayPoList.");
        poTableBody.innerHTML = '<tr><td colspan="6" style="color:red;">Error: Required functions missing. Cannot load POs.</td></tr>';
        return;
    }

    poTableBody.innerHTML = '<tr><td colspan="6"><i class="fas fa-spinner fa-spin"></i> Loading purchase orders...</td></tr>';
    try {
        const q = query(collection(db, "purchaseOrders"), orderBy("orderDate", "desc"));
        const querySnapshot = await getDocs(q);
        poTableBody.innerHTML = ''; // Clear loading/previous data
        if (querySnapshot.empty) {
            poTableBody.innerHTML = '<tr><td colspan="6">No purchase orders found. Create one using the button above!</td></tr>';
            return;
        }

        // Use Promise.all to fetch supplier names concurrently (optional optimization)
        const poPromises = querySnapshot.docs.map(async (docRef_po) => {
            const po = docRef_po.data();
            const poId = docRef_po.id;

            // Fetch supplier name (handle missing supplier gracefully)
            let supplierName = 'Unknown Supplier';
            if (po.supplierId) {
                try {
                    const supplierRef = doc(db, "suppliers", po.supplierId);
                    const supplierSnap = await getDoc(supplierRef);
                    if (supplierSnap.exists()) {
                        supplierName = supplierSnap.data().name || 'N/A';
                    } else {
                         console.warn(`Supplier document not found for ID: ${po.supplierId} in PO ${poId}`);
                    }
                } catch (err) {
                    console.error(`Error fetching supplier ${po.supplierId} for PO ${poId}:`, err);
                    supplierName = 'Error fetching name';
                }
            } else {
                supplierName = po.supplierName || 'N/A (Legacy)'; // Fallback if supplierName was stored directly
                 if(!po.supplierName) console.warn(`Missing supplierId and supplierName in PO ${poId}`);
            }


            let orderDateStr = '-';
            if (po.orderDate && po.orderDate.toDate) {
                try { orderDateStr = po.orderDate.toDate().toLocaleDateString('en-GB'); } // Use dd/mm/yyyy format
                catch(e) { console.warn("Error formatting PO date", e); }
            }

            let statusClass = po.status ? po.status.toLowerCase().replace(/[^a-z0-9]+/g, '-') : 'unknown';
            let amountStr = po.totalAmount !== undefined ? `₹ ${po.totalAmount.toFixed(2)}` : '-';

            return { // Return data needed for the row
                id: poId,
                poNumber: po.poNumber || 'N/A',
                supplierName: supplierName,
                orderDate: orderDateStr,
                status: po.status || 'Unknown',
                statusClass: statusClass,
                amount: amountStr,
                poData: po // Pass full PO data for PDF generation later
            };
        });

        const posData = await Promise.all(poPromises);

        // Now render rows using the fetched data
        posData.forEach(poInfo => {
             const tr = document.createElement('tr');
             tr.setAttribute('data-id', poInfo.id);
             tr.innerHTML = `
                 <td>${poInfo.poNumber}</td>
                 <td>${poInfo.supplierName}</td>
                 <td>${poInfo.orderDate}</td>
                 <td><span class="status-badge status-${poInfo.statusClass}">${poInfo.status}</span></td>
                 <td style="text-align: right;">${poInfo.amount}</td>
                 <td class="action-buttons">
                     <a href="new_po.html?editPOId=${poInfo.id}" class="button edit-button" title="Edit PO"><i class="fas fa-edit"></i></a>
                     <button class="button delete-button" data-id="${poInfo.id}" data-ponumber="${poInfo.poNumber}" title="Delete PO"><i class="fas fa-trash-alt"></i></button>
                     <button class="button pdf-button" data-id="${poInfo.id}" title="Download PDF"><i class="fas fa-file-pdf"></i></button>
                 </td>
             `;

             // PO Delete Button Listener
             const deletePoBtn = tr.querySelector('.delete-button[title="Delete PO"]');
             if (deletePoBtn) {
                 deletePoBtn.addEventListener('click', () => handleDeletePO(poInfo.id, poInfo.poNumber));
             }

             // PDF Button Listener
             const pdfBtn = tr.querySelector('.pdf-button');
             if (pdfBtn) {
                 pdfBtn.addEventListener('click', async () => {
                    if (typeof generatePoPdf !== 'function') {
                         console.error("generatePoPdf function is not imported or defined in supplier_management.js scope.");
                         alert("Cannot generate PDF. Function not found."); return;
                     }
                     // Functions for getting data are checked at the start of displayPoList

                     const currentPoId = pdfBtn.dataset.id;
                     if (!currentPoId) { alert("Error: Could not get PO ID for PDF."); return; }

                     pdfBtn.disabled = true; pdfBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

                     try {
                         // We already have poData from the loop (poInfo.poData)
                         // We need supplier data again
                         const poDataForPdf = poInfo.poData; // Use data from loop
                         if (!poDataForPdf.supplierId) throw new Error("Supplier ID missing in PO data for PDF.");

                         const supplierRef = doc(db, "suppliers", poDataForPdf.supplierId);
                         const supplierSnap = await getDoc(supplierRef);
                         if (!supplierSnap.exists()) throw new Error(`Supplier data not found for ID: ${poDataForPdf.supplierId}`);
                         const supplierDataForPdf = supplierSnap.data();

                         console.log("Data ready for PDF generation:", poDataForPdf, supplierDataForPdf);
                         await generatePoPdf(poDataForPdf, supplierDataForPdf); // Call imported function

                     } catch (error) {
                         console.error("Error preparing data or generating PDF:", error);
                         alert("Failed to generate PDF: " + error.message);
                     } finally {
                        // Re-find button in DOM to ensure it still exists before re-enabling
                         const latestPdfBtn = poTableBody.querySelector(`tr[data-id="${currentPoId}"] .pdf-button`);
                         if(latestPdfBtn) {
                            latestPdfBtn.disabled = false;
                            latestPdfBtn.innerHTML = '<i class="fas fa-file-pdf"></i>';
                         } else {
                             console.warn(`PDF button for PO ${currentPoId} not found after async operation. Row might have been removed.`);
                         }
                     }
                 });
             } // End PDF Button Listener

             poTableBody.appendChild(tr);
        }); // End forEach posData

        console.log("Purchase Orders list displayed successfully.");

    } catch (error) {
        console.error("Error processing or displaying POs: ", error);
        poTableBody.innerHTML = `<tr><td colspan="6" style="color:red;">Error loading POs: ${error.message}</td></tr>`;
    }
}

// Helper to show errors in supplier modal
function showSupplierError(message) {
    if(supplierErrorMsg) {
        supplierErrorMsg.textContent = message;
        supplierErrorMsg.style.display = 'block';
    } else {
        console.error("Supplier error message element not found, cannot display:", message);
        alert(message); // Fallback
    }
}

// --- Initialization on DOM Load ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("Supplier Management: DOM loaded. Initializing.");

    // मॉड्यूल इम्पोर्ट होने के कारण अब db उपलब्ध होना चाहिए
    if (!db) {
        console.error("Supplier Management Init: DB not available even after import! Check firebase-init.js for errors.");
        // Display persistent error
        if(supplierTableBody) supplierTableBody.innerHTML = '<tr><td colspan="5" style="color:red;"><strong>Initialization Error:</strong> Database connection failed. Please check console and refresh.</td></tr>';
        if(poTableBody) poTableBody.innerHTML = '<tr><td colspan="6" style="color:red;"><strong>Initialization Error:</strong> Database connection failed. Please check console and refresh.</td></tr>';
        // Stop further initialization
        return;
    }
    console.log("Supplier Management: DB connection confirmed via import.");

    // Setup Event Listeners (Ensure elements exist)
    if (addSupplierBtn) {
        addSupplierBtn.addEventListener('click', () => openSupplierModal('add'));
    } else { console.warn("Add Supplier button not found."); }

    if (closeSupplierModalBtn) {
        closeSupplierModalBtn.addEventListener('click', closeSupplierModal);
    } else { console.warn("Close Supplier Modal button not found."); }

    if (cancelSupplierBtn) {
        cancelSupplierBtn.addEventListener('click', closeSupplierModal);
    } else { console.warn("Cancel Supplier button not found."); }

    if (supplierForm) {
        supplierForm.addEventListener('submit', saveSupplier);
    } else { console.warn("Supplier form not found."); }

    // Close modal if clicked outside content
    if (supplierModal) {
        supplierModal.addEventListener('click', (event) => {
            if (event.target === supplierModal) { // Check if click is on the backdrop
                closeSupplierModal();
            }
        });
    } else { console.warn("Supplier modal not found."); }

    // Initial data load
    // Use async/await to ensure they load sequentially or handle errors independently
    (async () => {
        try {
            await displaySupplierList();
        } catch (e) { console.error("Error during initial supplier list load:", e); }
        try {
            await displayPoList();
        } catch (e) { console.error("Error during initial PO list load:", e); }
    })();


    // Check for #add hash to open modal on load (e.g., after redirect)
    if(window.location.hash === '#add') {
        // Need a slight delay sometimes for modal CSS to be ready
        setTimeout(() => {
            if(supplierModal) {
                 openSupplierModal('add');
            } else {
                console.warn("Modal not found, cannot open from #add hash.");
            }
            // Clean the hash
            if (history.replaceState) {
                history.replaceState(null, null, window.location.pathname + window.location.search);
            }
        }, 100); // 100ms delay, adjust if needed
    }

    console.log("Supplier Management Initialized via DOMContentLoaded.");
});

// Log to confirm script loaded at the end
console.log("supplier_management.js module processed.");