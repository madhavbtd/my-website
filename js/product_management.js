// js/product_management.js

document.addEventListener('DOMContentLoaded', () => {
    const addProductForm = document.getElementById('addProductForm');
    const productListTableBody = document.getElementById('productListTable').querySelector('tbody');
    const addProductModal = document.getElementById('addProductModal');
    const modalOverlay = document.getElementById('modalOverlay');
    let products = JSON.parse(localStorage.getItem('products')) || [
        {
            name: 'Bike Number Plate White',
            printName: 'Bike Number Plate White',
            purchasePrice: 20.00,
            salePrice: 200.00,
            unit: 'PCS',
            openingStock: 100
        },
        {
            name: 'Car Black Film - 0',
            printName: 'Car Black Film - 0',
            purchasePrice: 6.00,
            salePrice: 40.00,
            unit: 'SQF',
            openingStock: 50
        },
        {
            name: 'Radium Sticker',
            printName: 'Radium Sticker',
            purchasePrice: 0.00,
            salePrice: 15.00,
            unit: 'WORD',
            openingStock: 200
        },
        {
            name: 'Bike Number Plate Normal',
            printName: 'Bike Number Plate Normal',
            purchasePrice: 0.00,
            salePrice: 0.00,
            unit: 'PCS',
            openingStock: 75
        },
        {
            name: 'Radium Raw Material',
            printName: 'Radium Raw Material',
            purchasePrice: 18.00,
            salePrice: 35.00,
            unit: 'SQF',
            openingStock: 30
        },
        {
            name: 'Child Trophy',
            printName: 'Child Trophy',
            purchasePrice: 0.00,
            salePrice: 0.00,
            unit: 'PCS',
            openingStock: 120
        },
        {
            name: 'Car Top Film',
            printName: 'Car Top Film',
            purchasePrice: 850.00,
            salePrice: 1800.00,
            unit: 'PCS',
            openingStock: 15
        }
    ];
    let editingIndex = -1; // Track which product is being edited

    // Save products to local storage (on initial load)
    if (!localStorage.getItem('products')) {
        localStorage.setItem('products', JSON.stringify(products));
    } else {
        products = JSON.parse(localStorage.getItem('products'));
    }

    // Display products in the list
    function displayProducts() {
        productListTableBody.innerHTML = '';
        products.forEach((product, index) => {
            const row = productListTableBody.insertRow();
            row.insertCell().textContent = index + 1; // S.No.
            row.insertCell().textContent = product.name || '';
            row.insertCell().textContent = product.printName || '';
            row.insertCell().textContent = product.purchasePrice || '';
            row.insertCell().textContent = product.salePrice || '';
            row.insertCell().textContent = product.unit || '';
            row.insertCell().textContent = product.openingStock || 0;
            const actionsCell = row.insertCell();
            actionsCell.classList.add('actions');
            const editButton = document.createElement('button');
            editButton.textContent = 'Edit';
            editButton.addEventListener('click', () => loadProductForEdit(index));
            actionsCell.appendChild(editButton);
            const deleteButton = document.createElement('button');
            deleteButton.textContent = 'Delete';
            deleteButton.addEventListener('click', () => deleteProduct(index));
            actionsCell.appendChild(deleteButton);

            // Call edit function on double click
            row.addEventListener('dblclick', () => loadProductForEdit(index));
        });