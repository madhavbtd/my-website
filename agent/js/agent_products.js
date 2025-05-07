// /agent/js/agent_products.js

// Firebase कॉन्फिग और जरूरी फंक्शन्स इम्पोर्ट करें
import { db, auth } from './agent_firebase_config.js';
import { collection, query, where, orderBy, getDocs, doc, getDoc } from './agent_firebase_config.js'; // या सीधे Firebase SDK से
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

let currentUser = null;
let agentPermissions = null; // एजेंट की अनुमतियाँ (जैसे allowedCategories) यहाँ स्टोर होंगी
let allProductsCache = []; // सभी लोड किए गए उत्पादों का कैश

// --- DOM Elements ---
const productListContainer = document.getElementById('agentProductList');
const loadingIndicator = document.getElementById('loadingProducts');
const productSearchInput = document.getElementById('productSearchInput');
const categoryFilterSelect = document.getElementById('productCategoryFilter');
const clearFiltersButton = document.getElementById('clearProductFiltersBtn');
const noProductsMessage = document.getElementById('noProductsMessage');

// (Product Detail Page Elements - यदि यह फ़ाइल दोनों पेजों को संभालती है)
const detailContainer = document.getElementById('productDetailContainer'); // यदि यह product_detail.html के लिए भी है
// ... (अन्य डिटेल पेज एलिमेंट्स पहले जैसे)
const agentWelcomeMessageEl = document.getElementById('agentWelcomeMessage'); // हेडर से
const agentLogoutBtnEl = document.getElementById('agentLogoutBtn'); // हेडर से


// --- Helper Functions ---
function escapeHtml(unsafe) { /* ... (पहले जैसा) ... */ }
function formatCurrency(amount) { /* ... (पहले जैसा) ... */ }

// --- प्रमाणीकरण और अनुमति लोड करना ---
async function initializeAgentSession() {
    return new Promise((resolve, reject) => {
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                currentUser = user;
                if (agentWelcomeMessageEl) agentWelcomeMessageEl.textContent = `Welcome, ${user.email || 'Agent'}`;

                // एजेंट का Firestore दस्तावेज़ और अनुमतियाँ फ़ेच करें
                try {
                    const agentDocRef = doc(db, "agents", currentUser.uid);
                    const agentDocSnap = await getDoc(agentDocRef);

                    if (agentDocSnap.exists() && agentDocSnap.data().role === 'agent' && agentDocSnap.data().status === 'active') {
                        agentPermissions = agentDocSnap.data();
                        console.log("एजेंट प्रमाणित और अनुमतियाँ लोड की गईं (उत्पाद पेज):", agentPermissions);
                        resolve(true); // सत्र सफलतापूर्वक प्रारंभ हुआ
                    } else {
                        console.error("एजेंट दस्तावेज़ नहीं मिला या भूमिका/स्थिति अमान्य है। लॉग आउट किया जा रहा है।");
                        if (agentWelcomeMessageEl) agentWelcomeMessageEl.textContent = "अमान्य एजेंट खाता।";
                        auth.signOut();
                        window.location.href = 'agent_login.html';
                        reject(new Error("Invalid agent account."));
                    }
                } catch (error) {
                    console.error("एजेंट अनुमतियाँ लोड करने में त्रुटि:", error);
                    if (agentWelcomeMessageEl) agentWelcomeMessageEl.textContent = "प्रोफ़ाइल लोड करने में त्रुटि।";
                    auth.signOut();
                    window.location.href = 'agent_login.html';
                    reject(error);
                }
            } else {
                // कोई उपयोगकर्ता लॉग इन नहीं है
                console.log("Agent not logged in on products page. Redirecting...");
                window.location.replace('agent_login.html');
                reject(new Error("User not logged in."));
            }
        });
    });
}


// --- उत्पाद सूची पेज तर्क ---
async function loadAgentProducts() {
    if (!productListContainer || !loadingIndicator || !db) {
        console.error("उत्पाद सूची तत्व या DB तैयार नहीं हैं।");
        if (noProductsMessage) {
            noProductsMessage.textContent = "उत्पाद लोड करने में त्रुटि (पेज सेटअप समस्या)।";
            noProductsMessage.style.display = 'block';
        }
        if (loadingIndicator) loadingIndicator.style.display = 'none';
        return;
    }

    loadingIndicator.style.display = 'flex';
    productListContainer.innerHTML = '';
    if (noProductsMessage) noProductsMessage.style.display = 'none';

    try {
        let productsQuery = query(collection(db, "onlineProducts"), where("isEnabled", "==", true), orderBy("category"), orderBy("productName"));

        // (वैकल्पिक) एजेंट की अनुमतियों के आधार पर श्रेणी फ़िल्टरिंग
        if (agentPermissions && agentPermissions.allowedCategories && agentPermissions.allowedCategories.length > 0) {
            // यदि एजेंट को केवल कुछ श्रेणियों को देखने की अनुमति है
            // ध्यान दें: Firestore 'in' क्वेरी में एक बार में अधिकतम 30 मान हो सकते हैं।
            // यदि श्रेणियां बहुत अधिक हैं, तो आपको सभी उत्पाद लाने और क्लाइंट-साइड पर फ़िल्टर करने की आवश्यकता हो सकती है।
            console.log("एजेंट की अनुमत श्रेणियों के आधार पर फ़िल्टरिंग:", agentPermissions.allowedCategories);
            productsQuery = query(collection(db, "onlineProducts"),
                                where("isEnabled", "==", true),
                                where("category", "in", agentPermissions.allowedCategories), // अनुमत श्रेणियों में से एक
                                orderBy("category"),
                                orderBy("productName")
                               );
        } else if (agentPermissions) {
             console.log("एजेंट सभी सक्षम उत्पाद देख सकता है (कोई श्रेणी फ़िल्टर नहीं)।");
        } else {
            console.warn("एजेंट अनुमतियाँ लोड नहीं हुईं, सभी सक्षम उत्पाद दिखाए जा रहे हैं।");
        }

        const snapshot = await getDocs(productsQuery);
        allProductsCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log(`एजेंट के लिए ${allProductsCache.length} ऑनलाइन उत्पाद लोड किए गए।`);

        populateCategories(allProductsCache);
        applyProductFilters(); // फ़िल्टर लागू करें और सूची दिखाएं

    } catch (error) {
        console.error("एजेंट उत्पाद लोड करने में त्रुटि:", error);
        if (noProductsMessage) {
            noProductsMessage.textContent = `उत्पाद लोड करने में त्रुटि: ${error.message}. Firestore नियमों/इंडेक्स की जाँच करें।`;
            noProductsMessage.style.display = 'block';
        }
    } finally {
        if (loadingIndicator) loadingIndicator.style.display = 'none';
    }
}

// श्रेणी फ़िल्टर ड्रॉपडाउन पॉप्युलेट करें
function populateCategories(products) {
    if (!categoryFilterSelect) return;
    const categories = [...new Set(products.map(p => p.category).filter(Boolean))].sort();
    const currentValue = categoryFilterSelect.value;
    categoryFilterSelect.innerHTML = '<option value="">सभी श्रेणियाँ</option>';
    categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = escapeHtml(category);
        categoryFilterSelect.appendChild(option);
    });
    if (currentValue && categories.includes(currentValue)) {
        categoryFilterSelect.value = currentValue;
    }
}

// फ़िल्टर लागू करें और सूची रेंडर करें
function applyProductFilters() {
    if (!productListContainer) return;
    const searchTerm = productSearchInput ? productSearchInput.value.trim().toLowerCase() : '';
    const selectedCategory = categoryFilterSelect ? categoryFilterSelect.value : '';

    const filteredProducts = allProductsCache.filter(product => {
        const categoryMatch = !selectedCategory || product.category === selectedCategory;
        const searchMatch = !searchTerm ||
                            (product.productName || '').toLowerCase().includes(searchTerm) ||
                            (product.category || '').toLowerCase().includes(searchTerm) ||
                            (product.itemCode || '').toLowerCase().includes(searchTerm); // itemCode भी जोड़ा गया
        return categoryMatch && searchMatch;
    });
    renderProductList(filteredProducts);
}

// उत्पाद सूची रेंडर करें
function renderProductList(products) {
    if (!productListContainer) return;
    productListContainer.innerHTML = '';

    if (products.length === 0) {
         if(noProductsMessage) {
             noProductsMessage.textContent = "आपकी खोज या अनुमतियों से मेल खाने वाले कोई उत्पाद नहीं मिले।";
             noProductsMessage.style.display = 'block';
         }
    } else {
        if(noProductsMessage) noProductsMessage.style.display = 'none';
        products.forEach(product => {
            const card = document.createElement('a');
            card.href = `agent_product_detail.html?id=${product.id}`; // सुनिश्चित करें कि HTML फ़ाइल का नाम सही है
            card.className = 'product-card';

            const imageUrl = (product.imageUrls && product.imageUrls[0]) ? product.imageUrls[0] : 'images/placeholder.png';
            const stockLevelText = typeof product.stock === 'number' ? `Stock: ${product.stock}` : (product.stock === null || product.stock === undefined ? 'Stock: N/A' : `Stock: ${escapeHtml(product.stock)}`);
            let stockClass = '';
            if (typeof product.stock === 'number') {
                if (product.stock <= 0) stockClass = 'stock-out';
                else if (product.stock <= 10) stockClass = 'stock-low';
            }

            // एजेंट रेट को प्राथमिकता दें, यदि नहीं तो सामान्य बिक्री दर
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


// --- उत्पाद विवरण पेज तर्क (Product Detail Page Logic) ---
// (यदि यह फ़ाइल उत्पाद सूची और विवरण दोनों को संभालती है)
const detailImageEl = document.getElementById('mainProductImage');
const detailNameEl = document.getElementById('productName');
const detailCategoryEl = document.getElementById('productCategory');
const detailAgentRateEl = document.getElementById('productAgentRate');
const detailStockEl = document.getElementById('productStock');
const detailDescriptionEl = document.getElementById('productDescription');
const detailDiagramSectionEl = document.getElementById('diagramSection');
const detailDiagramButtonEl = document.getElementById('diagramDownloadBtn');
const breadcrumbProductNameEl = document.getElementById('breadcrumbProductName');
const detailLoadingEl = document.getElementById('loadingProductDetail'); // आईडी जांची गई
const detailContentEl = document.getElementById('productDetailContent'); // आईडी जांची गई
const detailErrorEl = document.getElementById('productError'); // आईडी जांची गई

async function loadProductDetails(productId) {
    if (!detailContainer || !detailLoadingEl || !detailContentEl || !detailErrorEl || !db) {
        console.error("उत्पाद विवरण पेज के तत्व या DB तैयार नहीं हैं।");
        if (detailErrorEl) {
            detailErrorEl.textContent = "पेज लोड करने में त्रुटि।";
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
            if (!product.isEnabled && !(agentPermissions && agentPermissions.canViewDisabledProducts)) { // काल्पनिक अनुमति
                if(detailErrorEl) { detailErrorEl.textContent = "यह उत्पाद वर्तमान में उपलब्ध नहीं है।"; detailErrorEl.style.display = 'block';}
                if (breadcrumbProductNameEl) breadcrumbProductNameEl.textContent = "अनुपलब्ध";
                document.title = "उत्पाद अनुपलब्ध - एजेंट पोर्टल";
                if(detailLoadingEl) detailLoadingEl.style.display = 'none';
                return;
            }

            if (detailNameEl) detailNameEl.textContent = product.productName || 'N/A';
            if (breadcrumbProductNameEl) breadcrumbProductNameEl.textContent = product.productName || 'विवरण';
            document.title = `${product.productName || 'उत्पाद'} - एजेंट पोर्टल`;

            const imageUrl = (product.imageUrls && product.imageUrls[0]) ? product.imageUrls[0] : 'images/placeholder.png';
            if (detailImageEl) { detailImageEl.src = imageUrl; detailImageEl.alt = product.productName || 'उत्पाद छवि'; }

            if (detailCategoryEl) detailCategoryEl.textContent = `श्रेणी: ${product.category || 'N/A'}`;
            if (detailDescriptionEl) detailDescriptionEl.innerHTML = product.description || 'कोई विवरण उपलब्ध नहीं है।';

            const stockLevel = product.stock ?? 'N/A';
            if (detailStockEl) detailStockEl.textContent = escapeHtml(stockLevel);

            const displayRate = product.pricing?.agentRate ?? product.pricing?.rate ?? null;
            if (detailAgentRateEl) detailAgentRateEl.textContent = displayRate !== null ? formatCurrency(displayRate) : 'दर उपलब्ध नहीं';

            const isWeddingCard = product.category?.toLowerCase().includes('wedding card');
            const diagramUrl = product.diagramUrl || null;
            if (isWeddingCard && diagramUrl && detailDiagramSectionEl && detailDiagramButtonEl) {
                detailDiagramButtonEl.href = diagramUrl;
                detailDiagramSectionEl.style.display = 'block';
            } else {
                if (detailDiagramSectionEl) detailDiagramSectionEl.style.display = 'none';
            }
            detailContentEl.style.display = 'grid';
        } else {
            if(detailErrorEl) { detailErrorEl.textContent = "उत्पाद नहीं मिला।"; detailErrorEl.style.display = 'block';}
            if (breadcrumbProductNameEl) breadcrumbProductNameEl.textContent = "नहीं मिला";
            document.title = "उत्पाद नहीं मिला - एजेंट पोर्टल";
        }
    } catch (error) {
        console.error("उत्पाद विवरण लोड करने में त्रुटि:", error);
        if(detailErrorEl) { detailErrorEl.textContent = `विवरण लोड करने में त्रुटि: ${error.message}`; detailErrorEl.style.display = 'block';}
    } finally {
        if (detailLoadingEl) detailLoadingEl.style.display = 'none';
    }
}

// --- पेज इनिशियलाइज़ेशन ---
async function initializePage() {
    // पहले प्रमाणीकरण और अनुमतियाँ लोड करें
    try {
        await initializeAgentSession(); // यह currentUser और agentPermissions सेट करेगा
    } catch (error) {
        console.error("एजेंट सत्र प्रारंभ करने में विफल:", error);
        // त्रुटि पहले ही initializeAgentSession में हैंडल हो जानी चाहिए (जैसे लॉगआउट/रीडायरेक्ट)
        return; // आगे न बढ़ें यदि सत्र प्रारंभ नहीं होता है
    }

    // पेज के प्रकार के आधार पर तर्क चलाएं
    if (productListContainer && productSearchInput && categoryFilterSelect) { // उत्पाद सूची पेज के तत्व
        console.log("एजेंट उत्पाद सूची पेज प्रारंभ हो रहा है...");
        loadAgentProducts();
        productSearchInput.addEventListener('input', applyProductFilters);
        categoryFilterSelect.addEventListener('change', applyProductFilters);
        if(clearFiltersButton) clearFiltersButton.addEventListener('click', () => {
            if(productSearchInput) productSearchInput.value = '';
            if(categoryFilterSelect) categoryFilterSelect.value = '';
            applyProductFilters();
        });
    } else if (detailContainer && detailNameEl) { // उत्पाद विवरण पेज के तत्व
        console.log("एजेंट उत्पाद विवरण पेज प्रारंभ हो रहा है...");
        const urlParams = new URLSearchParams(window.location.search);
        const productId = urlParams.get('id');
        if (productId) {
            loadProductDetails(productId);
        } else {
            if(detailErrorEl) { detailErrorEl.textContent = "URL में कोई उत्पाद ID नहीं दी गई है।"; detailErrorEl.style.display = 'block'; }
            if(detailLoadingEl) detailLoadingEl.style.display = 'none';
            if (breadcrumbProductNameEl) breadcrumbProductNameEl.textContent = "अमान्य उत्पाद";
            document.title = "अमान्य उत्पाद - एजेंट पोर्टल";
        }
    }

    // सामान्य लॉगआउट बटन सेटअप
    if (agentLogoutBtnEl && auth) {
        agentLogoutBtnEl.addEventListener('click', () => {
            if (confirm("क्या आप वाकई लॉग आउट करना चाहते हैं?")) {
                auth.signOut().then(() => {
                    window.location.href = 'agent_login.html';
                }).catch((error) => {
                    console.error("एजेंट लॉगआउट त्रुटि:", error);
                    alert("लॉगआउट विफल रहा।");
                });
            }
        });
    }
    console.log("agent_products.js पेज तर्क प्रारंभ किया गया।");
}

// DOM रेडी होने पर पेज इनिशियलाइज़ करें
document.addEventListener('DOMContentLoaded', initializePage);