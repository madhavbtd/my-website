// admin/js/view-online-orders.js

// Imports: Firebase init, Firestore functions, Auth functions
// !! PATH CHECK KAREIN !! (Assuming admin folder is at root, js folder is at root)
import { db, auth } from '../../js/firebase-init.js'; // Adjust path based on your structure (e.g., '../js/firebase-init.js')
import {
    collection, getDocs, doc, getDoc, updateDoc, query, orderBy, serverTimestamp, Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js"; // Use correct SDK version if different
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// --- DOM Elements ---
const ordersTbody = document.getElementById('orders-tbody');
const modal = document.getElementById('order-detail-modal');
const modalContent = document.getElementById('order-detail-content');
const closeModalBtn = modal?.querySelector('.close-modal-btn'); // Use optional chaining
const statusSelect = document.getElementById('order-status-update');
const updateStatusBtn = document.getElementById('update-status-btn');
const statusUpdateMessage = document.getElementById('status-update-message');

let currentOrderId = null; // To store ID for status update

// --- Helper Functions ---
function formatTimestamp(timestamp) {
    // Check if timestamp is a valid Firestore Timestamp object
    if (timestamp && typeof timestamp.toDate === 'function') {
        try {
            // Format date for India locale
            return timestamp.toDate().toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric'
             });
        } catch (e) {
            console.error("Error formatting timestamp:", e);
            return 'Invalid Date';
        }
    }
    return 'N/A';
}


function formatCurrency(amount) {
     if (typeof amount === 'number') {
         return amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
     }
     return 'N/A';
}

// --- Load Orders ---
const loadOrders = async () => {
    if (!ordersTbody) return;
    try {
        ordersTbody.innerHTML = '<tr><td colspan="7">Loading...</td></tr>';
        // Fetch from "onlineOrders", order by creation time descending
        const q = query(collection(db, "onlineOrders"), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        ordersTbody.innerHTML = ''; // Clear loading row

        if (querySnapshot.empty) {
            ordersTbody.innerHTML = '<tr><td colspan="7">No online orders found.</td></tr>';
            return;
        }

        querySnapshot.forEach((docSnap) => {
            const order = docSnap.data();
            const orderId = docSnap.id;
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${orderId.substring(0, 8)}...</td> <td>${formatTimestamp(order.createdAt)}</td>
                <td>${order.customerDetails?.fullName || 'N/A'}</td>
                <td>${formatCurrency(order.totalAmount)}</td>
                <td><span class="status-badge status-${(order.status || 'new').toLowerCase().replace(/\s+/g, '-')}">${order.status || 'New'}</span></td>
                <td>${order.paymentDetails?.status || 'Pending'}</td>
                <td>
                    <button class="btn btn-sm btn-view" data-id="${orderId}"><i class="fas fa-eye"></i> View</button>
                </td>
            `;
            // View Button Action
             const viewBtn = tr.querySelector('.btn-view');
             if (viewBtn) {
                viewBtn.addEventListener('click', () => {
                     viewOrderDetails(orderId);
                 });
             }
            ordersTbody.appendChild(tr);
        });
    } catch (error) {
        console.error("Error loading orders: ", error);
        ordersTbody.innerHTML = '<tr><td colspan="7" class="error">Error loading orders.</td></tr>';
    }
};

// --- View Order Details ---
const viewOrderDetails = async (orderId) => {
     if (!modal || !modalContent || !statusSelect || !statusUpdateMessage) return; // Ensure modal elements exist

     currentOrderId = orderId; // Store for status update
     modalContent.innerHTML = '<p>Loading details...</p>';
     modal.style.display = 'block'; // Show modal

     try {
         const orderRef = doc(db, "onlineOrders", orderId); // Use "onlineOrders"
         const docSnap = await getDoc(orderRef);

         if (docSnap.exists()) {
             const order = docSnap.data();
             let detailsHtml = `
                 <h4>Order ID: ${orderId}</h4>
                 <p><strong>Date:</strong> ${formatTimestamp(order.createdAt)}</p>
                 <p><strong>Status:</strong> <span id="modal-order-status">${order.status || 'New'}</span></p>
                 <p><strong>Total Amount:</strong> ₹${formatCurrency(order.totalAmount)}</p>
                 <hr>
                 <h4>Customer Details</h4>
                 <p><strong>Name:</strong> ${order.customerDetails?.fullName || 'N/A'}</p>
                 <p><strong>Email:</strong> ${order.customerDetails?.email || 'N/A'}</p>
                 <p><strong>Phone:</strong> ${order.customerDetails?.phone || 'N/A'}</p>
                 <p><strong>Address:</strong> ${order.customerDetails?.address || 'N/A'}</p>
                 <hr>
                 <h4>Items</h4>
             `;

             if (order.items && order.items.length > 0) {
                 detailsHtml += '<ul>';
                 order.items.forEach(item => {
                     detailsHtml += `<li>
                         <strong>${item.productName}</strong> - Qty: ${item.quantity || 1} - ₹${formatCurrency(item.itemAmount)}<br>
                         <small>(${item.unitType || 'N/A'}${item.unitType === 'Sq Feet' ? ` | ${item.width || ''}x${item.height || ''} ${item.dimensionUnit || 'ft'}` : ''})</small>
                         ${item.designDetails ? `<br><small><i>Details: ${item.designDetails}</i></small>` : ''}
                     </li>`;
                 });
                 detailsHtml += '</ul>';
             } else {
                 detailsHtml += '<p>No items found in this order.</p>';
             }

             // Add Payment details if available
             if(order.paymentDetails) {
                 detailsHtml += `<hr><h4>Payment Details</h4>`;
                 detailsHtml += `<p><strong>Status:</strong> ${order.paymentDetails.status || 'N/A'}</p>`;
                 if(order.paymentDetails.method) detailsHtml += `<p><strong>Method:</strong> ${order.paymentDetails.method}</p>`;
                 if(order.paymentDetails.transactionId) detailsHtml += `<p><strong>Transaction ID:</strong> ${order.paymentDetails.transactionId}</p>`;
             }

             modalContent.innerHTML = detailsHtml;
             // Set the dropdown to the current order status
             statusSelect.value = order.status || 'New';
             statusSelect.disabled = false;
             if (updateStatusBtn) updateStatusBtn.disabled = false;
             statusUpdateMessage.textContent = ''; // Clear previous status message

         } else {
             modalContent.innerHTML = '<p class="error">Order details not found.</p>';
             statusSelect.disabled = true; // Disable status update if order not found
             if(updateStatusBtn) updateStatusBtn.disabled = true;
         }
     } catch (error) {
         console.error("Error fetching order details:", error);
         modalContent.innerHTML = '<p class="error">Error loading order details.</p>';
         statusSelect.disabled = true;
         if(updateStatusBtn) updateStatusBtn.disabled = true;
     }
};

// --- Function to Initialize Page after Auth ---
function initializeOrderPage() {
    console.log("User authenticated, initializing Order View page...");

    // Add Event Listeners if elements exist
    if (updateStatusBtn && statusSelect) {
        updateStatusBtn.addEventListener('click', async () => {
             if (!currentOrderId) return;

             const newStatus = statusSelect.value;
             if(statusUpdateMessage) statusUpdateMessage.textContent = 'Updating...';
             updateStatusBtn.disabled = true;

             try {
                 const orderRef = doc(db, "onlineOrders", currentOrderId); // Use "onlineOrders"
                 await updateDoc(orderRef, {
                     status: newStatus,
                     updatedAt: serverTimestamp() // Update timestamp
                 });

                 if(statusUpdateMessage) {
                    statusUpdateMessage.textContent = 'Status updated successfully!';
                    statusUpdateMessage.className = 'message success small';
                 }
                 loadOrders(); // Refresh the list in the background

                 // Update the status in the modal view immediately
                 const modalStatusSpan = document.getElementById('modal-order-status');
                 if(modalStatusSpan) modalStatusSpan.textContent = newStatus;


             } catch (error) {
                 console.error("Error updating status:", error);
                 if(statusUpdateMessage) {
                    statusUpdateMessage.textContent = 'Error updating status.';
                    statusUpdateMessage.className = 'message error small';
                 }
             } finally {
                 updateStatusBtn.disabled = false;
                 setTimeout(() => { if(statusUpdateMessage) statusUpdateMessage.textContent = ''; }, 4000); // Clear message after few seconds
             }
        });
    }

    // --- Modal Close ---
    if(closeModalBtn && modal) {
        closeModalBtn.addEventListener('click', () => {
            modal.style.display = 'none';
            currentOrderId = null; // Reset current order ID
        });
    }

    // Close modal if clicked outside the content area
    window.addEventListener('click', (event) => {
        if (event.target == modal && modal) {
            modal.style.display = 'none';
            currentOrderId = null; // Reset current order ID
        }
    });

    // --- Initial Load ---
    loadOrders();
}


// --- Authentication Check ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        // User logged in hai, page ko initialize karein
        initializeOrderPage();
    } else {
        // User logged in nahi hai, login page par redirect karein
        console.log("User not logged in for Order View, redirecting...");
        // Ensure we are not already on login page to avoid infinite loop
         if (!window.location.pathname.includes('login.html')) {
             // Adjust path relative to admin folder
             window.location.replace('../login.html'); // Assumes login.html is one level up
        }
    }
});