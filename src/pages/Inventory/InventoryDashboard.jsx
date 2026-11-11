import {
  useCallback,
  useEffect,
  useMemo,
  useState
} from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";

import AddStockModal from "./AddStockModal";
import TransferStockModal from "./TransferStockModal";

import {
  getInventory,
  addStock,
  removeStock,
  deleteInventory,
  addWarehouseStock,
  transferStock,
  getStockTransfers
} from "../../services/inventoryService";

import {
  getMyNotifications
} from "../../services/notificationService";

import {
  adjustRentalStock
} from "../../services/rentalApi";

import { getBrands } from "../../services/brandService";
import { getCategories } from "../../services/categoryService";

import "./InventoryDashboard.css";

const API_URL = import.meta.env.VITE_API_URL || "";

const getToken = () =>
  localStorage.getItem("token") ||
  localStorage.getItem("accessToken") ||
  "";

const unwrapArray = (response) => {
  const values = [
    response?.data?.data,
    response?.data?.inventory,
    response?.data,
    response?.inventory,
    response
  ];

  return values.find(Array.isArray) || [];
};

// Store-only availability (store stock minus reserved)
const getAvailableStock = (item) =>
  Math.max(
    0,
    Number(item?.currentStock || 0) -
    Number(item?.reservedStock || 0)
  );

/*
  Availability that follows the Location filter:
  - IN_WAREHOUSE : warehouse stock only
  - IN_STORE     : store stock minus reserved
  - ALL          : store + warehouse minus reserved
*/
const getLocationAvailable = (item, location) => {
  const warehouse = Number(item?.warehouseStock || 0);

  if (location === "IN_WAREHOUSE") {
    return Math.max(0, warehouse);
  }

  if (location === "IN_STORE") {
    return getAvailableStock(item);
  }

  return Math.max(
    0,
    Number(item?.currentStock || 0) +
    warehouse -
    Number(item?.reservedStock || 0)
  );
};

const getStatus = (available) => {
  if (available <= 0) return "OUT_OF_STOCK";
  if (available <= 5) return "LOW_STOCK";
  return "IN_STOCK";
};

const getImageUrl = (image) => {
  const value =
    typeof image === "string"
      ? image
      : image?.url || image?.path || "";

  if (!value) return "";

  if (/^(https?:|data:)/i.test(value)) {
    return value;
  }

  const base = API_URL
    .replace(/\/api\/?$/, "")
    .replace(/\/$/, "");

  return `${base}/${String(value).replace(/^\/+/, "")}`;
};

const getProductId = (item) => {
  const value = item?.productId || item?.product?._id;

  if (typeof value === "object") {
    return String(value?._id || "");
  }

  return String(value || "");
};

const getProduct = (item) => {
  if (item?.product && typeof item.product === "object") {
    return item.product;
  }

  if (item?.productId && typeof item.productId === "object") {
    return item.productId;
  }

  return {};
};

const errorMessage = (error) =>
  error?.response?.data?.message ||
  error?.message ||
  "Something went wrong";

const personName = (user) =>
  [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
  user?.name ||
  user?.email ||
  "-";

const locationLabel = (value) =>
  ({
    STORE: "Store",
    WAREHOUSE: "Warehouse",
    SUPPLIER: "Supplier"
  })[value] || value || "-";

/* ==========================================================
   SEARCH / SORT HELPERS
========================================================== */

const SALE_SORTS = [
  { value: "DEFAULT", label: "Default order" },
  { value: "NAME_ASC", label: "Product: A → Z" },
  { value: "NAME_DESC", label: "Product: Z → A" },
  { value: "AVAILABLE_ASC", label: "Available: Low → High" },
  { value: "AVAILABLE_DESC", label: "Available: High → Low" },
  { value: "STORE_DESC", label: "Store stock: High → Low" },
  { value: "WAREHOUSE_DESC", label: "Warehouse stock: High → Low" },
  { value: "PRICE_ASC", label: "Retail price: Low → High" },
  { value: "PRICE_DESC", label: "Retail price: High → Low" },
  { value: "WHOLESALE_ASC", label: "Wholesale price: Low → High" },
  { value: "WHOLESALE_DESC", label: "Wholesale price: High → Low" }
];

const RENTAL_SORTS = [
  { value: "DEFAULT", label: "Default order" },
  { value: "NAME_ASC", label: "Product: A → Z" },
  { value: "NAME_DESC", label: "Product: Z → A" },
  { value: "AVAILABLE_ASC", label: "Available: Low → High" },
  { value: "AVAILABLE_DESC", label: "Available: High → Low" },
  { value: "RENTED_DESC", label: "Rented: High → Low" },
  { value: "RENT_ASC", label: "Monthly rent: Low → High" },
  { value: "RENT_DESC", label: "Monthly rent: High → Low" }
];

const TRANSFER_SORTS = [
  { value: "DEFAULT", label: "Default order" },
  { value: "DATE_DESC", label: "Date: Newest first" },
  { value: "DATE_ASC", label: "Date: Oldest first" },
  { value: "QTY_DESC", label: "Quantity: High → Low" },
  { value: "QTY_ASC", label: "Quantity: Low → High" },
  { value: "NAME_ASC", label: "Product: A → Z" }
];

const PRODUCT_TYPE_LABELS = {
  NEW: "New",
  REFURBISHED: "Refurbished",
  RENTAL: "Rental"
};

// The API sends the type on the product: "NEW", "REFURBISHED" or "RENTAL"
const getProductType = (item) =>
  String(getProduct(item)?.productType ?? item?.productType ?? "")
    .trim()
    .toUpperCase();

const productTypeLabel = (type) =>
  PRODUCT_TYPE_LABELS[type] || type || "-";

// Brands / categories come back in different shapes, so look in the usual places
const unwrapNamedList = (response, key) =>
  [
    response?.data?.[key],
    response?.data?.data?.[key],
    response?.data?.data,
    response?.data,
    response?.[key],
    response
  ].find(Array.isArray) || [];

// A product's brand/category can be a populated object or just an id string
const refId = (value) =>
  value && typeof value === "object"
    ? String(value._id || value.id || "")
    : String(value || "");

const refName = (value) =>
  value && typeof value === "object"
    ? String(value.name || "")
    : "";

// Products store retailPrice / wholesalePrice (older ones may still use sellingPrice)
// A price of 0 / null means "not set" (e.g. rental products), so treat it as missing
const cleanPrice = (value) => {
  const number = Number(value);

  return value === null ||
    value === undefined ||
    value === "" ||
    !Number.isFinite(number) ||
    number <= 0
    ? null
    : number;
};

const getRetailPrice = (product) =>
  cleanPrice(product?.pricing?.retailPrice) ??
  cleanPrice(product?.pricing?.sellingPrice);

const getWholesalePrice = (product) =>
  cleanPrice(product?.pricing?.wholesalePrice);

const formatPrice = (value) =>
  value === null || value === undefined || value === ""
    ? "—"
    : `₹ ${Number(value).toLocaleString("en-IN")}`;

const productName = (item) =>
  String(getProduct(item).name || "").toLowerCase();

// Optional serial number support (only used if your API returns it)
const serialText = (item) => {
  const product = getProduct(item);

  const value =
    item?.serialNumbers ??
    item?.serialNumber ??
    product?.serialNumbers ??
    product?.serialNumber ??
    "";

  if (Array.isArray(value)) {
    return value
      .map((entry) =>
        typeof entry === "object"
          ? entry?.serialNumber || entry?.serial || ""
          : entry
      )
      .join(" ");
  }

  return String(value || "");
};

const sortInventoryItems = (list, sortBy, tab, location = "ALL") => {
  if (sortBy === "DEFAULT") return list;

  const available = (item) =>
    tab === "RENTAL"
      ? Number(item.availableQuantity || 0)
      : getLocationAvailable(item, location);

  const comparators = {
    NAME_ASC: (a, b) => productName(a).localeCompare(productName(b)),
    NAME_DESC: (a, b) => productName(b).localeCompare(productName(a)),
    AVAILABLE_ASC: (a, b) => available(a) - available(b),
    AVAILABLE_DESC: (a, b) => available(b) - available(a),
    STORE_DESC: (a, b) =>
      Number(b.currentStock || 0) - Number(a.currentStock || 0),
    WAREHOUSE_DESC: (a, b) =>
      Number(b.warehouseStock || 0) - Number(a.warehouseStock || 0),
    PRICE_ASC: (a, b) =>
      Number(getRetailPrice(getProduct(a)) || 0) -
      Number(getRetailPrice(getProduct(b)) || 0),
    PRICE_DESC: (a, b) =>
      Number(getRetailPrice(getProduct(b)) || 0) -
      Number(getRetailPrice(getProduct(a)) || 0),
    WHOLESALE_ASC: (a, b) =>
      Number(getWholesalePrice(getProduct(a)) || 0) -
      Number(getWholesalePrice(getProduct(b)) || 0),
    WHOLESALE_DESC: (a, b) =>
      Number(getWholesalePrice(getProduct(b)) || 0) -
      Number(getWholesalePrice(getProduct(a)) || 0),
    RENTED_DESC: (a, b) =>
      Number(b.rentedQuantity || 0) - Number(a.rentedQuantity || 0),
    RENT_ASC: (a, b) =>
      Number(a.monthlyRent || 0) - Number(b.monthlyRent || 0),
    RENT_DESC: (a, b) =>
      Number(b.monthlyRent || 0) - Number(a.monthlyRent || 0)
  };

  const compare = comparators[sortBy];

  return compare ? [...list].sort(compare) : list;
};

const sortTransfers = (list, sortBy) => {
  if (sortBy === "DEFAULT") return list;

  const time = (t) => new Date(t.createdAt || 0).getTime();

  const comparators = {
    DATE_DESC: (a, b) => time(b) - time(a),
    DATE_ASC: (a, b) => time(a) - time(b),
    QTY_DESC: (a, b) => Number(b.quantity || 0) - Number(a.quantity || 0),
    QTY_ASC: (a, b) => Number(a.quantity || 0) - Number(b.quantity || 0),
    NAME_ASC: (a, b) =>
      String(a.product?.name || "")
        .toLowerCase()
        .localeCompare(String(b.product?.name || "").toLowerCase())
  };

  const compare = comparators[sortBy];

  return compare ? [...list].sort(compare) : list;
};

export default function InventoryDashboard() {
  const [searchParams] = useSearchParams();
  const notificationProductId = searchParams.get("product");

  const [activeTab, setActiveTab] = useState("SALE");
  const [inventory, setInventory] = useState([]);
  const [rentalInventory, setRentalInventory] = useState([]);
  const [transfers, setTransfers] = useState([]);

  const [loading, setLoading] = useState(true);
  const [rentalLoading, setRentalLoading] = useState(false);
  const [transfersLoading, setTransfersLoading] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);

  const [showTransfer, setShowTransfer] = useState(false);
  const [transferProduct, setTransferProduct] = useState(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [locationFilter, setLocationFilter] = useState("ALL");

  // Filter / sort state
  const [brandFilter, setBrandFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [productTypeFilter, setProductTypeFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState("DEFAULT");
  const [priceType, setPriceType] = useState("RETAIL");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [brands, setBrands] = useState([]);
  const [categories, setCategories] = useState([]);
  const [transferType, setTransferType] = useState("ALL");
  const [fromLocationFilter, setFromLocationFilter] = useState("ALL");
  const [toLocationFilter, setToLocationFilter] = useState("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [inventoryUnreadCount, setInventoryUnreadCount] =
    useState(0);

  const [busyId, setBusyId] = useState(null);

  const resetFilters = () => {
    setSearch("");
    setStatusFilter("ALL");
    setLocationFilter("ALL");
    setBrandFilter("ALL");
    setCategoryFilter("ALL");
    setProductTypeFilter("ALL");
    setSortBy("DEFAULT");
    setPriceType("RETAIL");
    setMinPrice("");
    setMaxPrice("");
    setTransferType("ALL");
    setFromLocationFilter("ALL");
    setToLocationFilter("ALL");
    setDateFrom("");
    setDateTo("");
  };

  const switchTab = (tab) => {
    if (tab === activeTab) return;

    setActiveTab(tab);
    setShowMoreFilters(false);
    resetFilters();
  };

  const loadInventory = useCallback(async () => {
    try {
      setLoading(true);

      const response = await getInventory();

      setInventory(unwrapArray(response));
    } catch (error) {
      toast.error(errorMessage(error));
      setInventory([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadRentalInventory = useCallback(async () => {
    try {
      setRentalLoading(true);

      const response = await fetch(
        `${API_URL}/rentals/inventory`,
        {
          headers: {
            Authorization: `Bearer ${getToken()}`
          }
        }
      );

      const result = await response.json();

      if (!response.ok || result?.success === false) {
        throw new Error(
          result?.message || "Failed to load rental inventory"
        );
      }

      setRentalInventory(unwrapArray(result));
    } catch (error) {
      setRentalInventory([]);
      toast.error(errorMessage(error));
    } finally {
      setRentalLoading(false);
    }
  }, []);

  const loadTransfers = useCallback(async () => {
    try {
      setTransfersLoading(true);

      const response = await getStockTransfers();

      setTransfers(unwrapArray(response));
    } catch (error) {
      setTransfers([]);
      toast.error(errorMessage(error));
    } finally {
      setTransfersLoading(false);
    }
  }, []);

  const loadBrands = useCallback(async () => {
    try {
      const response = await getBrands();

      setBrands(unwrapNamedList(response, "brands"));
    } catch (error) {
      setBrands([]);
      console.error("Brands load error:", error);
    }
  }, []);

  const loadCategories = useCallback(async () => {
    try {
      const response = await getCategories();

      setCategories(unwrapNamedList(response, "categories"));
    } catch (error) {
      setCategories([]);
      console.error("Categories load error:", error);
    }
  }, []);

  const loadNotifications = useCallback(async () => {
    try {
      const response = await getMyNotifications();

      const notifications =
        response?.notifications ||
        response?.data?.notifications ||
        response?.data?.data?.notifications ||
        response?.data?.data ||
        [];

      const count = (Array.isArray(notifications)
        ? notifications
        : []
      ).filter(
        (n) =>
          ["STOCK_LOW", "STOCK_OUT"].includes(n.type) &&
          n.isRead !== true &&
          n.read !== true &&
          String(n.status || "").toUpperCase() !== "READ"
      ).length;

      setInventoryUnreadCount(count);
    } catch (error) {
      console.error("Notification error:", error);
    }
  }, []);

  useEffect(() => {
    loadInventory();
    loadRentalInventory();
    loadNotifications();
    loadBrands();
    loadCategories();
  }, [
    loadInventory,
    loadRentalInventory,
    loadNotifications,
    loadBrands,
    loadCategories
  ]);

  useEffect(() => {
    if (activeTab === "TRANSFERS") {
      loadTransfers();
    }
  }, [activeTab, loadTransfers]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (activeTab === "RENTAL") {
        loadRentalInventory();
      } else if (activeTab === "TRANSFERS") {
        loadTransfers();
      } else {
        loadInventory();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [
    activeTab,
    loadInventory,
    loadRentalInventory,
    loadTransfers
  ]);

  useEffect(() => {
    const interval = setInterval(
      loadNotifications,
      15000
    );

    return () => clearInterval(interval);
  }, [loadNotifications]);

  const handleAddStock = async (
    productId,
    quantity,
    location = "STORE"
  ) => {
    try {
      if (location === "WAREHOUSE") {
        await addWarehouseStock({
          productId,
          quantity: Number(quantity)
        });

        toast.success("Warehouse stock added successfully");
      } else {
        await addStock({
          productId,
          quantity: Number(quantity)
        });

        toast.success("Stock added successfully");
      }

      setShowModal(false);
      setSelectedProduct(null);

      await loadInventory();
      await loadNotifications();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const handleTransfer = async (payload) => {
    try {
      await transferStock(payload);

      toast.success("Stock transferred successfully");

      setShowTransfer(false);
      setTransferProduct(null);

      await loadInventory();
      await loadNotifications();

      if (activeTab === "TRANSFERS") {
        await loadTransfers();
      }
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const handleRemoveStock = async (productId) => {
    const input = window.prompt(
      "Enter quantity to remove"
    );

    if (input === null || !input.trim()) return;

    const quantity = Number(input);

    if (!Number.isSafeInteger(quantity) || quantity <= 0) {
      toast.error("Enter a valid quantity");
      return;
    }

    try {
      setBusyId(String(productId));

      await removeStock({ productId, quantity });

      toast.success("Stock removed successfully");

      await loadInventory();
      await loadNotifications();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (item) => {
    const id = item?._id || item?.id;

    if (!id) {
      toast.error("Inventory ID missing");
      return;
    }

    if (
      !window.confirm(
        `Delete inventory record for "${item.product?.name || "Product"}"?`
      )
    ) {
      return;
    }

    try {
      setBusyId(String(id));

      await deleteInventory(id);

      toast.success("Inventory deleted");

      await loadInventory();
      await loadNotifications();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusyId(null);
    }
  };

  const handleRentalStock = async (item, action) => {
    const productId = getProductId(item);

    if (!productId) {
      toast.error("Product ID missing");
      return;
    }

    const input = window.prompt(
      action === "ADD"
        ? "How many rental units to add?"
        : `How many units to remove? Available: ${item.availableQuantity}`
    );

    if (input === null || !input.trim()) return;

    const quantity = Number(input);

    if (!Number.isSafeInteger(quantity) || quantity <= 0) {
      toast.error("Enter a valid positive whole number");
      return;
    }

    if (
      action === "REMOVE" &&
      quantity > Number(item.availableQuantity || 0)
    ) {
      toast.error(
        "Cannot remove units already rented to customers"
      );
      return;
    }

    try {
      setBusyId(productId);

      const response = await adjustRentalStock(
        productId,
        action,
        quantity
      );

      if (response?.success === false) {
        throw new Error(response.message);
      }

      toast.success(
        action === "ADD"
          ? "Rental stock added"
          : "Rental stock removed"
      );

      await loadRentalInventory();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusyId(null);
    }
  };

  /* ========================================================
     DROPDOWN OPTIONS (built from the loaded data)
  ======================================================== */

  const toOptions = (list) =>
    list
      .map((entry) => ({
        id: String(entry?._id || entry?.id || ""),
        name: String(entry?.name || "")
      }))
      .filter((entry) => entry.id && entry.name)
      .sort((a, b) => a.name.localeCompare(b.name));

  const brandOptions = useMemo(() => toOptions(brands), [brands]);

  const categoryOptions = useMemo(
    () => toOptions(categories),
    [categories]
  );

  // id -> name, used when a product only carries the brand/category id
  const brandNameById = useMemo(
    () =>
      Object.fromEntries(
        brandOptions.map((option) => [option.id, option.name])
      ),
    [brandOptions]
  );

  const categoryNameById = useMemo(
    () =>
      Object.fromEntries(
        categoryOptions.map((option) => [option.id, option.name])
      ),
    [categoryOptions]
  );

  /*
    Stock view: on the New & Refurbished tab, Available and Status follow
    the Location filter. Rental items always use their own availableQuantity.
  */
  const getViewAvailable = useCallback(
    (item) =>
      activeTab === "RENTAL"
        ? Number(item.availableQuantity || 0)
        : getLocationAvailable(item, locationFilter),
    [activeTab, locationFilter]
  );

  /* ========================================================
     FILTER + SORT : SALE / RENTAL
  ======================================================== */

  const filtered = useMemo(() => {
    const source =
      activeTab === "RENTAL"
        ? rentalInventory
        : inventory;

    const result = source.filter((item) => {
      const product = getProduct(item);

      const productId =
        activeTab === "RENTAL"
          ? getProductId(item)
          : String(product?._id || "");

      if (
        notificationProductId &&
        productId !== notificationProductId
      ) {
        return false;
      }

      const query = search.trim().toLowerCase();

      const brandName =
        refName(product.brand) ||
        brandNameById[refId(product.brand)] ||
        "";

      const categoryName =
        refName(product.category) ||
        categoryNameById[refId(product.category)] ||
        "";

      const searchable = [
        product.name,
        product.sku,
        brandName,
        categoryName,
        serialText(item)
      ]
        .map((value) =>
          String(value || "").toLowerCase()
        )
        .join(" ");

      const available = getViewAvailable(item);

      const status = getStatus(available);

      // Picking a location lists the products held there.
      // When a Status is chosen (e.g. Out Of Stock) every product is kept,
      // so its status in that location can be seen.
      if (
        activeTab === "SALE" &&
        locationFilter !== "ALL" &&
        statusFilter === "ALL"
      ) {
        if (
          locationFilter === "IN_STORE" &&
          Number(item.currentStock || 0) <= 0
        ) {
          return false;
        }

        if (
          locationFilter === "IN_WAREHOUSE" &&
          Number(item.warehouseStock || 0) <= 0
        ) {
          return false;
        }
      }

      if (
        activeTab === "SALE" &&
        productTypeFilter !== "ALL" &&
        getProductType(item) !== productTypeFilter
      ) {
        return false;
      }

      if (
        brandFilter !== "ALL" &&
        refId(product.brand) !== brandFilter &&
        brandName !== brandNameById[brandFilter]
      ) {
        return false;
      }

      if (
        categoryFilter !== "ALL" &&
        refId(product.category) !== categoryFilter &&
        categoryName !== categoryNameById[categoryFilter]
      ) {
        return false;
      }

      if (
        activeTab === "SALE" &&
        (minPrice !== "" || maxPrice !== "")
      ) {
        const price =
          priceType === "WHOLESALE"
            ? getWholesalePrice(product)
            : getRetailPrice(product);

        // products with no price set are left out while a range is active
        if (price === null || price === undefined) {
          return false;
        }

        if (minPrice !== "" && Number(price) < Number(minPrice)) {
          return false;
        }

        if (maxPrice !== "" && Number(price) > Number(maxPrice)) {
          return false;
        }
      }

      return (
        searchable.includes(query) &&
        (statusFilter === "ALL" || statusFilter === status)
      );
    });

    return sortInventoryItems(
      result,
      sortBy,
      activeTab,
      locationFilter
    );
  }, [
    activeTab,
    inventory,
    rentalInventory,
    notificationProductId,
    search,
    statusFilter,
    locationFilter,
    productTypeFilter,
    brandFilter,
    categoryFilter,
    brandNameById,
    categoryNameById,
    priceType,
    minPrice,
    maxPrice,
    sortBy,
    getViewAvailable
  ]);

  /* ========================================================
     FILTER + SORT : TRANSFER HISTORY
  ======================================================== */

  const filteredTransfers = useMemo(() => {
    const query = search.trim().toLowerCase();

    const from = dateFrom
      ? new Date(`${dateFrom}T00:00:00`).getTime()
      : null;

    const to = dateTo
      ? new Date(`${dateTo}T23:59:59.999`).getTime()
      : null;

    const result = transfers.filter((t) => {
      if (query) {
        const searchable = [
          t.product?.name,
          t.product?.sku,
          t.note,
          personName(t.transferredBy)
        ]
          .map((value) =>
            String(value || "").toLowerCase()
          )
          .join(" ");

        if (!searchable.includes(query)) return false;
      }

      if (transferType === "WAREHOUSE_IN") {
        if (t.movementType !== "WAREHOUSE_IN") return false;
      } else if (transferType === "TRANSFER") {
        if (t.movementType === "WAREHOUSE_IN") return false;
      }

      if (
        fromLocationFilter !== "ALL" &&
        t.fromLocation !== fromLocationFilter
      ) {
        return false;
      }

      if (
        toLocationFilter !== "ALL" &&
        t.toLocation !== toLocationFilter
      ) {
        return false;
      }

      if (from !== null || to !== null) {
        if (!t.createdAt) return false;

        const time = new Date(t.createdAt).getTime();

        if (from !== null && time < from) return false;
        if (to !== null && time > to) return false;
      }

      return true;
    });

    return sortTransfers(result, sortBy);
  }, [
    transfers,
    search,
    transferType,
    fromLocationFilter,
    toLocationFilter,
    dateFrom,
    dateTo,
    sortBy
  ]);

  const hasActiveFilters =
    search.trim() !== "" ||
    statusFilter !== "ALL" ||
    locationFilter !== "ALL" ||
    productTypeFilter !== "ALL" ||
    brandFilter !== "ALL" ||
    categoryFilter !== "ALL" ||
    sortBy !== "DEFAULT" ||
    minPrice !== "" ||
    maxPrice !== "" ||
    priceType !== "RETAIL" ||
    transferType !== "ALL" ||
    fromLocationFilter !== "ALL" ||
    toLocationFilter !== "ALL" ||
    dateFrom !== "" ||
    dateTo !== "";

  // Number of filters currently set inside the "More filters" panel
  const moreFiltersCount =
    (priceType !== "RETAIL" ? 1 : 0) +
    (minPrice !== "" ? 1 : 0) +
    (maxPrice !== "" ? 1 : 0);

  const summary = useMemo(() => {
    const source =
      activeTab === "RENTAL"
        ? rentalInventory
        : inventory;

    const available = (item) =>
      activeTab === "RENTAL"
        ? Number(item.availableQuantity || 0)
        : getLocationAvailable(item, locationFilter);

    return {
      totalProducts: source.length,
      inStock: source.filter(
        (item) => getStatus(available(item)) === "IN_STOCK"
      ).length,
      lowStock: source.filter(
        (item) => getStatus(available(item)) === "LOW_STOCK"
      ).length,
      outOfStock: source.filter(
        (item) => getStatus(available(item)) === "OUT_OF_STOCK"
      ).length,
      totalStock: source.reduce(
        (sum, item) =>
          sum +
          Number(
            activeTab === "RENTAL"
              ? item.totalQuantity
              : item.currentStock
          ),
        0
      ),
      warehouseStock: inventory.reduce(
        (sum, item) =>
          sum + Number(item.warehouseStock || 0),
        0
      ),
      rented: rentalInventory.reduce(
        (sum, item) =>
          sum + Number(item.rentedQuantity || 0),
        0
      )
    };
  }, [activeTab, inventory, rentalInventory, locationFilter]);

  const statusLabel = (status) =>
    ({
      IN_STOCK: "In Stock",
      LOW_STOCK: "Low Stock",
      OUT_OF_STOCK: "Out Of Stock"
    })[status] || status;

  const isLoading =
    activeTab === "RENTAL" ? rentalLoading : loading;

  const sortOptions =
    activeTab === "RENTAL"
      ? RENTAL_SORTS
      : activeTab === "TRANSFERS"
      ? TRANSFER_SORTS
      : SALE_SORTS;

  const totalCount =
    activeTab === "RENTAL"
      ? rentalInventory.length
      : inventory.length;

  const stockViewLabel =
    locationFilter === "IN_STORE"
      ? "Store stock"
      : locationFilter === "IN_WAREHOUSE"
      ? "Warehouse stock"
      : "Store + Warehouse";

  return (
    <div className="inventory-dashboard">
      <div className="inventory-page-header">
        <div>
          <h1>Inventory Management</h1>
          <p>
            Manage store, warehouse, refurbished and rental stock
          </p>
        </div>
      </div>

      <div
        className="inventory-notification-badge"
        aria-label={`${inventoryUnreadCount} unread inventory notifications`}
      >
        🔔
        {inventoryUnreadCount > 0 && (
          <span>{inventoryUnreadCount}</span>
        )}
      </div>

      <div className="inventory-stock-tabs">
        <button
          type="button"
          className={activeTab === "SALE" ? "active" : ""}
          onClick={() => switchTab("SALE")}
        >
          New & Refurbished
        </button>

        <button
          type="button"
          className={activeTab === "RENTAL" ? "active" : ""}
          onClick={() => switchTab("RENTAL")}
        >
          Rental Inventory
        </button>

        <button
          type="button"
          className={activeTab === "TRANSFERS" ? "active" : ""}
          onClick={() => switchTab("TRANSFERS")}
        >
          Transfer History
        </button>

        <button
          type="button"
          className="inventory-refresh-btn"
          onClick={() =>
            activeTab === "RENTAL"
              ? loadRentalInventory()
              : activeTab === "TRANSFERS"
              ? loadTransfers()
              : loadInventory()
          }
        >
          Refresh
        </button>
      </div>

      {activeTab === "TRANSFERS" ? (
        <>
          <div className="inventory-top">
            <div className="inventory-filter-group inventory-filter-search">
              <label htmlFor="transfer-search">Search</label>
              <input
                id="transfer-search"
                type="text"
                placeholder="Search product, SKU, note, user..."
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
              />
            </div>

            <div className="inventory-filter-group">
              <label htmlFor="transfer-type">Type</label>
              <select
                id="transfer-type"
                value={transferType}
                onChange={(event) =>
                  setTransferType(event.target.value)
                }
              >
                <option value="ALL">All Types</option>
                <option value="WAREHOUSE_IN">Warehouse In</option>
                <option value="TRANSFER">Transfer</option>
              </select>
            </div>

            <div className="inventory-filter-group">
              <label htmlFor="transfer-from">From</label>
              <select
                id="transfer-from"
                value={fromLocationFilter}
                onChange={(event) =>
                  setFromLocationFilter(event.target.value)
                }
              >
                <option value="ALL">All Sources</option>
                <option value="STORE">Store</option>
                <option value="WAREHOUSE">Warehouse</option>
                <option value="SUPPLIER">Supplier</option>
              </select>
            </div>

            <div className="inventory-filter-group">
              <label htmlFor="transfer-to">To</label>
              <select
                id="transfer-to"
                value={toLocationFilter}
                onChange={(event) =>
                  setToLocationFilter(event.target.value)
                }
              >
                <option value="ALL">All Destinations</option>
                <option value="STORE">Store</option>
                <option value="WAREHOUSE">Warehouse</option>
                <option value="SUPPLIER">Supplier</option>
              </select>
            </div>

            <div className="inventory-filter-group">
              <label htmlFor="transfer-date-from">Date from</label>
              <input
                id="transfer-date-from"
                type="date"
                value={dateFrom}
                max={dateTo || undefined}
                onChange={(event) =>
                  setDateFrom(event.target.value)
                }
              />
            </div>

            <div className="inventory-filter-group">
              <label htmlFor="transfer-date-to">Date to</label>
              <input
                id="transfer-date-to"
                type="date"
                value={dateTo}
                min={dateFrom || undefined}
                onChange={(event) =>
                  setDateTo(event.target.value)
                }
              />
            </div>

            <div className="inventory-filter-group">
              <label htmlFor="transfer-sort">Sort by</label>
              <select
                id="transfer-sort"
                value={sortBy}
                onChange={(event) =>
                  setSortBy(event.target.value)
                }
              >
                {sortOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {hasActiveFilters && (
              <div className="inventory-filter-group">
                <button
                  type="button"
                  className="inventory-clear-btn"
                  onClick={resetFilters}
                >
                  Clear filters
                </button>
              </div>
            )}
          </div>

          <div className="inventory-result-count">
            Showing {filteredTransfers.length} of {transfers.length} transfers
          </div>

          {transfersLoading ? (
            <div className="inventory-loading">
              Loading transfer history...
            </div>
          ) : (
            <div className="inventory-table-wrapper">
              <table className="inventory-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Date</th>
                    <th>Product</th>
                    <th>SKU</th>
                    <th>Type</th>
                    <th>From</th>
                    <th>To</th>
                    <th>Qty</th>
                    <th>Store (Before → After)</th>
                    <th>Warehouse (Before → After)</th>
                    <th>Note</th>
                    <th>By</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredTransfers.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="no-data">
                        No transfers found
                      </td>
                    </tr>
                  ) : (
                    filteredTransfers.map((t, index) => (
                      <tr key={t._id || index}>
                        <td>{index + 1}</td>
                        <td>
                          {t.createdAt
                            ? new Date(t.createdAt).toLocaleString()
                            : "-"}
                        </td>
                        <td>
                          <strong>{t.product?.name || "-"}</strong>
                        </td>
                        <td>{t.product?.sku || "-"}</td>
                        <td>
                          {t.movementType === "WAREHOUSE_IN"
                            ? "Warehouse In"
                            : "Transfer"}
                        </td>
                        <td>{locationLabel(t.fromLocation)}</td>
                        <td>{locationLabel(t.toLocation)}</td>
                        <td>
                          <strong>{t.quantity}</strong>
                        </td>
                        <td>
                          {t.storeStockBefore} → {t.storeStockAfter}
                        </td>
                        <td>
                          {t.warehouseStockBefore} →{" "}
                          {t.warehouseStockAfter}
                        </td>
                        <td>{t.note || "-"}</td>
                        <td>{personName(t.transferredBy)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="inventory-cards">
            <div className="card blue">
              <h3>Total Products</h3>
              <h2>{summary.totalProducts}</h2>
            </div>

            <div className="card green">
              <h3>In Stock</h3>
              <h2>{summary.inStock}</h2>
            </div>

            <div className="card orange">
              <h3>Low Stock</h3>
              <h2>{summary.lowStock}</h2>
            </div>

            <div className="card red">
              <h3>Out Of Stock</h3>
              <h2>{summary.outOfStock}</h2>
            </div>

            <div className="card purple">
              <h3>
                {activeTab === "SALE" ? "Store Stock" : "Total Stock"}
              </h3>
              <h2>{summary.totalStock}</h2>
            </div>

            {activeTab === "SALE" && (
              <div className="card blue">
                <h3>Warehouse Stock</h3>
                <h2>{summary.warehouseStock}</h2>
              </div>
            )}

            {activeTab === "RENTAL" && (
              <div className="card blue">
                <h3>Currently Rented</h3>
                <h2>{summary.rented}</h2>
              </div>
            )}
          </div>

          <div className="inventory-top">
            <div className="inventory-filter-group inventory-filter-search">
              <label htmlFor="inventory-search">Search</label>
              <input
                id="inventory-search"
                type="text"
                placeholder="Search product, SKU, brand, category, serial no..."
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
              />
            </div>

            <div className="inventory-filter-group">
              <label htmlFor="inventory-status">Status</label>
              <select
                id="inventory-status"
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value)
                }
              >
                <option value="ALL">All Status</option>
                <option value="IN_STOCK">In Stock</option>
                <option value="LOW_STOCK">Low Stock</option>
                <option value="OUT_OF_STOCK">Out Of Stock</option>
              </select>
            </div>

            {activeTab === "SALE" && (
              <div className="inventory-filter-group">
                <label htmlFor="inventory-location">Location</label>
                <select
                  id="inventory-location"
                  value={locationFilter}
                  onChange={(event) =>
                    setLocationFilter(event.target.value)
                  }
                >
                  <option value="ALL">All Locations</option>
                  <option value="IN_STORE">Store</option>
                  <option value="IN_WAREHOUSE">Warehouse</option>
                </select>
              </div>
            )}

            {activeTab === "SALE" && (
              <div className="inventory-filter-group">
                <label htmlFor="inventory-product-type">
                  Product type
                </label>
                <select
                  id="inventory-product-type"
                  value={productTypeFilter}
                  onChange={(event) =>
                    setProductTypeFilter(event.target.value)
                  }
                >
                  <option value="ALL">All Types</option>
                  <option value="NEW">New</option>
                  <option value="REFURBISHED">Refurbished</option>
                  <option value="RENTAL">Rental</option>
                </select>
              </div>
            )}

            <div className="inventory-filter-group">
              <label htmlFor="inventory-brand">Brand</label>
              <select
                id="inventory-brand"
                value={brandFilter}
                onChange={(event) =>
                  setBrandFilter(event.target.value)
                }
              >
                <option value="ALL">All Brands</option>
                {brandOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="inventory-filter-group">
              <label htmlFor="inventory-category">Category</label>
              <select
                id="inventory-category"
                value={categoryFilter}
                onChange={(event) =>
                  setCategoryFilter(event.target.value)
                }
              >
                <option value="ALL">All Categories</option>
                {categoryOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="inventory-filter-group">
              <label htmlFor="inventory-sort">Sort by</label>
              <select
                id="inventory-sort"
                value={sortBy}
                onChange={(event) =>
                  setSortBy(event.target.value)
                }
              >
                {sortOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {activeTab === "SALE" && (
              <div className="inventory-filter-group">
                <button
                  type="button"
                  className={
                    showMoreFilters || moreFiltersCount > 0
                      ? "inventory-more-btn active"
                      : "inventory-more-btn"
                  }
                  aria-expanded={showMoreFilters}
                  aria-controls="inventory-more-filters"
                  onClick={() =>
                    setShowMoreFilters((open) => !open)
                  }
                >
                  More filters
                  {moreFiltersCount > 0 && (
                    <span className="inventory-more-badge">
                      {moreFiltersCount}
                    </span>
                  )}
                  <span aria-hidden="true">
                    {showMoreFilters ? " ▴" : " ▾"}
                  </span>
                </button>
              </div>
            )}

            {hasActiveFilters && (
              <div className="inventory-filter-group">
                <button
                  type="button"
                  className="inventory-clear-btn"
                  onClick={resetFilters}
                >
                  Clear filters
                </button>
              </div>
            )}
          </div>

          {activeTab === "SALE" && showMoreFilters && (
            <div
              id="inventory-more-filters"
              className="inventory-top inventory-more-filters"
            >
              <div className="inventory-filter-group">
                <label htmlFor="inventory-price-type">Price type</label>
                <select
                  id="inventory-price-type"
                  value={priceType}
                  onChange={(event) =>
                    setPriceType(event.target.value)
                  }
                >
                  <option value="RETAIL">Retail Price</option>
                  <option value="WHOLESALE">Wholesale Price</option>
                </select>
              </div>

              <div className="inventory-filter-group">
                <label htmlFor="inventory-min-price">Min price (₹)</label>
                <input
                  id="inventory-min-price"
                  type="number"
                  min="0"
                  placeholder="e.g. 10000"
                  value={minPrice}
                  onChange={(event) =>
                    setMinPrice(event.target.value)
                  }
                />
              </div>

              <div className="inventory-filter-group">
                <label htmlFor="inventory-max-price">Max price (₹)</label>
                <input
                  id="inventory-max-price"
                  type="number"
                  min="0"
                  placeholder="e.g. 30000"
                  value={maxPrice}
                  onChange={(event) =>
                    setMaxPrice(event.target.value)
                  }
                />
              </div>
            </div>
          )}

          <div className="inventory-result-count">
            Showing {filtered.length} of {totalCount} products
            {activeTab === "SALE" && (
              <> · Stock view: {stockViewLabel}</>
            )}
          </div>

          {isLoading ? (
            <div className="inventory-loading">
              Loading inventory...
            </div>
          ) : (
            <div className="inventory-table-wrapper">
              <table className="inventory-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Image</th>
                    <th>Product</th>
                    <th>SKU</th>
                    <th>Brand</th>
                    <th>Category</th>
                    {activeTab === "SALE" && (
                      <>
                        <th>Type</th>
                        <th>Retail Price</th>
                        <th>Wholesale Price</th>
                      </>
                    )}
                    <th>
                      {activeTab === "SALE" ? "Store Stock" : "Total"}
                    </th>
                    <th>
                      {activeTab === "RENTAL"
                        ? "Rented"
                        : "Reserved"}
                    </th>
                    <th>Available</th>
                    {activeTab === "SALE" && (
                      <th>Warehouse</th>
                    )}
                    {activeTab === "RENTAL" ? (
                      <th>Monthly Rent</th>
                    ) : (
                      <>
                        <th>Min</th>
                        <th>Max</th>
                      </>
                    )}
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td
                        colSpan={17}
                        className="no-data"
                      >
                        No products found
                      </td>
                    </tr>
                  ) : (
                    filtered.map((item, index) => {
                      const product = getProduct(item);

                      const productId =
                        activeTab === "RENTAL"
                          ? getProductId(item)
                          : String(product?._id || "");

                      const available = getViewAvailable(item);

                      const status = getStatus(available);

                      const image = product.images?.length
                        ? getImageUrl(product.images[0])
                        : "";

                      const busy =
                        busyId === productId ||
                        busyId === String(item._id);

                      return (
                        <tr
                          key={
                            item.rentalProductId ||
                            item._id ||
                            index
                          }
                        >
                          <td>{index + 1}</td>

                          <td>
                            {image ? (
                              <img
                                src={image}
                                alt={product.name || "Product"}
                                className="inventory-image"
                              />
                            ) : (
                              <div className="inventory-no-image">
                                No Image
                              </div>
                            )}
                          </td>

                          <td>
                            <strong>{product.name || "-"}</strong>
                          </td>

                          <td>{product.sku || "-"}</td>
                          <td>
                            {refName(product.brand) ||
                              brandNameById[refId(product.brand)] ||
                              "-"}
                          </td>
                          <td>
                            {refName(product.category) ||
                              categoryNameById[refId(product.category)] ||
                              "-"}
                          </td>

                          {activeTab === "SALE" && (
                            <>
                              <td>
                                {productTypeLabel(getProductType(item))}
                              </td>
                              <td>{formatPrice(getRetailPrice(product))}</td>
                              <td>{formatPrice(getWholesalePrice(product))}</td>
                            </>
                          )}

                          <td>
                            <strong>
                              {activeTab === "RENTAL"
                                ? item.totalQuantity
                                : item.currentStock}
                            </strong>
                          </td>

                          <td>
                            {activeTab === "RENTAL"
                              ? item.rentedQuantity
                              : item.reservedStock}
                          </td>

                          <td>
                            <strong>{available}</strong>
                          </td>

                          {activeTab === "SALE" && (
                            <td>
                              <strong>
                                {Number(item.warehouseStock || 0)}
                              </strong>
                            </td>
                          )}

                          {activeTab === "RENTAL" ? (
                            <td>
                              {item.monthlyRent !== undefined
                                ? `₹ ${item.monthlyRent}`
                                : "—"}
                            </td>
                          ) : (
                            <>
                              <td>{item.minimumStock ?? 0}</td>
                              <td>{item.maximumStock ?? 0}</td>
                            </>
                          )}

                          <td>
                            <span
                              className={
                                status === "IN_STOCK"
                                  ? "status in-stock"
                                  : status === "LOW_STOCK"
                                  ? "status low-stock"
                                  : "status out-stock"
                              }
                            >
                              {statusLabel(status)}
                            </span>
                          </td>

                          <td>
                            <div className="inventory-actions">
                              {activeTab === "RENTAL" ? (
                                <>
                                  <button
                                    type="button"
                                    className="add-btn"
                                    disabled={busy}
                                    onClick={() =>
                                      handleRentalStock(item, "ADD")
                                    }
                                  >
                                    + Stock
                                  </button>

                                  <button
                                    type="button"
                                    className="remove-btn"
                                    disabled={busy || available <= 0}
                                    onClick={() =>
                                      handleRentalStock(item, "REMOVE")
                                    }
                                  >
                                    − Stock
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    className="add-btn"
                                    disabled={busy}
                                    onClick={() => {
                                      setSelectedProduct(item);
                                      setShowModal(true);
                                    }}
                                  >
                                    + Stock
                                  </button>

                                  <button
                                    type="button"
                                    className="remove-btn"
                                    disabled={busy}
                                    onClick={() =>
                                      handleRemoveStock(productId)
                                    }
                                  >
                                    − Stock
                                  </button>

                                  <button
                                    type="button"
                                    className="add-btn"
                                    disabled={busy}
                                    onClick={() => {
                                      setTransferProduct(item);
                                      setShowTransfer(true);
                                    }}
                                  >
                                    Transfer
                                  </button>

                                  <button
                                    type="button"
                                    className="inventory-delete-btn"
                                    disabled={busy}
                                    onClick={() =>
                                      handleDelete(item)
                                    }
                                  >
                                    Delete
                                  </button>
                                </>
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
          )}
        </>
      )}

      {showModal && selectedProduct && (
        <AddStockModal
          product={selectedProduct}
          onClose={() => {
            setShowModal(false);
            setSelectedProduct(null);
          }}
          onSave={handleAddStock}
        />
      )}

      {showTransfer && transferProduct && (
        <TransferStockModal
          item={transferProduct}
          onClose={() => {
            setShowTransfer(false);
            setTransferProduct(null);
          }}
          onSave={handleTransfer}
        />
      )}
    </div>
  );
}
