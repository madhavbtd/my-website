/* css/index.css - vFinal (Mobile Sidebar Nav Fix & Layout Updates) */

/* --- Base Variables --- */
:root {
    --primary-color: #0056b3;
    --secondary-color: #2c3e50;
    --accent-color: #ffc107;
    --success-color: #28a745;
    --info-color: #17a2b8;
    --danger-color: #dc3545;
    --light-bg: #f8f9fa;
    --border-color: #dee2e6;
    --text-color: #343a40;
    --text-muted: #6c757d;
    --sidebar-text: #ecf0f1;
    --sidebar-hover: #34495e;
    --sidebar-active-bg: #3a5368;
    --sidebar-active-border: #f1c40f;
    --card-bg: #ffffff;
    --card-shadow: 0 2px 8px rgba(0, 0, 0, 0.07);
    --card-border-radius: 8px;
    --base-font-size: 15px;
}

/* --- General Body & Container --- */
body {
    font-family: 'Poppins', sans-serif;
    font-size: var(--base-font-size);
    margin: 0;
    padding: 0;
    background-color: #f4f6f8;
    color: var(--text-color);
    line-height: 1.6;
    overflow-x: hidden; /* Prevent horizontal scroll */
}
.container {
    display: flex;
    min-height: 100vh;
}

/* --- Sidebar --- */
.sidebar {
    width: 220px;
    background-color: var(--secondary-color);
    color: var(--sidebar-text);
    padding-top: 0;
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    box-shadow: 2px 0 5px rgba(0,0,0,0.1);
    transition: width 0.3s ease;
    z-index: 1010; /* Ensure sidebar is above content */
}
.sidebar h2 {
    text-align: center;
    background-color: white;
    padding: 15px 10px;
    margin: 0;
    border-bottom: 1px solid var(--border-color);
    flex-shrink: 0;
    height: 60px; /* Consistent height */
    display: flex;
    align-items: center;
    justify-content: center;
}
.sidebar h2 img#sidebarLogo { /* Target logo by ID */
    max-width: 90%;
    max-height: 45px; /* Limit max height */
    width: auto; /* Allow auto width */
    height: auto; /* Allow auto height */
    vertical-align: middle;
    transition: max-width 0.3s ease, max-height 0.3s ease;
}
.sidebar ul {
    list-style-type: none;
    padding: 10px 0;
    margin: 0;
    flex-grow: 1;
    overflow-y: auto;
    overflow-x: hidden;
}
.sidebar ul li a {
    padding: 12px 20px;
    text-decoration: none;
    color: var(--sidebar-text);
    display: flex;
    align-items: center;
    border-left: 4px solid transparent;
    transition: background-color 0.2s ease, padding-left 0.2s ease, border-left-color 0.2s ease, color 0.2s ease;
    font-size: 0.95em;
    white-space: nowrap;
    gap: 15px;
    position: relative;
}
.sidebar ul li a i { width: 20px; text-align: center; font-size: 1.1em; flex-shrink: 0; }
.sidebar ul li a:hover { background-color: var(--sidebar-hover); color: #fff; padding-left: 20px; border-left-color: var(--sidebar-hover); }
.sidebar ul li a.active { background-color: var(--sidebar-active-bg); border-left-color: var(--sidebar-active-border); font-weight: 600; color: #fff; }
.sidebar ul li:last-child { margin-top: auto; }
.sidebar ul li a#logout-link { border-top: 1px solid var(--sidebar-hover); }

/* --- Main Content Area --- */
.main-content {
    flex: 1;
    padding: 25px;
    overflow-y: auto;
    height: 100vh;
    box-sizing: border-box;
    background-color: #f4f6f8;
    display: flex;
    flex-direction: column;
    gap: 25px;
    position: relative;
    z-index: 1;
}
.main-content > *:last-child { margin-bottom: 0; }

/* --- Updated Header --- */
.header.updated-header { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; padding: 12px 20px; background-color: var(--card-bg); box-shadow: var(--card-shadow); border-radius: var(--card-border-radius); gap: 15px; border: 1px solid var(--border-color); }
.welcome-text { font-weight: 600; font-size: 1.1em; color: var(--primary-color); flex-shrink: 0; margin-right: auto; }
.header-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 15px; }
.header-buttons { display: flex; flex-wrap: wrap; gap: 10px; }
.button-base { padding: 8px 14px; font-size: 0.9em; border-radius: 5px; text-decoration: none; color: white; border: none; cursor: pointer; font-family: 'Poppins', sans-serif; display: inline-flex; align-items: center; gap: 6px; transition: background-color 0.2s ease, transform 0.1s ease; line-height: 1.4; }
.button-base:hover { opacity: 0.9; } .button-base:active { transform: scale(0.98); }
.add-customer-btn { background-color: var(--success-color); }
.add-supplier-btn { background-color: var(--info-color); }
.new-order-btn { background-color: var(--primary-color); }
.quick-payment-btn { background-color: var(--info-color); }
.date-time-container { font-size: 0.9em; font-weight: 500; background-color: var(--light-bg); border: 1px solid var(--border-color); padding: 8px 12px; border-radius: 5px; color: var(--text-muted); white-space: nowrap; }
.header-icons { display: flex; gap: 10px; align-items: center; }
.icon-button { background: none; border: none; font-size: 1.3em; color: var(--text-muted); cursor: pointer; padding: 5px; position: relative; transition: color 0.2s ease; }
.icon-button:hover { color: var(--primary-color); }
.icon-button .badge { position: absolute; top: 0; right: 0; background-color: var(--danger-color); color: white; font-size: 0.6em; padding: 2px 5px; border-radius: 50%; font-weight: bold; display: none; }
.icon-button .badge.active { display: block; }

/* --- Card Layout Helper --- */
.card-layout { background-color: var(--card-bg, #ffffff); padding: 20px; border-radius: var(--card-border-radius, 8px); box-shadow: var(--card-shadow, 0 2px 8px rgba(0, 0, 0, 0.07)); border: 1px solid var(--border-color, #dee2e6); }
.card-layout h3 { margin-top: 0; margin-bottom: 15px; font-size: 1.1em; font-weight: 600; color: var(--primary-color); border-bottom: 1px solid #eee; padding-bottom: 8px; display: flex; align-items: center; gap: 8px; }
.card-layout h3 i { font-size: 0.9em; opacity: 0.8; }
.card-layout ul { list-style: none; padding: 0; margin: 0; font-size: 0.9em; max-height: 150px; overflow-y: auto; }
.card-layout ul li { padding: 6px 0; border-bottom: 1px dotted #eee; color: var(--text-muted); }
.card-layout ul li:last-child { border-bottom: none; }
.card-layout ul li strong { color: var(--text-color); }
.card-layout .loading-placeholder { color: #aaa; font-style: italic; }

/* --- KPI Section (Reduced Items) --- */
.kpi-section { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 15px; }
.kpi-card { display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 15px; border: 1px solid var(--border-color); border-radius: var(--card-border-radius); background-color: var(--light-bg); position: relative; min-height: 100px; transition: transform 0.2s ease, box-shadow 0.2s ease; }
.kpi-card:hover { transform: translateY(-2px); box-shadow: 0 4px 10px rgba(0,0,0,0.08); }
.kpi-icon { font-size: 1.8em; color: var(--primary-color); opacity: 0.6; margin-bottom: 8px; }
.kpi-value { font-size: 1.6em; font-weight: 700; color: var(--text-color); line-height: 1.1; }
.kpi-label { font-size: 0.8em; color: var(--text-muted); margin-top: 5px; text-transform: uppercase; }

/* --- Order Control Panel --- */
.order-control-panel { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 15px; }
.panel-item { padding: 15px; min-height: 150px; box-shadow: var(--card-shadow); border: 1px solid var(--border-color); border-radius: var(--card-border-radius); font-size: 0.9em; color: var(--text-color); display: flex; flex-direction: column; justify-content: space-between; align-items: center; font-weight: 600; font-family: 'Poppins', sans-serif; text-transform: uppercase; line-height: 1.3; transition: transform 0.2s ease, box-shadow 0.2s ease; background-color: #fff; }
.panel-item:hover { transform: translateY(-3px); box-shadow: 0 5px 10px rgba(0, 0, 0, 0.1); }
.panel-icon { font-size: 2em; margin-bottom: 10px; }
.panel-count { font-size: 2.3em; font-weight: 600; display: block; margin-bottom: 10px; color: var(--primary-color); }
.panel-item a.button-link { background-color: var(--primary-color); color: white; border: none; padding: 6px 12px; cursor: pointer; border-radius: 5px; font-size: 0.8em; margin-top: 8px; font-weight: 500; font-family: 'Poppins', sans-serif; text-transform: capitalize; text-decoration: none; display: inline-block; transition: background-color 0.2s ease; }
.panel-item a.button-link:hover { background-color: #004085; }
.panel-item.light-blue { background-color: #e1f5fe; color: #0d47a1; border-color: #b3e5fc; } .panel-item.light-blue .panel-count { color: #1976d2;}
.panel-item.light-orange { background-color: #fff3e0; color: #bf360c; border-color: #ffe0b2;} .panel-item.light-orange .panel-count { color: #e65100;}
.panel-item.light-green { background-color: #e8f5e9; color: #1b5e20; border-color: #c8e6c9;} .panel-item.light-green .panel-count { color: #388e3c;}
.panel-item.light-red { background-color: #ffebee; color: #b71c1c; border-color: #ffcdd2;} .panel-item.light-red .panel-count { color: #d32f2f;}

/* Loading Spinner */
.loading-placeholder, .fa-spinner { color: #aaa; font-style: italic; }
.panel-count .fa-spinner, .kpi-value .fa-spinner { font-size: 0.6em; color: #aaa; }
.fa-spinner { animation: fa-spin 1.5s infinite linear; display: inline-block; }
@keyframes fa-spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

/* --- Dashboard Grid Layout --- */
.dashboard-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 25px; }
/* Customer Dues Section Styles */
.customer-dues-section ul { max-height: 250px; overflow-y: auto; list-style: none; padding: 0; margin: 0; }
.customer-dues-section ul li { padding: 8px 5px; border-bottom: 1px dotted #eee; display: flex; justify-content: space-between; align-items: center; cursor: pointer; transition: background-color 0.2s ease; font-size: 0.9em; }
.customer-dues-section ul li:last-child { border-bottom: none; }
.customer-dues-section ul li:hover { background-color: #f0f5f9; }
.customer-dues-section .customer-name { font-weight: 500; color: var(--text-color); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding-right: 10px; }
.customer-dues-section .due-amount { font-weight: 600; color: var(--danger-color); white-space: nowrap; margin-left: 10px;}
.info-feed-section ul li { display: flex; justify-content: space-between; align-items: center; }
.info-feed-section .activity-time { font-size: 0.85em; color: #999; white-space: nowrap; margin-left: 10px;}

/* --- Reminder Section Improvements --- */
.reminder-section h4 { font-size: 0.9em; color: var(--secondary-color); margin-top: 15px; margin-bottom: 5px; font-weight: 600; padding-bottom: 3px; border-bottom: 1px dotted #ccc; }
.reminder-section h4:first-of-type { margin-top: 0; }
.reminder-section ul { max-height: 100px; } /* Limit list height */
.reminder-section ul li { line-height: 1.5; } /* Improve line spacing */

/* --- Chart Section --- */
.chart-section .chart-container { position: relative; height: 280px; width: 100%; }

/* --- Search Bar & Suggestions --- */
.search-bar { display: flex; align-items: center; justify-content: flex-end; flex-wrap: wrap; gap: 10px; background-color: var(--card-bg); padding: 12px 15px; border-radius: var(--card-border-radius); box-shadow: var(--card-shadow); border: 1px solid var(--border-color); position: relative; }
.search-bar label { margin: 0; color: var(--text-muted); font-size: 0.95em; font-weight: 500; flex-shrink: 0; }
.search-bar input[type="text"]#dashboardSearchInput { padding: 8px 10px; border: 1px solid var(--border-color); border-radius: 5px; font-size: 0.9em; width: 300px; height: 38px; box-sizing: border-box; }
.search-bar input[type="text"]#dashboardSearchInput:focus { outline: none; border-color: var(--primary-color); box-shadow: 0 0 0 2px rgba(0, 86, 179, 0.2); }
.search-bar button#dashboardSearchButton { background-color: var(--success-color); color: white; border: none; padding: 8px 14px; cursor: pointer; border-radius: 5px; font-size: 0.9em; height: 38px; line-height: 1; transition: background-color 0.2s ease; flex-shrink: 0; }
.search-bar button#dashboardSearchButton:hover { background-color: #1e7e34; }
.suggestions-list#dashboardSuggestions { display: none; position: absolute; top: calc(100% + 5px); /* Position below bar */ /* Adjust right/left based on final layout */ right: 15px; width: 360px; background-color: white; border: 1px solid var(--border-color); border-radius: 5px; box-shadow: 0 5px 10px rgba(0,0,0,0.1); max-height: 250px; overflow-y: auto; z-index: 1050; }
.suggestions-list#dashboardSuggestions div { padding: 8px 12px; cursor: pointer; border-bottom: 1px solid #eee; font-size: 0.9em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.suggestions-list#dashboardSuggestions div:last-child { border-bottom: none; }
.suggestions-list#dashboardSuggestions div:hover { background-color: #f0f0f0; }
.suggestions-list#dashboardSuggestions div.no-suggestions { color: var(--text-muted); cursor: default; }
.suggestions-list#dashboardSuggestions div strong { font-weight: 600; } /* Highlight search term if needed */

/* --- Quick Payment Modal Styles --- */
.modal { z-index: 1050; /* Ensure modal is above suggestions */ }
.modal-content.small-modal { max-width: 500px; }
#quickPaymentModal .suggestions-box { position: relative; }
#quickPaymentModal .suggestions-box ul { position: absolute; list-style: none; margin: 1px 0 0; padding: 0; border: 1px solid #ced4da; background-color: #fff; max-height: 150px; overflow-y: auto; z-index: 1100; border-radius: 0 0 var(--card-border-radius) var(--card-border-radius); box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1); width: 100%; box-sizing: border-box; display: none; left: 0; top: 100%; }
#quickPaymentModal .suggestions-box.active ul { display: block; }
#quickPaymentModal .suggestions-box li { padding: 8px 12px; font-size: .9em; cursor: pointer; border-bottom: 1px solid #f0f0f0; }
#quickPaymentModal .suggestions-box li:last-child { border-bottom: none; }
#quickPaymentModal .suggestions-box li:hover { background-color: #e9ecef; }
#quickPaymentModal .error-message { color: var(--danger-color); font-size: 0.85em; margin-top: 10px; text-align: center; }
#quickPaymentSelectedCustomer { padding: 5px 0; font-size: 0.9em; }

/* --- Responsive --- */
@media (max-width: 1200px) { .kpi-section { grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); } .dashboard-grid { grid-template-columns: 1fr; } }
@media (max-width: 992px) {
    .sidebar { width: 60px; overflow: hidden; position: fixed; left: 0; top: 0; height: 100%; }
    .sidebar:hover { width: 220px; box-shadow: 4px 0 10px rgba(0,0,0,0.2); }
    .sidebar h2 { padding: 10px 5px; height: 60px; } .sidebar h2 img#sidebarLogo { max-width: 40px; max-height: 40px; }
    .sidebar:hover h2 img#sidebarLogo { max-width: 90%; max-height: 45px; }
    .sidebar ul li a span { display: none; } .sidebar:hover ul li a span { display: inline; }
    .sidebar ul li a { justify-content: center; padding: 12px 0; }
    .sidebar:hover ul li a { justify-content: flex-start; padding: 12px 20px;}
    .sidebar ul li a i { margin-right: 0; } .sidebar:hover ul li a i { margin-right: 12px; }
    .main-content { padding-left: 80px; }
    .welcome-text { font-size: 1em; } .header-actions { gap: 10px; }
    .button-base { padding: 7px 12px; font-size: 0.85em; }
    .dashboard-grid { gap: 20px; }
}
@media (max-width: 768px) {
    .container { flex-direction: column; }
    .sidebar { width: 100%; min-height: auto; height: auto; flex-direction: row; align-items: center; box-shadow: 0 2px 5px rgba(0,0,0,0.1); position: sticky; top: 0; overflow: visible; padding-top: 0; z-index: 1010; background-color: var(--secondary-color); }
    .sidebar:hover { width: 100%; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
    .sidebar h2 { padding: 5px 15px; flex-shrink: 0; border-bottom: none; height: 50px; display:flex; align-items:center; }
    .sidebar h2 img#sidebarLogo { max-width: 120px; max-height: 40px; width: auto; height: auto; } /* Prevent logo enlargement */
    .sidebar ul { display: flex; overflow-x: auto; flex-grow: 1; padding: 0 5px; justify-content: flex-start; border-top: none; z-index: 1; height: 50px; align-items: center;}
    .sidebar ul li { flex-shrink: 0; margin-top: 0; } .sidebar ul li:last-child { margin-top: 0; }
    /* --- Mobile Nav Link Fix --- */
    .sidebar ul li a { padding: 10px; border-left: none; border-bottom: 3px solid transparent; white-space: nowrap; justify-content: center; pointer-events: auto !important; z-index: 2 !important; height: 100%; display: flex; align-items: center; flex-direction: column; /* Stack icon and text */ font-size: 0.8em; gap: 2px; }
    .sidebar ul li a i { margin-right: 0; font-size: 1.2em; }
    .sidebar ul li a span { display: inline; font-size: 0.8em; }
    .sidebar ul li a:hover { padding-left: 10px; background-color: var(--sidebar-hover); border-bottom-color: var(--sidebar-hover); }
    .sidebar ul li a.active { border-left: none; border-bottom-color: var(--sidebar-active-border); background-color: transparent; color: var(--sidebar-active-border); font-weight: 600; }
    /* --- End Mobile Nav Link Fix --- */
    .main-content { padding: 15px; height: auto; min-height: calc(100vh - 50px); padding-left: 15px; gap: 20px; margin-top: 50px; }
    .header.updated-header { flex-direction: column; gap: 10px; align-items: stretch; padding: 10px 15px; }
    .welcome-text { text-align: center; order: -1; width: 100%; margin-bottom: 10px; }
    .header-actions { margin-left: 0; justify-content: center; flex-direction: column; gap: 12px;}
    .header-buttons { justify-content: center; width: 100%; order: 2;}
    .date-time-container { order: 1; text-align: center; }
    .header-icons { order: 0; align-self: flex-end; }
    .search-bar { flex-direction: column; align-items: stretch; gap: 10px; padding: 10px; position: relative; }
    .search-bar input[type="text"]#dashboardSearchInput { width: 100%; max-width: none; } .search-bar button#dashboardSearchButton { width: 100%; }
    .suggestions-list#dashboardSuggestions { position: static; width: 100%; margin-top: 5px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05); border-radius: 5px; right: auto; left: auto; max-height: 150px; border: 1px solid var(--border-color); }
    .kpi-section, .order-control-panel { gap: 10px; }
    .kpi-card { padding: 10px; min-height: 80px;} .kpi-icon { font-size: 1.5em; margin-bottom: 5px;} .kpi-value { font-size: 1.4em; } .kpi-label { font-size: 0.7em; }
    .panel-item { padding: 12px 10px; min-height: 130px; } .panel-icon { font-size: 1.8em; } .panel-count { font-size: 2em; }
    .dashboard-grid { gap: 20px; grid-template-columns: 1fr; }
    .card-layout { padding: 15px; } .card-layout h3 { font-size: 1em; margin-bottom: 10px;} .card-layout ul { font-size: 0.85em; }
}
@media (max-width: 480px) {
     body { font-size: 14px; } .main-content { padding: 10px; gap: 15px;}
     .header-buttons { flex-direction: column; align-items: stretch;} .button-base { justify-content: center; }
     .kpi-section { grid-template-columns: 1fr 1fr; }
     .order-control-panel { grid-template-columns: 1fr 1fr; }
     .panel-item { padding: 10px 8px; min-height: 120px; } .panel-icon { font-size: 1.6em; } .panel-count { font-size: 1.8em; } .panel-item a.button-link { font-size: 0.75em; padding: 5px 8px; }
     .search-bar input, .search-bar button { height: 36px; font-size: 0.85em; } .suggestions-list div { font-size: 0.85em; padding: 6px 10px; }
     .card-layout ul { max-height: 120px; } .chart-section .chart-container { height: 200px; }
     .customer-dues-section ul li { flex-direction: column; align-items: flex-start; gap: 2px; }
     .customer-dues-section .due-amount { margin-left: 0; }
     .sidebar ul li a { padding: 8px 5px; } /* Further reduce padding */
     .sidebar ul li a i { font-size: 1.1em; }
     .sidebar ul li a span { font-size: 0.75em; }
}