import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./WalkInRentalOrders.css";

import { getAllRentals } from "../../services/rentalApi";

// NOTE: same services WalkInOrders uses. The path starts with
// ../../ because this file is one folder shallower than
// WalkInOrders (which uses ../../../). Adjust if yours differs.
import { getAllBranches } from "../../services/branchService";
import { getEmployees } from "../../services/userService";

// NEW: used to fill the "Laptop / product" dropdown with
// products whose productType is RENTAL
import { getProducts } from "../../services/productService";


// ======================================================
// CUSTOMER SOURCE
// "How did you come to know about ZAID Infotech?"
//
// KEY   -> saved in the database (never change a key later)
// LABEL -> shown to the user / used in reports
// ======================================================

const CUSTOMER_SOURCES = {
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


// =====================================================
// FILTER DEFAULTS
// =====================================================

const EMPTY_FILTERS = {
    search: "",
    dateFrom: "",
    dateTo: "",
    branch: "",
    salesperson: "",
    product: "",
    status: "",
    depositStatus: "",
    customerType: "",
    source: "",
};

// Statuses that are always listed in the Status dropdown,
// plus any other status already present on the rentals
const KNOWN_STATUSES = [
    "PENDING",
    "DOCUMENT_VERIFICATION",
    "APPROVED",
    "DEPOSIT_PENDING",
    "READY_FOR_ALLOCATION",
    "ACTIVE",
    "RETURN_REQUESTED",
    "SETTLEMENT_PENDING",
    "RETURNED",
    "COMPLETED",
    "REJECTED",
    "CANCELLED",
];

const DEPOSIT_STATUSES = ["PAID", "PARTIAL", "UNPAID"];

const CUSTOMER_TYPES = ["INDIVIDUAL", "COMPANY"];


// =====================================================
// SMALL HELPERS (outside the component)
// =====================================================

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

// Role text of an employee. Handles a string ("SALES"),
// an object ({ name: "Sales" }) or an array of either.
// NOTE: if your employee role is stored under a different
// field, add it to the list below.
const getRoleText = (person) => {
    if (!person || typeof person !== "object") {
        return "";
    }

    const raw =
        person.role ??
        person.roles ??
        person.userRole ??
        person.designation;

    return (Array.isArray(raw) ? raw : [raw])
        .map((r) =>
            r && typeof r === "object"
                ? firstText(r.name, r.title, r.role)
                : String(r || "")
        )
        .join(" ")
        .toLowerCase();
};

// True for roles like SALES, SALESPERSON, SALES_EXECUTIVE
const isSalesPerson = (person) =>
    getRoleText(person).includes("sales");

// NEW: True only for products saved with productType RENTAL
// (and not soft-deleted)
const isRentalProduct = (product) =>
    String(product?.productType || "")
        .trim()
        .toUpperCase() === "RENTAL" &&
    !product?.isDeleted;

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

// Pull a list out of many possible API response shapes
const extractList = (response, ...keys) => {
    if (Array.isArray(response)) return response;

    for (const key of keys) {
        if (Array.isArray(response?.[key])) return response[key];
        if (Array.isArray(response?.data?.[key])) return response.data[key];
    }

    if (Array.isArray(response?.data)) return response.data;
    if (Array.isArray(response?.data?.data)) return response.data.data;

    return [];
};

// A field can be a populated object OR just an id string.
// Object -> read the name from it. String id -> find it in `list`.
const refName = (ref, list, getName) => {
    if (!ref) return "";

    if (typeof ref === "object") return getName(ref);

    const found = list.find(
        (item) => String(item?._id) === String(ref)
    );

    return found ? getName(found) : "";
};

const pretty = (value) =>
    String(value || "")
        .replace(/_/g, " ")
        .toLowerCase()
        .replace(/\b\w/g, (c) => c.toUpperCase());


// =====================================================
// SORTABLE HEADER
// Defined OUTSIDE the main component so React does not
// remount it on every render.
// =====================================================

function SortableTh({ label, sortKey, sort, onSort }) {
    const active = sort.key === sortKey;

    return (
        <th
            className="sortable"
            onClick={() => onSort(sortKey)}
            aria-sort={
                active
                    ? sort.direction === "asc"
                        ? "ascending"
                        : "descending"
                    : "none"
            }
        >
            {label}
            <span
                className={`sort-arrow ${active ? "active" : ""}`}
            >
                {active
                    ? sort.direction === "asc"
                        ? " ▲"
                        : " ▼"
                    : " ↕"}
            </span>
        </th>
    );
}


function WalkInRentalOrders() {
    const navigate = useNavigate();

    const [rentals, setRentals] = useState([]);

    // Full lists from the branches / employees / products APIs
    const [branchList, setBranchList] = useState([]);
    const [employeeList, setEmployeeList] = useState([]);

    // NEW: products from the products API (filtered to RENTAL later)
    const [productList, setProductList] = useState([]);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    // =====================================================
    // FILTER + SORT STATE
    // =====================================================

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

    const NUMERIC_OR_DATE_SORTS = [
        "date",
        "monthlyRent",
        "deposit",
        "depositPaid",
        "total",
    ];

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
                    direction: NUMERIC_OR_DATE_SORTS.includes(key)
                        ? "desc"
                        : "asc",
                }
        );
    };

    // =====================================================
    // LOAD RENTALS
    // =====================================================

    useEffect(() => {
        loadWalkInRentals();
        loadBranches();
        loadEmployees();
        loadProducts();
    }, []);

    // Same API Branch Management / WalkInOrders uses.
    // Not fatal if it fails: dropdown falls back to rentals.
    const loadBranches = async () => {
        try {
            const res = await getAllBranches();

            setBranchList(
                extractList(res, "branches").filter(
                    (b) =>
                        !b?.isDeleted &&
                        String(b?.status || "ACTIVE").toUpperCase() === "ACTIVE"
                )
            );
        } catch (err) {
            console.error("LOAD BRANCHES ERROR:", err);
        }
    };

    // Role-protected route: a 403 just means we fall back to rentals.
    const loadEmployees = async () => {
        try {
            const res = await getEmployees();

            setEmployeeList(extractList(res, "employees", "users"));
        } catch (err) {
            console.error("LOAD EMPLOYEES ERROR:", err);
        }
    };

    // NEW: loads products for the "Laptop / product" dropdown.
    // Not fatal if it fails: dropdown falls back to the product
    // names found on the loaded rentals (old behaviour).
    const loadProducts = async () => {
        try {
            const res = await getProducts();

            setProductList(extractList(res, "products", "items"));
        } catch (err) {
            console.error("LOAD PRODUCTS ERROR:", err);
        }
    };

    const loadWalkInRentals = async () => {
        try {
            setLoading(true);
            setError("");

            const response = await getAllRentals();

            let list = [];

            // ---------------------------------------------
            // SUPPORT MULTIPLE RESPONSE STRUCTURES
            // ---------------------------------------------

            if (Array.isArray(response)) {
                list = response;
            } else if (Array.isArray(response?.rentals)) {
                list = response.rentals;
            } else if (Array.isArray(response?.data)) {
                list = response.data;
            } else if (Array.isArray(response?.data?.rentals)) {
                list = response.data.rentals;
            } else if (Array.isArray(response?.data?.data)) {
                list = response.data.data;
            } else if (Array.isArray(response?.result)) {
                list = response.result;
            } else if (Array.isArray(response?.data?.result)) {
                list = response.data.result;
            }

            // ---------------------------------------------
            // ONLY WALK-IN RENTALS
            // ---------------------------------------------

            const walkInRentals = list.filter((rental) => {
                return (
                    String(rental?.rentalSource || "")
                        .trim()
                        .toUpperCase() === "WALK_IN"
                );
            });

            setRentals(walkInRentals);
        } catch (err) {
            console.error("WALK-IN RENTALS ERROR:", err);

            setError(
                err?.response?.data?.message ||
                err?.message ||
                "Failed to load walk-in rental orders"
            );

            setRentals([]);
        } finally {
            setLoading(false);
        }
    };

    // =====================================================
    // CUSTOMER NAME
    // =====================================================

    const getCustomerName = (rental) => {
        if (
            String(rental?.customerType || "")
                .toUpperCase() === "COMPANY"
        ) {
            return (
                rental?.companyDetails?.contactPerson ||
                rental?.companyDetails?.companyName ||
                "Company Customer"
            );
        }

        return (
            rental?.individualDetails?.fullName ||
            rental?.customer?.name ||
            rental?.customer?.fullName ||
            "Walk-In Customer"
        );
    };

    // =====================================================
    // CUSTOMER TYPE (INDIVIDUAL / COMPANY)
    // =====================================================

    const getCustomerType = (rental) => {
        return String(
            rental?.customerType || "INDIVIDUAL"
        ).toUpperCase();
    };

    // =====================================================
    // PHONE
    // =====================================================

    const getCustomerPhone = (rental) => {
        if (
            String(rental?.customerType || "")
                .toUpperCase() === "COMPANY"
        ) {
            return (
                rental?.companyDetails?.phone ||
                "-"
            );
        }

        return (
            rental?.individualDetails?.phone ||
            rental?.customer?.phone ||
            "-"
        );
    };

    // =====================================================
    // EMAIL
    // =====================================================

    const getCustomerEmail = (rental) => {
        if (
            String(rental?.customerType || "")
                .toUpperCase() === "COMPANY"
        ) {
            return (
                rental?.companyDetails?.email ||
                "-"
            );
        }

        return (
            rental?.individualDetails?.email ||
            rental?.customer?.email ||
            "-"
        );
    };

    // =====================================================
    // BRANCH
    //
    // NOTE: field names are best guesses (same as the
    // Walk-In Orders page). If your rental object uses
    // different names, change ONLY this function.
    // =====================================================

    const getBranch = (rental) => {
        const byName = (b) => firstText(b?.name);

        return (
            refName(rental?.branchId, branchList, byName) ||
            refName(rental?.branch, branchList, byName) ||
            firstText(rental?.branchName)
        );
    };

    // =====================================================
    // SALESPERSON
    //
    // NOTE: best guesses. Change ONLY this function if your
    // rental stores the staff member under another field.
    // =====================================================

    const getSalesperson = (rental) => {
        const candidates = [
            rental?.soldBy,
            rental?.salesperson,
            rental?.salesPerson,
            rental?.createdBy,
            rental?.handledBy,
            rental?.staff,
            rental?.employee,
        ];

        for (const ref of candidates) {
            const name = refName(ref, employeeList, getPersonName);

            if (name) return name;
        }

        return firstText(rental?.salespersonName);
    };

    // =====================================================
    // SERIAL NUMBER (of the allocated laptop)
    //
    // NOTE: best guesses. Change ONLY this function if your
    // rental stores the serial number somewhere else.
    // =====================================================

    const getSerialNumber = (rental) => {
        return firstText(
            rental?.serialNumber,
            rental?.assignedSerialNumber,
            rental?.laptopSerialNumber,
            rental?.assignedAsset?.serialNumber,
            rental?.inventoryItem?.serialNumber,
            rental?.rentalProduct?.serialNumber
        );
    };

    // =====================================================
    // CUSTOMER SOURCE
    // "How did the customer come to know about us?"
    //
    // Returns { label, detail }
    // - label  = readable source name
    // - detail = free text, only when source is OTHER
    // =====================================================

    const getCustomerSource = (rental) => {
        const key = String(
            rental?.customerSource || ""
        )
            .trim()
            .toUpperCase();

        if (!key) {
            return {
                label: "",
                detail: "",
            };
        }

        const label =
            CUSTOMER_SOURCES[key] ||
            key;

        const detail =
            key === "OTHER"
                ? String(
                    rental?.customerSourceOther || ""
                ).trim()
                : "";

        return {
            label,
            detail,
        };
    };

    // =====================================================
    // PRODUCT NAME
    // =====================================================

    const getProductName = (rental) => {
        return (
            rental?.product?.name ||
            rental?.product?.title ||
            rental?.rentalProduct?.product?.name ||
            rental?.rentalProduct?.product?.title ||
            rental?.rentalProduct?.name ||
            "Rental Product"
        );
    };

    // =====================================================
    // BRAND
    // =====================================================

    const getBrandName = (rental) => {
        const brand =
            rental?.product?.brand ||
            rental?.rentalProduct?.product?.brand;

        if (typeof brand === "object" && brand !== null) {
            return (
                brand?.name ||
                brand?.title ||
                ""
            );
        }

        return brand || "";
    };

    // =====================================================
    // MONGODB RENTAL ID
    // =====================================================

    const getRentalId = (rental) => {
        return (
            rental?._id ||
            rental?.id ||
            rental?.rentalId ||
            ""
        );
    };

    // =====================================================
    // RENTAL NUMBER
    // =====================================================

    const getRentalNumber = (rental) => {
        return (
            rental?.rentalNumber ||
            rental?.rentalNo ||
            rental?.rental_number ||
            getRentalId(rental)
        );
    };

    // =====================================================
    // MONTHLY RENT
    // =====================================================

    const getMonthlyRent = (rental) => {
        return Number(
            rental?.monthlyRent ??
            rental?.rentalProduct?.monthlyRent ??
            0
        );
    };

    // =====================================================
    // RENTAL DURATION TYPE
    // =====================================================

    const getRentalDurationType = (rental) => {
        return String(
            rental?.rentalDurationType ||
            "MONTHS"
        ).toUpperCase();
    };

    // =====================================================
    // RENTAL DURATION
    // =====================================================

    const getRentalDuration = (rental) => {
        const type =
            getRentalDurationType(rental);

        const duration = Number(
            rental?.rentalDuration ??
            rental?.rentalMonths ??
            1
        );

        return {
            value: duration,
            type:
                type === "DAYS"
                    ? "days"
                    : "months",
        };
    };

    // =====================================================
    // SECURITY DEPOSIT
    // =====================================================

    const getSecurityDeposit = (rental) => {
        return Number(
            rental?.securityDeposit ?? 0
        );
    };

    // =====================================================
    // ACTUAL DEPOSIT PAID
    // =====================================================

    const getDepositAmountPaid = (rental) => {
        const possiblePaidAmounts = [
            rental?.depositAmountPaid,
            rental?.depositPaid,
            rental?.securityDepositPaid,
            rental?.paidDeposit,
            rental?.deposit?.paidAmount,
            rental?.deposit?.amountPaid,
            rental?.payment?.depositAmount,
            rental?.payment?.amount,
        ];

        for (const amount of possiblePaidAmounts) {
            if (
                amount !== undefined &&
                amount !== null &&
                amount !== "" &&
                typeof amount !== "boolean" &&
                !Number.isNaN(Number(amount))
            ) {
                return Number(amount);
            }
        }

        return 0;
    };

    // =====================================================
    // DEPOSIT STATUS
    // =====================================================

    const getDepositPaymentStatus = (rental) => {
        const expected = getSecurityDeposit(rental);
        const paid = getDepositAmountPaid(rental);

        // Backend direct status, if available
        const backendStatus = String(
            rental?.depositPaymentStatus ||
            rental?.depositStatus ||
            rental?.securityDepositStatus ||
            ""
        )
            .trim()
            .toUpperCase();

        if (backendStatus === "PAID") {
            return "PAID";
        }

        if (backendStatus === "PARTIAL") {
            return "PARTIAL";
        }

        // No expected deposit
        if (expected <= 0) {
            return paid > 0 ? "PAID" : "UNPAID";
        }

        // Actual status from amounts
        if (paid >= expected) {
            return "PAID";
        }

        if (paid > 0) {
            return "PARTIAL";
        }

        return "UNPAID";
    };

    // =====================================================
    // GST
    // =====================================================

    const getGSTPercentage = (rental) => {
        return Number(
            rental?.gstPercentage ??
            rental?.gst ??
            0
        );
    };

    // =====================================================
    // TOTAL RENT
    // =====================================================

    const getTotalRent = (rental) => {
        const monthlyRent =
            getMonthlyRent(rental);

        const type =
            getRentalDurationType(rental);

        const duration = Number(
            rental?.rentalDuration ??
            rental?.rentalMonths ??
            1
        );

        // DAILY RENT
        if (type === "DAYS") {
            return (
                (monthlyRent / 30) *
                duration
            );
        }

        // MONTHLY RENT
        return (
            monthlyRent *
            duration
        );
    };

    // =====================================================
    // GST AMOUNT
    // =====================================================

    const getGSTAmount = (rental) => {
        const totalRent =
            getTotalRent(rental);

        const gstPercentage =
            getGSTPercentage(rental);

        return (
            totalRent *
            gstPercentage /
            100
        );
    };

    // =====================================================
    // TOTAL WITH GST
    // =====================================================

    const getTotalWithGST = (rental) => {
        return (
            getTotalRent(rental) +
            getGSTAmount(rental)
        );
    };

    // =====================================================
    // STATUS
    // =====================================================

    const getStatus = (rental) => {
        return String(
            rental?.status || "PENDING"
        ).toUpperCase();
    };

    // =====================================================
    // STATUS CLASS
    // =====================================================

    const getStatusClass = (status) => {
        switch (
            String(status || "")
                .toUpperCase()
        ) {
            case "ACTIVE":
                return "active";

            case "RETURNED":
                return "returned";

            case "COMPLETED":
                return "completed";

            case "PENDING":
            case "DOCUMENT_VERIFICATION":
            case "APPROVED":
            case "DEPOSIT_PENDING":
            case "READY_FOR_ALLOCATION":
            case "RETURN_REQUESTED":
            case "SETTLEMENT_PENDING":
                return "pending";

            case "REJECTED":
            case "CANCELLED":
                return "cancelled";

            default:
                return "default";
        }
    };

    // =====================================================
    // DEPOSIT STATUS CLASS
    // =====================================================

    const getDepositStatusClass = (status) => {
        switch (
            String(status || "")
                .toUpperCase()
        ) {
            case "PAID":
                return "deposit-paid";

            case "PARTIAL":
                return "deposit-partial";

            case "UNPAID":
            default:
                return "deposit-unpaid";
        }
    };

    // =====================================================
    // FORMAT MONEY
    // =====================================================

    const formatMoney = (value) => {
        return Number(
            value || 0
        ).toLocaleString(
            "en-IN",
            {
                maximumFractionDigits: 2,
            }
        );
    };

    // =====================================================
    // DROPDOWN OPTIONS
    // Built from the rentals that were loaded
    // =====================================================

    const options = useMemo(() => {
        // NEW: names of products whose productType is RENTAL
        const rentalProductNames = uniqueSorted(
            productList
                .filter(isRentalProduct)
                .map((p) => firstText(p?.name))
        );

        return {
            // Branches API + branches seen on rentals
            branches: uniqueSorted([
                ...branchList.map((b) => firstText(b?.name)),
                ...rentals.map(getBranch),
            ]),

            // Only employees who have the sales role
            salespersons: uniqueSorted(
                employeeList
                    .filter(isSalesPerson)
                    .map(getPersonName)
            ),

            // CHANGED: only RENTAL type products.
            // If the products API gave no rental products (failed
            // or none exist), fall back to the old behaviour so the
            // dropdown is never empty when rentals exist.
            products:
                rentalProductNames.length > 0
                    ? rentalProductNames
                    : uniqueSorted(rentals.map(getProductName)),

            // Known statuses + any other status found on the rentals
            statuses: uniqueSorted([
                ...KNOWN_STATUSES,
                ...rentals.map(getStatus),
            ]),

            // All client-defined sources (in the client's order),
            // plus any unknown source value already saved on a rental
            sources: [
                ...Object.values(CUSTOMER_SOURCES),
                ...uniqueSorted(
                    rentals
                        .map((rental) => getCustomerSource(rental).label)
                        .filter(
                            (label) =>
                                !Object.values(CUSTOMER_SOURCES).includes(label)
                        )
                ),
            ],
        };
    }, [rentals, branchList, employeeList, productList]); // eslint-disable-line react-hooks/exhaustive-deps

    // =====================================================
    // SORT VALUES
    // =====================================================

    const getSortValue = (rental, key) => {
        switch (key) {
            case "number":
                return String(
                    getRentalNumber(rental)
                ).toLowerCase();

            case "customer":
                return getCustomerName(rental).toLowerCase();

            case "branch":
                return getBranch(rental).toLowerCase();

            case "salesperson":
                return getSalesperson(rental).toLowerCase();

            case "product":
                return getProductName(rental).toLowerCase();

            case "monthlyRent":
                return getMonthlyRent(rental);

            case "deposit":
                return getSecurityDeposit(rental);

            case "depositPaid":
                return getDepositAmountPaid(rental);

            case "total":
                return getTotalWithGST(rental);

            case "status":
                return getStatus(rental);

            case "date":
            default:
                return (
                    new Date(rental?.createdAt).getTime() || 0
                );
        }
    };

    // =====================================================
    // FILTER + SORT (one place, always combined)
    // =====================================================

    const filteredRentals = useMemo(() => {
        const keyword = filters.search.trim().toLowerCase();

        const result = rentals.filter((rental) => {
            // ---- search ----
            if (keyword) {
                const source = getCustomerSource(rental);

                const haystack = [
                    getRentalId(rental),
                    getRentalNumber(rental),
                    getCustomerName(rental),
                    getCustomerPhone(rental),
                    getCustomerEmail(rental),
                    getProductName(rental),
                    getBrandName(rental),
                    getSerialNumber(rental),
                    getBranch(rental),
                    getSalesperson(rental),
                    getStatus(rental),
                    source.label,
                    source.detail,
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
                const key = toDateKey(rental?.createdAt);

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
                getBranch(rental) !== filters.branch
            ) return false;

            if (
                filters.salesperson &&
                getSalesperson(rental) !== filters.salesperson
            ) return false;

            if (
                filters.product &&
                getProductName(rental) !== filters.product
            ) return false;

            if (
                filters.status &&
                getStatus(rental) !== filters.status
            ) return false;

            if (
                filters.depositStatus &&
                getDepositPaymentStatus(rental) !== filters.depositStatus
            ) return false;

            if (
                filters.customerType &&
                getCustomerType(rental) !== filters.customerType
            ) return false;

            if (
                filters.source &&
                getCustomerSource(rental).label !== filters.source
            ) return false;

            return true;
        });

        // ---- sort ----
        const factor = sort.direction === "asc" ? 1 : -1;

        return [...result].sort((a, b) => {
            const va = getSortValue(a, sort.key);
            const vb = getSortValue(b, sort.key);

            if (va < vb) return -1 * factor;
            if (va > vb) return 1 * factor;

            return 0;
        });
    }, [rentals, branchList, employeeList, filters, sort]); // eslint-disable-line react-hooks/exhaustive-deps

    const activeFilterCount = Object.values(filters).filter(Boolean).length;

    // =====================================================
    // SUMMARY (follows the filtered list)
    // =====================================================

    const totalRent =
        filteredRentals.reduce(
            (sum, rental) =>
                sum +
                getTotalWithGST(rental),
            0
        );

    const totalDeposit =
        filteredRentals.reduce(
            (sum, rental) =>
                sum +
                getSecurityDeposit(rental),
            0
        );

    const totalDepositPaid =
        filteredRentals.reduce(
            (sum, rental) =>
                sum +
                getDepositAmountPaid(rental),
            0
        );

    const activeRentals =
        filteredRentals.filter(
            (rental) =>
                getStatus(rental) ===
                "ACTIVE"
        ).length;

    // =====================================================
    // VIEW
    // =====================================================

    const viewRental = (rental) => {
        const rentalId =
            getRentalId(rental);

        if (!rentalId) {
            console.error(
                "Rental ID missing:",
                rental
            );

            return;
        }

        navigate(
            `/receptionist-dashboard/rental/orders/${rentalId}`,
            {
                state: {
                    rental,
                },
            }
        );
    };

    // =====================================================
    // NEW RENTAL
    // =====================================================

    const createNewRental = () => {
        navigate(
            "/receptionist-dashboard/rental/new"
        );
    };

    // =====================================================
    // INVOICE
    // =====================================================

    const printInvoice = (rental) => {
        const rentalId =
            getRentalId(rental);

        if (!rentalId) {
            alert(
                "Rental ID not found"
            );

            return;
        }

        navigate(
            `/receptionist-dashboard/walk-in-invoice/${rentalId}`,
            {
                state: {
                    rental,
                },
            }
        );
    };

    // =====================================================
    // RETURN
    // =====================================================

    const returnRental = (rental) => {
        const rentalId =
            getRentalId(rental);

        if (!rentalId) {
            console.error(
                "Rental ID missing:",
                rental
            );

            return;
        }

        navigate(
            `/receptionist-dashboard/rental/orders/${rentalId}/return`,
            {
                state: {
                    rental,
                },
            }
        );
    };

    const COLUMN_COUNT = 15;

    // =====================================================
    // RENDER
    // =====================================================

    return (
        <div className="walkin-rental-orders-page">

            {/* =========================================
                HEADER
            ========================================== */}

            <div className="rental-orders-header">

                <div>
                    <h2>
                        Walk-In Rental Orders
                    </h2>

                    <p>
                        Manage all walk-in laptop
                        rental customers
                    </p>
                </div>

                <button
                    className="new-rental-btn"
                    onClick={createNewRental}
                >
                    + New Walk-In Rental
                </button>

            </div>

            {/* =========================================
                ERROR
            ========================================== */}

            {error && (
                <div className="rental-error-box">
                    {error}
                </div>
            )}

            {/* =========================================
                FILTERS
            ========================================== */}

            <div className="rental-filter-panel">

                <div className="rental-filter-search-row">

                    <input
                        type="text"
                        className="rental-filter-search"
                        placeholder="Search customer, phone, rental number, laptop, serial number, salesperson, source"
                        value={filters.search}
                        onChange={(e) =>
                            setFilter("search", e.target.value)
                        }
                    />

                    <button
                        type="button"
                        className="rental-clear-btn"
                        onClick={clearFilters}
                        disabled={activeFilterCount === 0}
                    >
                        Clear filters
                        {activeFilterCount > 0 &&
                            ` (${activeFilterCount})`}
                    </button>

                    <button
                        type="button"
                        className="refresh-btn"
                        onClick={loadWalkInRentals}
                        disabled={loading}
                    >
                        {loading
                            ? "Loading..."
                            : "Refresh"}
                    </button>

                </div>

                <div className="rental-filter-grid">

                    <label className="rental-filter-field">
                        <span>From date</span>
                        <input
                            type="date"
                            value={filters.dateFrom}
                            max={filters.dateTo || undefined}
                            onChange={(e) =>
                                setFilter("dateFrom", e.target.value)
                            }
                        />
                    </label>

                    <label className="rental-filter-field">
                        <span>To date</span>
                        <input
                            type="date"
                            value={filters.dateTo}
                            min={filters.dateFrom || undefined}
                            onChange={(e) =>
                                setFilter("dateTo", e.target.value)
                            }
                        />
                    </label>

                    <label className="rental-filter-field">
                        <span>Branch</span>
                        <select
                            value={filters.branch}
                            onChange={(e) =>
                                setFilter("branch", e.target.value)
                            }
                        >
                            <option value="">All branches</option>
                            {options.branches.map((b) => (
                                <option key={b} value={b}>{b}</option>
                            ))}
                        </select>
                    </label>

                    <label className="rental-filter-field">
                        <span>Salesperson</span>
                        <select
                            value={filters.salesperson}
                            onChange={(e) =>
                                setFilter("salesperson", e.target.value)
                            }
                        >
                            <option value="">All salespersons</option>
                            {options.salespersons.map((s) => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>
                    </label>

                    <label className="rental-filter-field">
                        <span>Laptop / product</span>
                        <select
                            value={filters.product}
                            onChange={(e) =>
                                setFilter("product", e.target.value)
                            }
                        >
                            <option value="">All laptops</option>
                            {options.products.map((p) => (
                                <option key={p} value={p}>{p}</option>
                            ))}
                        </select>
                    </label>

                    <label className="rental-filter-field">
                        <span>Rental status</span>
                        <select
                            value={filters.status}
                            onChange={(e) =>
                                setFilter("status", e.target.value)
                            }
                        >
                            <option value="">All statuses</option>
                            {options.statuses.map((s) => (
                                <option key={s} value={s}>
                                    {pretty(s)}
                                </option>
                            ))}
                        </select>
                    </label>

                    <label className="rental-filter-field">
                        <span>Deposit payment</span>
                        <select
                            value={filters.depositStatus}
                            onChange={(e) =>
                                setFilter("depositStatus", e.target.value)
                            }
                        >
                            <option value="">All deposits</option>
                            {DEPOSIT_STATUSES.map((s) => (
                                <option key={s} value={s}>
                                    {pretty(s)}
                                </option>
                            ))}
                        </select>
                    </label>

                    <label className="rental-filter-field">
                        <span>Customer type</span>
                        <select
                            value={filters.customerType}
                            onChange={(e) =>
                                setFilter("customerType", e.target.value)
                            }
                        >
                            <option value="">All types</option>
                            {CUSTOMER_TYPES.map((t) => (
                                <option key={t} value={t}>
                                    {pretty(t)}
                                </option>
                            ))}
                        </select>
                    </label>

                    <label className="rental-filter-field">
                        <span>Customer source</span>
                        <select
                            value={filters.source}
                            onChange={(e) =>
                                setFilter("source", e.target.value)
                            }
                        >
                            <option value="">All sources</option>
                            {options.sources.map((s) => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>
                    </label>

                </div>

                <div className="rental-result-count">
                    Showing {filteredRentals.length} of {rentals.length} rentals
                </div>

            </div>

            {/* =========================================
                SUMMARY
            ========================================== */}

            <div className="rental-summary-box">

                <div className="rental-summary-card">
                    <h3>{filteredRentals.length}</h3>
                    <p>Total Rentals</p>
                </div>

                <div className="rental-summary-card">
                    <h3>{activeRentals}</h3>
                    <p>Active Rentals</p>
                </div>

                <div className="rental-summary-card">
                    <h3>₹ {formatMoney(totalRent)}</h3>
                    <p>Rental Amount + GST</p>
                </div>

                <div className="rental-summary-card">
                    <h3>₹ {formatMoney(totalDeposit)}</h3>
                    <p>Security Deposit</p>
                </div>

                <div className="rental-summary-card">
                    <h3>₹ {formatMoney(totalDepositPaid)}</h3>
                    <p>Deposit Collected</p>
                </div>

            </div>

            {/* =========================================
                TABLE
            ========================================== */}

            <div className="rental-orders-table-wrapper">

                <table className="rental-orders-table">

                    <thead>

                        <tr>

                            <SortableTh
                                label="Rental ID"
                                sortKey="number"
                                sort={sort}
                                onSort={toggleSort}
                            />

                            <SortableTh
                                label="Date"
                                sortKey="date"
                                sort={sort}
                                onSort={toggleSort}
                            />

                            <SortableTh
                                label="Customer"
                                sortKey="customer"
                                sort={sort}
                                onSort={toggleSort}
                            />

                            <th>Phone</th>

                            <SortableTh
                                label="Branch"
                                sortKey="branch"
                                sort={sort}
                                onSort={toggleSort}
                            />

                            <SortableTh
                                label="Salesperson"
                                sortKey="salesperson"
                                sort={sort}
                                onSort={toggleSort}
                            />

                            <th>Customer Source</th>

                            <SortableTh
                                label="Laptop"
                                sortKey="product"
                                sort={sort}
                                onSort={toggleSort}
                            />

                            <th>Duration</th>

                            <SortableTh
                                label="Monthly Rent"
                                sortKey="monthlyRent"
                                sort={sort}
                                onSort={toggleSort}
                            />

                            <SortableTh
                                label="Deposit"
                                sortKey="deposit"
                                sort={sort}
                                onSort={toggleSort}
                            />

                            <SortableTh
                                label="Deposit Paid"
                                sortKey="depositPaid"
                                sort={sort}
                                onSort={toggleSort}
                            />

                            <SortableTh
                                label="Total"
                                sortKey="total"
                                sort={sort}
                                onSort={toggleSort}
                            />

                            <SortableTh
                                label="Status"
                                sortKey="status"
                                sort={sort}
                                onSort={toggleSort}
                            />

                            <th>Action</th>

                        </tr>

                    </thead>

                    <tbody>

                        {loading ? (

                            <tr>
                                <td
                                    colSpan={COLUMN_COUNT}
                                    className="table-message"
                                >
                                    Loading Walk-In Rentals...
                                </td>
                            </tr>

                        ) : filteredRentals.length === 0 ? (

                            <tr>
                                <td
                                    colSpan={COLUMN_COUNT}
                                    className="table-message"
                                >
                                    {rentals.length === 0
                                        ? "No Walk-In Rental Orders Found"
                                        : "No rentals match these filters. Try clearing some filters."}
                                </td>
                            </tr>

                        ) : (

                            filteredRentals.map((rental) => {

                                const rentalId = getRentalId(rental);

                                const status = getStatus(rental);

                                const duration = getRentalDuration(rental);

                                const deposit = getSecurityDeposit(rental);

                                const depositPaid = getDepositAmountPaid(rental);

                                const depositStatus = getDepositPaymentStatus(rental);

                                const source = getCustomerSource(rental);

                                const branch = getBranch(rental);

                                const salesperson = getSalesperson(rental);

                                const serial = getSerialNumber(rental);

                                return (
                                    <tr key={rentalId}>

                                        {/* RENTAL NUMBER */}

                                        <td>
                                            <strong>
                                                #
                                                {String(
                                                    getRentalNumber(rental)
                                                ).slice(-12)}
                                            </strong>
                                        </td>

                                        {/* DATE */}

                                        <td>
                                            {rental?.createdAt
                                                ? new Date(
                                                    rental.createdAt
                                                ).toLocaleDateString("en-IN")
                                                : "-"}
                                        </td>

                                        {/* CUSTOMER */}

                                        <td>
                                            <div className="customer-cell">
                                                <strong>
                                                    {getCustomerName(rental)}
                                                </strong>

                                                <small>
                                                    {getCustomerType(rental)}
                                                </small>
                                            </div>
                                        </td>

                                        {/* PHONE */}

                                        <td>{getCustomerPhone(rental)}</td>

                                        {/* BRANCH */}

                                        <td>
                                            {branch || (
                                                <span className="source-empty">-</span>
                                            )}
                                        </td>

                                        {/* SALESPERSON */}

                                        <td>
                                            {salesperson || (
                                                <span className="source-empty">-</span>
                                            )}
                                        </td>

                                        {/* CUSTOMER SOURCE */}

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

                                        {/* PRODUCT */}

                                        <td>
                                            <div className="product-cell">
                                                <strong>
                                                    {getProductName(rental)}
                                                </strong>

                                                {getBrandName(rental) && (
                                                    <small>
                                                        {getBrandName(rental)}
                                                    </small>
                                                )}

                                                {serial && (
                                                    <small>S/N: {serial}</small>
                                                )}
                                            </div>
                                        </td>

                                        {/* DURATION */}

                                        <td>
                                            {duration.value} {duration.type}
                                        </td>

                                        {/* MONTHLY RENT */}

                                        <td>
                                            ₹ {formatMoney(getMonthlyRent(rental))}
                                        </td>

                                        {/* SECURITY DEPOSIT */}

                                        <td>₹ {formatMoney(deposit)}</td>

                                        {/* DEPOSIT PAID */}

                                        <td>
                                            <div className="deposit-cell">
                                                <strong>
                                                    ₹ {formatMoney(depositPaid)}
                                                </strong>

                                                <span
                                                    className={`deposit-status ${getDepositStatusClass(
                                                        depositStatus
                                                    )}`}
                                                >
                                                    {depositStatus}
                                                </span>
                                            </div>
                                        </td>

                                        {/* TOTAL */}

                                        <td>
                                            <strong>
                                                ₹ {formatMoney(
                                                    getTotalWithGST(rental)
                                                )}
                                            </strong>
                                        </td>

                                        {/* STATUS */}

                                        <td>
                                            <span
                                                className={`rental-status ${getStatusClass(
                                                    status
                                                )}`}
                                            >
                                                {status}
                                            </span>
                                        </td>

                                        {/* ACTION */}

                                        <td>
                                            <div className="rental-action-buttons">

                                                <button
                                                    className="view-btn"
                                                    onClick={() => viewRental(rental)}
                                                >
                                                    View
                                                </button>

                                                <button
                                                    className="print-btn"
                                                    onClick={() => printInvoice(rental)}
                                                >
                                                    Invoice
                                                </button>

                                                {status === "ACTIVE" && (
                                                    <button
                                                        className="return-btn"
                                                        onClick={() => returnRental(rental)}
                                                    >
                                                        Return
                                                    </button>
                                                )}

                                            </div>
                                        </td>

                                    </tr>
                                );
                            })

                        )}

                    </tbody>

                </table>

            </div>

        </div>
    );
}

export default WalkInRentalOrders;
