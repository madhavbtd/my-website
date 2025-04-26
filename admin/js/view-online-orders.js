import {
    db, collection, getDocs, doc, getDoc, updateDoc, query, orderBy, Timestamp
} from '../../js/firebase-config.js'; // Adjust path as needed

const ordersTbody = document.getElementById('orders-tbody');
const modal = document.getElementById('order-detail-modal');
const modalContent = document.getElementById('order-detail-content');
const closeModalBtn = modal.querySelector('.close-modal-btn');
const statusSelect = document.getElementById('order-status-update');
const updateStatusBtn = document.getElementById('update-status-btn');
const statusUpdateMessage = document.getElementById('status-update-message');

let currentOrderId = null; // To store ID for status update

// --- Helper Function ---
function formatTimestamp(timestamp) {
    if (timestamp && timestamp.toDate) {
        return timestamp.toDate().toLocaleDateString('en-IN', { dateStyle: 'medium' }); // Adjust format as needed
    }
    return 'N/A';
}

function formatCurrency(amount) {
     if (typeof amount === 'number') {
         return amount.toFixed(2);
     }
     return 'N/A';
}

// --- Load Orders ---
const loadOrders = async () => {
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
                <td><span class="status-badge status-${(order.status || 'new').toLowerCase()}">${order.status || 'New'}</span></td>
                <td>${order.paymentDetails?.status || 'Pending'}</td>
                <td>
                    <button class="btn btn-sm btn-view" data-id="${orderId}"><i class="fas fa-eye"></i> View</button>
                </td>
            `;
            // View Button Action
            tr.querySelector('.btn-view').addEventListener('click', () => {
                viewOrderDetails(orderId);
            });
            ordersTbody.appendChild(tr);
        });
    } catch (error) {
        console.error("Error loading orders: ", error);
        ordersTbody.innerHTML = '<tr><td colspan="7" class="error">Error loading orders.</td></tr>';
    }
};

// --- View Order Details ---
const viewOrderDetails = async (orderId) => {
     currentOrderId = orderId; // Store for status update
     modalContent.innerHTML = '<p>Loading details...</p>';
     modal.style.display = 'block'; // Show modal

     try {
         const orderRef = doc(db, "onlineOrders", orderId);
         const docSnap = await getDoc(orderRef);

         if (docSnap.exists()) {
             const order = docSnap.data();
             let detailsHtml = `
                 <h4>Order ID: ${orderId}</h4>
                 <p><strong>Date:</strong> ${formatTimestamp(order.createdAt)}</p>
                 <p><strong>Status:</strong> ${order.status || 'New'}</p>
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
                         <strong>${item.productName}</strong> - Qty: ${item.quantity} - ₹${formatCurrency(item.itemAmount)}<br>
                         <small>(${item.unitType}${item.unitType === 'Sq Feet' ? ` | ${item.width || ''}x${item.height || ''} ${item.dimensionUnit || 'ft'}` : ''})</small>
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
             statusUpdateMessage.textContent = ''; // Clear previous status message

         } else {
             modalContent.innerHTML = '<p class="error">Order details not found.</p>';
             statusSelect.disabled = true; // Disable status update if order not found
             updateStatusBtn.disabled = true;
         }
     } catch (error) {
         console.error("Error fetching order details:", error);
         modalContent.innerHTML = '<p class="error">Error loading order details.</p>';
         statusSelect.disabled = true;
         updateStatusBtn.disabled = true;
     }
};

// --- Update Order Status ---
updateStatusBtn.addEventListener('click', async () => {
     if (!currentOrderId) return;

     const newStatus = statusSelect.value;
     statusUpdateMessage.textContent = 'Updating...';
     updateStatusBtn.disabled = true;

     try {
         const orderRef = doc(db, "onlineOrders", currentOrderId);
         await updateDoc(orderRef, {
             status: newStatus,
             updatedAt: serverTimestamp() // Update timestamp
         });
         statusUpdateMessage.textContent = 'Status updated successfully!';
         statusUpdateMessage.className = 'message success small';
         loadOrders(); // Refresh the list in the background
         // Optionally update the status in the modal view immediately
         modalContent.querySelector('p strong:contains("Status:")')?.nextSibling.replaceWith(` ${newStatus}`);

     } catch (error) {
         console.error("Error updating status:", error);
         statusUpdateMessage.textContent = 'Error updating status.';
          statusUpdateMessage.className = 'message error small';
     } finally {
         updateStatusBtn.disabled = false;
         setTimeout(() => statusUpdateMessage.textContent = '', 4000); // Clear message after few seconds
     }
});


// --- Modal Close ---
closeModalBtn.addEventListener('click', () => {
    modal.style.display = 'none';
    currentOrderId = null; // Reset current order ID
});

// Close modal if clicked outside the content area
window.addEventListener('click', (event) => {
    if (event.target == modal) {
        modal.style.display = 'none';
        currentOrderId = null; // Reset current order ID
    }
});

// --- Initial Load ---
document.addEventListener('DOMContentLoaded', loadOrders);