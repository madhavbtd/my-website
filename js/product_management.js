// js/product_management.js

import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, onSnapshot, doc, deleteDoc, updateDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "madhav-multyprint.firebaseapp.com",
  projectId: "madhav-multyprint",
  storageBucket: "madhav-multyprint.firebasestorage.app",
  messagingSenderId: "104988349637",
  appId: "1:104988349637:web:faf045b77c6786a4e70cac"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

console.log("Firebase initialized:", app);
console.log("Firestore instance:", db);

const addProductForm = document.getElementById('addProductForm');
const productListTableBody = document.getElementById('productListTable').querySelector('tbody');
const addProductModal = document.getElementById('addProductModal');
const modalOverlay = document.getElementById('modalOverlay');
let products = []; // अब हम Firestore से डेटा प्राप्त करेंगे
let editingIndex = -1; // ट्रैक करें कि कौन सा उत्पाद संपादित किया जा रहा है

// Firestore से प्रोडक्ट डेटा प्राप्त करें और प्रदर्शित करें
function displayProducts() {
  productListTableBody.innerHTML = '';
  const productsCollection = collection(db, 'products');
  onSnapshot(productsCollection, (snapshot) => {
    products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    products.forEach((product, index) => {
      const row = productListTableBody.insertRow();
      row.insertCell().textContent = index + 1; // S.No.
      row.insertCell().textContent = product.productName || '';
      row.insertCell().textContent = product.printName || '';
      row.insertCell().textContent = product.purchasePrice || '';
      row.insertCell().textContent = product.salePrice || '';
      row.insertCell().textContent = product.unit || '';
      row.insertCell().textContent = product.lowLevelLimit || ''; // Low Level Limit दिखाएँ
      row.insertCell().textContent = product.productDescription || ''; // Product Description दिखाएँ
      row.insertCell().textContent = product.minSalePrice || ''; // Min. Sale Price दिखाएँ
      row.insertCell().textContent = product.mrp || ''; // MRP दिखाएँ
      row.insertCell().textContent = product.saleDiscount || ''; // Sale Discount % दिखाएँ
      const actionsCell = row.insertCell();
      actionsCell.classList.add('actions');
      const editButton = document.createElement('button');
      editButton.textContent = 'Edit';
      editButton.addEventListener('click', () => loadProductForEdit(product.id)); // अब ID का उपयोग करें
      actionsCell.appendChild(editButton);
      const deleteButton = document.createElement('button');
      deleteButton.textContent = 'Delete';
      deleteButton.addEventListener('click', () => deleteProduct(product.id)); // अब ID का उपयोग करें
      actionsCell.appendChild(deleteButton);

      row.addEventListener('dblclick', () => loadProductForEdit(product.id));
    });
  });
}

// नया प्रोडक्ट Firestore में सेव करें
async function saveProductData(event) {
  event.preventDefault();
  const productName = document.getElementById('productName').value;
  const printName = document.getElementById('printName').value;
  const purchasePrice = parseFloat(document.getElementById('purchasePrice').value);
  const salePrice = parseFloat(document.getElementById('salePrice').value);
  const unit = document.getElementById('unit').value;
  const lowLevelLimit = parseInt(document.getElementById('lowLevelLimit').value) || 0;
  const productDescription = document.getElementById('productDescription').value;
  const minSalePrice = parseFloat(document.getElementById('minSalePrice').value);
  const mrp = parseFloat(document.getElementById('mrp').value);
  const saleDiscount = parseFloat(document.getElementById('saleDiscount').value);
  // const openingStock = parseInt(document.getElementById('openingStock').value) || 0; // फ़ॉर्म में यह फ़ील्ड नहीं दिख रहा

  const newProduct = {
    productName,
    printName,
    purchasePrice,
    salePrice,
    unit,
    lowLevelLimit,
    productDescription,
    minSalePrice,
    mrp,
    saleDiscount,
    // openingStock // यदि आप इसे सेव करना चाहते हैं, तो आपको इसे फॉर्म में जोड़ना होगा
  };

  try {
    if (editingIndex !== -1) {
      // एडिट करें (भविष्य में लागू करें)
    } else {
      const docRef = await addDoc(collection(db, 'products'), newProduct);
      console.log('प्रोडक्ट जोड़ा गया ID के साथ: ', docRef.id);
    }
    closeModal();
    addProductForm.reset();
    editingIndex = -1;
  } catch (error) {
    console.error('प्रोडक्ट जोड़ने में त्रुटि: ', error);
  }
}

// एडिट के लिए प्रोडक्ट लोड करें (भविष्य में लागू करें)
async function loadProductForEdit(id) {
  // Firestore से ID का उपयोग करके प्रोडक्ट डेटा प्राप्त करें और फॉर्म में भरें
  console.log('एडिट करें: ', id);
}

// प्रोडक्ट डिलीट करें
async function deleteProduct(id) {
  if (confirm('क्या आप वाकई इस उत्पाद को हटाना चाहते हैं?')) {
    try {
      await deleteDoc(doc(db, 'products', id));
      console.log('प्रोडक्ट हटाया गया ID के साथ: ', id);
    } catch (error) {
      console.error('प्रोडक्ट हटाने में त्रुटि: ', error);
    }
  }
}

// Modal खोलें
function openModal() {
  addProductModal.classList.remove('hidden');
  modalOverlay.classList.remove('hidden');
}

// Modal बंद करें
function closeModal() {
  addProductModal.classList.add('hidden');
  modalOverlay.classList.add('hidden');
  addProductForm.reset();
  editingIndex = -1;
}

// इवेंट लिसनर
document.getElementById('addProductButton').addEventListener('click', openModal);
document.querySelector('#addProductModal .close-button').addEventListener('click', closeModal);
modalOverlay.addEventListener('click', closeModal);
addProductForm.addEventListener('submit', saveProductData);

// पेज लोड होने पर प्रोडक्ट्स को डिस्प्ले करें
displayProducts();