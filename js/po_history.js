// js/po_history.js
// Manages the Purchase Order History page

// Assume Firebase functions are globally available via po_history.html's script block
const {
    db, collection, onSnapshot, query, orderBy, doc, deleteDoc, updateDoc, Timestamp // Add arrayUnion if using status history
} = window;

// --- DOM Elements ---
const poTableBody = document.getElementById('poTableBody');
const loadingRow = document.getElementById('loadingMessage');
const sortSelect = document.getElementById('sort-pos');
const filterDateInput = document.getElementById('filterDate');
const filterSearchInput = document.getElementById('filterSearch');
const filterStatusSelect = document.getElementById('filterStatus');
const clearFiltersBtn = document.getElementById('clearFiltersBtn');
// const totalPOsSpan = document.getElementById('total-pos'); // Uncomment if using summary counts
// const completedPOsSpan = document.getElementById('completed-pos'); // Uncomment if using summary counts
// const pendingPOsSpan = document.getElementById('pending-pos'); // Uncomment if using summary counts

// Modal Elements
const detailsModal = document.getElementById('poDetailsModal');
const closeModalBtn = document.getElementById('closePODetailsModal');
const modalPOIdInput = document.getElementById('modalPOId'); // Hidden input stores Firestore ID
const modalPONumberSpan = document.getElementById('modalPONumber');
const modalSupplierNameSpan = document.getElementById('modalSupplierName');
const modalPODateSpan = document.getElementById('modalPODate');
const modalCurrentStatusSpan = document.getElementById('modalCurrentStatus');
const modalPOStatusUpdateSelect = document.getElementById('modalPOStatusUpdate');
const modalUpdateStatusBtn = document.getElementById('modalUpdateStatusBtn');
const modalDeletePOBtn = document.getElementById('modalDeletePOBtn');
const modalEditPOBtn = document.getElementById('modalEditPOBtn');
const modalGeneratePDFBtn = document.getElementById('modalGeneratePDFBtn'); // PDF Button
const modalProductListContainer = document.getElementById('modalProductList');
// const modalStatusHistoryListContainer = document.getElementById('modalStatusHistoryList'); // Uncomment if using status history
const modalErrorPOSpan = document.getElementById('modalErrorPO');


// --- Global State ---
let currentSortField = 'createdAt';
let currentSortDirection = 'desc';
let unsubscribePOs = null;
let allPOsCache = []; // Stores ALL raw PO data fetched by listener
let searchDebounceTimer;

// --- Initialization ---
function initializePOHistoryPage() {
    console.log("[DEBUG] Initializing PO History Page...");

    listenForPOs(); // Start listener

    // Event Listeners
    if (sortSelect) sortSelect.addEventListener('change', handleSortChange);
    if (filterDateInput) filterDateInput.addEventListener('change', applyFiltersAndRender);
    if (filterSearchInput) filterSearchInput.addEventListener('input', handleSearchInput);
    if (filterStatusSelect) filterStatusSelect.addEventListener('change', applyFiltersAndRender);
    if (clearFiltersBtn) clearFiltersBtn.addEventListener('click', clearFilters);

    // Modal Listeners
    if (closeModalBtn) closeModalBtn.addEventListener('click', closePODetailsModal);
    if (detailsModal) detailsModal.addEventListener('click', (event) => { if (event.target === detailsModal) closePODetailsModal(); });
    if (modalUpdateStatusBtn) modalUpdateStatusBtn.addEventListener('click', handleUpdatePOStatus);
    if (modalDeletePOBtn) modalDeletePOBtn.addEventListener('click', handleDeleteFromModal);
    if (modalEditPOBtn) modalEditPOBtn.addEventListener('click', handleEditFromModal);
    if (modalGeneratePDFBtn) modalGeneratePDFBtn.addEventListener('click', handleGeneratePDFFromModal);


    // Event Delegation for table buttons
    if (poTableBody) {
        poTableBody.addEventListener('click', function(event) {
            const target = event.target;
            const row = target.closest('tr');
            if (!row || !row.dataset.id) return;
            const firestoreId = row.dataset.id;
            const poData = allPOsCache.find(po => po.id === firestoreId);
            if (!poData) { console.warn(`[DEBUG] PO data not found in cache for ID: ${firestoreId}`); return; }

            if (target.closest('.details-button')) {
                 openPODetailsModal(firestoreId, poData);
            }
            // Add other actions like quick print etc. if needed
        });
    } else {
        console.error("Element with ID 'poTableBody' not found!");
    }
    console.log("[DEBUG] PO History Page Initialized.");
}
// Make initialize function global
window.initializePOHistoryPage = initializePOHistoryPage;

// --- Firestore Listener ---
function listenForPOs() {
    if (unsubscribePOs) { unsubscribePOs(); unsubscribePOs = null; console.log("[DEBUG] Unsubscribed from previous PO listener."); }
    if (!db || !collection || !query || !orderBy || !onSnapshot) { console.error("Firestore listener functions missing."); return; }

    if (poTableBody) { poTableBody.innerHTML = `<tr><td colspan="6" id="loadingMessage">Loading purchase orders...</td></tr>`; } // Colspan=6

    try {
        // Initial query - might need adjustment based on sorting needs vs. client-side sort
        const q = query(collection(db, "purchaseOrders"), orderBy(currentSortField, currentSortDirection));
        console.log("[DEBUG] Setting up Firestore listener for purchaseOrders...");

        unsubscribePOs = onSnapshot(q, (snapshot) => {
            console.log(`[DEBUG] PO snapshot received. ${snapshot.size} total documents.`);
            allPOsCache = snapshot.docs.map(doc => {
                const data = doc.data();
                // Basic data validation/defaults
                return {
                    id: doc.id, // Firestore document ID
                    poNumber: data.poNumber || '',
                    supplierId: data.supplierId || '',
                    supplierName: data.supplierName || 'N/A', // Denormalized name
                    orderDate: data.orderDate || null, // Expecting Timestamp
                    status: data.status || 'Unknown',
                    products: data.products || [], // Array of product objects
                    //statusHistory: data.statusHistory || [], // If using history
                    createdAt: data.createdAt || null, // Timestamp
                    updatedAt: data.updatedAt || null // Timestamp
                };
            });
            console.log(`[DEBUG] allPOsCache populated with ${allPOsCache.length} POs.`);
            applyFiltersAndRender(); // Apply filters/sort to the new list
        }, (error) => {
            console.error("[DEBUG] Error fetching POs snapshot:", error);
            if (poTableBody) { poTableBody.innerHTML = `<tr><td colspan="6" style="color: red;">Error loading purchase orders. Please try again.</td></tr>`; }
        });
    } catch (error) {
        console.error("[DEBUG] Error setting up Firestore listener:", error);
        if (poTableBody) { poTableBody.innerHTML = `<tr><td colspan="6" style="color: red;">Error setting up listener.</td></tr>`; }
    }
}

// --- Sorting & Filtering Handlers ---
function handleSortChange() {
    if (!sortSelect) return;
    const [field, direction] = sortSelect.value.split('_');
    if (field && direction) {
        // if (field === currentSortField && direction === currentSortDirection) return; // Optimization
        currentSortField = field;
        currentSortDirection = direction;
        // Re-fetch data with new sorting from Firestore OR sort client-side
        // For simplicity, let's sort client-side for now
        applyFiltersAndRender();
        // If sorting large datasets, re-running listenForPOs with updated query is better:
        // listenForPOs();
    }
}

function handleSearchInput() {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(applyFiltersAndRender, 300); // Debounce search input
}

function clearFilters() {
    if (filterDateInput) filterDateInput.value = '';
    if (filterSearchInput) filterSearchInput.value = '';
    if (filterStatusSelect) filterStatusSelect.value = '';
    if (sortSelect) sortSelect.value = 'createdAt_desc'; // Reset sort
    currentSortField = 'createdAt';
    currentSortDirection = 'desc';
    applyFiltersAndRender();
}

// --- Filter, Sort, Render Function ---
function applyFiltersAndRender() {
    if (!allPOsCache) { console.warn("[DEBUG] applyFiltersAndRender called but PO cache is empty."); return; }

    const filterDateValue = filterDateInput ? filterDateInput.value : ''; // Expects YYYY-MM-DD string
    const filterSearchValue = filterSearchInput ? filterSearchInput.value.trim().toLowerCase() : '';
    const filterStatusValue = filterStatusSelect ? filterStatusSelect.value : '';

    // Filter
    let filteredPOs = allPOsCache.filter(po => {
        if (filterStatusValue && po.status !== filterStatusValue) return false;

        // Date filtering (compare YYYY-MM-DD strings)
        if (filterDateValue && po.orderDate) {
             try {
                 // Convert Firestore Timestamp to 'YYYY-MM-DD' for comparison
                 const poDateStr = po.orderDate.toDate().toISOString().split('T')[0];
                 if (poDateStr !== filterDateValue) return false;
             } catch (e) { console.error("Error converting PO date for filtering:", e); return false; } // Handle invalid dates
        } else if (filterDateValue && !po.orderDate) {
            return false; // Don't show if date filter is set and PO has no date
        }


        if (filterSearchValue) {
            const poNumMatch = po.poNumber.toLowerCase().includes(filterSearchValue);
            const supplierNameMatch = po.supplierName.toLowerCase().includes(filterSearchValue);
            // Can add search within products if needed (more complex)
            if (!(poNumMatch || supplierNameMatch)) return false;
        }
        return true;
    });

    // Sort (Client-side for simplicity, adjust for performance if needed)
    try {
        filteredPOs.sort((a, b) => {
            let valA = a[currentSortField];
            let valB = b[currentSortField];

            // Handle Timestamps (createdAt, updatedAt, orderDate)
             if (valA && typeof valA.toDate === 'function') valA = valA.toDate().getTime();
             if (valB && typeof valB.toDate === 'function') valB = valB.toDate().getTime();

            // Handle potentially null Timestamps/Dates for sorting
            if (valA === null && valB === null) return 0;
            if (valA === null) return currentSortDirection === 'asc' ? 1 : -1; // Nulls last
            if (valB === null) return currentSortDirection === 'asc' ? -1 : 1; // Nulls last

            // Handle strings for case-insensitive sort (e.g., supplierName)
            if (typeof valA === 'string' && typeof valB === 'string') {
                valA = valA.toLowerCase();
                valB = valB.toLowerCase();
            }


            let sortComparison = 0;
            if (valA > valB) { sortComparison = 1; }
            else if (valA < valB) { sortComparison = -1; }

            return currentSortDirection === 'desc' ? sortComparison * -1 : sortComparison;
        });
    } catch (sortError) {
        console.error("[DEBUG] Error during PO sorting:", sortError);
    }

    // Update Counts (Optional)
    // updatePOCounts(filteredPOs);

    // Render table
    renderPOTable(filteredPOs);
}

// --- Update PO Counts Function (Optional) ---
/*
function updatePOCounts(filteredPOs) {
    const total = filteredPOs.length;
    let completed = 0;
    filteredPOs.forEach(po => { if (po.status === 'Completed') completed++; });
    const pending = total - completed; // Define what pending means (e.g., not Completed/Cancelled)
    if (totalPOsSpan) totalPOsSpan.textContent = total;
    if (completedPOsSpan) completedPOsSpan.textContent = completed;
    if (pendingPOsSpan) pendingPOsSpan.textContent = pending; // Adjust logic as needed
}
*/

// --- Display Single PO Row ---
function renderPOTable(posToRender) {
    if (!poTableBody) { console.error("poTableBody not found during render!"); return; }
    poTableBody.innerHTML = ''; // Clear previous content

    if (posToRender.length === 0) {
        const message = filterSearchInput?.value || filterDateInput?.value || filterStatusSelect?.value ? "No purchase orders found matching your criteria." : "No purchase orders created yet.";
        poTableBody.innerHTML = `<tr><td colspan="6" id="noPOsMessage">${message}</td></tr>`; // Colspan=6
    } else {
        posToRender.forEach(po => {
            const tableRow = document.createElement('tr');
            tableRow.setAttribute('data-id', po.id); // Use Firestore ID

            // Safely format data
            const poNumber = po.poNumber || 'N/A';
            const supplierName = po.supplierName || 'N/A';
            let orderDateStr = '-';
             if (po.orderDate && typeof po.orderDate.toDate === 'function') {
                 try { orderDateStr = po.orderDate.toDate().toLocaleDateString('en-GB'); } catch (e) { console.error("Invalid date format for PO:", po.id); }
             }
            const status = po.status || 'Unknown';
            const statusClass = `status-${status.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`; // Generate CSS class

            // Simple product summary (e.g., count or first item) - Adapt as needed
            let productSummary = '-';
            if (po.products && po.products.length > 0) {
                 productSummary = `${po.products.length} item(s)`;
                 // Or show first product name:
                 // productSummary = `${po.products[0].productName || 'Item'} ${po.products.length > 1 ? `(+${po.products.length - 1})` : ''}`;
            }

            // Escape HTML
            const escape = (str) => String(str).replace(/[&<>"']/g, (match) => ({'&': '&amp;','<': '&lt;','>': '&gt;','"': '&quot;',"'": '&#39;'})[match]);


            tableRow.innerHTML = `
                <td>${escape(poNumber)}</td>
                <td>${escape(supplierName)}</td>
                <td>${orderDateStr}</td>
                <td><span class="status-badge ${statusClass}">${escape(status)}</span></td>
                 <td>${escape(productSummary)}</td>
                <td style="text-align: center;">
                    <button type="button" class="button details-button" title="View Details">
                        <i class="fas fa-info-circle"></i> Details
                    </button>
                </td>
            `;
            poTableBody.appendChild(tableRow);
        });
    }
}

// --- PO Details Modal ---
function openPODetailsModal(firestoreId, poData) {
    if (!detailsModal || !poData) { console.error("Modal element or PO data missing for ID:", firestoreId); return; }

    clearModalErrorPO(); // Clear previous errors
    modalPOIdInput.value = firestoreId; // Store Firestore ID
    modalPONumberSpan.textContent = poData.poNumber || 'N/A';
    modalSupplierNameSpan.textContent = poData.supplierName || 'N/A';

    let orderDateStr = 'N/A';
    if (poData.orderDate && typeof poData.orderDate.toDate === 'function') {
       try { orderDateStr = poData.orderDate.toDate().toLocaleDateString('en-GB'); } catch (e) { /* ignore */ }
    }
    modalPODateSpan.textContent = orderDateStr;

    modalCurrentStatusSpan.textContent = poData.status || 'Unknown';
    modalCurrentStatusSpan.className = `status-badge status-${(poData.status || 'unknown').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`; // Update class too
    modalPOStatusUpdateSelect.value = poData.status || '';


    // Populate Product List
    modalProductListContainer.innerHTML = ''; // Clear previous
    const products = poData.products;
    if (Array.isArray(products) && products.length > 0) {
        const ul = document.createElement('ul');
        products.forEach((product, index) => {
            const li = document.createElement('li');
            li.classList.add('product-line-item');

            let productInfo = `<strong>${index + 1}. ${product.productName || 'Unnamed Product'}</strong>`;

            if (product.unitType === 'qty') {
                productInfo += `<span class="product-details">Qty: ${product.quantity || '?'} | Price: ${product.unitPrice || '-'} | Total: ${product.lineTotal || '-'}</span>`;
            } else if (product.unitType === 'ft' || product.unitType === 'in') {
                 // Display Flex details
                productInfo += `<span class="product-details flex-details">
                                    <span>Real Size: ${product.realSize || '-'}</span> |
                                    <span>Real Area: ${product.realSqUnit || '-'} sq ${product.inputUnit || '?'}</span> <br>
                                    <span>Print Size: ${product.printSize || '-'}</span> |
                                    <span>Print Area: ${product.printSqUnit || '-'} sq ${product.inputUnit || '?'}</span> |
                                    <span>Price/sq ${product.inputUnit || '?'}: ${product.pricePerSqUnit || '-'}</span> |
                                    <span>Total: ${product.lineTotal || '-'}</span>
                               </span>`;
            } else {
                 productInfo += `<span class="product-details">Details unavailable (Unknown unit type: ${product.unitType})</span>`;
            }

             if(product.notes){
                 productInfo += `<span class="product-details" style="color: #2a9d8f;"><em>Note: ${product.notes}</em></span>`;
             }

            li.innerHTML = productInfo;
            ul.appendChild(li);
        });
        modalProductListContainer.appendChild(ul);
    } else {
        modalProductListContainer.innerHTML = '<p>No products listed for this PO.</p>';
    }

    // Populate Status History (if implemented)
    // populateStatusHistory(poData.statusHistory);

    detailsModal.style.display = 'flex'; // Show modal
}

function closePODetailsModal() {
    if (detailsModal) { detailsModal.style.display = 'none'; }
     clearModalErrorPO();
}

// --- Modal Action Handlers ---
async function handleUpdatePOStatus() {
    const firestoreId = modalPOIdInput.value;
    const newStatus = modalPOStatusUpdateSelect.value;
    if (!firestoreId || !newStatus || !db || !doc || !updateDoc ) {
        showModalErrorPO("Update function prerequisites failed.");
        return;
    }
    const poData = allPOsCache.find(po => po.id === firestoreId);
    if (!poData) { showModalErrorPO("Original PO data not found for update."); return; }
    if (poData.status === newStatus) { alert("Status is already set to '" + newStatus + "'."); return; }

    if (modalUpdateStatusBtn) { modalUpdateStatusBtn.disabled = true; modalUpdateStatusBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...'; clearModalErrorPO(); }

    // Prepare data for update
    const updateData = {
        status: newStatus,
        updatedAt: Timestamp.now() // Use server timestamp ideally if backend involved, else client's now()
    };

    // Optional: Add status history entry (requires arrayUnion import)
    // const historyEntry = { status: newStatus, timestamp: Timestamp.now() };
    // updateData.statusHistory = arrayUnion(historyEntry);

    try {
        const poRef = doc(db, "purchaseOrders", firestoreId);
        await updateDoc(poRef, updateData);
        console.log("[DEBUG] PO Status updated successfully for:", firestoreId);
        // Update status in the modal immediately for better UX
         modalCurrentStatusSpan.textContent = newStatus;
         modalCurrentStatusSpan.className = `status-badge status-${newStatus.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
         alert("PO Status updated successfully!");
         // Optionally close modal or keep it open
         // closePODetailsModal();
    } catch (error) {
        console.error("Error updating PO status:", error);
        showModalErrorPO("Error updating status: " + error.message);
        alert("Error updating status: " + error.message);
    } finally {
        if (modalUpdateStatusBtn) { modalUpdateStatusBtn.disabled = false; modalUpdateStatusBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Update Status'; }
    }
}

function handleDeleteFromModal() {
    const firestoreId = modalPOIdInput.value;
    const poNumber = modalPONumberSpan.textContent;
    if (!firestoreId) return;
    closePODetailsModal(); // Close modal before confirm dialog
    handleDeletePO(firestoreId, poNumber);
}

function handleEditFromModal() {
    const firestoreId = modalPOIdInput.value;
    if (!firestoreId) return;
    // Redirect to the new PO page with the ID for editing
    window.location.href = `new_po.html?editPOId=${firestoreId}`;
}

function handleGeneratePDFFromModal() {
    const firestoreId = modalPOIdInput.value;
    if (!firestoreId) { alert("Cannot generate PDF. PO ID missing."); return; }
    const poData = allPOsCache.find(po => po.id === firestoreId);
    if (!poData) { alert("Cannot generate PDF. PO data not found."); return; }

    // Check if jsPDF is loaded
     if (typeof jspdf === 'undefined' || typeof jspdf.jsPDF === 'undefined') {
         alert("PDF generation library (jsPDF) not loaded. Please check the console or try again later.");
         console.error("jsPDF is not loaded!");
         // Maybe try loading it dynamically here if needed
         return;
     }
     console.log("[DEBUG] jsPDF seems loaded. Proceeding with PDF generation...");

    // Call the PDF generation function (we will define this in Step 5)
    generatePOPDF(poData); // Assuming generatePOPDF exists
}


// --- Main Delete PO Function ---
async function handleDeletePO(firestoreId, poNumber) {
    if (!db || !doc || !deleteDoc) { alert("Delete function unavailable."); return; }
    if (!confirm(`Are you sure you want to delete Purchase Order: ${poNumber}? This cannot be undone.`)) {
        console.log("[DEBUG] PO Deletion cancelled by user.");
        return;
    }

    console.log("[DEBUG] Deleting PO:", firestoreId);
    try {
        await deleteDoc(doc(db, "purchaseOrders", firestoreId));
        console.log("[DEBUG] PO deleted successfully.");
        alert("Purchase Order deleted successfully.");
        // Data will refresh via the listener automatically
    } catch (error) {
        console.error("Error deleting PO:", error);
        alert("Error deleting PO: " + error.message);
    }
}


// --- PDF Generation Function (Placeholder for Step 5) ---
// This function will be fully implemented later
function generatePOPDF(poData) {
    console.log("[DEBUG] Attempting to generate PDF for PO:", poData.poNumber);
     alert(`PDF Generation for PO ${poData.poNumber} is not fully implemented yet. Please check Step 5.`);

     // --- >> Placeholder for jsPDF code << ---
     // Example structure:
     // const { jsPDF } = jspdf;
     // const doc = new jsPDF();
     //
     // doc.setFontSize(16);
     // doc.text("Purchase Order", 10, 10);
     // doc.setFontSize(10);
     // doc.text(`PO Number: ${poData.poNumber}`, 10, 20);
     // doc.text(`Supplier: ${poData.supplierName}`, 10, 25);
     // // ... Add more details: Date, Your Company Info etc.
     //
     // // Add products using autoTable plugin (ensure it's loaded too)
     // if (doc.autoTable) {
     //    const tableColumn = ["#", "Product Name", "Details", "Qty/Size", "Price", "Total"];
     //    const tableRows = [];
     //    poData.products.forEach((p, index) => {
     //         // Format product details for table row
     //         const rowData = [ index+1, /* Product Name */, /* Details */, /* Qty/Size */, /* Price */, /* Total */ ];
     //         tableRows.push(rowData);
     //     });
     //    doc.autoTable(tableColumn, tableRows, { startY: 35 });
     // } else {
     //     console.error("jsPDF autoTable plugin not loaded.");
     //     doc.text("Product table could not be generated (autoTable missing).", 10, 35);
     // }
     //
     // doc.save(`PO_${poData.poNumber}.pdf`);
     // console.log("[DEBUG] PDF generation placeholder executed.");
     // --- >> End Placeholder << ---
}


// --- Modal Error Helper ---
function showModalErrorPO(message) {
     if (modalErrorPOSpan) modalErrorPOSpan.textContent = message;
}
function clearModalErrorPO() {
    if (modalErrorPOSpan) modalErrorPOSpan.textContent = '';
}

// --- Final Check ---
console.log("po_history.js script loaded.");