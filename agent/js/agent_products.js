// /agent/js/agent_products.js

// Import Firebase config and necessary functions
import { db, auth } from './agent_firebase_config.js';
import { collection, query, where, orderBy, getDocs, doc, getDoc } from './agent_firebase_config.js'; // Or directly from Firebase SDK
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { updateNavigation } from './agent_main.js'; // इम्पोर्ट

let currentUser = null;
let agentPermissions = null; // Agent permissions (e.g., allowedCategories) will be stored here
let allProductsCache = []; // Cache for all loaded products

// --- DOM Elements ---
const productListContainer = document.getElementById('agentProductList');
const loadingIndicator = document.getElementById('loadingProducts');
const productSearchInput = document.getElementById('productSearchInput');
const categoryFilterSelect = document.getElementById('productCategoryFilter');
const clearFiltersButton = document.getElementById('clearProductFiltersBtn');
const noProductsMessage = document.getElementById('noProductsMessage');

// (Product Detail Page Elements - If this file handles both pages)
const detailContainer = document.getElementById('productDetailContainer');
const detailImageEl = document.getElementById('mainProductImage');
const detailNameEl = document.getElementById('productName');
const detailCategoryEl = document.getElementById('productCategory');
const detailAgentRateEl = document.getElementById('productAgentRate');
const detailStockEl = document.getElementById('productStock');
const detailDescriptionEl = document.getElementById('productDescription');
const detailDiagramSectionEl = document.getElementById('diagramSection');
const detailDiagramButtonEl = document.getElementById('diagramDownloadBtn');
const breadcrumbProductNameEl = document.getElementById('breadcrumbProductName');
const detailLoadingEl = document.getElementById('loadingProductDetail');
const detailContentEl = document.getElementById('productDetailContent');
const detailErrorEl = document.getElementById('productError');

// (Header Elements)
const agentWelcomeMessageEl = document.getElementById('agentWelcomeMessage');
const agentLogoutBtnEl = document.getElementById('agentLogoutBtn');


// --- Helper Functions ---
function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') unsafe = String(unsafe || '');
    return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
function formatCurrency(amount) {
    const num = Number(amount);
    return isNaN(num) ? 'N/A' : num.toLocaleString('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// --- Authentication and Permission Loading ---
async function initializeAgentSession() {
    return new Promise((resolve, reject) => {
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                currentUser = user;
                if (agentWelcomeMessageEl) agentWelcomeMessageEl.textContent = `Welcome, ${user.email || 'Agent'}`;

                // Fetch agent's Firestore document and permissions
                try {
                    const agentDocRef = doc(db, "agents", currentUser.uid);
                    const agentDocSnap = await getDoc(agentDocRef);

                    if (agentDocSnap.exists() && agentDocSnap.data().role === 'agent' && agentDocSnap.data().status === 'active') {
                        agentPermissions = agentDocSnap.data();
                        console.log("Agent authenticated and permissions loaded (Products Page):", agentPermissions);
                        resolve(true); // Session initialized successfully
                    } else {
                        console.error("Agent document not found or role/status invalid. Logging out.");
                        if (agentWelcomeMessageEl) agentWelcomeMessageEl.textContent = "Invalid Agent Account.";
                        auth.signOut();
                        window.location.href = 'agent_login.html';
                        reject(new Error("Invalid agent account."));
                    }
                } catch (error) {
                    console.error("Error loading agent permissions:", error);
                    if (agentWelcomeMessageEl) agentWelcomeMessageEl.textContent = "Error loading profile.";
                    auth.signOut();
                    window.location.href = 'agent_login.html';
                    reject(error);
                }
            } else {
                // No user logged in
                console.log("Agent not logged in on products page. Redirecting...");
                window.location.replace('agent_login.html');
                reject(new Error("User not logged in."));
            }
        });
    });
}


// --- Product List Page Logic ---
async function loadAgentProducts() {
    if (!productListContainer || !loadingIndicator || !db) {
        console.error("Product list elements or DB not ready.");
        if (noProductsMessage) {
            noProductsMessage.textContent = "Error loading products (page setup issue)."; // English message
            noProductsMessage.style.display = 'block';
        }
        if (loadingIndicator) loadingIndicator.style.display = 'none';
        return;
    }

    loadingIndicator.style.display = 'flex';
    productListContainer.innerHTML = ''; // Clear previous products
    if (noProductsMessage) noProductsMessage.style.display = 'none';

    try {
        let productsQuery;

        // Filter by agent's allowed categories if applicable
        if (agentPermissions && agentPermissions.allowedCategories && agentPermissions.allowedCategories.length > 0) {
            // Note: Firestore 'in' query limit is 30 values per query.
            // If more categories, fetch all and filter client-side.
            console.log("Filtering products based on agent's allowed categories:", agentPermissions.allowedCategories);
            productsQuery = query(collection(db, "onlineProducts"),
                where("isEnabled", "==", true),
                where("category", "in", agentPermissions.allowedCategories),
                orderBy("category"),
                orderBy("productName")
            );
        } else if (agentPermissions) {
            console.log("Agent can view all enabled products (no category filter).");
            productsQuery = query(collection(db, "onlineProducts"),
                where("isEnabled", "==", true),
                orderBy("category"),
                orderBy("productName")
            );
        } else {
            console.warn("Agent permissions not loaded, showing all enabled products.");
            productsQuery = query(collection(db, "onlineProducts"),
                where("isEnabled", "==", true),
                orderBy("category"),
                orderBy("productName")
            );
        }

        const snapshot = await getDocs(productsQuery);
        allProductsCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log(`${allProductsCache.length} online products loaded for agent.`);

        populateCategories(allProductsCache);
        applyProductFilters(); // Apply filters and display the list

    } catch (error) {
        console.error("Error loading agent products:", error);
        if (noProductsMessage) {
            noProductsMessage.textContent = `Error loading products: ${error.message}. Check Firestore rules/indexes.`; // English message
            noProductsMessage.style.display = 'block';
        }
    } finally {
        if (loadingIndicator) loadingIndicator.style.display = 'none';
    }
}

// Populate category filter dropdown
function populateCategories(products) {
    if (!categoryFilterSelect) return;
    const categories = [...new Set(products.map(p => p.category).filter(Boolean))].sort();
    const currentValue = categoryFilterSelect.value; // Preserve selection if possible
    categoryFilterSelect.innerHTML = '<option value="">All Categories</option>'; // English default
    categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = escapeHtml(category);
        categoryFilterSelect.appendChild(option);
    });
    // Restore previous selection if it still exists
    if (currentValue && categories.includes(currentValue)) {
        categoryFilterSelect.value = currentValue;
    }
}

// Apply filters and render the list
function applyProductFilters() {
    if (!productListContainer) return;
    const searchTerm = productSearchInput ? productSearchInput.value.trim().toLowerCase() : '';
    const selectedCategory = categoryFilterSelect ? categoryFilterSelect.value : '';

    const filteredProducts = allProductsCache.filter(product => {
        const categoryMatch = !selectedCategory || product.category === selectedCategory;
        const searchMatch = !searchTerm ||
            (product.productName || '').toLowerCase().includes(searchTerm) ||
            (product.category || '').toLowerCase().includes(searchTerm) ||
            (product.itemCode || '').toLowerCase().includes(searchTerm); // Also check itemCode
        return categoryMatch && searchMatch;
    });
    renderProductList(filteredProducts);
}

// Render the product list
function renderProductList(products) {
    if (!productListContainer) return;
    productListContainer.innerHTML = ''; // Clear previous list

    if (products.length === 0) {
        if (noProductsMessage) {
            noProductsMessage.textContent = "No products found matching your criteria or permissions."; // English message
            no