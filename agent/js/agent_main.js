// /agent/js/agent_main.js
/* Main and common styles for all Agent Portal pages */

import { auth, db } from './agent_firebase_config.js'; // इम्पोर्ट auth और db
import { onAuthStateChanged, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

:root {
    --agent-primary: #0056b3;
    --agent-primary-dark: #003f80;
    --agent-secondary: #2c3e50;
    --agent-success: #28a745;
    --agent-danger: #dc3545;
    --agent-info: #17a2b8;
    --agent-warning: #ffc107;
    --agent-accent: #ffc107;

    --agent-light-bg: #f8f9fa;
    --agent-body-bg: #f4f6f9;
    --agent-white: #ffffff;
    --agent-border: #dee2e6;
    --agent-text: #343a40;
    --agent-text-muted: #6c757d;

    --agent-font-family: 'Poppins', sans-serif;
    --agent-radius: 6px;
    --agent-shadow: 0 2px 8px rgba(0,0,0,0.08);
    --agent-shadow-hover: 0 4px 12px rgba(0,0,0,0.12);

    --sidebar-width: 240px;
    --sidebar-width-collapsed: 60px;
    --header-height: 64px;
}

* {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
}

body {
    font-family: var(--agent-font-family);
    background-color: var(--agent-body-bg);
    color: var(--agent-text);
    line-height: 1.6;
    font-size: 15px;
}

.agent-portal-container { }

.agent-header {
    background-color: var(--agent-secondary);
    color: var(--agent-white);
    padding: 0 25px;
    height: var(--header-height);
    display: flex;
    justify-content: space-between;
    align-items: center;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    z-index: 1000;
}

.header-left {
    display: flex;
    align-items: center;
    gap: 15px;
}

.header-logo {
    display: flex;
    align-items: center;
    gap: 12px;
}
.header-logo img {
    max-height: 40px;
}
.header-logo span {
    font-size: 1.15em;
    font-weight: 600;
    opacity: 0.95;
}

.header-user-info {
    display: flex;
    align-items: center;
    gap: 15px;
    font-size: 0.9em;
}
.header-user-info #agentWelcomeMessage {
    font-weight: 500;
}

.header-menu-toggle {
    display: none;
    background: none;
    border: none;
    color: var(--agent-white);
    font-size: 1.6em;
    cursor: pointer;
    padding: 5px;
    line-height: 1;
}

.button-logout {
    background-color: var(--agent-danger);
    color: var(--agent-white);
    border: none;
    padding: 7px 14px;
    border-radius: var(--agent-radius);
    cursor: pointer;
    font-size: 0.85em;
    font-weight: 500;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    transition: background-color 0.2s ease;
}
.button-logout i { font-size: 0.95em; }
.button-logout:hover {
    background-color: #c82333;
}

.agent-sidebar {
    width: var(--sidebar-width);
    background-color: var(--agent-secondary, #2c3e50);
    color: var(--agent-white, #ffffff);
    position: fixed;
    top: var(--header-height);
    left: 0;
    height: calc(100vh - var(--header-height));
    overflow-y: auto;
    z-index: 990;
    box-shadow: 3px 0px 6px rgba(0,0,0,0.1);
    transition: width 0.3s ease, transform 0.3s ease;
}

.agent-sidebar ul {
    list-style: none;
    padding: 10px 0;
    margin: 0;
}

.agent-sidebar ul li a {
    display: flex;
    align-items: center;
    padding: 12px 20px;
    color: rgba(255, 255, 255, 0.75);
    text-decoration: none;
    transition: background-color 0.2s ease, color 0.2s ease, border-left-color 0.2s ease;
    font-size: 0.95em;
    border-left: 4px solid transparent;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.agent-sidebar ul li a i {
    margin-right: 12px;
    width: 20px;
    text-align: center;
    font-size: 1.05em;
    opacity: 0.8;
    flex-shrink: 0;
}
.agent-sidebar ul li a span {
    font-weight: 500;
    transition: opacity 0.2s ease;
}

.agent-sidebar ul li a:hover {
    background-color: rgba(255, 255, 255, 0.1);
    color: var(--agent-white, #ffffff);
    border-left-color: var(--agent-info, #17a2b8);
}

.agent-sidebar ul li a.active {
    background-color: var(--agent-primary, #0056b3);
    color: var(--agent-white, #ffffff);
    border-left-color: var(--agent-warning, #ffc107);
    font-weight: 600;
}
.agent-sidebar ul li a.active i {
    opacity: 1;
}

.agent-main-content-area {
    margin-left: var(--sidebar-width);
    padding-top: var(--header-height);
    width: calc(100% - var(--sidebar-width));
    min-height: calc(100vh - var(--header-height));
    display: flex;
    flex-direction: column;
    transition: margin-left 0.3s ease, width 0.3s ease;
    box-sizing: border-box;
}

.agent-main-content {
    flex-grow: 1;
    padding: 25px;
    max-width: 1400px;
    width: 100%;
    margin: 0 auto;
    box-sizing: border-box;
}
.agent-main-content h1 {
    font-size: 1.8em;
    color: var(--agent-primary);
    margin-top: 0;
    margin-bottom: 20px;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--agent-border);
    font-weight: 600;
}
.agent-main-content > p:first-of-type {
    font-size: 1em;
    color: var(--agent-text-muted);
    margin-bottom: 25px;
}

.agent-footer {
    text-align: center;
    padding: 15px;
    background-color: var(--agent-secondary);
    color: rgba(255, 255, 255, 0.75);
    font-size: 0.85em;
    flex-shrink: 0;
    box-sizing: border-box;
}


/* --- Common Component Styles --- */

.card-style {
    background-color: var(--agent-white);
    padding: 20px 25px;
    border-radius: var(--agent-radius);
    box-shadow: var(--agent-shadow);
    border: 1px solid var(--agent-border);
    margin-bottom: 20px;
}
.card-style h2, .card-style h3 {
    font-size: 1.25em;
    color: var(--agent-primary);
    margin-top: 0;
    margin-bottom: 15px;
    padding-bottom: 10px;
    border-bottom: 1px solid #eee;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 8px;
}
.card-style h2 i, .card-style h3 i { font-size: 0.9em; opacity: 0.8; }

.form-group { margin-bottom: 18px; }
.form-group label { display: block; font-weight: 500; margin-bottom: 6px; color: var(--agent-text); font-size: 0.9em; }
.form-group input[type="text"],
.form-group input[type="email"],
.form-group input[type="password"],
.form-group input[type="tel"],
.form-group input[type="date"],
.form-group input[type="number"],
.form-group select,
.form-group textarea {
    width: 100%; padding: 10px 12px; border: 1px solid var(--agent-border); border-radius: 4px; box-sizing: border-box; font-size: 0.95em; font-family: var(--agent-font-family); background-color: var(--agent-white); color: var(--agent-text); transition: border-color 0.2s ease, box-shadow 0.2s ease; height: 40px;
}
.form-group select {
    -webkit-appearance: none; -moz-appearance: none; appearance: none; background-image: url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%236C757D%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E'); background-repeat: no-repeat; background-position: right 10px center; background-size: 9px 9px; padding-right: 30px; cursor:pointer;
}
.form-group textarea { height: auto; min-height: 80px; resize: vertical; }
.form-group input:focus, .form-group select:focus, .form-group textarea:focus { border-color: var(--agent-primary); outline: 0; box-shadow: 0 0 0 0.2rem rgba(0, 86, 179, 0.2); }
.form-group input[readonly], .form-group input:disabled { background-color: #e9ecef; cursor: not-allowed; opacity: 0.7; }
.form-group small { font-size: 0.8em; color: var(--agent-text-muted); display: block; margin-top: 5px; }
.required-asterisk { color: var(--agent-danger); margin-left: 3px; font-weight: bold; }

.button {
    padding: 10px 20px; font-size: 0.95em; border: none; border-radius: var(--agent-radius); cursor: pointer; font-weight: 500; display: inline-flex; align-items: center; justify-content: center; gap: 8px; text-decoration: none; transition: background-color 0.2s ease, box-shadow 0.2s ease, transform 0.1s ease; box-shadow: var(--agent-shadow); color: var(--agent-white); background-color: var(--agent-primary);
}
.button:hover:not(:disabled) { background-color: var(--agent-primary-dark); box-shadow: var(--agent-shadow-hover); transform: translateY(-1px); }
.button:active:not(:disabled) { transform: translateY(0); box-shadow: inset 0 1px 2px rgba(0,0,0,0.1); }
.button:disabled { background-color: #adb5bd; color: #6c757d; cursor: not-allowed; box-shadow: none; transform: none; opacity: 0.7; }
.button .fa-spinner { animation: fa-spin 1s infinite linear; }
@keyframes fa-spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
.button.primary-button { background-color: var(--agent-primary); }
.button.secondary-button { background-color: var(--agent-text-muted); }
.button.secondary-button:hover:not(:disabled) { background-color: #5a6268; }
.button.success-button { background-color: var(--agent-success); }
.button.success-button:hover:not(:disabled) { background-color: #1e7e34; }
.button.danger-button { background-color: var(--agent-danger); }
.button.danger-button:hover:not(:disabled) { background-color: #bd2130; }
.button.info-button { background-color: var(--agent-info); }
.button.info-button:hover:not(:disabled) { background-color: #117a8b; }
.button.warning-button { background-color: var(--agent-warning); color: var(--agent-text); }
.button.warning-button:hover:not(:disabled) { background-color: #e0a800; }

.form-message { margin-top: 15px; padding: 12px 18px; border-radius: var(--agent-radius); font-size: 0.9em; text-align: center; border-width: 1px; border-style: solid; display: none; }
.form-message.success { background-color: #d1e7dd; color: #0f5132; border-color: #badbcc; }
.form-message.error { background-color: #f8d7da; color: #842029; border-color: #f5c2c7; }

.table-container { width: 100%; overflow-x: auto; border: 1px solid var(--agent-border); border-radius: var(--agent-radius); background-color: var(--agent-white); box-shadow: var(--agent-shadow); margin-bottom: 20px; }
table { width: 100%; border-collapse: collapse; font-size: 0.9em; }
table thead th { background-color: var(--agent-light-bg); color: var(--agent-text); padding: 12px 15px; text-align: left; font-weight: 600; border-bottom: 2px solid var(--agent-border); white-space: nowrap; position: sticky; top: 0; z-index: 5; }
table tbody td { padding: 10px 15px; border-bottom: 1px solid #f0f0f0; vertical-align: middle; color: var(--agent-text-muted); }
table tbody tr:last-child td { border-bottom: none; }
table tbody tr:hover { background-color: #e9f5ff; }

.info-message { padding: 15px; background-color: var(--agent-light-bg); border: 1px solid var(--agent-border); border-radius: var(--agent-radius); color: var(--agent-text-muted); font-size: 0.95em; text-align: center; margin-top: 20px; }
#loadingMessage td, .loading-state { text-align: center; padding: 30px 15px !important; font-style: italic; font-size: 1em; color: var(--agent-text-muted); }
#loadingMessage i, .loading-state i { margin-right: 8px; font-size: 1.1em; color: var(--agent-primary); }
.loading-state { display: none; }
.loading-state.active { display: flex; justify-content: center; align-items: center; }

.dashboard-widgets { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; margin-top: 25px; }
.widget { background-color: var(--agent-white); padding: 20px; border-radius: var(--agent-radius); border: 1px solid var(--agent-border); box-shadow: var(--agent-shadow); }
.widget h3 { margin-top: 0; margin-bottom: 15px; font-size: 1.15em; color: var(--agent-secondary); font-weight: 600; border-bottom: 1px solid #eee; padding-bottom: 10px; }
.widget div, .widget ul { font-size: 0.95em; color: var(--agent-text-muted); }
.widget ul { padding-left: 20px; margin: 0; list-style: disc; }
.widget li { margin-bottom: 8px; }
.widget a { color: var(--agent-primary); text-decoration: none; font-weight: 500; }
.widget a:hover { text-decoration: underline; color: var(--agent-primary-dark); }


/* Responsive Adjustments */
@media (max-width: 992px) {
    /* Optional: Collapse sidebar visually */
    .agent-sidebar {
        width: var(--sidebar-width-collapsed);
    }
    .agent-sidebar ul li a i { margin-right: 0; }
    .agent-sidebar ul li a span { display: none; /* Hide text */ }
    .agent-sidebar ul li a { justify-content: center; /* Center icon */ }

    .agent-main-content-area {
        margin-left: var(--sidebar-width-collapsed);
        width: calc(100% - var(--sidebar-width-collapsed));
    }
}

@media (max-width: 768px) {
    body { font-size: 14px; }
    .agent-header {
        padding: 0 15px;
        /* Keep header layout by default */
    }
    /* Show menu toggle button */
    .header-menu-toggle { display: block; }

    /* Sidebar behavior for mobile - Overlay */
    .agent-sidebar {
        width: var(--sidebar-width); /* Keep width when open */
        transform: translateX(-100%); /* Hidden off-screen */
        top: 0; /* Align with viewport top */
        height: 100vh; /* Full viewport height */
        padding-top: 0; /* No offset for header */
        z-index: 1050; /* Ensure it's above content and header */
        box-shadow: 5px 0 15px rgba(0,0,0,0.2);
        /* Header might be covered, consider JS to hide header or adjust sidebar */
    }
    .agent-sidebar.open {
        transform: translateX(0); /* Slide in */
    }
    /* Show text again in overlay mode */
    .agent-sidebar ul li a span { display: inline; }
    .agent-sidebar ul li a { justify-content: flex-start; }

    .agent-main-content-area {
        margin-left: 0; /* Full width */
        width: 100%;
        padding-top: var(--header-height); /* Keep header space */
        transition: margin-left 0s; /* No transition needed when sidebar overlays */
    }
    /* Optional: Add overlay/dim effect for content */
    /* body.sidebar-open .agent-main-content-area::before { ... } */

    .agent-main-content { padding: 15px; margin: 0 auto; }
    .agent-main-content h1 { font-size: 1.6em; }
    .button { padding: 12px 18px; font-size: 1em; }
    .dashboard-widgets { grid-template-columns: 1fr; }
    table { display: block; width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch;} /* Allow table horizontal scroll */
    table thead { display: table-header-group; /* Keep header visible */}
    table tbody, table tr, table td, table th { display: block; } /* Stack cells */
    /* Or keep table layout and just allow scroll (simpler) */
    /* table thead th { top: 0; } /* Fix sticky header if using simple scroll */
}

@media (max-width: 480px) {
    .agent-header { padding: 0 10px; }
    .header-logo span { font-size: 1em; }
    .header-user-info { gap: 10px; font-size: 0.85em;}
    .button-logout { padding: 6px 10px; font-size: 0.8em;}
    .agent-sidebar ul li a { padding: 10px 15px; font-size: 0.9em; }
    .agent-main-content { padding: 10px; }
    .agent-main-content h1 { font-size: 1.4em; }
    .button { padding: 10px 15px; font-size: 0.95em; }
    .card-style { padding: 15px; }
    .card-style h2, .card-style h3 { font-size: 1.15em;}
    .form-group input[type="text"], .form-group input[type="email"], .form-group input[type="password"], .form-group input[type="tel"], .form-group input[type="date"], .form-group input[type="number"], .form-group select, .form-group textarea { padding: 8px 10px; font-size: 0.9em; height: 38px;}
}

// नया फंक्शन: नेविगेशन अपडेट करें
function updateNavigation(permissions) {
    const navItems = document.querySelectorAll('.agent-sidebar ul li');

    navItems.forEach(item => {
        const link = item.querySelector('a');
        if (link) {
            const pageId = link.id.replace('nav-', ''); // आईडी से पेज नाम निकालें

            // अनुमतियों के आधार पर दृश्यता सेट करें
            if (pageId === 'create-order' && !permissions.includes('canAddOrder')) {
                item.style.display = 'none';
            } else if (pageId === 'order-history' && !permissions.includes('canViewOrderHistory')) {
                item.style.display = 'none';
            } else if (pageId === 'customers' && !permissions.includes('canViewCustomers')) {
                item.style.display = 'none';
            } else if (pageId === 'ledger' && !permissions.includes('canShowLedger')) {
                item.style.display = 'none';
            } else if (pageId === 'products' && !permissions.includes('canViewProducts')) {
                item.style.display = 'none';
            } else if (pageId === 'profile' && !permissions.includes('canEditProfile')) {
                item.style.display = 'none';
            } else {
                item.style.display = ''; // डिफ़ॉल्ट रूप से दिखाएँ
            }
        }
    });
}
export { updateNavigation };