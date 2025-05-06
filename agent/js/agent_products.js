// /agent/js/agent_products.js

// Firebase कॉन्फिग और जरूरी फंक्शन्स इम्पोर्ट करें
import { db, auth, collection, query, where, orderBy, limit, getDocs, doc, getDoc } from './agent_firebase_config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

let agentPermissions = null; // बाद में यहाँ एजेंट की अनुमतियाँ स्टोर होंगी
let allProductsCache = []; // प्रोडक्ट्स का कैश

// --- DOM Elements ---
const productListContainer = document.getElementById('agentProductList');
const loadingIndicator = document.getElementById('loadingProducts');
const productSearchInput = document.getElementById('productSearchInput');
const categoryFilterSelect = document.getElementById('productCategoryFilter');
const clearFiltersButton = document.getElementById('clearProductFiltersBtn');
const noProductsMessage = document.getElementById('noProductsMessage');

// --- Product Detail Page Elements ---
const detailContainer = document.getElementById('productDetailContainer');
const detailLoading = document.getElementById('loadingProductDetail');
const detailContent = document.getElementById('productDetailContent');
const detailError = document.getElementById('productError');
const detailImage = document.getElementById('mainProductImage');
const detailName = document.getElementById('productName');
const detailCategory = document.getElementById('productCategory');
const detailAgentRate = document.getElementById('productAgentRate');
const detailStock = document.getElementById('productStock');
const detailDescription = document.getElementById('productDescription');
const detailDiagramSection = document.getElementById('diagramSection');
const detailDiagramButton = document.getElementById('diagramDownloadBtn');
const breadcrumbProductName = document.getElementById('breadcrumbProductName');

// --- Helper Functions ---
function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') unsafe = String(unsafe || '');
    return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
function formatCurrency(amount) {
    const num = Number(amount);
    // अगर null, undefined, या NaN है तो 'N/A' दिखाएं
    if (amount === null || amount === undefined || isNaN(num)) {
        return 'N/A';
    }
    return num.toLocaleString('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// --- Product List Page Logic ---

async function loadAgentProducts() {
    if (!productListContainer || !loadingIndicator || !db) {
        console.error("Product list elements or DB not ready.");
        return;
    }

    loadingIndicator.style.display = 'flex';
    productListContainer.innerHTML = ''; 
    if(noProductsMessage) noProductsMessage.style.display = 'none';

    try {
        // **महत्वपूर्ण:** अभी हम सभी enabled प्रोडक्ट्स ला रहे हैं। 
        // Phase 3 में, यहाँ एजेंट की permissions के आधार पर फ़िल्टर करने का लॉजिक जोड़ा जाएगा।
        // यह सुनिश्चित करें कि Firestore में onlineProducts collection पर indexing हो: isEnabled (Asc/Desc), category (Asc/Desc)
        
        const q = query(collection(db, "onlineProducts"), where("isEnabled", "==", true), orderBy("category")); 
        const snapshot = await getDocs(q);
        
        allProductsCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log(`Workspaceed ${allProductsCache.length} online products for agent.`);
        
        populateCategories(allProductsCache);
        applyProductFilters(); // फिल्टर लागू करें और लिस्ट दिखाएं

    } catch (error) {
        console.error("Error loading agent products:", error);
        if(noProductsMessage) {
            noProductsMessage.textContent = `Error loading products: ${error.message}. Check Firestore rules/indexes.`;
            noProductsMessage.style.display = 'block';
        }
    } finally {
        if(loadingIndicator) loadingIndicator.style.display = 'none';
    }
}

// केटेगरी फ़िल्टर ड्रॉपडाउन पॉप्युलेट करें
function populateCategories(products) {
    if (!categoryFilterSelect) return;
    // यूनिक, सॉर्टेड केटेगरीज़ प्राप्त करें
    const categories = [...new Set(products.map(p => p.category).filter(Boolean))].sort(); 
    
    const currentValue = categoryFilterSelect.value;
    categoryFilterSelect.innerHTML = '<option value="">All Categories</option>'; // रीसेट करें
    
    categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = category;
        categoryFilterSelect.appendChild(option);
    });

    // यदि संभव हो तो पिछली पसंद को बहाल करें
    if (currentValue && categories.includes(currentValue)) {
        categoryFilterSelect.value = currentValue;
    }
}


// फ़िल्टर लागू करें और लिस्ट रेंडर करें
function applyProductFilters() {
    if (!productListContainer) return;
    
    const searchTerm = productSearchInput ? productSearchInput.value.trim().toLowerCase() : '';
    const selectedCategory = categoryFilterSelect ? categoryFilterSelect.value : '';

    const filteredProducts = allProductsCache.filter(product => {
        // **यहाँ बाद में एजेंट की अनुमतियों के आधार पर फ़िल्टर जोड़ें (Phase 3)**
        // if (agentPermissions && !agentPermissions.allowedCategories.includes(product.category)) {
        //     return false; 
        // }

        const categoryMatch = !selectedCategory || product.category === selectedCategory;
        
        // productName, category, या itemCode में सर्च करें
        const searchMatch = !searchTerm || 
                            (product.productName || '').toLowerCase().includes(searchTerm) ||
                            (product.category || '').toLowerCase().includes(searchTerm) ||
                            (product.itemCode || '').toLowerCase().includes(searchTerm);

        return categoryMatch && searchMatch;
    });

    renderProductList(filteredProducts);
}

// प्रोडक्ट लिस्ट रेंडर करें
function renderProductList(products) {
    if (!productListContainer) return;
    productListContainer.innerHTML = ''; // पिछला कंटेंट हटाएं

    if (products.length === 0) {
         if(noProductsMessage) {
             noProductsMessage.textContent = "No products found matching your criteria or permissions.";
             noProductsMessage.style.display = 'block';
         }
    } else {
         if(noProductsMessage) noProductsMessage.style.display = 'none';
        products.forEach(product => {
            const card = document.createElement('a'); // कार्ड को लिंक बनाएं
            card.href = `product_detail.html?id=${product.id}`;
            card.className = 'product-card';

            const imageUrl = (product.imageUrls && product.imageUrls[0]) ? product.imageUrls[0] : 'images/placeholder.png'; 
            // **स्टॉक फील्ड (`stock`) का उपयोग करें**
            const stockLevel = product.stock ?? 'N/A'; 
            // **एजेंट रेट (`agentRate`) का उपयोग करें, अगर नहीं है तो सामान्य रेट (`rate`) दिखाएं**
            const agentRate = product.pricing?.agentRate ?? product.pricing?.rate ?? null; 

            card.innerHTML = `
                <div class="product-card-image">
                    <img src="${imageUrl}" alt="${escapeHtml(product.productName)}" loading="lazy" onerror="this.onerror=null;this.src='images/placeholder.png';">
                </div>
                <div class="product-card-info">
                    <h3>${escapeHtml(product.productName)}</h3>
                    <div class="product-card-details">
                        <span class="rate">${agentRate !== null ? formatCurrency(agentRate) : 'N/A'}</span>
                        <span class="stock ${typeof stockLevel === 'number' && stockLevel <= 0 ? 'stock-out' : (typeof stockLevel === 'number' && stockLevel <= 10 ? 'stock-low' : '')}">
                            Stock: ${escapeHtml(stockLevel)}
                        </span>
                    </div>
                </div>
            `;
            productListContainer.appendChild(card);
        });
    }
}


// --- Product Detail Page Logic ---

async function loadProductDetails(productId) {
    if (!detailContainer || !detailLoading || !detailContent || !detailError || !db || !doc || !getDoc) {
        console.error("Detail page elements or DB functions missing.");
        return;
    }

    detailLoading.style.display = 'flex';
    detailContent.style.display = 'none';
    detailError.style.display = 'none';

    try {
        const productRef = doc(db, "onlineProducts", productId); // 'onlineProducts' कलेक्शन मानें
        const docSnap = await getDoc(productRef);

        if (docSnap.exists()) {
            const product = docSnap.data();
            
            if (detailName) detailName.textContent = product.productName || 'N/A';
            if (breadcrumbProductName) breadcrumbProductName.textContent = product.productName || 'Detail';
            document.title = `${product.productName || 'Product'} - Agent Portal`;
            
            const imageUrl = (product.imageUrls && product.imageUrls[0]) ? product.imageUrls[0] : 'images/placeholder.png';
            if (detailImage) { detailImage.src = imageUrl; detailImage.alt = product.productName || 'Product Image'; }

            if (detailCategory) detailCategory.textContent = `Category: ${product.category || 'N/A'}`;
            if (detailDescription) detailDescription.innerHTML = product.description || 'No description available.'; // Use innerHTML if needed
            
            // **स्टॉक दिखाएं**
            const stockLevel = product.stock ?? 'N/A'; 
            if (detailStock) detailStock.textContent = escapeHtml(stockLevel);
            
            // **एजेंट रेट दिखाएं**
            const agentRate = product.pricing?.agentRate ?? product.pricing?.rate ?? null; 
            if (detailAgentRate) detailAgentRate.textContent = agentRate !== null ? formatCurrency(agentRate) : 'N/A';

            // **डायग्राम डाउनलोड लॉजिक**
            const isWeddingCard = product.category?.toLowerCase().includes('wedding card');
            // **`diagramUrl` फील्ड देखें**
            const diagramUrl = product.diagramUrl || null; 

            if (isWeddingCard && diagramUrl && detailDiagramSection && detailDiagramButton) {
                detailDiagramButton.href = diagramUrl;
                detailDiagramSection.style.display = 'block';
            } else {
                 if (detailDiagramSection) detailDiagramSection.style.display = 'none';
            }

            detailContent.style.display = 'grid'; // कंटेंट दिखाएं

        } else {
            if(detailError) {
                 detailError.textContent = "Product not found.";
                 detailError.style.display = 'block';
            }
            if (breadcrumbProductName) breadcrumbProductName.textContent = "Not Found";
            document.title = "Product Not Found - Agent Portal";
        }

    } catch (error) {
        console.error("Error loading product details:", error);
        if(detailError) {
            detailError.textContent = `Error loading details: ${error.message}`;
            detailError.style.display = 'block';
        }
    } finally {
        if (detailLoading) detailLoading.style.display = 'none';
    }
}


// --- Initialization and Auth Check ---
function initializePage() {
    // Check if on product list page
    if (productListContainer) {
        console.log("Agent Products List Page Initializing...");
        // Wait for auth state before loading products
        onAuthStateChanged(auth, (user) => {
            if (user) {
                loadAgentProducts(); // Load products for logged-in user
                // Attach filter listeners
                if(productSearchInput) productSearchInput.addEventListener('input', applyProductFilters);
                if(categoryFilterSelect) categoryFilterSelect.addEventListener('change', applyProductFilters);
                if(clearFiltersButton) clearFiltersButton.addEventListener('click', () => {
                    if(productSearchInput) productSearchInput.value = '';
                    if(categoryFilterSelect) categoryFilterSelect.value = '';
                    applyProductFilters();
                });
            } else {
                console.log("User not logged in on products page.");
                // Redirect to login if necessary (could be handled globally)
                // window.location.href = 'agent_login.html'; 
            }
        });
    } 
    // Check if on product detail page
    else if (detailContainer) {
        console.log("Agent Product Detail Page Initializing...");
        const urlParams = new URLSearchParams(window.location.search);
        const productId = urlParams.get('id');

        onAuthStateChanged(auth, (user) => {
            if (user) {
                if (productId) {
                    loadProductDetails(productId);
                } else {
                    // Handle missing product ID
                    if(detailError) {
                        detailError.textContent = "No Product ID specified in URL.";
                        detailError.style.display = 'block';
                    }
                    if(detailLoading) detailLoading.style.display = 'none';
                     if (breadcrumbProductName) breadcrumbProductName.textContent = "Invalid Product";
                     document.title = "Invalid Product - Agent Portal";
                }
            } else {
                 console.log("User not logged in on product detail page.");
                 // Redirect to login if necessary
                 // window.location.href = 'agent_login.html'; 
            }
        });
    }

    // --- Common Logout Button Setup ---
    const agentLogoutBtnCommon = document.getElementById('agentLogoutBtn'); 
    const agentWelcomeMessageCommon = document.getElementById('agentWelcomeMessage'); 

    if(agentWelcomeMessageCommon && auth.currentUser) {
        agentWelcomeMessageCommon.textContent = `Welcome, ${auth.currentUser.email || 'Agent'}`;
    }

    if (agentLogoutBtnCommon) {
        agentLogoutBtnCommon.addEventListener('click', () => {
             if (confirm("Are you sure you want to logout?")) {
                auth.signOut().then(() => {
                    console.log("Agent logged out successfully.");
                    window.location.href = 'agent_login.html'; 
                }).catch((error) => {
                    console.error("Agent Logout Error:", error);
                    alert("Logout failed. Please try again.");
                });
            }
        });
    }
    // --- End Common Logout ---
}

// Initialize page logic once DOM is ready
document.addEventListener('DOMContentLoaded', initializePage);

console.log("agent_products.js loaded.");