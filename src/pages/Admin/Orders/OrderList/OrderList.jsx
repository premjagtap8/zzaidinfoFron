import React, { useEffect, useMemo, useState } from "react";

import "./OrderList.css";

import { useNavigate } from "react-router-dom";

import {

    getAllOrders

} from "../../../../services/orderService";

import {

    getAllBranches

} from "../../../../services/branchService";


// =====================================================
// CUSTOMER SOURCE (how the customer found us)
// value = what is stored in MongoDB (customerSource)
// Unknown values (e.g. new ones added later) still show
// up, they are just prettified automatically.
// =====================================================

const CUSTOMER_SOURCES = [

    { value: "WALK_IN", label: "Walk-in" },

    { value: "WHATSAPP", label: "WhatsApp" },

    { value: "PHONE_CALL", label: "Phone Call" },

    { value: "INSTAGRAM", label: "Instagram" },

    { value: "FACEBOOK", label: "Facebook" },

    { value: "INSTAGRAM_FACEBOOK", label: "Instagram / Facebook" },

    { value: "YOUTUBE", label: "YouTube" },

    { value: "INFLUENCER", label: "Influencer" },

    { value: "GOOGLE", label: "Google Search" },

    { value: "WEBSITE", label: "Website" },

    { value: "REFERRAL", label: "Referral" },

    { value: "REPEAT_CUSTOMER", label: "Repeat Customer" },

    { value: "OTHER", label: "Other" }

];

// Returns { value, label }. Old orders without a source show "—".
const getSourceInfo = (order) => {

    const value =
        String(order?.customerSource || "")
            .toUpperCase()
            .trim();

    if (!value) {

        return { value: "", label: "—" };

    }

    const match =
        CUSTOMER_SOURCES.find(
            (item) => item.value === value
        );

    const baseLabel =
        match?.label ||
        value
            .replaceAll("_", " ")
            .toLowerCase()
            .replace(/\b\w/g, (letter) => letter.toUpperCase());

    const other =
        String(order?.customerSourceOther || "").trim();

    return {

        value,

        label:
            value === "OTHER" && other
                ? `Other: ${other}`
                : baseLabel

    };

};

const getSourceClass = (order) => {

    const { value } = getSourceInfo(order);

    return value
        ? `source-${value.toLowerCase().replaceAll("_", "-")}`
        : "source-none";

};


// =====================================================
// ORDER TYPE (B2C / B2B)  -> order.orderType
// =====================================================

const getOrderType = (order) =>

    String(order?.orderType || "")
        .toUpperCase()
        .trim();

const getTypeClass = (order) => {

    const type = getOrderType(order);

    return type
        ? `type-${type.toLowerCase().replaceAll("_", "-")}`
        : "type-none";

};


// =====================================================
// ORDER CHANNEL (Walk-in / Online)  -> order.orderSource
// Schema enum: ONLINE | WALK_IN (default ONLINE)
// =====================================================

const ORDER_CHANNELS = [

    { value: "WALK_IN", label: "Walk-in" },

    { value: "ONLINE", label: "Online" }

];

const getChannelValue = (order) =>

    String(order?.orderSource || "")
        .toUpperCase()
        .trim();

const getChannelLabel = (value) =>

    ORDER_CHANNELS.find((item) => item.value === value)?.label ||
    (value ? prettify(value) : "—");

const getChannelClass = (order) => {

    const value = getChannelValue(order);

    return value
        ? `channel-${value.toLowerCase().replaceAll("_", "-")}`
        : "channel-none";

};


// =====================================================
// HELPERS
// =====================================================

const DEFAULT_GST_PERCENTAGE = 18; // fallback for old orders

const toNumber = (value, fallback = 0) => {

    const number = Number(value);

    return Number.isFinite(number)
        ? number
        : fallback;

};

const round2 = (value) =>

    Math.round(
        (toNumber(value) + Number.EPSILON) * 100
    ) / 100;

const money = (value) =>

    toNumber(value).toLocaleString(
        "en-IN",
        {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }
    );


// =====================================================
// FINAL TOTAL
// New orders  -> saved finalAmount
// Old orders  -> calculated from totalAmount
// =====================================================

const getFinalTotal = (order) => {

    const isNewOrder =
        order?.gstAmount !== undefined &&
        order?.gstAmount !== null &&
        order?.finalAmount !== undefined &&
        order?.finalAmount !== null;

    if (isNewOrder) {

        return round2(order.finalAmount);

    }

    // ---------- old orders ----------

    const productAmount =
        toNumber(order?.totalAmount);

    const couponDiscount =
        toNumber(order?.couponDiscount);

    const taxableAmount =
        Math.max(
            productAmount - couponDiscount,
            0
        );

    const gstPercentage =
        toNumber(
            order?.gstPercentage,
            DEFAULT_GST_PERCENTAGE
        );

    const gstAmount =
        round2(
            (taxableAmount * gstPercentage) / 100
        );

    const shippingCharge =
        toNumber(order?.shippingCharge);

    const otherCharges =
        toNumber(order?.otherCharges);

    return round2(
        taxableAmount +
        gstAmount +
        shippingCharge +
        otherCharges
    );

};


// =====================================================
// SEARCH / FILTER / SORT HELPERS
// =====================================================

const DEFAULT_ORDER_STATUSES = [

    "PENDING",
    "CONFIRMED",
    "PROCESSING",
    "SHIPPED",
    "DELIVERED",
    "CANCELLED"

];

const DEFAULT_PAYMENT_STATUSES = [

    "PENDING",
    "PAID",
    "FAILED",
    "REFUNDED"

];

const DEFAULT_ORDER_TYPES = [ "B2C", "B2B" ];

const SORT_OPTIONS = [

    { value: "DEFAULT", label: "Default order" },

    { value: "DATE_DESC", label: "Date: Newest first" },

    { value: "DATE_ASC", label: "Date: Oldest first" },

    { value: "TOTAL_DESC", label: "Total: High → Low" },

    { value: "TOTAL_ASC", label: "Total: Low → High" },

    { value: "CUSTOMER_ASC", label: "Customer: A → Z" },

    { value: "CUSTOMER_DESC", label: "Customer: Z → A" }

];

function prettify(value) {

    return String(value || "")
        .replaceAll("_", " ")
        .toLowerCase()
        .replace(/\b\w/g, (letter) => letter.toUpperCase());

}

const personName = (person) =>

    [person?.firstName, person?.lastName]
        .filter(Boolean)
        .join(" ") ||
    person?.name ||
    person?.email ||
    "";

// Name shown in the Customer column
const getCustomerName = (order) =>

    order?.user
        ? personName(order.user) || "N/A"
        : "N/A";

// { id, name } for the branch on an ORDER (populated object or plain id).
// Used only for filtering / searching, the dropdown list itself
// comes from the /branches API.
const getBranchInfo = (order) => {

    const branch = order?.branchId;

    if (branch && typeof branch === "object") {

        return {

            id: String(branch._id || branch.id || ""),

            name: String(branch.name || branch.code || "")

        };

    }

    return { id: String(branch || ""), name: "" };

};

const getSalesperson = (order) => {

    const seller = order?.soldBy;

    if (seller && typeof seller === "object") {

        return {

            id: String(seller._id || seller.id || ""),

            name: personName(seller)

        };

    }

    return { id: String(seller || ""), name: "" };

};

// Serial numbers are only searched if the API sends them
const getSerialText = (order) =>

    (order?.orderItems || [])
        .map((item) => {

            const value =
                item?.serialNumbers ??
                item?.serialNumber ??
                "";

            if (Array.isArray(value)) {

                return value
                    .map((entry) =>
                        typeof entry === "object"
                            ? entry?.serialNumber ||
                              entry?.serial ||
                              ""
                            : entry
                    )
                    .join(" ");

            }

            return String(value || "");

        })
        .join(" ");

const getSearchText = (order) => {

    const address = order?.shippingAddress || {};

    const products = (order?.orderItems || [])
        .map((item) => [
            item?.title,
            item?.product?.name,
            item?.product?.sku
        ])
        .flat();

    return [

        order?._id,

        getCustomerName(order),

        order?.user?.email,

        order?.user?.phone,

        address.fullName,

        address.phone,

        address.city,

        ...products,

        getSerialText(order),

        getBranchInfo(order).name,

        getSalesperson(order).name,

        getOrderType(order),

        getChannelLabel(getChannelValue(order)),

        getSourceInfo(order).label

    ]

        .map((value) => String(value || "").toLowerCase())

        .join(" ");

};

// Unique values from the loaded orders, joined with a default list
const mergeValues = (defaults, orders, pick) => {

    const set = new Set(defaults);

    orders.forEach((order) => {

        const value = String(pick(order) || "")
            .toUpperCase()
            .trim();

        if (value) set.add(value);

    });

    return Array.from(set);

};

const uniqueOptions = (orders, pick) => {

    const map = new Map();

    orders.forEach((order) => {

        const { id, name } = pick(order);

        if (id && name && !map.has(id)) {

            map.set(id, name);

        }

    });

    return Array.from(map, ([id, name]) => ({ id, name }))

        .sort((a, b) => a.name.localeCompare(b.name));

};

// The branches API can answer in a few shapes:
//   [ ... ]                      (array)
//   { branches: [ ... ] }
//   { data: [ ... ] }
// and axios may or may not have unwrapped the response body.
const extractBranches = (res) => {

    const body = res?.data ?? res;

    if (Array.isArray(body)) return body;

    if (Array.isArray(body?.branches)) return body.branches;

    if (Array.isArray(body?.data)) return body.data;

    if (Array.isArray(body?.data?.branches)) return body.data.branches;

    return [];

};

const sortOrders = (list, sortBy) => {

    if (sortBy === "DEFAULT") return list;

    const time = (order) =>
        new Date(order?.createdAt || 0).getTime();

    const comparators = {

        DATE_DESC: (a, b) => time(b) - time(a),

        DATE_ASC: (a, b) => time(a) - time(b),

        TOTAL_DESC: (a, b) =>
            getFinalTotal(b) - getFinalTotal(a),

        TOTAL_ASC: (a, b) =>
            getFinalTotal(a) - getFinalTotal(b),

        CUSTOMER_ASC: (a, b) =>
            getCustomerName(a)
                .toLowerCase()
                .localeCompare(
                    getCustomerName(b).toLowerCase()
                ),

        CUSTOMER_DESC: (a, b) =>
            getCustomerName(b)
                .toLowerCase()
                .localeCompare(
                    getCustomerName(a).toLowerCase()
                )

    };

    const compare = comparators[sortBy];

    return compare ? [...list].sort(compare) : list;

};


const OrderList = () => {

    const navigate = useNavigate();

    const [orders, setOrders] = useState([]);

    // Branches come from their own API (/branches)
    const [branches, setBranches] = useState([]);

    const [loading, setLoading] = useState(true);

    // Search / filter / sort state
    const [search, setSearch] = useState("");

    const [statusFilter, setStatusFilter] = useState("ALL");

    const [paymentFilter, setPaymentFilter] = useState("ALL");

    const [typeFilter, setTypeFilter] = useState("ALL");

    const [channelFilter, setChannelFilter] = useState("ALL");

    const [branchFilter, setBranchFilter] = useState("ALL");

    const [sortBy, setSortBy] = useState("DEFAULT");

    const [salespersonFilter, setSalespersonFilter] = useState("ALL");

    const [sourceFilter, setSourceFilter] = useState("ALL");

    const [dateFrom, setDateFrom] = useState("");

    const [dateTo, setDateTo] = useState("");

    const [minAmount, setMinAmount] = useState("");

    const [maxAmount, setMaxAmount] = useState("");

    const [showMoreFilters, setShowMoreFilters] = useState(false);

    useEffect(() => {

        fetchData();

    }, []);

    // Orders and branches are fetched in parallel. They are
    // independent: if /branches fails the order list still works.
    const fetchData = async () => {

        try {

            const [ordersResult, branchesResult] =
                await Promise.allSettled([
                    getAllOrders(),
                    getAllBranches()
                ]);

            if (ordersResult.status === "fulfilled") {

                console.log("All Orders :", ordersResult.value);

                setOrders(ordersResult.value?.orders || []);

            }

            else {

                console.log(
                    "Orders error:",
                    ordersResult.reason
                );

            }

            if (branchesResult.status === "fulfilled") {

                console.log("All Branches :", branchesResult.value);

                setBranches(
                    extractBranches(branchesResult.value)
                );

            }

            else {

                console.log(
                    "Branches error:",
                    branchesResult.reason
                );

            }

        }

        finally {

            setLoading(false);

        }

    };

    // ---------- dropdown options ----------

    const statusOptions = useMemo(

        () => mergeValues(
            DEFAULT_ORDER_STATUSES,
            orders,
            (order) => order.orderStatus
        ),

        [orders]

    );

    const paymentOptions = useMemo(

        () => mergeValues(
            DEFAULT_PAYMENT_STATUSES,
            orders,
            (order) => order.paymentStatus
        ),

        [orders]

    );

    const typeOptions = useMemo(

        () => mergeValues(
            DEFAULT_ORDER_TYPES,
            orders,
            (order) => order.orderType
        ),

        [orders]

    );

    const channelOptions = useMemo(

        () => mergeValues(
            ORDER_CHANNELS.map((item) => item.value),
            orders,
            (order) => order.orderSource
        ),

        [orders]

    );

    const sourceOptions = useMemo(

        () => mergeValues(
            CUSTOMER_SOURCES.map((item) => item.value),
            orders,
            (order) => order.customerSource
        ),

        [orders]

    );

    // Branch dropdown = every branch returned by the /branches API
    const branchOptions = useMemo(

        () => branches

            .map((branch) => ({

                id: String(branch?._id || branch?.id || ""),

                name: String(branch?.name || branch?.code || "")

            }))

            .filter((branch) => branch.id && branch.name)

            .sort((a, b) => a.name.localeCompare(b.name)),

        [branches]

    );

    const salespersonOptions = useMemo(

        () => uniqueOptions(orders, getSalesperson),

        [orders]

    );

    // ---------- filter + sort ----------

    const filteredOrders = useMemo(() => {

        const query = search.trim().toLowerCase();

        const from = dateFrom
            ? new Date(`${dateFrom}T00:00:00`).getTime()
            : null;

        const to = dateTo
            ? new Date(`${dateTo}T23:59:59.999`).getTime()
            : null;

        const result = orders.filter((order) => {

            if (query && !getSearchText(order).includes(query)) {

                return false;

            }

            if (
                statusFilter !== "ALL" &&
                String(order.orderStatus || "").toUpperCase() !==
                    statusFilter
            ) {

                return false;

            }

            if (
                paymentFilter !== "ALL" &&
                String(order.paymentStatus || "").toUpperCase() !==
                    paymentFilter
            ) {

                return false;

            }

            if (
                typeFilter !== "ALL" &&
                getOrderType(order) !== typeFilter
            ) {

                return false;

            }

            if (
                channelFilter !== "ALL" &&
                getChannelValue(order) !== channelFilter
            ) {

                return false;

            }

            if (
                branchFilter !== "ALL" &&
                getBranchInfo(order).id !== branchFilter
            ) {

                return false;

            }

            if (
                salespersonFilter !== "ALL" &&
                getSalesperson(order).id !== salespersonFilter
            ) {

                return false;

            }

            if (
                sourceFilter !== "ALL" &&
                getSourceInfo(order).value !== sourceFilter
            ) {

                return false;

            }

            if (from !== null || to !== null) {

                if (!order.createdAt) return false;

                const time = new Date(order.createdAt).getTime();

                if (from !== null && time < from) return false;

                if (to !== null && time > to) return false;

            }

            if (minAmount !== "" || maxAmount !== "") {

                const total = getFinalTotal(order);

                if (minAmount !== "" && total < Number(minAmount)) {

                    return false;

                }

                if (maxAmount !== "" && total > Number(maxAmount)) {

                    return false;

                }

            }

            return true;

        });

        return sortOrders(result, sortBy);

    }, [
        orders,
        search,
        statusFilter,
        paymentFilter,
        typeFilter,
        channelFilter,
        branchFilter,
        salespersonFilter,
        sourceFilter,
        dateFrom,
        dateTo,
        minAmount,
        maxAmount,
        sortBy
    ]);

    const hasActiveFilters =
        search.trim() !== "" ||
        statusFilter !== "ALL" ||
        paymentFilter !== "ALL" ||
        typeFilter !== "ALL" ||
        channelFilter !== "ALL" ||
        branchFilter !== "ALL" ||
        salespersonFilter !== "ALL" ||
        sourceFilter !== "ALL" ||
        dateFrom !== "" ||
        dateTo !== "" ||
        minAmount !== "" ||
        maxAmount !== "" ||
        sortBy !== "DEFAULT";

    // Number of filters set inside the "More filters" panel
    const moreFiltersCount =
        (salespersonFilter !== "ALL" ? 1 : 0) +
        (sourceFilter !== "ALL" ? 1 : 0) +
        (dateFrom !== "" ? 1 : 0) +
        (dateTo !== "" ? 1 : 0) +
        (minAmount !== "" ? 1 : 0) +
        (maxAmount !== "" ? 1 : 0);

    const resetFilters = () => {

        setSearch("");
        setStatusFilter("ALL");
        setPaymentFilter("ALL");
        setTypeFilter("ALL");
        setChannelFilter("ALL");
        setBranchFilter("ALL");
        setSalespersonFilter("ALL");
        setSourceFilter("ALL");
        setDateFrom("");
        setDateTo("");
        setMinAmount("");
        setMaxAmount("");
        setSortBy("DEFAULT");

    };

    if (loading) {

        return <h2>Loading...</h2>;

    }

    return (

        <div className="admin-orders">

            <h1>All Orders</h1>

            {/* ================= SEARCH + FILTERS ================= */}

            <div className="order-filters">

                <div className="order-filter-group order-filter-search">

                    <label htmlFor="order-search">Search</label>

                    <input

                        id="order-search"

                        type="text"

                        placeholder="Search customer, phone, order ID, product, SKU, branch, salesperson..."

                        value={search}

                        onChange={(event) =>
                            setSearch(event.target.value)
                        }

                    />

                </div>

                <div className="order-filter-group">

                    <label htmlFor="order-status">Order status</label>

                    <select

                        id="order-status"

                        value={statusFilter}

                        onChange={(event) =>
                            setStatusFilter(event.target.value)
                        }

                    >

                        <option value="ALL">All Status</option>

                        {statusOptions.map((value) => (

                            <option key={value} value={value}>

                                {prettify(value)}

                            </option>

                        ))}

                    </select>

                </div>

                <div className="order-filter-group">

                    <label htmlFor="order-payment">Payment</label>

                    <select

                        id="order-payment"

                        value={paymentFilter}

                        onChange={(event) =>
                            setPaymentFilter(event.target.value)
                        }

                    >

                        <option value="ALL">All Payments</option>

                        {paymentOptions.map((value) => (

                            <option key={value} value={value}>

                                {prettify(value)}

                            </option>

                        ))}

                    </select>

                </div>

                <div className="order-filter-group">

                    <label htmlFor="order-type">Order type</label>

                    <select

                        id="order-type"

                        value={typeFilter}

                        onChange={(event) =>
                            setTypeFilter(event.target.value)
                        }

                    >

                        <option value="ALL">All Types</option>

                        {typeOptions.map((value) => (

                            <option key={value} value={value}>

                                {value}

                            </option>

                        ))}

                    </select>

                </div>

                <div className="order-filter-group">

                    <label htmlFor="order-channel">Walk-in / Online</label>

                    <select

                        id="order-channel"

                        value={channelFilter}

                        onChange={(event) =>
                            setChannelFilter(event.target.value)
                        }

                    >

                        <option value="ALL">All Orders</option>

                        {channelOptions.map((value) => (

                            <option key={value} value={value}>

                                {getChannelLabel(value)}

                            </option>

                        ))}

                    </select>

                </div>

                <div className="order-filter-group">

                    <label htmlFor="order-branch">Branch</label>

                    <select

                        id="order-branch"

                        value={branchFilter}

                        onChange={(event) =>
                            setBranchFilter(event.target.value)
                        }

                    >

                        <option value="ALL">All Branches</option>

                        {branchOptions.map((option) => (

                            <option key={option.id} value={option.id}>

                                {option.name}

                            </option>

                        ))}

                    </select>

                </div>

                <div className="order-filter-group">

                    <label htmlFor="order-sort">Sort by</label>

                    <select

                        id="order-sort"

                        value={sortBy}

                        onChange={(event) =>
                            setSortBy(event.target.value)
                        }

                    >

                        {SORT_OPTIONS.map((option) => (

                            <option key={option.value} value={option.value}>

                                {option.label}

                            </option>

                        ))}

                    </select>

                </div>

                <div className="order-filter-actions">

                    <button

                        type="button"

                        className={
                            showMoreFilters || moreFiltersCount > 0
                                ? "order-more-btn active"
                                : "order-more-btn"
                        }

                        aria-expanded={showMoreFilters}

                        aria-controls="order-more-filters"

                        onClick={() =>
                            setShowMoreFilters((open) => !open)
                        }

                    >

                        More filters

                        {moreFiltersCount > 0 && (

                            <span className="order-more-badge">

                                {moreFiltersCount}

                            </span>

                        )}

                        <span aria-hidden="true">

                            {showMoreFilters ? " ▴" : " ▾"}

                        </span>

                    </button>

                    {hasActiveFilters && (

                        <button

                            type="button"

                            className="order-clear-btn"

                            onClick={resetFilters}

                        >

                            Clear filters

                        </button>

                    )}

                </div>

            </div>

            {showMoreFilters && (

                <div

                    id="order-more-filters"

                    className="order-filters order-more-panel"

                >

                    <div className="order-filter-group">

                        <label htmlFor="order-salesperson">
                            Salesperson
                        </label>

                        <select

                            id="order-salesperson"

                            value={salespersonFilter}

                            onChange={(event) =>
                                setSalespersonFilter(event.target.value)
                            }

                        >

                            <option value="ALL">All Salespersons</option>

                            {salespersonOptions.map((option) => (

                                <option key={option.id} value={option.id}>

                                    {option.name}

                                </option>

                            ))}

                        </select>

                    </div>

                    <div className="order-filter-group">

                        <label htmlFor="order-source">
                            Customer source
                        </label>

                        <select

                            id="order-source"

                            value={sourceFilter}

                            onChange={(event) =>
                                setSourceFilter(event.target.value)
                            }

                        >

                            <option value="ALL">All Sources</option>

                            {sourceOptions.map((value) => (

                                <option key={value} value={value}>

                                    {CUSTOMER_SOURCES.find(
                                        (item) => item.value === value
                                    )?.label || prettify(value)}

                                </option>

                            ))}

                        </select>

                    </div>

                    <div className="order-filter-group">

                        <label htmlFor="order-date-from">Date from</label>

                        <input

                            id="order-date-from"

                            type="date"

                            value={dateFrom}

                            max={dateTo || undefined}

                            onChange={(event) =>
                                setDateFrom(event.target.value)
                            }

                        />

                    </div>

                    <div className="order-filter-group">

                        <label htmlFor="order-date-to">Date to</label>

                        <input

                            id="order-date-to"

                            type="date"

                            value={dateTo}

                            min={dateFrom || undefined}

                            onChange={(event) =>
                                setDateTo(event.target.value)
                            }

                        />

                    </div>

                    <div className="order-filter-group">

                        <label htmlFor="order-min-amount">
                            Min total (₹)
                        </label>

                        <input

                            id="order-min-amount"

                            type="number"

                            min="0"

                            placeholder="e.g. 1000"

                            value={minAmount}

                            onChange={(event) =>
                                setMinAmount(event.target.value)
                            }

                        />

                    </div>

                    <div className="order-filter-group">

                        <label htmlFor="order-max-amount">
                            Max total (₹)
                        </label>

                        <input

                            id="order-max-amount"

                            type="number"

                            min="0"

                            placeholder="e.g. 50000"

                            value={maxAmount}

                            onChange={(event) =>
                                setMaxAmount(event.target.value)
                            }

                        />

                    </div>

                </div>

            )}

            <div className="order-result-count">

                Showing {filteredOrders.length} of {orders.length} orders

            </div>

            <div className="order-table-wrapper">

                <table>

                    <thead>

                        <tr>

                            <th>Customer</th>

                            <th>Order Type</th>

                            <th>Walk-in / Online</th>

                            <th>Source</th>

                            <th>Branch</th>

                            <th>Total</th>

                            <th>Order Status</th>

                            <th>Payment</th>

                            <th>Date</th>

                            <th>Action</th>

                        </tr>

                    </thead>

                    <tbody>

                        {

                            filteredOrders.length === 0 ?

                                (

                                    <tr>

                                        <td colSpan="10">

                                            No Orders Found

                                        </td>

                                    </tr>

                                )

                                :

                                (

                                    filteredOrders.map(order => (

                                        <tr key={order._id}>

                                            <td>

                                                {getCustomerName(order)}

                                            </td>

                                            <td>

                                                <span

                                                    className={`type-badge ${getTypeClass(order)}`}

                                                >

                                                    {getOrderType(order) || "—"}

                                                </span>

                                            </td>

                                            <td>

                                                <span

                                                    className={`channel-badge ${getChannelClass(order)}`}

                                                >

                                                    {getChannelLabel(getChannelValue(order))}

                                                </span>

                                            </td>

                                            <td>

                                                <span

                                                    className={`source-badge ${getSourceClass(order)}`}

                                                    title={getSourceInfo(order).label}

                                                >

                                                    {getSourceInfo(order).label}

                                                </span>

                                            </td>

                                            <td>

                                                {getBranchInfo(order).name || "—"}

                                            </td>

                                            <td>

                                                ₹ {money(getFinalTotal(order))}

                                            </td>

                                            <td>

                                                {order.orderStatus}

                                            </td>

                                            <td>

                                                {order.paymentStatus}

                                            </td>

                                            <td>

                                                {

                                                    new Date(

                                                        order.createdAt

                                                    ).toLocaleDateString()

                                                }

                                            </td>

                                            <td>

                                                <button

                                                    className="view-btn"

                                                    onClick={() =>

                                                        navigate(

                                                            `/admin/orders/${order._id}`

                                                        )

                                                    }

                                                >

                                                    View

                                                </button>

                                            </td>

                                        </tr>

                                    ))

                                )

                        }

                    </tbody>

                </table>

            </div>

        </div>

    );

};

export default OrderList;
