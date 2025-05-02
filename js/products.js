/* ================================================== */
/* === js/products.js - Product Listing Page Logic === */
/* ===      (Complete & Updated Version)          === */
/* ================================================== */

// --- Imports ---
// सुनिश्चित करें कि firebase-config.js का पाथ सही है
import { db } from './firebase-config.js';
import {
    collection,
    query,
    where,
    getDocs,
    limit,
    orderBy,
    startAfter,
    // Note: endBefore and complex previous page logic might be needed for full pagination
    // but are omitted here for simplicity.
    documentId // Used potentially for complex queries if needed
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// --- State Variables ---
let currentCategory = 'all'; // Default category filter
let currentSort = 'default'; // Default sort option ('price-asc', 'price-desc', 'name-asc', 'name-desc')
let currentMinPrice = null; // Current minimum price filter
let currentMaxPrice = null; // Current maximum price filter
let productsPerPage = 8; // Number of products per page (Adjust as needed)
let lastVisibleDoc = null; // Firestore document snapshot for 'Next' page pagination
let firstVisibleDoc = null; // Firestore document snapshot for 'Previous' page pagination (basic use)
let currentPage = 1; // Current page number

// --- DOM Elements ---
const productGrid = document.getElementById('product-grid');
const loadingSpinnerContainer = productGrid?.querySelector('.loading-spinner-container'); // Select within grid initially
const categoryFilterButtons = document.querySelectorAll('.category-filter-btn');
const sortSelect = document.getElementById('sort-select');
const filterModalBtn = document.getElementById('filter-modal-btn');
const filterModal = document.getElementById('filter-modal');
const closeModalBtn = filterModal?.querySelector('.close-modal-btn');
const applyFiltersBtn = document.getElementById('apply-filters-btn');
const minPriceInput = document.getElementById('min-price');
const maxPriceInput = document.getElementById('max-price');
const activeFiltersDisplay = document.getElementById('active-filters-display');
const paginationControls = document.getElementById('pagination-controls');
const prevPageBtn = document.getElementById('prev-page');
const nextPageBtn = document.getElementById('next-page');
const pageInfoSpan = document.getElementById('page-info');

// --- Helper Functions ---

/**
 * Formats a number into Indian Currency (e.g., ₹ 1,234.56)
 * @param {number | string | null} amount - The amount to format
 * @returns {string} Formatted currency string or 'N/A'
 */
const formatIndianCurrency = (amount) => {
    const num = Number(amount);
    if (isNaN(num) || num === null) {
        console.warn("Invalid amount for formatting:", amount);
        return 'N/A';
    }
    return `₹ ${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

/** Shows the loading spinner and hides pagination */
const showLoading = () => {
    if (!productGrid || !loadingSpinnerContainer) return;
    productGrid.innerHTML = ''; // Clear previous content (cards, error message)
    loadingSpinnerContainer.classList.remove('hidden');
    productGrid.appendChild(loadingSpinnerContainer); // Append the spinner container
    if (paginationControls) paginationControls.style.display = 'none'; // Hide pagination
};

/** Hides the loading spinner */
const hideLoading = () => {
    // It's safer to just hide it rather than removing/re-appending constantly
    if (loadingSpinnerContainer) loadingSpinnerContainer.classList.add('hidden');
    // Pagination visibility is handled after data fetch
};

/** Displays an error message in the product grid */
const showError = (message) => {
     hideLoading(); // Ensure spinner is hidden
     if(productGrid) productGrid.innerHTML = `<p class="error" style="text-align: center; padding: 20px;">${message}</p>`;
     if(paginationControls) paginationControls.style.display = 'none'; // Hide pagination on error
}

// --- Display Products ---
/**
 * Renders product cards into the grid.
 * @param {Array<object>} products - Array of product objects from Firestore
 */
function displayProducts(products) {
    if (!productGrid) return;
    // Loading is hidden/managed in fetchProducts finally block

    // Ensure spinner is hidden before adding new cards
    hideLoading();

    // Clear previous cards *after* spinner is handled
    // Find and remove existing product cards, but not the spinner container if it's needed again
    Array.from(productGrid.querySelectorAll('.product-card')).forEach(card => card.remove());

    if (!products || products.length === 0) {
        // Keep the grid clear, show "No products found" message
        productGrid.innerHTML = '<p style="text-align: center; padding: 20px;">No products found matching your criteria.</p>';
        if(paginationControls) paginationControls.style.display = 'none';
        return;
    }

    // Create and append new product cards
    products.forEach(product => {
        const card = document.createElement('div');
        card.className = 'product-card';

        let imageUrl = product.imageUrls?.[0] || 'images/placeholder.png'; // Default placeholder

        // Determine display price based on product type and pricing structure
        let displayPrice = 'Contact for Price';
        if (product.pricing && product.numericPrice !== undefined && product.numericPrice !== null) {
             displayPrice = formatIndianCurrency(product.numericPrice);
             if (product.pricingType === 'flex' && product.pricing.unit === 'sqft') {
                displayPrice += ' (per sq ft)';
             } else if (product.pricingType === 'wedding') {
                 // Optionally add '/ card' or similar notation if numericPrice represents lowest per-card price
                 // displayPrice += ' (per card)';
             }
        } else if (product.pricingType === 'wedding' && Array.isArray(product.pricing?.options) && product.pricing.options.length > 0) {
            // Fallback for wedding cards if numericPrice isn't set: show lowest option
            const sortedOptions = [...product.pricing.options].sort((a, b) => a.quantity - b.quantity);
            if (sortedOptions.length > 0 && typeof sortedOptions[0].price === 'number') {
                 displayPrice = `${formatIndianCurrency(sortedOptions[0].price)} for ${sortedOptions[0].quantity}`;
            }
        }


        card.innerHTML = `
            <div class="product-image-container">
                <a href="product-detail.html?id=${product.id}">
                    <img src="${imageUrl}" alt="${product.productName || 'Product Image'}" loading="lazy">
                </a>
            </div>
            <div class="product-info">
                <h3><a href="product-detail.html?id=${product.id}">${product.productName || 'Unnamed Product'}</a></h3>
                <div class="price">${displayPrice}</div>
                <a href="product-detail.html?id=${product.id}" class="button-primary view-details-btn">View Details</a>
            </div>
        `;
        productGrid.appendChild(card);
    });

     // Update pagination UI based on the number of products fetched
     updatePaginationUI(products.length);
}

// --- Update Active Filters UI ---
/** Updates the display area showing currently active filters */
function updateActiveFiltersUI() {
    if (!activeFiltersDisplay) return;
    activeFiltersDisplay.innerHTML = ''; // Clear previous filters
    let filtersApplied = [];

    // Category Filter
    if (currentCategory !== 'all') {
        filtersApplied.push(`<span>Category: ${currentCategory} <button data-filter-type="category" title="Remove Category Filter">&times;</button></span>`);
    }

    // Price Filter
    if (currentMinPrice !== null || currentMaxPrice !== null) {
         let priceText = '';
         if(currentMinPrice !== null) priceText += `Min ₹${currentMinPrice}`;
         if(currentMinPrice !== null && currentMaxPrice !== null) priceText += ' - ';
         if(currentMaxPrice !== null) priceText += `Max ₹${currentMaxPrice}`;
        filtersApplied.push(`<span>Price: ${priceText} <button data-filter-type="price" title="Remove Price Filter">&times;</button></span>`);
    }

    // Display active filters
    if (filtersApplied.length > 0) {
        activeFiltersDisplay.innerHTML = 'Applied Filters: ' + filtersApplied.join('');

        // Add event listeners to the remove buttons
        activeFiltersDisplay.querySelectorAll('button').forEach(button => {
            button.addEventListener('click', () => {
                const filterType = button.dataset.filterType;
                if (filterType === 'category') {
                    // Reset category filter visually and fetch
                    categoryFilterButtons.forEach(btn => btn.classList.remove('active'));
                    const allBtn = document.querySelector('.category-filter-btn[data-category="all"]');
                    if(allBtn) allBtn.classList.add('active');
                    currentCategory = 'all';
                    resetAndFetchProducts(); // Reset pagination and fetch
                } else if (filterType === 'price') {
                    // Reset price filter state and fetch
                    currentMinPrice = null;
                    currentMaxPrice = null;
                    // Clear modal inputs as well
                    if(minPriceInput) minPriceInput.value = '';
                    if(maxPriceInput) maxPriceInput.value = '';
                    resetAndFetchProducts(); // Reset pagination and fetch
                }
            });
        });
    }
}


// --- Fetch Products from Firestore ---
/**
 * Fetches products based on current filters, sorting, and pagination state.
 * @param {'initial' | 'next' | 'prev'} direction - The pagination direction
 */
async function fetchProducts(direction = 'initial') {
    showLoading(); // Show spinner, hide old content/pagination
    updateActiveFiltersUI(); // Show active filters above the grid

    // --- Build Firestore Query ---
    try {
        const productsRef = collection(db, "onlineProducts"); // Target collection
        let queryConstraints = [where("isEnabled", "==", true)]; // Base constraint: only show enabled products

        // 1. Category Filter
        if (currentCategory !== 'all') {
            queryConstraints.push(where("category", "==", currentCategory));
        }

        // 2. Price Filter
        // IMPORTANT: Firestore requires a corresponding index for range filters combined with other filters/sorts.
        // Requires a 'numericPrice' field in Firestore documents.
        if (currentMinPrice !== null) {
            queryConstraints.push(where("numericPrice", ">=", currentMinPrice));
        }
        if (currentMaxPrice !== null) {
             // Check for potential conflicts with Firestore limitations (e.g., multiple range filters or inequality on different fields)
             const isSortingByName = currentSort === 'name-asc' || currentSort === 'name-desc';
             const hasMinPriceFilter = currentMinPrice !== null;

             // You can generally have multiple range filters *on the same field* OR
             // one range/inequality filter combined with equality filters and sorting on other fields.
             // If sorting by name (a different field), adding a range filter on price might require a specific composite index or might be limited.
             // Let's assume a composite index exists or handle potential errors.
            queryConstraints.push(where("numericPrice", "<=", currentMaxPrice));
             if(isSortingByName && hasMinPriceFilter){
                  console.warn("Applying range price filter (min/max) while sorting by name might require specific composite Firestore indexes.");
             }
        }

        // 3. Sorting
        // Requires corresponding fields in Firestore ('numericPrice', 'productNameLower', 'createdAt') and indexes.
        let orderByField = "productNameLower"; // Default sort field (lowercase name)
        let orderByDirection = "asc"; // Default sort direction

        switch (currentSort) {
            case 'price-asc':
                orderByField = "numericPrice";
                orderByDirection = "asc";
                break;
            case 'price-desc':
                orderByField = "numericPrice";
                orderByDirection = "desc";
                break;
            case 'name-asc':
                orderByField = "productNameLower"; // Use lowercase field for case-insensitive sort
                orderByDirection = "asc";
                break;
            case 'name-desc':
                orderByField = "productNameLower";
                orderByDirection = "desc";
                break;
            // case 'newest': // Requires 'createdAt' timestamp field
            //     orderByField = "createdAt";
            //     orderByDirection = "desc";
            //     break;
            default: // 'default' sort
                 // Keep default orderByField and orderByDirection as defined above
                 break;
        }
        queryConstraints.push(orderBy(orderByField, orderByDirection));

         // Add secondary sort for consistency if primary fields are equal (optional)
         if (orderByField !== "productNameLower") {
             queryConstraints.push(orderBy("productNameLower", "asc"));
         }


         // 4. Pagination
         if (direction === 'next' && lastVisibleDoc) {
             queryConstraints.push(startAfter(lastVisibleDoc));
         } else if (direction === 'prev' && firstVisibleDoc) {
             // Implementing reliable 'previous' page requires more complex logic:
             // - Store firstVisibleDoc of *each* page.
             // - OR Query with reversed order and endBefore(firstVisibleDoc), then reverse results client-side.
             // This simplified version might not implement 'prev' correctly.
              console.warn("Previous page functionality may be limited or reset to page 1.");
              // To prevent errors, we might just disable 'prev' button logic or reset.
              // Resetting to first page if 'prev' is clicked on page 1 state:
             if (currentPage <= 1) {
                 direction = 'initial'; // Treat as initial fetch if already on page 1
                 // Clear pagination cursors for a fresh start
                 lastVisibleDoc = null;
                 firstVisibleDoc = null;
             } else {
                  // If not on page 1, ideally implement endBefore logic.
                  // For now, we'll block 'prev' until fully implemented or accept limitations.
                 console.error("'Previous Page' is not fully supported in this version.");
                  showError("Previous page functionality is not available."); // Show error and stop
                  return;
             }
         }

        // Add Limit (Must be applied *after* all filtering, sorting, and pagination constraints)
        queryConstraints.push(limit(productsPerPage));

        // --- Execute Query ---
        const q = query(productsRef, ...queryConstraints);
        const querySnapshot = await getDocs(q);

        // --- Process Results ---
        const products = [];
        querySnapshot.forEach((doc) => {
            // Ensure essential data exists before pushing
            const data = doc.data();
            if (data.productName && data.numericPrice !== undefined) { // Add checks for essential fields
                 products.push({ id: doc.id, ...data });
            } else {
                console.warn(`Product with ID ${doc.id} missing essential data (productName or numericPrice), skipping.`);
            }
        });

        // --- Update Pagination State ---
        const fetchedDocsCount = querySnapshot.docs.length;
        if (fetchedDocsCount > 0) {
            // Update cursors based on direction (excluding 'prev' for now due to complexity)
             if (direction === 'initial' || direction === 'next') {
                lastVisibleDoc = querySnapshot.docs[fetchedDocsCount - 1];
                // Store first doc of the *current* page, needed for potential 'prev' logic
                firstVisibleDoc = querySnapshot.docs[0];
             }

             // Update current page number
             if (direction === 'next') {
                 currentPage++;
             } else if (direction === 'prev') {
                  // Decrement only if 'prev' logic was successfully executed (which it isn't fully here)
                  // currentPage--; // Avoid decrementing in this simplified version
             } else { // 'initial' load or filter/sort change
                 currentPage = 1; // Reset page number
             }
        } else {
            // No results fetched for this page
             if (direction === 'next') {
                 // Reached the end, disable 'next'
                 lastVisibleDoc = null; // Clear cursor
             } else if (direction === 'initial') {
                  // No results found for the very first page/filter set
                  currentPage = 1;
                  lastVisibleDoc = null;
                  firstVisibleDoc = null;
             }
        }

        // --- Display Products ---
        displayProducts(products); // Render the fetched products

    } catch (error) {
        console.error("Error fetching products:", error);
         if (error.code === 'failed-precondition') {
             showError("Could not fetch products. The required data index is missing or being built. Please try again later or contact support.");
             console.error("Firestore Index Error: Ensure necessary composite indexes are created for your query:", queryConstraints);
         } else {
             showError("Could not load products. Please check your connection or filters and try again.");
         }
    } finally {
        // Ensure loading indicator is hidden *after* potential errors or content rendering
         hideLoading();
    }
}

// --- Update Pagination UI ---
/** Enables/disables pagination buttons and updates page info */
function updatePaginationUI(currentBatchSize) {
    if (!paginationControls || !pageInfoSpan || !prevPageBtn || !nextPageBtn) return;

    // Update Page Info
    pageInfoSpan.textContent = `Page ${currentPage}`;

    // Previous Button State
    // Disable 'prev' if on page 1 OR if full 'prev' logic isn't implemented
    prevPageBtn.disabled = currentPage <= 1;

    // Next Button State
    // Disable 'next' if the number of fetched products is less than the limit per page
    nextPageBtn.disabled = currentBatchSize < productsPerPage;

     // Show/hide pagination based on whether there are results OR multiple pages
    const showPagination = !(currentBatchSize === 0 && currentPage === 1); // Hide if no results on page 1
    paginationControls.style.display = showPagination ? 'flex' : 'none';
}


// --- Reset and Fetch ---
/** Resets pagination state and fetches the first page with current filters/sort */
function resetAndFetchProducts() {
     currentPage = 1;
     lastVisibleDoc = null;
     firstVisibleDoc = null;
     fetchProducts('initial');
}

// --- Event Listeners ---
/** Sets up all event listeners for the page controls */
function setupEventListeners() {
    // Category Filters
    categoryFilterButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Prevent action if already active
            if (button.classList.contains('active')) return;

            currentCategory = button.dataset.category;
            // Update active class
            categoryFilterButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            // Fetch products with new category, resetting pagination
            resetAndFetchProducts();
        });
    });

    // Sort Select Dropdown
    if (sortSelect) {
        sortSelect.addEventListener('change', (e) => {
            currentSort = e.target.value;
             // Fetch products with new sort order, resetting pagination
             resetAndFetchProducts();
        });
    }

    // Filter Modal Controls
    if (filterModalBtn && filterModal && closeModalBtn && applyFiltersBtn) {
        // Open Modal
        filterModalBtn.addEventListener('click', () => {
            // Populate modal with current values before showing
             if(minPriceInput) minPriceInput.value = currentMinPrice || '';
             if(maxPriceInput) maxPriceInput.value = currentMaxPrice || '';
            filterModal.style.display = 'block';
        });

        // Close Modal (using button)
        closeModalBtn.addEventListener('click', () => {
            filterModal.style.display = 'none';
        });

        // Close Modal (clicking outside)
        window.addEventListener('click', (event) => {
            if (event.target == filterModal) {
                filterModal.style.display = 'none';
            }
        });

        // Apply Filters Button
        applyFiltersBtn.addEventListener('click', () => {
            // Parse and validate input values
            const min = parseFloat(minPriceInput.value);
            const max = parseFloat(maxPriceInput.value);
            const newMinPrice = isNaN(min) || min < 0 ? null : min;
            const newMaxPrice = isNaN(max) || max < 0 ? null : max;

            // Basic validation: min <= max
             if(newMinPrice !== null && newMaxPrice !== null && newMinPrice > newMaxPrice) {
                 alert("Minimum price cannot be greater than maximum price.");
                 return; // Prevent applying invalid range
             }

            // Update state variables
            currentMinPrice = newMinPrice;
            currentMaxPrice = newMaxPrice;

            // Close modal and fetch results
            filterModal.style.display = 'none';
            resetAndFetchProducts(); // Reset pagination and fetch with new price filters
        });
    } else {
        console.warn("Filter modal elements not found. Filtering functionality may be limited.");
    }

     // Pagination Buttons
     if(prevPageBtn && nextPageBtn) {
         // Previous Page Button
         prevPageBtn.addEventListener('click', () => {
            // Only proceed if not disabled (i.e., not on page 1)
             if (!prevPageBtn.disabled) {
                 // Attempt to fetch previous page (requires full implementation)
                 // fetchProducts('prev');
                 // In this simplified version, clicking 'prev' when enabled might not work correctly.
                 console.warn("Attempting 'Previous Page' - Full functionality might require more complex implementation.");
                 // Optionally, you could reset to page 1 as a fallback:
                 // resetAndFetchProducts();
                 alert("Previous page functionality is not fully implemented in this version.");
             }
         });

         // Next Page Button
         nextPageBtn.addEventListener('click', () => {
             // Only proceed if not disabled
             if (!nextPageBtn.disabled) {
                 fetchProducts('next');
             }
         });
     } else {
         console.warn("Pagination buttons not found. Pagination will not work.");
     }
}

// --- Initial Load ---
/** Initializes the page on DOMContentLoaded */
document.addEventListener('DOMContentLoaded', () => {
    // Ensure essential elements exist before proceeding
    if (!productGrid || !paginationControls || !categoryFilterButtons.length) {
        console.error("Essential elements for product listing page not found. Cannot initialize.");
        showError("Page structure is incomplete. Cannot load products.");
        return;
    }

    console.log("Product Listing Page DOM loaded. Initializing...");
    setupEventListeners(); // Attach listeners to controls
    fetchProducts('initial'); // Fetch and display the first page of products
});


// --- Firestore Data Preparation Notes ---
// For optimal performance and functionality:
// 1. Data Fields: Ensure your 'onlineProducts' documents in Firestore have:
//    - `isEnabled` (Boolean): To filter only active products.
//    - `category` (String): For category filtering (e.g., "Wedding Card", "Flex Banner").
//    - `numericPrice` (Number): A representative price for sorting and range filtering.
//    - `productNameLower` (String): Lowercase version of `productName` for case-insensitive sorting.
//    - `imageUrls` (Array of strings): For displaying product images.
//    - `productName` (String): The display name of the product.
//    - `pricingType` (String): e.g., "standard", "flex", "wedding" (used for price display logic).
//    - `pricing` (Object): Contains pricing details specific to the type.
//    - `(Optional) createdAt` (Timestamp): For sorting by newest.
//
// 2. Firestore Indexes: Create composite indexes in Firestore to support your queries.
//    Firestore usually suggests required indexes in the browser console errors (look for links). Common indexes needed might include:
//    - (`isEnabled` ASC, `category` ASC, `numericPrice` ASC/DESC)
//    - (`isEnabled` ASC, `category` ASC, `productNameLower` ASC/DESC)
//    - (`isEnabled` ASC, `numericPrice` ASC/DESC)
//    - (`isEnabled` ASC, `productNameLower` ASC/DESC)
//    - Potentially more complex indexes combining price ranges and sorting.