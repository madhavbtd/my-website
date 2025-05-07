// /agent/js/agent_products.js

// Import Firebase config and necessary functions
import { db, auth } from './agent_firebase_config.js';
import { collection, query, where, orderBy, getDocs, doc, getDoc } from './agent_firebase_config.js'; // Or directly from Firebase SDK
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

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
function escapeHtml(unsafe) { if (typeof unsafe !== 'string') unsafe = String(unsafe || ''); return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");}
function formatCurrency(amount) { const num = Number(amount); return isNaN(num) ? 'N/A' : num.toLocaleString('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 });}

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
         if(noProductsMessage) {
             noProductsMessage.textContent = "No products found matching your criteria or permissions."; // English message
             noProductsMessage.style.display = 'block';
         }
    } else {
        if(noProductsMessage) noProductsMessage.style.display = 'none';
        products.forEach(product => {
            const card = document.createElement('a');
            // Ensure the link points to the correct agent detail page
            card.href = `product_detail.html?id=${product.id}`;
            card.className = 'product-card';

            const imageUrl = (product.imageUrls && product.imageUrls[0]) ? product.imageUrls[0] : 'images/placeholder.png'; // Default placeholder path
            const stockLevel = product.stock ?? 'N/A';
            const stockLevelText = `Stock: ${escapeHtml(stockLevel)}`;
            let stockClass = '';
            if (typeof product.stock === 'number') {
                if (product.stock <= 0) stockClass = 'stock-out';
                else if (product.stock <= 10) stockClass = 'stock-low'; // Example threshold for low stock
            } else if (stockLevel === 'N/A') {
                stockClass = 'stock-unknown'; // Optional class for N/A
            }

            // Prioritize agentRate, fallback to regular rate
            const displayRate = product.pricing?.agentRate ?? product.pricing?.rate ?? null;

            card.innerHTML = `
                <div class="product-card-image">
                    <img src="${imageUrl}" alt="${escapeHtml(product.productName)}" loading="lazy" onerror="this.onerror=null;this.src='images/placeholder.png';">
                </div>
                <div class="product-card-info">
                    <h3>${escapeHtml(product.productName)}</h3>
                    <div class="product-card-details">
                        <span class="rate">${displayRate !== null ? formatCurrency(displayRate) : 'Rate N/A'}</span>
                        <span class="stock ${stockClass}">${stockLevelText}</span>
                    </div>
                </div>
            `;
            productListContainer.appendChild(card);
        });
    }
}


// --- Product Detail Page Logic ---
async function loadProductDetails(productId) {
    if (!detailContainer || !detailLoadingEl || !detailContentEl || !detailErrorEl || !db) {
        console.error("Product detail page elements or DB not ready.");
        if (detailErrorEl) {
            detailErrorEl.textContent = "Error loading page."; // English message
            detailErrorEl.style.display = 'block';
        }
        if(detailLoadingEl) detailLoadingEl.style.display = 'none';
        return;
    }

    detailLoadingEl.style.display = 'flex';
    detailContentEl.style.display = 'none';
    detailErrorEl.style.display = 'none';

    try {
        const productRef = doc(db, "onlineProducts", productId);
        const docSnap = await getDoc(productRef);

        if (docSnap.exists()) {
            const product = docSnap.data();

            // Check if product is enabled or if agent has permission to view disabled ones
            if (!product.isEnabled && !(agentPermissions && agentPermissions.canViewDisabledProducts)) { // Hypothetical permission
                if(detailErrorEl) { detailErrorEl.textContent = "This product is currently unavailable."; detailErrorEl.style.display = 'block';} // English message
                if (breadcrumbProductNameEl) breadcrumbProductNameEl.textContent = "Unavailable"; // English
                document.title = "Product Unavailable - Agent Portal"; // English
                if(detailLoadingEl) detailLoadingEl.style.display = 'none';
                return;
            }

            // Populate details
            if (detailNameEl) detailNameEl.textContent = product.productName || 'N/A';
            if (breadcrumbProductNameEl) breadcrumbProductNameEl.textContent = product.productName || 'Details'; // English
            document.title = `${product.productName || 'Product'} - Agent Portal`; // English

            const imageUrl = (product.imageUrls && product.imageUrls[0]) ? product.imageUrls[0] : 'images/placeholder.png';
            if (detailImageEl) { detailImageEl.src = imageUrl; detailImageEl.alt = product.productName || 'Product Image'; } // English

            if (detailCategoryEl) detailCategoryEl.textContent = `Category: ${product.category || 'N/A'}`; // English
            if (detailDescriptionEl) detailDescriptionEl.innerHTML = product.description || 'No description available.'; // English

            const stockLevel = product.stock ?? 'N/A';
            if (detailStockEl) detailStockEl.textContent = escapeHtml(stockLevel);

            const displayRate = product.pricing?.agentRate ?? product.pricing?.rate ?? null;
            if (detailAgentRateEl) detailAgentRateEl.textContent = displayRate !== null ? formatCurrency(displayRate) : 'Rate not available'; // English

            // Handle diagram download link
            const isWeddingCard = product.category?.toLowerCase().includes('wedding card');
            const diagramUrl = product.diagramUrl || null;
            if (isWeddingCard && diagramUrl && detailDiagramSectionEl && detailDiagramButtonEl) {
                detailDiagramButtonEl.href = diagramUrl;
                detailDiagramSectionEl.style.display = 'block';
            } else {
                if (detailDiagramSectionEl) detailDiagramSectionEl.style.display = 'none';
            }

            detailContentEl.style.display = 'grid'; // Show content using grid layout

        } else {
            if(detailErrorEl) { detailErrorEl.textContent = "Product not found."; detailErrorEl.style.display = 'block';} // English message
            if (breadcrumbProductNameEl) breadcrumbProductNameEl.textContent = "Not Found"; // English
            document.title = "Product Not Found - Agent Portal"; // English
        }
    } catch (error) {
        console.error("Error loading product details:", error);
        if(detailErrorEl) { detailErrorEl.textContent = `Error loading details: ${error.message}`; detailErrorEl.style.display = 'block';} // English message
    } finally {
        if (detailLoadingEl) detailLoadingEl.style.display = 'none';
    }
}

// --- Page Initialization ---
async function initializePage() {
    // First, load authentication and permissions
    try {
        await initializeAgentSession(); // This sets currentUser and agentPermissions
    } catch (error) {
        console.error("Failed to initialize agent session:", error);
        // Error should have been handled (e.g., logout/redirect) in initializeAgentSession
        return; // Do not proceed if session fails
    }

    // Determine page type and run appropriate logic
    if (productListContainer && productSearchInput && categoryFilterSelect) { // Elements for product list page
        console.log("Initializing Agent Product List page...");
        loadAgentProducts(); // Load product cache and display initially
        productSearchInput.addEventListener('input', applyProductFilters);
        categoryFilterSelect.addEventListener('change', applyProductFilters);
        if(clearFiltersButton) clearFiltersButton.addEventListener('click', () => {
            if(productSearchInput) productSearchInput.value = '';
            if(categoryFilterSelect) categoryFilterSelect.value = '';
            applyProductFilters();
        });
    } else if (detailContainer && detailNameEl) { // Elements for product detail page
        console.log("Initializing Agent Product Detail page...");
        const urlParams = new URLSearchParams(window.location.search);
        const productId = urlParams.get('id');
        if (productId) {
            loadProductDetails(productId);
        } else {
            if(detailErrorEl) { detailErrorEl.textContent = "No product ID provided in URL."; detailErrorEl.style.display = 'block'; } // English
            if(detailLoadingEl) detailLoadingEl.style.display = 'none';
            if (breadcrumbProductNameEl) breadcrumbProductNameEl.textContent = "Invalid Product"; // English
            document.title = "Invalid Product - Agent Portal"; // English
        }
    } else {
        console.warn("Could not determine page type (Product List or Detail). Ensure correct HTML elements exist.");
    }

    // Common logout button setup
    if (agentLogoutBtnEl && auth) {
        agentLogoutBtnEl.addEventListener('click', () => {
            if (confirm("Are you sure you want to logout?")) { // English
                auth.signOut().then(() => {
                    window.location.href = 'agent_login.html';
                }).catch((error) => {
                    console.error("Agent Logout Error:", error);
                    alert("Logout failed."); // English
                });
            }
        });
    }
    console.log("agent_products.js page logic initialized.");
}

// Initialize the page when the DOM is ready
document.addEventListener('DOMContentLoaded', initializePage);