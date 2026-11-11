import React, {
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
} from "react";

import "./ProductList.css";

import {
  getProducts,
  deleteProduct,
  searchProducts,
  updateProduct,
} from "../../../../services/productService";

import { getBrands } from "../../../../services/brandService";
import { getCategories } from "../../../../services/categoryService";

import axios from "axios";
import { toast } from "react-toastify";
import {
  FaEdit,
  FaTrash,
  FaTimes,
  FaSave,
} from "react-icons/fa";

const API = String(import.meta.env.VITE_API_URL || "/api")
  .replace(/\/+$/, "");

const getToken = () =>
  localStorage.getItem("token") ||
  localStorage.getItem("accessToken");

const authConfig = () => ({
  headers: {
    Authorization: `Bearer ${getToken()}`,
  },
});

const extractProducts = (res) => {
  const data = res?.data;

  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.products)) return data.products;
  if (Array.isArray(data?.data?.products)) {
    return data.data.products;
  }

  return [];
};

const numberValue = (value, fallback = 0) => {
  if (value === "" || value === null || value === undefined) {
    return fallback;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const formatMoney = (value) =>
  numberValue(value).toLocaleString("en-IN");

const getProductType = (product) =>
  String(product?.productType || "NEW").toUpperCase();

const getObjectName = (value) => {
  if (value && typeof value === "object") {
    return value.name || value.title || "N/A";
  }

  return value || "N/A";
};

const getRentalDetails = (product) =>
  product?.rental ||
  product?.rentalDetails ||
  product?.rentalProduct ||
  null;

const getRentalQuantity = (product) => {
  const rental = getRentalDetails(product);

  if (!rental) return null;

  return {
    available:
      rental.availableQuantity ??
      rental.availableQty ??
      0,

    total:
      rental.totalQuantity ??
      rental.quantity ??
      rental.availableQuantity ??
      0,

    rented: rental.rentedQuantity ?? 0,
  };
};

const getRentalStatus = (product) => {
  const rental = getRentalDetails(product);

  if (!rental) return "NOT_CONFIGURED";

  return rental.isAvailableForRent === true
    ? "AVAILABLE"
    : "UNAVAILABLE";
};

const getImageUrl = (product) => {
  let imageUrl = null;

  if (Array.isArray(product?.images) && product.images.length) {
    const firstImage = product.images[0];

    imageUrl =
      typeof firstImage === "string"
        ? firstImage
        : firstImage?.url ||
          firstImage?.path ||
          firstImage?.image ||
          firstImage?.src;
  }

  if (!imageUrl) {
    const fallback =
      product?.image ||
      product?.primaryImage ||
      product?.thumbnail ||
      product?.imageUrl;

    imageUrl =
      typeof fallback === "string"
        ? fallback
        : fallback?.url || fallback?.path || null;
  }

  if (!imageUrl || typeof imageUrl !== "string") return null;

  if (/^(https?:|data:|blob:)/i.test(imageUrl)) {
    return imageUrl;
  }

  const serverUrl = API.replace(/\/api\/?$/i, "");
  return `${serverUrl}/${imageUrl.replace(/^\/+/, "")}`;
};

const createEditForm = (product) => {
  const pricing = product?.pricing || {};
  const refurbished = product?.refurbishedDetails || {};
  const rental = getRentalDetails(product) || {};

  return {
    name: product?.name || "",
    productType: getProductType(product),
    status: product?.status || "ACTIVE",

    pricing: {
      purchasePrice: pricing.purchasePrice ?? 0,
      retailPrice: pricing.retailPrice ?? 0,
      wholesalePrice: pricing.wholesalePrice ?? "",
      mrp: pricing.mrp ?? 0,
      discount: pricing.discount ?? 0,
      gst: pricing.gst ?? 0,
    },

    refurbishedDetails: {
      grade: refurbished.grade || "",
      batteryHealth: refurbished.batteryHealth ?? 0,
      warrantyMonths: refurbished.warrantyMonths ?? 0,
      testingStatus: refurbished.testingStatus || "",
    },

    rental: {
      monthlyRent: rental.monthlyRent ?? 0,
      securityDeposit: rental.securityDeposit ?? 0,
      minimumRentalMonths: rental.minimumRentalMonths ?? 3,
      gst: rental.gst ?? 0,
      totalQuantity: rental.totalQuantity ?? rental.quantity ?? 0,
      availableQuantity: rental.availableQuantity ?? 0,
      rentedQuantity: rental.rentedQuantity ?? 0,
      isAvailableForRent: rental.isAvailableForRent === true,
      basicSoftwareInstalled:
        rental.basicSoftwareInstalled === true,
      includedItems: Array.isArray(rental.includedItems)
        ? rental.includedItems.join(", ")
        : "",
    },
  };
};

/* ==========================================================
   FILTER / SORT HELPERS
========================================================== */

const SORT_OPTIONS = [
  { value: "DEFAULT", label: "Default order" },
  { value: "NAME_ASC", label: "Name: A → Z" },
  { value: "NAME_DESC", label: "Name: Z → A" },
  { value: "NEWEST", label: "Date: Newest first" },
  { value: "OLDEST", label: "Date: Oldest first" },
  { value: "RETAIL_ASC", label: "Retail price: Low → High" },
  { value: "RETAIL_DESC", label: "Retail price: High → Low" },
  { value: "WHOLESALE_ASC", label: "Wholesale price: Low → High" },
  { value: "WHOLESALE_DESC", label: "Wholesale price: High → Low" },
  { value: "STOCK_ASC", label: "Stock: Low → High" },
  { value: "STOCK_DESC", label: "Stock: High → Low" },
];

const PRICE_TYPES = [
  { value: "retailPrice", label: "Retail Price" },
  { value: "wholesalePrice", label: "Wholesale Price" },
  { value: "purchasePrice", label: "Purchase Price" },
  { value: "mrp", label: "MRP" },
];

// Category / subcategory / brand can be a populated object or just an id
const refId = (value) =>
  value && typeof value === "object"
    ? String(value._id || value.id || "")
    : String(value || "");

const refName = (value) =>
  value && typeof value === "object"
    ? String(value.name || value.title || "")
    : "";

const getStock = (product) =>
  numberValue(
    product?.inventory?.currentStock ?? product?.stock,
    0
  );

const getStockStatus = (stock) => {
  if (stock <= 0) return "OUT";
  if (stock <= 5) return "LOW";
  return "IN";
};

const getProductName = (product) =>
  String(product?.name || "").toLowerCase();

const getPriceValue = (product, field) => {
  const value = product?.pricing?.[field];

  return value === null || value === undefined || value === ""
    ? null
    : Number(value);
};

const getCreatedTime = (product) =>
  new Date(product?.createdAt || 0).getTime();

// Unique { id, name } options from a list of products
const buildOptions = (list, key) => {
  const map = new Map();

  list.forEach((product) => {
    const value = product?.[key];
    const id = refId(value);
    const name = refName(value);

    if (id && name && !map.has(id)) {
      map.set(id, name);
    }
  });

  return Array.from(map, ([id, name]) => ({ id, name })).sort(
    (a, b) => a.name.localeCompare(b.name)
  );
};

// Brands / categories come back in different shapes, so look in the usual places
const unwrapNamedList = (response, key) =>
  [
    response?.data?.[key],
    response?.data?.data?.[key],
    response?.data?.data,
    response?.data,
    response?.[key],
    response,
  ].find(Array.isArray) || [];

// { id, name } options from a brand / category API list
const toOptions = (list) =>
  list
    .map((entry) => ({
      id: String(entry?._id || entry?.id || ""),
      name: String(entry?.name || entry?.title || ""),
    }))
    .filter((entry) => entry.id && entry.name)
    .sort((a, b) => a.name.localeCompare(b.name));

// Name for a category / subcategory / brand that is either a populated
// object or just an id (the id is looked up in the API lists)
const displayName = (value, nameById) => {
  if (value && typeof value === "object") {
    return getObjectName(value);
  }

  if (!value) return "N/A";

  return nameById[String(value)] || String(value);
};

const sortProducts = (list, sortBy) => {
  if (sortBy === "DEFAULT") return list;

  const comparators = {
    NAME_ASC: (a, b) =>
      getProductName(a).localeCompare(getProductName(b)),
    NAME_DESC: (a, b) =>
      getProductName(b).localeCompare(getProductName(a)),
    NEWEST: (a, b) => getCreatedTime(b) - getCreatedTime(a),
    OLDEST: (a, b) => getCreatedTime(a) - getCreatedTime(b),
    RETAIL_ASC: (a, b) =>
      numberValue(a.pricing?.retailPrice) -
      numberValue(b.pricing?.retailPrice),
    RETAIL_DESC: (a, b) =>
      numberValue(b.pricing?.retailPrice) -
      numberValue(a.pricing?.retailPrice),
    WHOLESALE_ASC: (a, b) =>
      numberValue(a.pricing?.wholesalePrice) -
      numberValue(b.pricing?.wholesalePrice),
    WHOLESALE_DESC: (a, b) =>
      numberValue(b.pricing?.wholesalePrice) -
      numberValue(a.pricing?.wholesalePrice),
    STOCK_ASC: (a, b) => getStock(a) - getStock(b),
    STOCK_DESC: (a, b) => getStock(b) - getStock(a),
  };

  const compare = comparators[sortBy];

  return compare ? [...list].sort(compare) : list;
};

const ProductList = () => {
  const [products, setProducts] = useState([]);
  const [allProducts, setAllProducts] = useState([]);
  const [brands, setBrands] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [deletingId, setDeletingId] = useState(null);

  const [editingProduct, setEditingProduct] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [saving, setSaving] = useState(false);

  // Filter / sort state
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [brandFilter, setBrandFilter] = useState("ALL");
  const [subcategoryFilter, setSubcategoryFilter] = useState("ALL");
  const [stockFilter, setStockFilter] = useState("ALL");
  const [rentalFilter, setRentalFilter] = useState("ALL");
  const [priceType, setPriceType] = useState("retailPrice");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortBy, setSortBy] = useState("DEFAULT");
  const [showMoreFilters, setShowMoreFilters] = useState(false);

  const itemsPerPage = 10;
  const requestIdRef = useRef(0);

  // ==========================================
  // LOAD / SEARCH PRODUCTS
  // ==========================================

  const loadProducts = useCallback(async (keyword = "") => {
    const requestId = ++requestIdRef.current;

    try {
      setLoading(true);

      const res = keyword.trim()
        ? await searchProducts(keyword.trim())
        : await getProducts();

      if (requestId !== requestIdRef.current) return;

      const list = extractProducts(res);

      setProducts(list);

      // Keep the full list so the filter dropdowns don't shrink while searching
      if (!keyword.trim()) {
        setAllProducts(list);
      }

      setCurrentPage(1);
    }
     catch (error) {
      if (requestId !== requestIdRef.current) return;

      console.error("PRODUCT LOAD ERROR:", error);

      toast.error(
        error.response?.data?.message ||
        (keyword.trim()
          ? "Search failed"
          : "Failed to load products")
      );
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    loadProducts();

    return () => {
      requestIdRef.current += 1;
    };
  }, [loadProducts]);

  // ==========================================
  // LOAD BRANDS + CATEGORIES (for the filter dropdowns)
  // ==========================================

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

  useEffect(() => {
    loadBrands();
    loadCategories();
  }, [loadBrands, loadCategories]);

  const handleSearch = (e) => {
    const keyword = e.target.value;

    setSearch(keyword);
    setCurrentPage(1);
    loadProducts(keyword);
  };

  // ==========================================
  // FILTER OPTIONS (built from the loaded data)
  // ==========================================

  const optionSource = allProducts.length ? allProducts : products;

  // The categories API returns categories and subcategories together;
  // a subcategory is the one that has a parentCategory.
  const categoryOptions = useMemo(() => {
    const fromApi = toOptions(
      categories.filter((entry) => !refId(entry.parentCategory))
    );

    return fromApi.length
      ? fromApi
      : buildOptions(optionSource, "category");
  }, [categories, optionSource]);

  const subcategoryOptions = useMemo(() => {
    const fromApi = toOptions(
      categories.filter((entry) => {
        const parentId = refId(entry.parentCategory);

        if (!parentId) return false;

        return (
          categoryFilter === "ALL" || parentId === categoryFilter
        );
      })
    );

    return fromApi.length
      ? fromApi
      : buildOptions(optionSource, "subcategory");
  }, [categories, categoryFilter, optionSource]);

  const brandOptions = useMemo(() => {
    const fromApi = toOptions(brands);

    return fromApi.length
      ? fromApi
      : buildOptions(optionSource, "brand");
  }, [brands, optionSource]);

  // id -> name, used when a product only carries the id
  const categoryNameById = useMemo(
    () =>
      Object.fromEntries(
        toOptions(categories).map((option) => [option.id, option.name])
      ),
    [categories]
  );

  const brandNameById = useMemo(
    () =>
      Object.fromEntries(
        toOptions(brands).map((option) => [option.id, option.name])
      ),
    [brands]
  );

  // ==========================================
  // FILTER + SORT
  // ==========================================

  const filteredProducts = useMemo(() => {
    const from = dateFrom
      ? new Date(`${dateFrom}T00:00:00`).getTime()
      : null;

    const to = dateTo
      ? new Date(`${dateTo}T23:59:59.999`).getTime()
      : null;

    const priceRangeActive = minPrice !== "" || maxPrice !== "";

    const result = products.filter((product) => {
      if (
        typeFilter !== "ALL" &&
        getProductType(product) !== typeFilter
      ) {
        return false;
      }

      if (
        statusFilter !== "ALL" &&
        String(product.status || "").toUpperCase() !== statusFilter
      ) {
        return false;
      }

      if (
        categoryFilter !== "ALL" &&
        refId(product.category) !== categoryFilter
      ) {
        return false;
      }

      if (
        brandFilter !== "ALL" &&
        refId(product.brand) !== brandFilter
      ) {
        return false;
      }

      if (
        subcategoryFilter !== "ALL" &&
        refId(product.subcategory) !== subcategoryFilter
      ) {
        return false;
      }

      if (
        stockFilter !== "ALL" &&
        getStockStatus(getStock(product)) !== stockFilter
      ) {
        return false;
      }

      // Rental availability only applies to rental products
      if (rentalFilter !== "ALL") {
        if (getProductType(product) !== "RENTAL") return false;

        if (getRentalStatus(product) !== rentalFilter) return false;
      }

      if (priceRangeActive) {
        const price = getPriceValue(product, priceType);

        // products with no price set are left out while a range is active
        if (price === null || !Number.isFinite(price)) {
          return false;
        }

        if (minPrice !== "" && price < Number(minPrice)) {
          return false;
        }

        if (maxPrice !== "" && price > Number(maxPrice)) {
          return false;
        }
      }

      if (from !== null || to !== null) {
        if (!product.createdAt) return false;

        const time = getCreatedTime(product);

        if (from !== null && time < from) return false;
        if (to !== null && time > to) return false;
      }

      return true;
    });

    return sortProducts(result, sortBy);
  }, [
    products,
    typeFilter,
    statusFilter,
    categoryFilter,
    brandFilter,
    subcategoryFilter,
    stockFilter,
    rentalFilter,
    priceType,
    minPrice,
    maxPrice,
    dateFrom,
    dateTo,
    sortBy,
  ]);

  // Go back to page 1 whenever a filter or the sort changes
  useEffect(() => {
    setCurrentPage(1);
  }, [
    typeFilter,
    statusFilter,
    categoryFilter,
    brandFilter,
    subcategoryFilter,
    stockFilter,
    rentalFilter,
    priceType,
    minPrice,
    maxPrice,
    dateFrom,
    dateTo,
    sortBy,
  ]);

  const hasActiveFilters =
    search.trim() !== "" ||
    typeFilter !== "ALL" ||
    statusFilter !== "ALL" ||
    categoryFilter !== "ALL" ||
    brandFilter !== "ALL" ||
    subcategoryFilter !== "ALL" ||
    stockFilter !== "ALL" ||
    rentalFilter !== "ALL" ||
    priceType !== "retailPrice" ||
    minPrice !== "" ||
    maxPrice !== "" ||
    dateFrom !== "" ||
    dateTo !== "" ||
    sortBy !== "DEFAULT";

  // Number of filters currently set inside the "More filters" panel
  const moreFiltersCount =
    (subcategoryFilter !== "ALL" ? 1 : 0) +
    (stockFilter !== "ALL" ? 1 : 0) +
    (rentalFilter !== "ALL" ? 1 : 0) +
    (priceType !== "retailPrice" ? 1 : 0) +
    (minPrice !== "" ? 1 : 0) +
    (maxPrice !== "" ? 1 : 0) +
    (dateFrom !== "" ? 1 : 0) +
    (dateTo !== "" ? 1 : 0);

  const resetFilters = () => {
    const hadSearch = search.trim() !== "";

    setSearch("");
    setTypeFilter("ALL");
    setStatusFilter("ALL");
    setCategoryFilter("ALL");
    setBrandFilter("ALL");
    setSubcategoryFilter("ALL");
    setStockFilter("ALL");
    setRentalFilter("ALL");
    setPriceType("retailPrice");
    setMinPrice("");
    setMaxPrice("");
    setDateFrom("");
    setDateTo("");
    setSortBy("DEFAULT");
    setCurrentPage(1);

    if (hadSearch) {
      loadProducts("");
    }
  };

  // ==========================================
  // DELETE PRODUCT
  // ==========================================

  const handleDelete = async (id) => {
    if (!id) {
      toast.error("Product ID not found");
      return;
    }

    const confirmed = window.confirm(
      "Are you sure you want to delete this product?"
    );

    if (!confirmed) return;

    try {
      setDeletingId(id);

      await deleteProduct(id);

      toast.success("Product Deleted Successfully");

      await loadProducts(search);
    } catch (error) {
      console.error("DELETE PRODUCT ERROR:", error);

      toast.error(
        error.response?.data?.message ||
        "Delete Failed"
      );
    } finally {
      setDeletingId(null);
    }
  };

  // ==========================================
  // OPEN / CLOSE EDIT MODAL
  // ==========================================

  const openEdit = (product) => {
    setEditingProduct(product);
    setEditForm(createEditForm(product));
  };

  const closeEdit = () => {
    if (saving) return;

    setEditingProduct(null);
    setEditForm(null);
  };

  // ==========================================
  // EDIT INPUT HANDLERS
  // ==========================================

  const updateMainField = (field, value) => {
    setEditForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const updateNestedField = (section, field, value) => {
    setEditForm((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value,
      },
    }));
  };

  // ==========================================
  // SAVE EDIT
  // ==========================================

 
const handleSaveEdit = async (e) => {
  e.preventDefault();

  if (!editingProduct || !editForm) {
    return;
  }

  const id = editingProduct._id || editingProduct.id;

  if (!id) {
    toast.error("Product ID not found");
    return;
  }

  if (!editForm.name.trim()) {
    toast.error("Product name is required");
    return;
  }

  const toNumber = (value, fallback = 0) => {
    if (value === "" || value === null || value === undefined) {
      return fallback;
    }

    const number = Number(value);

    return Number.isFinite(number) ? number : fallback;
  };

  const pricing = {
    purchasePrice: toNumber(editForm.pricing.purchasePrice),
    retailPrice: toNumber(editForm.pricing.retailPrice),
    mrp: toNumber(editForm.pricing.mrp),
    discount: toNumber(editForm.pricing.discount),
    gst: toNumber(editForm.pricing.gst),
  };

  if (editForm.pricing.wholesalePrice !== "") {
    pricing.wholesalePrice = toNumber(
      editForm.pricing.wholesalePrice
    );
  }

  const payload = {
    name: editForm.name.trim(),
    status: editForm.status,
    pricing,
  };

  // ==========================================
  // REFURBISHED PRODUCT
  // ==========================================

  if (editForm.productType === "REFURBISHED") {
    payload.refurbishedDetails = {
      grade: editForm.refurbishedDetails.grade,
      batteryHealth: toNumber(
        editForm.refurbishedDetails.batteryHealth
      ),
      warrantyMonths: toNumber(
        editForm.refurbishedDetails.warrantyMonths
      ),
      testingStatus:
        editForm.refurbishedDetails.testingStatus,
    };
  }

  // ==========================================
  // RENTAL PRODUCT
  // ==========================================

  if (editForm.productType === "RENTAL") {
    payload.rental = {
      monthlyRent: toNumber(editForm.rental.monthlyRent),
      securityDeposit: toNumber(
        editForm.rental.securityDeposit
      ),
      minimumRentalMonths: toNumber(
        editForm.rental.minimumRentalMonths,
        3
      ),
      gst: toNumber(editForm.rental.gst),
      isAvailableForRent:
        editForm.rental.isAvailableForRent,
      basicSoftwareInstalled:
        editForm.rental.basicSoftwareInstalled,
      includedItems: editForm.rental.includedItems
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    };
  }

  // ==========================================
  // UPDATE PRODUCT API
  // ==========================================

  try {
    setSaving(true);

    const response = await updateProduct(id, payload);

    if (response.data?.success === false) {
      throw new Error(
        response.data?.message || "Product update failed"
      );
    }

    toast.success("Product Updated Successfully");

    setEditingProduct(null);
    setEditForm(null);

    await loadProducts(search);
  } 
 
catch (error) {
  const response = error.response?.data;

  console.error("========== PRODUCT UPDATE FAILED ==========");
  console.error("HTTP STATUS:", error.response?.status);
  console.error("BACKEND RESPONSE:", response);
  console.error("VALIDATION ERRORS:", response?.errors);
  console.error("SENT PAYLOAD:", payload);

  let message =
    response?.message ||
    error.message ||
    "Product update failed";

  if (Array.isArray(response?.errors) && response.errors.length) {
    message = response.errors
      .map((item) => {
        if (typeof item === "string") return item;

        return (
          item.message ||
          item.msg ||
          JSON.stringify(item)
        );
      })
      .join(", ");
  }

  toast.error(message);
} finally {
    setSaving(false);
  }
};

  // ==========================================
  // PAGINATION
  // ==========================================

  const totalPages = Math.ceil(
    filteredProducts.length / itemsPerPage
  );

  const safePage = Math.max(
    1,
    Math.min(currentPage, totalPages || 1)
  );

  const firstIndex = (safePage - 1) * itemsPerPage;

  const currentProducts = filteredProducts.slice(
    firstIndex,
    firstIndex + itemsPerPage
  );

  // ==========================================
  // UI
  // ==========================================

  return (
    <div className="product-list1">
      <div className="page-header1">
        <div>
          <h2>Product List</h2>
          <p>Manage all your products</p>
        </div>

        <input
          type="text"
          placeholder="Search Product..."
          value={search}
          onChange={handleSearch}
          className="search-box1"
        />
      </div>

      {/* ======================================
          FILTER BAR
      ====================================== */}

      <div className="product-filters1">
        <div className="product-filter-group1">
          <label htmlFor="product-filter-type">Product type</label>
          <select
            id="product-filter-type"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="ALL">All Types</option>
            <option value="NEW">New</option>
            <option value="REFURBISHED">Refurbished</option>
            <option value="RENTAL">Rental</option>
          </select>
        </div>

        <div className="product-filter-group1">
          <label htmlFor="product-filter-status">Status</label>
          <select
            id="product-filter-status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="ALL">All Status</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </div>

        <div className="product-filter-group1">
          <label htmlFor="product-filter-category">Category</label>
          <select
            id="product-filter-category"
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setSubcategoryFilter("ALL");
            }}
          >
            <option value="ALL">All Categories</option>
            {categoryOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
        </div>

        <div className="product-filter-group1">
          <label htmlFor="product-filter-brand">Brand</label>
          <select
            id="product-filter-brand"
            value={brandFilter}
            onChange={(e) => setBrandFilter(e.target.value)}
          >
            <option value="ALL">All Brands</option>
            {brandOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
        </div>

        <div className="product-filter-group1">
          <label htmlFor="product-filter-sort">Sort by</label>
          <select
            id="product-filter-sort"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="product-filter-actions1">
          <button
            type="button"
            className={
              showMoreFilters || moreFiltersCount > 0
                ? "product-more-btn1 active"
                : "product-more-btn1"
            }
            aria-expanded={showMoreFilters}
            aria-controls="product-more-filters"
            onClick={() => setShowMoreFilters((open) => !open)}
          >
            More filters
            {moreFiltersCount > 0 && (
              <span className="product-more-badge1">
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
              className="product-clear-btn1"
              onClick={resetFilters}
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {showMoreFilters && (
        <div
          id="product-more-filters"
          className="product-filters1 product-more-panel1"
        >
          <div className="product-filter-group1">
            <label htmlFor="product-filter-subcategory">
              Subcategory
            </label>
            <select
              id="product-filter-subcategory"
              value={subcategoryFilter}
              onChange={(e) =>
                setSubcategoryFilter(e.target.value)
              }
            >
              <option value="ALL">All Subcategories</option>
              {subcategoryOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
          </div>

          <div className="product-filter-group1">
            <label htmlFor="product-filter-stock">Stock</label>
            <select
              id="product-filter-stock"
              value={stockFilter}
              onChange={(e) => setStockFilter(e.target.value)}
            >
              <option value="ALL">All Stock</option>
              <option value="IN">In Stock</option>
              <option value="LOW">Low Stock</option>
              <option value="OUT">Out Of Stock</option>
            </select>
          </div>

          <div className="product-filter-group1">
            <label htmlFor="product-filter-rental">
              Rental availability
            </label>
            <select
              id="product-filter-rental"
              value={rentalFilter}
              onChange={(e) => setRentalFilter(e.target.value)}
            >
              <option value="ALL">All</option>
              <option value="AVAILABLE">Available</option>
              <option value="UNAVAILABLE">Unavailable</option>
              <option value="NOT_CONFIGURED">Not Configured</option>
            </select>
          </div>

          <div className="product-filter-group1">
            <label htmlFor="product-filter-price-type">
              Price type
            </label>
            <select
              id="product-filter-price-type"
              value={priceType}
              onChange={(e) => setPriceType(e.target.value)}
            >
              {PRICE_TYPES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="product-filter-group1">
            <label htmlFor="product-filter-min-price">
              Min price (₹)
            </label>
            <input
              id="product-filter-min-price"
              type="number"
              min="0"
              placeholder="e.g. 10000"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
            />
          </div>

          <div className="product-filter-group1">
            <label htmlFor="product-filter-max-price">
              Max price (₹)
            </label>
            <input
              id="product-filter-max-price"
              type="number"
              min="0"
              placeholder="e.g. 30000"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
            />
          </div>

          <div className="product-filter-group1">
            <label htmlFor="product-filter-date-from">
              Added from
            </label>
            <input
              id="product-filter-date-from"
              type="date"
              value={dateFrom}
              max={dateTo || undefined}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>

          <div className="product-filter-group1">
            <label htmlFor="product-filter-date-to">Added to</label>
            <input
              id="product-filter-date-to"
              type="date"
              value={dateTo}
              min={dateFrom || undefined}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
        </div>
      )}

      {!loading && (
        <div className="product-result-count1">
          Showing {filteredProducts.length} of {products.length}{" "}
          products
        </div>
      )}

      {loading ? (
        <div className="loading1">
          Loading Products...
        </div>
      ) : (
        <>
          <div className="table-container1">
            <table className="product-table1">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Image</th>
                  <th>Product Name</th>
                  <th>Type</th>
                  <th>Category</th>
                  <th>Subcategory</th>
                  <th>Brand</th>
                  <th>Refurbished Details</th>
                  <th>Rental Details</th>
                  <th>Purchase Price</th>
                  <th>Retail Price (Personal)</th>
                  <th>Wholesale Price (Business)</th>
                  <th>MRP</th>
                  <th>Discount</th>
                  <th>GST</th>
                  <th>Stock</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {currentProducts.length > 0 ? (
                  currentProducts.map((product, index) => {
                    const id = product._id || product.id;
                    const imageUrl = getImageUrl(product);
                    const productType = getProductType(product);
                    const refurbishedDetails =
                      product.refurbishedDetails;

                    const rentalDetails =
                      getRentalDetails(product);

                    const rentalQuantity =
                      getRentalQuantity(product);

                    const rentalStatus =
                      getRentalStatus(product);

                    return (
                      <tr key={id || index}>
                        <td>{firstIndex + index + 1}</td>

                        <td>
                          {imageUrl ? (
                            <img
                              src={imageUrl}
                              alt={product.name || "Product"}
                              className="table-image1"
                              onError={(e) => {
                                e.currentTarget.style.display =
                                  "none";
                              }}
                            />
                          ) : (
                            <div className="no-image1">
                              No Image
                            </div>
                          )}
                        </td>

                        <td>
                          <strong>
                            {product.name || "N/A"}
                          </strong>
                        </td>

                        <td>
                          <span
                            className={
                              productType === "REFURBISHED"
                                ? "refurbished-badge"
                                : productType === "RENTAL"
                                ? "rental-product-badge"
                                : "new-product-badge"
                            }
                          >
                            {productType === "REFURBISHED"
                              ? "Refurbished"
                              : productType === "RENTAL"
                              ? "Rental"
                              : "New"}
                          </span>
                        </td>

                        <td>
                          {displayName(
                            product.category,
                            categoryNameById
                          )}
                        </td>

                        <td>
                          {displayName(
                            product.subcategory,
                            categoryNameById
                          )}
                        </td>

                        <td>
                          {displayName(product.brand, brandNameById)}
                        </td>

                        <td>
                          {productType === "REFURBISHED" ? (
                            refurbishedDetails ? (
                              <div className="refurbished-details1">
                                <div>
                                  <strong>Grade:</strong>{" "}
                                  {refurbishedDetails.grade || "N/A"}
                                </div>
                                <div>
                                  <strong>Battery:</strong>{" "}
                                  {refurbishedDetails.batteryHealth ?? 0}%
                                </div>
                                <div>
                                  <strong>Warranty:</strong>{" "}
                                  {refurbishedDetails.warrantyMonths ?? 0} months
                                </div>
                                <div>
                                  <strong>Testing:</strong>{" "}
                                  {refurbishedDetails.testingStatus || "N/A"}
                                </div>
                              </div>
                            ) : (
                              "No Details"
                            )
                          ) : (
                            <span className="not-applicable1">
                              N/A
                            </span>
                          )}
                        </td>

                        <td>
                          {productType === "RENTAL" ? (
                            rentalDetails ? (
                              <div className="rental-details1">
                                <div>
                                  <strong>Rental:</strong>{" "}
                                  <span
                                    className={
                                      rentalStatus === "AVAILABLE"
                                        ? "rental-available1"
                                        : "rental-unavailable1"
                                    }
                                  >
                                    {rentalStatus === "AVAILABLE"
                                      ? "Available"
                                      : "Unavailable"}
                                  </span>
                                </div>

                                <div>
                                  <strong>Monthly:</strong> ₹
                                  {formatMoney(rentalDetails.monthlyRent)}
                                </div>

                                <div>
                                  <strong>Deposit:</strong> ₹
                                  {formatMoney(rentalDetails.securityDeposit)}
                                </div>

                                <div>
                                  <strong>Minimum:</strong>{" "}
                                  {rentalDetails.minimumRentalMonths ?? 3} months
                                </div>

                                <div>
                                  <strong>GST:</strong>{" "}
                                  {rentalDetails.gst ?? 0}%
                                </div>

                                <div>
                                  <strong>Available:</strong>{" "}
                                  {rentalQuantity?.available ?? 0}
                                </div>

                                <div>
                                  <strong>Total:</strong>{" "}
                                  {rentalQuantity?.total ?? 0}
                                </div>

                                <div>
                                  <strong>Rented:</strong>{" "}
                                  {rentalQuantity?.rented ?? 0}
                                </div>

                                <div>
                                  <strong>Software:</strong>{" "}
                                  {rentalDetails.basicSoftwareInstalled
                                    ? "Installed"
                                    : "Not Installed"}
                                </div>

                                {Array.isArray(
                                  rentalDetails.includedItems
                                ) &&
                                  rentalDetails.includedItems.length > 0 && (
                                    <div>
                                      <strong>Included:</strong>{" "}
                                      {rentalDetails.includedItems.join(", ")}
                                    </div>
                                  )}
                              </div>
                            ) : (
                              <span className="rental-not-configured1">
                                Rental Not Configured
                              </span>
                            )
                          ) : (
                            <span className="not-applicable1">
                              N/A
                            </span>
                          )}
                        </td>

                        <td>
                          ₹ {formatMoney(product.pricing?.purchasePrice)}
                        </td>

                        <td>
                          ₹ {formatMoney(product.pricing?.retailPrice)}
                        </td>

                        <td>
                          {product.pricing?.wholesalePrice != null ? (
                            <>
                              ₹{" "}
                              {formatMoney(
                                product.pricing.wholesalePrice
                              )}
                            </>
                          ) : (
                            <span className="not-applicable1">
                              Not set
                            </span>
                          )}
                        </td>

                        <td>
                          ₹ {formatMoney(product.pricing?.mrp)}
                        </td>

                        <td>
                          {product.pricing?.discount ?? 0}%
                        </td>

                        <td>
                          {product.pricing?.gst ?? 0}%
                        </td>

                        <td>
                          {product.inventory?.currentStock ??
                            product.stock ??
                            0}
                        </td>

                        <td>
                          <span
                            className={
                              product.status === "ACTIVE"
                                ? "active-status"
                                : "inactive-status"
                            }
                          >
                            {product.status === "ACTIVE"
                              ? "Active"
                              : "Inactive"}
                          </span>
                        </td>

                        <td>
                          <div className="product-actions1">
                            <button
                              type="button"
                              className="edit-btn1"
                              onClick={() => openEdit(product)}
                              disabled={deletingId === id}
                            >
                              <FaEdit /> Edit
                            </button>

                            <button
                              type="button"
                              className="delete-btn1"
                              onClick={() => handleDelete(id)}
                              disabled={deletingId === id}
                            >
                              <FaTrash />{" "}
                              {deletingId === id
                                ? "Deleting..."
                                : "Delete"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={18} className="no-products1">
                      No Products Found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="pagination1">
              <button
                type="button"
                disabled={safePage === 1}
                onClick={() => setCurrentPage(safePage - 1)}
              >
                Previous
              </button>

              {Array.from(
                { length: totalPages },
                (_, index) => (
                  <button
                    type="button"
                    key={index}
                    className={
                      safePage === index + 1
                        ? "active-page"
                        : ""
                    }
                    onClick={() => setCurrentPage(index + 1)}
                  >
                    {index + 1}
                  </button>
                )
              )}

              <button
                type="button"
                disabled={safePage === totalPages}
                onClick={() => setCurrentPage(safePage + 1)}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      {/* ======================================
          EDIT PRODUCT MODAL
      ====================================== */}

      {editingProduct && editForm && (
        <div
          className="product-edit-overlay1"
          onClick={closeEdit}
        >
          <div
            className="product-edit-modal1"
            role="dialog"
            aria-modal="true"
            aria-label="Edit product"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="product-edit-header1">
              <div>
                <h2>Edit Product</h2>
                <p>
                  {editingProduct.name}
                </p>
              </div>

              <button
                type="button"
                className="product-edit-close1"
                onClick={closeEdit}
                disabled={saving}
                aria-label="Close edit product"
              >
                <FaTimes />
              </button>
            </div>

            <form onSubmit={handleSaveEdit}>
              <div className="product-edit-body1">
                <div className="product-edit-grid1">
                  <label>
                    Product Name
                    <input
                      type="text"
                      value={editForm.name}
                      onChange={(e) =>
                        updateMainField(
                          "name",
                          e.target.value
                        )
                      }
                      required
                    />
                  </label>

                  <label>
                    Product Type
                    <input
                      value={editForm.productType}
                      disabled
                    />
                  </label>

                  <label>
                    Status
                    <select
                      value={editForm.status}
                      onChange={(e) =>
                        updateMainField(
                          "status",
                          e.target.value
                        )
                      }
                    >
                      <option value="ACTIVE">Active</option>
                      <option value="INACTIVE">Inactive</option>
                    </select>
                  </label>
                </div>

                <h3>Pricing Details</h3>

                <div className="product-edit-grid1">
                  {[
                    ["purchasePrice", "Purchase Price"],
                    ["retailPrice", "Retail Price"],
                    ["wholesalePrice", "Wholesale Price"],
                    ["mrp", "MRP"],
                    ["discount", "Discount (%)"],
                    ["gst", "GST (%)"],
                  ].map(([field, label]) => (
                    <label key={field}>
                      {label}
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={editForm.pricing[field]}
                        onChange={(e) =>
                          updateNestedField(
                            "pricing",
                            field,
                            e.target.value
                          )
                        }
                      />
                    </label>
                  ))}
                </div>

                {editForm.productType === "REFURBISHED" && (
                  <>
                    <h3>Refurbished Details</h3>

                    <div className="product-edit-grid1">
                      <label>
                        Grade
                        <input
                          value={editForm.refurbishedDetails.grade}
                          onChange={(e) =>
                            updateNestedField(
                              "refurbishedDetails",
                              "grade",
                              e.target.value
                            )
                          }
                        />
                      </label>

                      <label>
                        Battery Health (%)
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={
                            editForm.refurbishedDetails.batteryHealth
                          }
                          onChange={(e) =>
                            updateNestedField(
                              "refurbishedDetails",
                              "batteryHealth",
                              e.target.value
                            )
                          }
                        />
                      </label>

                      <label>
                        Warranty (Months)
                        <input
                          type="number"
                          min="0"
                          value={
                            editForm.refurbishedDetails.warrantyMonths
                          }
                          onChange={(e) =>
                            updateNestedField(
                              "refurbishedDetails",
                              "warrantyMonths",
                              e.target.value
                            )
                          }
                        />
                      </label>

                      <label>
                        Testing Status
                        <input
                          value={
                            editForm.refurbishedDetails.testingStatus
                          }
                          onChange={(e) =>
                            updateNestedField(
                              "refurbishedDetails",
                              "testingStatus",
                              e.target.value
                            )
                          }
                        />
                      </label>
                    </div>
                  </>
                )}

                {editForm.productType === "RENTAL" && (
                  <>
                    <h3>Rental Details</h3>

                    <div className="product-edit-grid1">
                      {[
                        ["monthlyRent", "Monthly Rent"],
                        ["securityDeposit", "Security Deposit"],
                        ["minimumRentalMonths", "Minimum Rental Months"],
                        ["gst", "Rental GST (%)"],
                      ].map(([field, label]) => (
                        <label key={field}>
                          {label}
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={editForm.rental[field]}
                            onChange={(e) =>
                              updateNestedField(
                                "rental",
                                field,
                                e.target.value
                              )
                            }
                          />
                        </label>
                      ))}

                      <label>
                        Rental Availability
                        <select
                          value={
                            editForm.rental.isAvailableForRent
                              ? "true"
                              : "false"
                          }
                          onChange={(e) =>
                            updateNestedField(
                              "rental",
                              "isAvailableForRent",
                              e.target.value === "true"
                            )
                          }
                        >
                          <option value="true">Available</option>
                          <option value="false">Unavailable</option>
                        </select>
                      </label>

                      <label>
                        Basic Software
                        <select
                          value={
                            editForm.rental.basicSoftwareInstalled
                              ? "true"
                              : "false"
                          }
                          onChange={(e) =>
                            updateNestedField(
                              "rental",
                              "basicSoftwareInstalled",
                              e.target.value === "true"
                            )
                          }
                        >
                          <option value="true">Installed</option>
                          <option value="false">Not Installed</option>
                        </select>
                      </label>

                      <label className="product-edit-wide1">
                        Included Items (comma separated)
                        <textarea
                          rows={3}
                          value={editForm.rental.includedItems}
                          onChange={(e) =>
                            updateNestedField(
                              "rental",
                              "includedItems",
                              e.target.value
                            )
                          }
                        />
                      </label>
                    </div>

                    <p className="product-edit-note1">
                      Rental quantities are managed separately
                      through inventory and rental APIs.
                    </p>
                  </>
                )}
              </div>

              <div className="product-edit-footer1">
                <button
                  type="button"
                  className="product-edit-cancel1"
                  onClick={closeEdit}
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="product-edit-save1"
                  disabled={saving}
                >
                  <FaSave />
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductList;
