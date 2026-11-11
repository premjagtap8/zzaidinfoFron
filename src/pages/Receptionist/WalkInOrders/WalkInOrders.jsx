import { useEffect, useMemo, useState } from "react";
import "./WalkInOrders.css";
import { toast } from "react-toastify";

import {
    getAllOrders
} from "../../../services/orderService";

// NOTE: change this import to match your existing branch service.
// It must call GET /api/branches (the same API Branch Management uses).
import {
    getAllBranches
} from "../../../services/branchService";

import {
    getProducts
} from "../../../services/productService";

// NOTE: change this import to match your existing user/employee service.
// It must call GET /api/users/employees.
import {
    getEmployees
} from "../../../services/userService";

import {
    getInvoiceByOrderId,
    createInvoice
} from "../../../services/invoiceService";

import WalkInInvoice from "./WalkInInvoice/WalkInInvoice";


// ======================================
// CUSTOMER SOURCE LABELS
// key = value saved in database, label = shown in table
// ======================================

const CUSTOMER_SOURCE_LABELS = {
    GOOGLE: "Google Search / Google Maps",
    INSTAGRAM_FACEBOOK: "Instagram / Facebook",
    YOUTUBE: "YouTube",
    REFERRAL: "Friends or Family Referral",
    EXISTING_CUSTOMER: "Existing Customer",
    SHOP_BOARD: "Walk-in / Shop Board",
    ONLINE_AD: "Online Advertisement",
    INFLUENCER: "Influencer / Blogger Recommendation",
    WHATSAPP: "WhatsApp",
    OTHER: "Other",
};

const getCustomerSource = (order) => {

    const key = String(order?.customerSource || "")
        .trim()
        .toUpperCase();

    if (!key) {
        return { label: "", detail: "" };
    }

    const label = CUSTOMER_SOURCE_LABELS[key] || key;

    const detail =
        key === "OTHER"
            ? String(order?.customerSourceOther || "").trim()
            : "";

    return { label, detail };

};


// ======================================
// FIELD HELPERS
//
// NOTE: branch and salesperson field names below are
// best guesses. If your order object uses different
// names, change ONLY these two functions.
// ======================================

const firstText = (...values) => {

    const found = values.find(
        (v) =>
            v !== undefined &&
            v !== null &&
            typeof v !== "object" &&
            String(v).trim() !== ""
    );

    return found ? String(found).trim() : "";

};

const getPersonName = (person) => {

    if (!person || typeof person !== "object") {
        return "";
    }

    return firstText(
        person.name,
        [person.firstName, person.lastName]
            .filter(Boolean)
            .join(" "),
        person.email
    );

};

// Branch: backend populates branchId -> { _id, name, code }
const getBranch = (order) =>
    firstText(
        order?.branchId?.name,
        order?.branch?.name,
        order?.branchName
    );

// Salesperson: backend already populates soldBy
const getSalesperson = (order) =>
    getPersonName(order?.soldBy) ||
    firstText(order?.salespersonName);

const getCustomerName = (order) =>
    firstText(order?.shippingAddress?.fullName);

const getPhone = (order) =>
    firstText(order?.shippingAddress?.phone);

const getProductNames = (order) =>
    (order?.orderItems || [])
        .map((item) =>
            firstText(
                item?.title,
                item?.name,
                item?.productName,
                item?.product?.title,
                item?.product?.name,
                item?.product?.productName
            )
        )
        .filter(Boolean);

// Local date as YYYY-MM-DD (avoids the UTC shift of toISOString)
const toDateKey = (value) => {

    const d = new Date(value);

    if (Number.isNaN(d.getTime())) {
        return "";
    }

    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");

    return `${d.getFullYear()}-${month}-${day}`;

};

const uniqueSorted = (list) =>
    [...new Set(list.filter(Boolean))].sort((a, b) =>
        a.localeCompare(b)
    );


// ======================================
// BRANCH API RESPONSE -> BRANCH NAMES
// Handles: [..], { branches: [..] }, { data: [..] },
// { data: { branches: [..] } }
// Skips deleted / inactive branches.
// ======================================

const extractBranchNames = (response) => {

    const list =
        (Array.isArray(response) && response) ||
        response?.branches ||
        response?.data?.branches ||
        (Array.isArray(response?.data) && response.data) ||
        response?.data?.data ||
        [];

    if (!Array.isArray(list)) {
        return [];
    }

    return list
        .filter(
            (b) =>
                !b?.isDeleted &&
                String(b?.status || "ACTIVE").toUpperCase() === "ACTIVE"
        )
        .map((b) => firstText(b?.name));

};


// ======================================
// PRODUCTS API RESPONSE -> PRODUCT NAMES
// Handles: [..], { products: [..] }, { data: [..] },
// { data: { products: [..] } }
// ======================================

const extractProductNames = (response) => {

    const list =
        (Array.isArray(response) && response) ||
        response?.products ||
        response?.data?.products ||
        (Array.isArray(response?.data) && response.data) ||
        response?.data?.data ||
        [];

    if (!Array.isArray(list)) {
        return [];
    }

    return list.map((p) =>
        firstText(p?.title, p?.name, p?.productName)
    );

};


// ======================================
// EMPLOYEES API RESPONSE -> SALESPERSON NAMES
// Handles: [..], { employees: [..] }, { users: [..] },
// { data: [..] }, { data: { employees: [..] } }
//
// SALESPERSON_ROLES: only users with these roles are listed
// in the Salesperson dropdown. Use the exact role values saved
// in your database. Leave empty ([]) to list every employee.
// ======================================

const SALESPERSON_ROLES = ["SALES", "SALESPERSON"];

const extractSalespersonNames = (response) => {

    const list =
        (Array.isArray(response) && response) ||
        response?.employees ||
        response?.users ||
        response?.data?.employees ||
        response?.data?.users ||
        (Array.isArray(response?.data) && response.data) ||
        response?.data?.data ||
        [];

    if (!Array.isArray(list)) {
        return [];
    }

    return list
        .filter((u) => {

            if (SALESPERSON_ROLES.length === 0) {
                return true;
            }

            return SALESPERSON_ROLES.includes(
                String(u?.role || "").toUpperCase()
            );

        })
        .map(getPersonName);

};


// ======================================
// INVOICE RESPONSE -> INVOICE OBJECT
// ======================================

const extractInvoice = (response) => {

    const invoice =
        response?.data?.invoice ||
        response?.data ||
        response?.invoice ||
        null;

    if (
        invoice &&
        typeof invoice === "object" &&
        !Array.isArray(invoice)
    ) {
        return invoice;
    }

    return null;

};


// ======================================
// FILTER DEFAULTS
// ======================================

const EMPTY_FILTERS = {
    search: "",
    dateFrom: "",
    dateTo: "",
    branch: "",
    salesperson: "",
    product: "",
    paymentStatus: "",
    orderStatus: "",
    source: "",
};

// Sort keys -> value used for comparison
const SORT_VALUES = {
    date: (o) => new Date(o.createdAt).getTime() || 0,
    customer: (o) => getCustomerName(o).toLowerCase(),
    branch: (o) => getBranch(o).toLowerCase(),
    salesperson: (o) => getSalesperson(o).toLowerCase(),
    total: (o) => Number(o.totalAmount || 0),
    payment: (o) => String(o.paymentStatus || "").toLowerCase(),
    status: (o) => String(o.orderStatus || "").toLowerCase(),
};


function WalkInOrders() {

    const [orders, setOrders] = useState([]);

    // All active branch names from the branches API
    const [branchNames, setBranchNames] = useState([]);

    // All product names from the products API
    const [productNames, setProductNames] = useState([]);

    // All employee names from the employees API
    const [employeeNames, setEmployeeNames] = useState([]);

    // true once the employees API answered successfully
    const [employeesLoaded, setEmployeesLoaded] = useState(false);

    const [loading, setLoading] = useState(true);

    // ======================================
    // FILTER + SORT STATE
    // ======================================

    const [filters, setFilters] = useState(EMPTY_FILTERS);

    const [sort, setSort] = useState({
        key: "date",
        direction: "desc",
    });

    const setFilter = (name, value) => {

        setFilters((prev) => ({
            ...prev,
            [name]: value,
        }));

    };

    const clearFilters = () => {

        setFilters(EMPTY_FILTERS);

    };

    const toggleSort = (key) => {

        setSort((prev) =>
            prev.key === key
                ? {
                    key,
                    direction:
                        prev.direction === "asc"
                            ? "desc"
                            : "asc",
                }
                : {
                    key,
                    direction: key === "date" || key === "total"
                        ? "desc"
                        : "asc",
                }
        );

    };

    // ======================================
    // INVOICE POPUP STATES
    // ======================================

    const [invoiceData, setInvoiceData] = useState(null);

    const [autoPrint, setAutoPrint] = useState(false);

    const [openingId, setOpeningId] = useState("");

    useEffect(() => {

        loadOrders();

        loadBranches();

        loadEmployees();

        loadProducts();

    }, []);

    const loadOrders = async () => {

        try {

            setLoading(true);

            const res = await getAllOrders();

            const list =
                res.orders ||
                res.data ||
                [];

            // Only Walk-In Orders
            const walkInOrders = list.filter(
                (order) => order.orderSource === "WALK_IN"
            );

            setOrders(walkInOrders);

        }

        catch (error) {

            console.log(error);

        }

        finally {

            setLoading(false);

        }

    };

    // Load ALL branches so the dropdown shows every branch,
    // even a branch that has no walk-in order yet.
    const loadBranches = async () => {

        try {

            const res = await getAllBranches();

            setBranchNames(extractBranchNames(res));

        }

        catch (error) {

            // Not fatal: dropdown falls back to branches found in orders
            console.error("LOAD BRANCHES ERROR:", error);

        }

    };

    // Load ALL products so the Product dropdown lists every product,
    // even one that has not been sold in a walk-in order yet.
    const loadProducts = async () => {

        try {

            const res = await getProducts();

            setProductNames(extractProductNames(res));

        }

        catch (error) {

            // Not fatal: dropdown falls back to products found in orders
            console.error("LOAD PRODUCTS ERROR:", error);

        }

    };

    // Load employees so the Salesperson dropdown lists everyone.
    // This route is role-protected: if the logged-in role is not
    // allowed (403), we just fall back to names found in orders.
    const loadEmployees = async () => {

        try {

            const res = await getEmployees();

            setEmployeeNames(extractSalespersonNames(res));

            setEmployeesLoaded(true);

        }

        catch (error) {

            console.error("LOAD EMPLOYEES ERROR:", error);

        }

    };

    // ======================================
    // DROPDOWN OPTIONS
    // Branches = branches API + branches seen in orders
    // (orders part keeps old/inactive branches filterable)
    // ======================================

    const options = useMemo(() => ({

        branches: uniqueSorted([
            ...branchNames,
            ...orders.map(getBranch),
        ]),

        // Sales-role users only. If the employees API could not be
        // loaded (e.g. 403), fall back to names found in the orders.
        salespersons: employeesLoaded
            ? uniqueSorted(employeeNames)
            : uniqueSorted(orders.map(getSalesperson)),

        // Products API + names already on orders
        // (orders part keeps renamed / deleted products filterable)
        products: uniqueSorted([
            ...productNames,
            ...orders.flatMap(getProductNames),
        ]),

        // PAID and PENDING are always listed, plus any other
        // status already present on the orders
        paymentStatuses: uniqueSorted([
            "PAID",
            "PENDING",
            ...orders.map((o) => String(o.paymentStatus || "")),
        ]),

        orderStatuses: uniqueSorted(
            orders.map((o) => String(o.orderStatus || ""))
        ),

        sources: uniqueSorted(
            orders.map((o) => getCustomerSource(o).label)
        ),

    }), [orders, branchNames, employeeNames, employeesLoaded, productNames]);

    // ======================================
    // FILTER + SORT (one place, always combined)
    // ======================================

    const filteredOrders = useMemo(() => {

        const keyword = filters.search.trim().toLowerCase();

        const result = orders.filter((order) => {

            // ---- search ----
            if (keyword) {

                const source = getCustomerSource(order);

                const haystack = [
                    order._id,
                    order.invoiceNumber,
                    getCustomerName(order),
                    getPhone(order),
                    getBranch(order),
                    getSalesperson(order),
                    source.label,
                    source.detail,
                    ...getProductNames(order),
                ]
                    .filter(Boolean)
                    .join(" ")
                    .toLowerCase();

                if (!haystack.includes(keyword)) {
                    return false;
                }

            }

            // ---- date range ----
            if (filters.dateFrom || filters.dateTo) {

                const key = toDateKey(order.createdAt);

                if (!key) return false;

                if (filters.dateFrom && key < filters.dateFrom) {
                    return false;
                }

                if (filters.dateTo && key > filters.dateTo) {
                    return false;
                }

            }

            // ---- dropdowns ----
            if (
                filters.branch &&
                getBranch(order) !== filters.branch
            ) return false;

            if (
                filters.salesperson &&
                getSalesperson(order) !== filters.salesperson
            ) return false;

            if (
                filters.product &&
                !getProductNames(order).includes(filters.product)
            ) return false;

            if (
                filters.paymentStatus &&
                String(order.paymentStatus || "") !== filters.paymentStatus
            ) return false;

            if (
                filters.orderStatus &&
                String(order.orderStatus || "") !== filters.orderStatus
            ) return false;

            if (
                filters.source &&
                getCustomerSource(order).label !== filters.source
            ) return false;

            return true;

        });

        // ---- sort ----
        const getValue = SORT_VALUES[sort.key] || SORT_VALUES.date;

        const factor = sort.direction === "asc" ? 1 : -1;

        return [...result].sort((a, b) => {

            const va = getValue(a);
            const vb = getValue(b);

            if (va < vb) return -1 * factor;
            if (va > vb) return 1 * factor;

            return 0;

        });

    }, [orders, filters, sort]);

    const activeFilterCount = Object.values(filters).filter(Boolean).length;

    // ======================================
    // AUTO PRINT
    // ======================================

    useEffect(() => {

        if (!invoiceData || !autoPrint) {
            return;
        }

        const timer = setTimeout(() => {

            const printButton =
                document.querySelector(".wkinv-print-btn");

            if (printButton) {
                printButton.click();
            }
            else {
                toast.error(
                    "Print button not found. Please use PRINT INVOICE in the popup."
                );
            }

            setAutoPrint(false);

        }, 600);

        return () => clearTimeout(timer);

    }, [invoiceData, autoPrint]);

    // ======================================
    // TOTALS (follow the filtered list)
    // ======================================

    const totalSales = filteredOrders.reduce(
        (sum, order) => sum + Number(order.totalAmount || 0),
        0
    );

    const totalOrders = filteredOrders.length;

    // ======================================
    // OPEN INVOICE (VIEW / PRINT)
    // ======================================

    const openInvoice = async (order, shouldPrint = false) => {

        if (!order?._id) {
            toast.error("Order ID not found");
            return;
        }

        try {

            setOpeningId(order._id);

            let invoice = null;

            try {

                const response = await getInvoiceByOrderId(order._id);

                invoice = extractInvoice(response);

            }

            catch (error) {

                // 404 = invoice not created yet
                if (error?.response?.status !== 404) {
                    throw error;
                }

                const isPaid =
                    String(order.paymentStatus || "").toUpperCase() === "PAID";

                if (!isPaid) {

                    toast.warning(
                        "Invoice sirf paid order ka banta hai. Order details dikha rahe hain."
                    );

                }
                else if (
                    window.confirm(
                        "Is order ka invoice abhi bana nahi hai. Abhi bana dein?"
                    )
                ) {

                    const created = await createInvoice(order._id);

                    invoice = extractInvoice(created);

                    toast.success("Invoice created successfully");

                }

            }

            setInvoiceData(invoice || order);

            setAutoPrint(shouldPrint);

        }

        catch (error) {

            console.error("OPEN INVOICE ERROR:", error);

            toast.error(
                error?.response?.data?.message ||
                error?.message ||
                "Unable to load invoice. Showing order details."
            );

            setInvoiceData(order);

            setAutoPrint(shouldPrint);

        }

        finally {

            setOpeningId("");

        }

    };

    const viewOrder = (order) => {
        openInvoice(order, false);
    };

    const printInvoice = (order) => {
        openInvoice(order, true);
    };

    const closeInvoice = () => {
        setInvoiceData(null);
        setAutoPrint(false);
    };

    // ======================================
    // SORTABLE HEADER
    // ======================================

    const SortableTh = ({ label, sortKey }) => {

        const active = sort.key === sortKey;

        return (
            <th
                className="sortable"
                onClick={() => toggleSort(sortKey)}
                aria-sort={
                    active
                        ? sort.direction === "asc"
                            ? "ascending"
                            : "descending"
                        : "none"
                }
            >
                {label}
                <span className={`sort-arrow ${active ? "active" : ""}`}>
                    {active
                        ? sort.direction === "asc"
                            ? " ▲"
                            : " ▼"
                        : " ↕"}
                </span>
            </th>
        );

    };

    const COLUMN_COUNT = 13;

    // ======================================
    // RETURN JSX
    // ======================================

    return (

        <div className="walkin-orders-page">

            <div className="page-header">

                <h2>Walk-In Orders</h2>

            </div>

            {/* ================= FILTERS ================= */}

            <div className="filter-panel">

                <div className="filter-search-row">

                    <input
                        type="text"
                        className="filter-search"
                        placeholder="Search customer, phone, order ID, product, salesperson, source"
                        value={filters.search}
                        onChange={(e) => setFilter("search", e.target.value)}
                    />

                    <button
                        type="button"
                        className="clear-btn"
                        onClick={clearFilters}
                        disabled={activeFilterCount === 0}
                    >
                        Clear filters
                        {activeFilterCount > 0 && ` (${activeFilterCount})`}
                    </button>

                </div>

                <div className="filter-grid">

                    <label className="filter-field">
                        <span>From date</span>
                        <input
                            type="date"
                            value={filters.dateFrom}
                            max={filters.dateTo || undefined}
                            onChange={(e) => setFilter("dateFrom", e.target.value)}
                        />
                    </label>

                    <label className="filter-field">
                        <span>To date</span>
                        <input
                            type="date"
                            value={filters.dateTo}
                            min={filters.dateFrom || undefined}
                            onChange={(e) => setFilter("dateTo", e.target.value)}
                        />
                    </label>

                    <label className="filter-field">
                        <span>Branch</span>
                        <select
                            value={filters.branch}
                            onChange={(e) => setFilter("branch", e.target.value)}
                        >
                            <option value="">All branches</option>
                            {options.branches.map((b) => (
                                <option key={b} value={b}>{b}</option>
                            ))}
                        </select>
                    </label>

                    <label className="filter-field">
                        <span>Salesperson</span>
                        <select
                            value={filters.salesperson}
                            onChange={(e) => setFilter("salesperson", e.target.value)}
                        >
                            <option value="">All salespersons</option>
                            {options.salespersons.map((s) => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>
                        <small className="filter-hint">
                            Currently only users with the Sales role are shown here. Admin is not shown yet; it will be added later.
                        </small>
                    </label>

                    <label className="filter-field">
                        <span>Product</span>
                        <select
                            value={filters.product}
                            onChange={(e) => setFilter("product", e.target.value)}
                        >
                            <option value="">All products</option>
                            {options.products.map((p) => (
                                <option key={p} value={p}>{p}</option>
                            ))}
                        </select>
                    </label>

                    <label className="filter-field">
                        <span>Payment status</span>
                        <select
                            value={filters.paymentStatus}
                            onChange={(e) => setFilter("paymentStatus", e.target.value)}
                        >
                            <option value="">All payments</option>
                            {options.paymentStatuses.map((p) => (
                                <option key={p} value={p}>{p}</option>
                            ))}
                        </select>
                    </label>

                    <label className="filter-field">
                        <span>Order status</span>
                        <select
                            value={filters.orderStatus}
                            onChange={(e) => setFilter("orderStatus", e.target.value)}
                        >
                            <option value="">All statuses</option>
                            {options.orderStatuses.map((s) => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>
                    </label>

                    <label className="filter-field">
                        <span>Customer source</span>
                        <select
                            value={filters.source}
                            onChange={(e) => setFilter("source", e.target.value)}
                        >
                            <option value="">All sources</option>
                            {options.sources.map((s) => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>
                    </label>

                </div>

                <div className="result-count">
                    Showing {filteredOrders.length} of {orders.length} orders
                </div>

            </div>

            {/* ================= SUMMARY ================= */}

            <div className="summary-box">

                <div className="summary-card">
                    <h3>{totalOrders}</h3>
                    <p>Total Orders</p>
                </div>

                <div className="summary-card">
                    <h3>₹ {totalSales}</h3>
                    <p>Total Sales</p>
                </div>

            </div>

            {/* ================= TABLE ================= */}

            <div className="orders-table">

                <table>

                    <thead>

                        <tr>

                            <th>Order ID</th>

                            <SortableTh label="Date" sortKey="date" />

                            <SortableTh label="Customer" sortKey="customer" />

                            <th>Phone</th>

                            <SortableTh label="Branch" sortKey="branch" />

                            <SortableTh label="Salesperson" sortKey="salesperson" />

                            <th>Customer Source</th>

                            <th>
                                Products
                                <small className="th-note">
                                    Shows item count, not names (to be improved later)
                                </small>
                            </th>

                            <th>Qty</th>

                            <SortableTh label="Total" sortKey="total" />

                            <SortableTh label="Payment" sortKey="payment" />

                            <SortableTh label="Status" sortKey="status" />

                            <th>Action</th>

                        </tr>

                    </thead>

                    <tbody>

                        {loading ? (

                            <tr>
                                <td colSpan={COLUMN_COUNT}>Loading...</td>
                            </tr>

                        ) : filteredOrders.length === 0 ? (

                            <tr>
                                <td colSpan={COLUMN_COUNT}>
                                    {orders.length === 0
                                        ? "No Walk-In Orders Found"
                                        : "No orders match these filters. Try clearing some filters."}
                                </td>
                            </tr>

                        ) : (

                            filteredOrders.map((order) => {

                                const source = getCustomerSource(order);

                                const isOpening = openingId === order._id;

                                return (

                                    <tr key={order._id}>

                                        <td>{order._id.slice(-8)}</td>

                                        <td>
                                            {new Date(order.createdAt).toLocaleDateString()}
                                        </td>

                                        <td>{order.shippingAddress?.fullName}</td>

                                        <td>{order.shippingAddress?.phone}</td>

                                        <td>
                                            {getBranch(order) || (
                                                <span className="source-empty">-</span>
                                            )}
                                        </td>

                                        <td>
                                            {getSalesperson(order) || (
                                                <span className="source-empty">-</span>
                                            )}
                                        </td>

                                        <td>

                                            {source.label ? (

                                                <div className="source-cell">

                                                    <span className="source-badge">
                                                        {source.label}
                                                    </span>

                                                    {source.detail && (
                                                        <small>{source.detail}</small>
                                                    )}

                                                </div>

                                            ) : (

                                                <span className="source-empty">-</span>

                                            )}

                                        </td>

                                        <td>{order.orderItems.length}</td>

                                        <td>
                                            {order.orderItems.reduce(
                                                (sum, item) => sum + item.quantity,
                                                0
                                            )}
                                        </td>

                                        <td>₹{order.totalAmount}</td>

                                        <td>
                                            <span
                                                className={
                                                    order.paymentStatus === "PAID"
                                                        ? "paid"
                                                        : "pending"
                                                }
                                            >
                                                {order.paymentStatus}
                                            </span>
                                        </td>

                                        <td>
                                            <span className="order-status">
                                                {order.orderStatus}
                                            </span>
                                        </td>

                                        <td>

                                            <div className="action-buttons">

                                                <button
                                                    type="button"
                                                    className="view-btn"
                                                    disabled={isOpening}
                                                    onClick={() => viewOrder(order)}
                                                >
                                                    {isOpening ? "Opening..." : "View"}
                                                </button>

                                                <button
                                                    type="button"
                                                    className="print-btn"
                                                    disabled={isOpening}
                                                    onClick={() => printInvoice(order)}
                                                >
                                                    Print
                                                </button>

                                            </div>

                                        </td>

                                    </tr>

                                );

                            })

                        )}

                    </tbody>

                </table>

            </div>

            {/* INVOICE POPUP */}

            {invoiceData && (

                <WalkInInvoice
                    order={invoiceData}
                    onClose={closeInvoice}
                />

            )}

        </div>

    );

}

export default WalkInOrders;
