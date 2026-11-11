import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import {
  FaArrowLeft,
  FaBuilding,
  FaCalendarAlt,
  FaCheckCircle,
  FaEnvelope,
  FaLaptop,
  FaMapMarkerAlt,
  FaMinus,
  FaPhone,
  FaPlus,
  FaRupeeSign,
  FaSearch,
  FaShieldAlt,
  FaSpinner,
  FaUser,
  FaTimes,
  FaRedo,
  FaMoneyBillWave,
  FaCreditCard,
  FaUniversity,
  FaTrashAlt,
  FaShoppingCart,
  FaCodeBranch,
  FaUserTie,
} from "react-icons/fa";

import {
  getRentalProducts,
  createWalkInRentalRequest,
  uploadRentalDocument,
  uploadRentalConditionPhoto,
} from "../../../services/rentalApi";

import { createPayment } from "../../../services/paymentService";
import { getAllBranches } from "../../../services/branchService";
import "./WalkInRental.css";

// ======================================================
// CONSTANTS
// ======================================================

const API = import.meta.env.VITE_API_URL || "";

const MIN_MONTHS = 3;
const MAX_UNITS_INDIVIDUAL = 1;
const MAX_UNITS_COMPANY = 10;
const DEFAULT_GST = 18;

const PHOTO_SIDES = [
  { key: "FRONT", label: "Front Image" },
  { key: "BACK", label: "Back Image" },
  { key: "FULL", label: "Full Image" },
];

const EMPTY_PHOTOS = () => ({
  FRONT: null,
  BACK: null,
  FULL: null,
});

const EMPTY_INDIVIDUAL = {
  fullName: "",
  phone: "",
  email: "",
  address: "",
};

const EMPTY_COMPANY = {
  companyName: "",
  contactPerson: "",
  phone: "",
  email: "",
  officeAddress: "",
  gstNumber: "",
};

const DOCUMENT_CONFIG = {
  INDIVIDUAL: [
    {
      key: "PASSPORT_PHOTO",
      label: "Passport Size Photograph",
      accept: "image/*",
    },
    {
      key: "PAN_CARD",
      label: "PAN Card",
      accept: "image/*,.pdf",
    },
    {
      key: "AADHAAR_CARD",
      label: "Aadhaar Card",
      accept: "image/*,.pdf",
    },
    {
      key: "HOUSE_RENTAL_AGREEMENT",
      label: "House Rental Agreement",
      accept: "image/*,.pdf",
    },
    {
      key: "OFFICE_OR_COLLEGE_ID",
      label: "Office ID / College ID (any one)",
      accept: "image/*,.pdf",
      merged: true,
    },
  ],

  COMPANY: [
    {
      key: "PAN_CARD",
      label: "PAN Card",
      accept: "image/*,.pdf",
    },
    {
      key: "AADHAAR_CARD",
      label: "Authorized Person Aadhaar Card",
      accept: "image/*,.pdf",
    },
    {
      key: "GST_REGISTRATION",
      label: "GST Registration",
      accept: "image/*,.pdf",
    },
    {
      key: "OFFICE_ID",
      label: "Office ID",
      accept: "image/*,.pdf",
    },
    {
      key: "AUTHORIZATION_LETTER",
      label: "Authorization Letter",
      accept: "image/*,.pdf",
    },
  ],
};

const PAYMENT_METHODS = [
  { value: "CASH", label: "Cash" },
  { value: "UPI", label: "UPI" },
  { value: "CARD", label: "Card" },
  { value: "BANK_TRANSFER", label: "Bank Transfer" },
  { value: "ONLINE", label: "Online" },
];

// CUSTOMER SOURCE OPTIONS (OPTIONAL FIELD)
// "How did you come to know about ZAID Infotech?"
// value = saved in database (must match backend customerSource keys)
// label = shown in the dropdown
const CUSTOMER_SOURCE_OPTIONS = [
  { value: "GOOGLE", label: "Google Search / Google Maps" },
  { value: "INSTAGRAM_FACEBOOK", label: "Instagram / Facebook" },
  { value: "YOUTUBE", label: "YouTube" },
  { value: "REFERRAL", label: "Friends or Family Referral" },
  { value: "EXISTING_CUSTOMER", label: "Existing Customer" },
  { value: "SHOP_BOARD", label: "Walk-in / Shop Board" },
  { value: "ONLINE_AD", label: "Online Advertisement" },
  { value: "INFLUENCER", label: "Influencer / Blogger Recommendation" },
  { value: "WHATSAPP", label: "WhatsApp" },
  { value: "OTHER", label: "Other" },
];

// ======================================================
// HELPERS
// ======================================================

const round = (value) =>
  Math.round((Number(value) + Number.EPSILON) * 100) / 100;

const money = (value) =>
  `₹${Number(value || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;

const firstArray = (response) =>
  [
    response,
    response?.data,
    response?.products,
    response?.data?.products,
    response?.data?.data,
    response?.data?.data?.products,
  ].find(Array.isArray) || [];

// Branch list can come back in several shapes depending on the
// axios interceptor / backend response format.
const branchList = (response) =>
  [
    response,
    response?.data,
    response?.branches,
    response?.data?.branches,
    response?.data?.data,
    response?.data?.data?.branches,
  ].find(Array.isArray) || [];

const branchIdOf = (branch) =>
  String(branch?._id || branch?.id || "");

const branchNameOf = (branch) =>
  branch?.name ||
  branch?.branchName ||
  branch?.title ||
  "Unnamed Branch";

// Reads the logged-in user saved in localStorage ("user" key).
const readLoggedInUser = () => {
  try {
    const raw = localStorage.getItem("user");
    if (!raw) return null;

    const parsed = JSON.parse(raw);

    return parsed && typeof parsed === "object" ? parsed : null;
  } catch (error) {
    console.error("LOCALSTORAGE USER PARSE ERROR", error);
    return null;
  }
};

const productObject = (item) =>
  (item?.productId && typeof item.productId === "object"
    ? item.productId
    : null) ||
  (item?.product && typeof item.product === "object"
    ? item.product
    : null) ||
  item ||
  {};

const productId = (item) => {
  const product = productObject(item);

  return String(
    product?._id ||
      product?.id ||
      (typeof item?.productId === "string"
        ? item.productId
        : "") ||
      item?._id ||
      item?.id ||
      ""
  );
};

const rentalProductId = (item) =>
  String(
    (typeof item?.rentalProductId === "object"
      ? item?.rentalProductId?._id ||
        item?.rentalProductId?.id
      : item?.rentalProductId) ||
      item?.rentalProduct?._id ||
      item?.rentalProduct?.id ||
      item?._id ||
      item?.id ||
      ""
  );

const productName = (item) =>
  productObject(item)?.name ||
  productObject(item)?.title ||
  item?.name ||
  item?.productName ||
  "Rental Laptop";

const brandName = (item) => {
  const brand = productObject(item)?.brand || item?.brand;

  return typeof brand === "object"
    ? brand?.name || brand?.title || ""
    : brand || "";
};

const productSku = (item) =>
  productObject(item)?.sku ||
  productObject(item)?.productCode ||
  item?.sku ||
  "N/A";

const monthlyRent = (item) =>
  Number(
    item?.monthlyRent ??
      item?.rental?.monthlyRent ??
      item?.rentalDetails?.monthlyRent ??
      item?.pricing?.monthlyRent ??
      productObject(item)?.monthlyRent ??
      productObject(item)?.rental?.monthlyRent ??
      productObject(item)?.rentalDetails?.monthlyRent ??
      productObject(item)?.pricing?.monthlyRent ??
      0
  );

const depositAmount = (item) =>
  Number(
    item?.securityDeposit ??
      item?.rental?.securityDeposit ??
      item?.rentalDetails?.securityDeposit ??
      item?.pricing?.securityDeposit ??
      productObject(item)?.securityDeposit ??
      productObject(item)?.rental?.securityDeposit ??
      productObject(item)?.rentalDetails?.securityDeposit ??
      0
  );

const minimumMonths = (item) =>
  Math.max(
    MIN_MONTHS,
    Number(
      item?.minimumRentalMonths ??
        item?.minRentalMonths ??
        item?.rental?.minimumRentalMonths ??
        item?.rentalDetails?.minimumRentalMonths ??
        productObject(item)?.minimumRentalMonths ??
        productObject(item)?.minRentalMonths ??
        MIN_MONTHS
    ) || MIN_MONTHS
  );

const availableQuantity = (item) =>
  Number(
    item?.availableQuantity ??
      item?.availableQty ??
      item?.availableStock ??
      item?.rental?.availableQuantity ??
      item?.rentalDetails?.availableQuantity ??
      productObject(item)?.availableQuantity ??
      productObject(item)?.rental?.availableQuantity ??
      productObject(item)?.rentalDetails?.availableQuantity ??
      item?.quantity ??
      0
  );

const isRentalProduct = (item) => {
  if (!item) return false;

  const type = String(
    item?.productType ??
      productObject(item)?.productType ??
      ""
  ).toUpperCase();

  return (
    type === "RENTAL" ||
    Boolean(item?.rentalProductId) ||
    [
      item?.monthlyRent,
      item?.securityDeposit,
      item?.minimumRentalMonths,
      item?.isAvailableForRent,
      item?.rental,
      item?.rentalDetails,
    ].some((value) => value !== undefined && value !== null)
  );
};

const imageUrl = (item) => {
  const product = productObject(item);

  let image =
    item?.primaryImage ||
    item?.image ||
    item?.imageUrl ||
    item?.thumbnail ||
    product?.primaryImage ||
    product?.image ||
    product?.imageUrl ||
    product?.thumbnail ||
    "";

  if (product?.images?.length) image = product.images[0];
  if (item?.images?.length) image = item.images[0];

  if (typeof image === "object") {
    image =
      image?.url ||
      image?.path ||
      image?.fileUrl ||
      image?.src ||
      "";
  }

  if (!image) return "";

  if (/^https?:\/\//i.test(image)) return image;

  const host = String(API)
    .replace(/\/api\/?$/, "")
    .replace(/\/$/, "");

  return `${host}/${String(image).replace(/^\/+/, "")}`;
};

const getCreatedRentals = (response) => {
  const queue = [response];
  const seen = new Set();

  while (queue.length) {
    const node = queue.shift();

    if (!node || typeof node !== "object" || seen.has(node)) {
      continue;
    }

    seen.add(node);

    if (Array.isArray(node.rentals)) {
      const rentals = node.rentals.filter(
        (r) => r && (r._id || r.id)
      );

      if (rentals.length) {
        return {
          rentals,
          warnings: node.warnings || [],
        };
      }
    }

    if (node.rental?._id || node.rental?.id) {
      return {
        rentals: [node.rental],
        warnings: node.warnings || [],
      };
    }

    if (
      (node._id || node.id) &&
      (node.rentalNumber ||
        node.rentalProductId ||
        node.customerType ||
        node.orderId)
    ) {
      return {
        rentals: [node],
        warnings: node.warnings || [],
      };
    }

    for (const key of [
      "data",
      "result",
      "payload",
      "response",
      "body",
    ]) {
      if (node[key] && typeof node[key] === "object") {
        queue.push(node[key]);
      }
    }
  }

  return {
    rentals: [],
    warnings: [],
  };
};

const validateFile = (file, isPhoto) => {
  if (!file) return "Please select a file.";

  const types = isPhoto
    ? ["image/jpeg", "image/png", "image/webp"]
    : [
        "image/jpeg",
        "image/png",
        "image/webp",
        "application/pdf",
      ];

  if (!types.includes(file.type)) {
    return isPhoto
      ? "Only JPG, PNG or WEBP allowed."
      : "Only JPG, PNG, WEBP or PDF allowed.";
  }

  const maxMB = isPhoto ? 5 : 10;

  if (file.size > maxMB * 1024 * 1024) {
    return `Maximum file size is ${maxMB} MB.`;
  }

  return "";
};

// ======================================================
// CONDITION IMAGE PREVIEW
// ======================================================

function ConditionPreview({ file, label }) {
  const [url, setUrl] = useState("");

  useEffect(() => {
    if (!file) {
      setUrl("");
      return;
    }

    const objectUrl = URL.createObjectURL(file);

    setUrl(objectUrl);

    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  return url ? (
    <img
      className="wir-condition-preview"
      src={url}
      alt={label}
    />
  ) : (
    <div className="wir-condition-placeholder">
      <span>📷</span>
      <p>No image selected</p>
    </div>
  );
}

// ======================================================
// MAIN COMPONENT
// ======================================================

function WalkInRental() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState([]);

  // ----------------------------------------------------
  // SALESPERSON (logged-in user from localStorage)
  // ----------------------------------------------------
  const salesperson = useMemo(() => {
    const user = readLoggedInUser();

    if (!user) return null;

    const id = String(user.id || user._id || "");

    const fullName =
      [user.firstName, user.lastName]
        .filter(Boolean)
        .join(" ")
        .trim() ||
      user.name ||
      user.fullName ||
      user.email ||
      "";

    return {
      id,
      name: fullName,
      email: user.email || "",
      phone: user.phone || "",
      // If the user record already carries a branch, use it as default
      branchId: String(
        (typeof user.branchId === "object"
          ? user.branchId?._id || user.branchId?.id
          : user.branchId) ||
          (typeof user.branch === "object"
            ? user.branch?._id || user.branch?.id
            : user.branch) ||
          ""
      ),
    };
  }, []);

  // ----------------------------------------------------
  // BRANCH
  // ----------------------------------------------------
  const [branches, setBranches] = useState([]);
  const [branchesLoading, setBranchesLoading] = useState(true);
  const [branchId, setBranchId] = useState(
    salesperson?.branchId || ""
  );

  const [customerType, setCustomerType] =
    useState("INDIVIDUAL");

  const [individualDetails, setIndividualDetails] =
    useState({ ...EMPTY_INDIVIDUAL });

  const [companyDetails, setCompanyDetails] =
    useState({ ...EMPTY_COMPANY });

  const [rentalDuration, setRentalDuration] =
    useState(MIN_MONTHS);

  const [handoverDescription, setHandoverDescription] =
    useState("");

  const [documents, setDocuments] = useState({});

  const [officeOrCollegeType, setOfficeOrCollegeType] =
    useState("OFFICE_ID");

  const [conditionPhotos, setConditionPhotos] = useState({});

  // Customer source tracking (OPTIONAL)
  // customerSource = key of the selected option (e.g. GOOGLE, OTHER)
  // customerSourceOther = free text, used only when key is OTHER
  const [customerSource, setCustomerSource] = useState("");
  const [customerSourceOther, setCustomerSourceOther] =
    useState("");

  // GST / NON GST
  const [billingType, setBillingType] = useState("GST");

  const [gstPercentage, setGstPercentage] =
    useState(DEFAULT_GST);

  // Negotiation per rental product
  const [negotiations, setNegotiations] = useState({});

  // Deposit
  const [depositPaid, setDepositPaid] = useState(false);

  const [depositAmountPaid, setDepositAmountPaid] =
    useState(0);

  const [depositPaymentMethod, setDepositPaymentMethod] =
    useState("CASH");

  const [
    depositPaymentReference,
    setDepositPaymentReference,
  ] = useState("");

  // First rent installment
  const [rentPaidNow, setRentPaidNow] = useState(false);

  const [rentPaymentMethod, setRentPaymentMethod] =
    useState("CASH");

  const [rentPaymentReference, setRentPaymentReference] =
    useState("");

  // ====================================================
  // DERIVED VALUES
  // ====================================================

  const maxUnits =
    customerType === "COMPANY"
      ? MAX_UNITS_COMPANY
      : MAX_UNITS_INDIVIDUAL;

  const cartTotalUnits = useMemo(
    () => cart.reduce((sum, c) => sum + c.quantity, 0),
    [cart]
  );

  const minDuration = useMemo(
    () =>
      Math.max(
        MIN_MONTHS,
        ...cart.map((c) => minimumMonths(c.product))
      ),
    [cart]
  );

  const currentDocuments = DOCUMENT_CONFIG[customerType];

  const unitEntries = useMemo(
    () =>
      cart.flatMap((c) =>
        Array.from({ length: c.quantity }, (_, index) => ({
          key: `${c.rentalProductId}:${index}`,
          rentalProductId: c.rentalProductId,
          name: productName(c.product),
          index: index + 1,
        }))
      ),
    [cart]
  );

  const isNonGst = billingType === "NON_GST";

  const effectiveGstPercentage = isNonGst
    ? 0
    : Number(gstPercentage);

  // ====================================================
  // LOAD BRANCHES
  // ====================================================

  useEffect(() => {
    let cancelled = false;

    const loadBranches = async () => {
      try {
        setBranchesLoading(true);

        const response = await getAllBranches();
        const list = branchList(response).filter(
          (b) => branchIdOf(b)
        );

        if (cancelled) return;

        setBranches(list);

        setBranchId((current) => {
          // keep a valid existing choice
          if (
            current &&
            list.some((b) => branchIdOf(b) === current)
          ) {
            return current;
          }

          // only one branch -> select it automatically
          if (list.length === 1) {
            return branchIdOf(list[0]);
          }

          return "";
        });
      } catch (error) {
        console.error("LOAD BRANCHES ERROR", error);

        if (!cancelled) {
          toast.error(
            error?.response?.data?.message ||
              error?.message ||
              "Failed to load branches"
          );
        }
      } finally {
        if (!cancelled) setBranchesLoading(false);
      }
    };

    loadBranches();

    return () => {
      cancelled = true;
    };
  }, []);

  // ====================================================
  // LOAD PRODUCTS
  // ====================================================

  const loadProducts = async (refresh = false) => {
    try {
      if (refresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const response = await getRentalProducts();

      const list = firstArray(response).filter(isRentalProduct);

      setProducts(list);

      setCart((prev) =>
        prev
          .map((c) => {
            const fresh = list.find(
              (p) =>
                rentalProductId(p) === c.rentalProductId
            );

            if (!fresh || availableQuantity(fresh) <= 0) {
              return null;
            }

            return {
              ...c,
              product: fresh,
              quantity: Math.min(
                c.quantity,
                availableQuantity(fresh)
              ),
            };
          })
          .filter(Boolean)
      );
    } catch (error) {
      console.error("LOAD RENTAL PRODUCTS ERROR", error);

      toast.error(
        error?.response?.data?.message ||
          error?.message ||
          "Failed to load rental products"
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  useEffect(() => {
    setRentalDuration((prev) =>
      Math.max(prev, minDuration)
    );
  }, [minDuration]);

  useEffect(() => {
    setDepositPaid(false);
    setDepositAmountPaid(0);
    setDepositPaymentMethod("CASH");
    setDepositPaymentReference("");

    setRentPaidNow(false);
    setRentPaymentMethod("CASH");
    setRentPaymentReference("");
  }, [cart]);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();

    if (!q) return products;

    return products.filter((p) =>
      [
        productName(p),
        brandName(p),
        productSku(p),
      ].some((value) =>
        String(value).toLowerCase().includes(q)
      )
    );
  }, [products, search]);

  const quantityInCart = (id) =>
    cart.find((c) => c.rentalProductId === id)?.quantity || 0;

  const limitMessage =
    customerType === "COMPANY"
      ? `Company can rent a maximum of ${MAX_UNITS_COMPANY} laptops.`
      : "Individual customer can rent only 1 laptop.";

  // ====================================================
  // CART ACTIONS
  // ====================================================

  const addToCart = (item) => {
    if (!isRentalProduct(item)) {
      return toast.error(
        "Only rental products can be selected."
      );
    }

    if (availableQuantity(item) <= 0) {
      return toast.error("This laptop is out of stock.");
    }

    if (cartTotalUnits >= maxUnits) {
      return toast.error(limitMessage);
    }

    const id = rentalProductId(item);

    setCart((prev) => {
      const found = prev.find(
        (c) => c.rentalProductId === id
      );

      if (found) {
        if (found.quantity >= availableQuantity(item)) {
          toast.error("Insufficient stock.");
          return prev;
        }

        return prev.map((c) =>
          c.rentalProductId === id
            ? { ...c, quantity: c.quantity + 1 }
            : c
        );
      }

      return [
        ...prev,
        {
          rentalProductId: id,
          productId: productId(item),
          product: item,
          quantity: 1,
        },
      ];
    });
  };

  const changeQuantity = (id, delta) => {
    if (delta > 0 && cartTotalUnits >= maxUnits) {
      return toast.error(limitMessage);
    }

    setCart((prev) =>
      prev
        .map((c) => {
          if (c.rentalProductId !== id) return c;

          if (
            delta > 0 &&
            c.quantity >= availableQuantity(c.product)
          ) {
            toast.error("Insufficient stock.");
            return c;
          }

          return {
            ...c,
            quantity: c.quantity + delta,
          };
        })
        .filter((c) => c.quantity > 0)
    );
  };

  const removeFromCart = (id) => {
    setCart((prev) =>
      prev.filter((c) => c.rentalProductId !== id)
    );
  };

  const changeCustomerType = (type) => {
    setCustomerType(type);
    setDocuments({});

    if (type === "INDIVIDUAL" && cartTotalUnits > 1) {
      setCart((prev) =>
        prev
          .slice(0, 1)
          .map((c) => ({ ...c, quantity: 1 }))
      );

      toast.info(
        "Individual customer can rent only one laptop. Extra units removed."
      );
    }
  };

  // NOTE: branch is intentionally NOT reset here. The receptionist
  // works from one branch, so it should stay selected between rentals.
  const resetForm = () => {
    setCart([]);
    setSearch("");
    setCustomerType("INDIVIDUAL");

    setIndividualDetails({ ...EMPTY_INDIVIDUAL });
    setCompanyDetails({ ...EMPTY_COMPANY });

    setRentalDuration(MIN_MONTHS);
    setHandoverDescription("");
    setDocuments({});
    setOfficeOrCollegeType("OFFICE_ID");
    setConditionPhotos({});
    setNegotiations({});

    // reset customer source
    setCustomerSource("");
    setCustomerSourceOther("");

    setBillingType("GST");
    setGstPercentage(DEFAULT_GST);

    setDepositPaid(false);
    setDepositAmountPaid(0);
    setDepositPaymentMethod("CASH");
    setDepositPaymentReference("");

    setRentPaidNow(false);
    setRentPaymentMethod("CASH");
    setRentPaymentReference("");
  };

  // ====================================================
  // DOCUMENTS AND PHOTOS
  // ====================================================

  const handleDocumentChange = (key, event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    const error = validateFile(file, false);

    if (error) {
      toast.error(error);
      event.target.value = "";
      return;
    }

    setDocuments((prev) => ({
      ...prev,
      [key]: file,
    }));
  };

  const handlePhotoChange = (unitKey, side, event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    const error = validateFile(file, true);

    if (error) {
      toast.error(error);
      event.target.value = "";
      return;
    }

    setConditionPhotos((prev) => ({
      ...prev,
      [unitKey]: {
        ...(prev[unitKey] || EMPTY_PHOTOS()),
        [side]: file,
      },
    }));
  };

  // ====================================================
  // GST / NON-GST / NEGOTIATED PRICING
  // ====================================================

  const pricing = useMemo(() => {
    const duration = Math.max(
      MIN_MONTHS,
      Number(rentalDuration) || MIN_MONTHS
    );

    // NON_GST always means zero GST.
    const gstRate =
      billingType === "NON_GST"
        ? 0
        : Number(gstPercentage) || 0;

    const items = cart.map((c) => {
      const originalMonthlyRent = monthlyRent(c.product);

      const negotiation = negotiations[c.rentalProductId] || {};

      const negotiated = Boolean(negotiation.enabled);

      const negotiatedMonthlyRent = negotiated
        ? Number(negotiation.rate ?? originalMonthlyRent)
        : originalMonthlyRent;

      const effectiveMonthlyRent = negotiatedMonthlyRent;

      const lineRent = round(
        effectiveMonthlyRent * duration * c.quantity
      );

      const lineGst =
        billingType === "NON_GST"
          ? 0
          : round((lineRent * gstRate) / 100);

      const lineDeposit = round(
        depositAmount(c.product) * c.quantity
      );

      const firstRent = round(
        effectiveMonthlyRent * c.quantity
      );

      const firstGst =
        billingType === "NON_GST"
          ? 0
          : round((firstRent * gstRate) / 100);

      const firstInstallment = round(
        firstRent + firstGst
      );

      return {
        rentalProductId: c.rentalProductId,
        productId: c.productId,
        name: productName(c.product),
        quantity: c.quantity,

        originalMonthlyRent,
        negotiatedMonthlyRent,
        monthlyRent: effectiveMonthlyRent,

        negotiated,
        pricingType: negotiated
          ? "NEGOTIATED"
          : "STANDARD",

        negotiationReason: negotiated
          ? String(negotiation.reason || "").trim()
          : "",

        billingType,
        gstPercentage: gstRate,

        lineRent,
        lineGst,
        lineDeposit,

        lineTotal: round(
          lineRent + lineGst + lineDeposit
        ),

        firstRent,
        firstGst,
        firstInstallment,
      };
    });

    const rentSubtotal = round(
      items.reduce((sum, item) => sum + item.lineRent, 0)
    );

    const gstAmount =
      billingType === "NON_GST"
        ? 0
        : round(
            items.reduce(
              (sum, item) => sum + item.lineGst,
              0
            )
          );

    const rentTotalAmount = round(
      rentSubtotal + gstAmount
    );

    const securityDeposit = round(
      items.reduce(
        (sum, item) => sum + item.lineDeposit,
        0
      )
    );

    const firstInstallmentTotal = round(
      items.reduce(
        (sum, item) => sum + item.firstInstallment,
        0
      )
    );

    return {
      items,
      duration,
      durationType: "MONTHS",
      billingType,
      gstPercentage: gstRate,

      rentSubtotal,
      gstAmount,
      rentTotalAmount,

      securityDeposit,

      totalAmount: round(
        rentTotalAmount + securityDeposit
      ),

      firstInstallmentTotal,
      installmentCount: duration,
    };
  }, [
    cart,
    rentalDuration,
    negotiations,
    billingType,
    gstPercentage,
  ]);

  // ====================================================
  // DEPOSIT SUMMARY
  // ====================================================

  const depositExpected = pricing.securityDeposit;

  const depositReceived = depositPaid
    ? Number(depositAmountPaid || 0)
    : 0;

  const depositBalance = Math.max(
    0,
    round(depositExpected - depositReceived)
  );

  const depositStatus =
    depositExpected <= 0 ||
    depositReceived >= depositExpected
      ? "PAID"
      : depositReceived > 0
      ? "PARTIAL"
      : "UNPAID";

  const changeDepositPaid = (checked) => {
    setDepositPaid(checked);

    setDepositAmountPaid(
      checked ? depositExpected : 0
    );

    setDepositPaymentMethod(
      checked ? "CASH" : "NONE"
    );

    setDepositPaymentReference("");
  };

  // ====================================================
  // VALIDATION
  // ====================================================

  const validateForm = () => {
    if (!salesperson?.id) {
      toast.error(
        "Logged-in user not found. Please log in again."
      );
      return false;
    }

    if (!branchId) {
      toast.error("Please select a branch.");
      return false;
    }

    if (!cart.length) {
      toast.error("Please select a rental laptop.");
      return false;
    }

    if (cartTotalUnits > maxUnits) {
      toast.error(limitMessage);
      return false;
    }

    if (
      !Number.isInteger(Number(rentalDuration)) ||
      Number(rentalDuration) < minDuration
    ) {
      toast.error(
        `Minimum rental duration is ${minDuration} months.`
      );
      return false;
    }

    for (const c of cart) {
      const fresh =
        products.find(
          (p) =>
            rentalProductId(p) === c.rentalProductId
        ) || c.product;

      if (c.quantity > availableQuantity(fresh)) {
        toast.error(
          `Insufficient stock for ${productName(fresh)}.`
        );
        return false;
      }

      const item = pricing.items.find(
        (i) => i.rentalProductId === c.rentalProductId
      );

      if (
        !Number.isFinite(item.negotiatedMonthlyRent) ||
        item.negotiatedMonthlyRent < 0
      ) {
        toast.error(
          `Invalid negotiated rent for ${item.name}.`
        );
        return false;
      }

      if (item.negotiated && !item.negotiationReason) {
        toast.error(
          `Enter negotiation reason for ${item.name}.`
        );
        return false;
      }
    }

    if (
      billingType === "GST" &&
      (!Number.isFinite(Number(gstPercentage)) ||
        String(gstPercentage).trim() === "" ||
        Number(gstPercentage) < 0 ||
        Number(gstPercentage) > 100)
    ) {
      toast.error(
        "Enter a valid GST percentage (0–100)."
      );
      return false;
    }

    if (
      customerType === "INDIVIDUAL" &&
      (!individualDetails.fullName.trim() ||
        !individualDetails.phone.trim())
    ) {
      toast.error(
        "Customer name and phone are required."
      );
      return false;
    }

    if (
      customerType === "COMPANY" &&
      (!companyDetails.companyName.trim() ||
        !companyDetails.contactPerson.trim() ||
        !companyDetails.phone.trim())
    ) {
      toast.error(
        "Company name, contact person and phone are required."
      );
      return false;
    }

    // NOTE: "How did you come to know about ZAID Infotech?"
    // is OPTIONAL, so there is intentionally no validation
    // for customerSource here.

    if (
      depositPaid &&
      (!Number.isFinite(depositReceived) ||
        depositReceived <= 0 ||
        depositReceived > depositExpected)
    ) {
      toast.error(
        "Deposit paid must be greater than zero and no more than required deposit."
      );
      return false;
    }

    if (
      !depositPaid &&
      Number(depositAmountPaid) > 0
    ) {
      toast.error(
        "Tick Deposit Paid before entering received deposit."
      );
      return false;
    }

    if (
      depositPaid &&
      depositPaymentMethod !== "CASH" &&
      !depositPaymentReference.trim()
    ) {
      toast.error(
        "Enter deposit transaction reference."
      );
      return false;
    }

    if (
      rentPaidNow &&
      rentPaymentMethod !== "CASH" &&
      !rentPaymentReference.trim()
    ) {
      toast.error(
        "Enter rent transaction reference."
      );
      return false;
    }

    for (const doc of currentDocuments) {
      if (!documents[doc.key]) {
        toast.error(
          `Please upload ${doc.label}.`
        );
        return false;
      }
    }

    for (const unit of unitEntries) {
      for (const side of PHOTO_SIDES) {
        if (!conditionPhotos[unit.key]?.[side.key]) {
          toast.error(
            `Upload ${side.label} for ${unit.name} (Unit ${unit.index}).`
          );
          return false;
        }
      }
    }

    return true;
  };

  // ====================================================
  // UPLOAD DOCUMENTS
  // ====================================================

  const uploadAllDocuments = async (id) => {
    for (const doc of currentDocuments) {
      const type = doc.merged
        ? officeOrCollegeType
        : doc.key;

      const response = await uploadRentalDocument(
        id,
        type,
        documents[doc.key]
      );

      if (
        response?.success === false ||
        response?.data?.success === false
      ) {
        throw new Error(
          response?.message ||
            `Failed to upload ${doc.label}.`
        );
      }
    }
  };

  const uploadPhotosForRental = async (id, photos) => {
    for (const side of PHOTO_SIDES) {
      const response = await uploadRentalConditionPhoto(
        id,
        side.key,
        photos[side.key]
      );

      if (
        response?.success === false ||
        response?.data?.success === false
      ) {
        throw new Error(
          response?.message ||
            `Failed to upload ${side.label}.`
        );
      }
    }
  };

  // ====================================================
  // SUBMIT RENTAL
  // ====================================================

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (submitting || !validateForm()) return;

    setSubmitting(true);

    let orderCreated = false;

    try {
      const payload = {
        rentalSource: "WALK_IN",
        customerType,

        // BRANCH + SALESPERSON
        // branchId  -> selected in the dropdown
        // soldBy    -> logged-in user (from localStorage)
        branchId,
        soldBy: salesperson.id,

        items: cart.map((c) => {
          const p = pricing.items.find(
            (i) =>
              i.rentalProductId === c.rentalProductId
          );

          return {
            rentalProductId: c.rentalProductId,
            quantity: c.quantity,

            originalMonthlyRent: p.originalMonthlyRent,
            negotiatedMonthlyRent: p.negotiatedMonthlyRent,

            monthlyRent: p.monthlyRent,

            pricingType: p.pricingType,
            negotiationReason: p.negotiationReason,

            billingType,
            gstPercentage: effectiveGstPercentage,

            rentSubtotal: p.lineRent,
            rentGstAmount: p.lineGst,
            rentTotalAmount: round(
              p.lineRent + p.lineGst
            ),
          };
        }),

        individualDetails:
          customerType === "INDIVIDUAL"
            ? {
                ...individualDetails,
                fullName:
                  individualDetails.fullName.trim(),
                phone:
                  individualDetails.phone.trim(),
                email:
                  individualDetails.email
                    .trim()
                    .toLowerCase(),
                address:
                  individualDetails.address.trim(),
              }
            : undefined,

        companyDetails:
          customerType === "COMPANY"
            ? {
                ...companyDetails,
                companyName:
                  companyDetails.companyName.trim(),
                contactPerson:
                  companyDetails.contactPerson.trim(),
                phone:
                  companyDetails.phone.trim(),
                email:
                  companyDetails.email
                    .trim()
                    .toLowerCase(),
                officeAddress:
                  companyDetails.officeAddress.trim(),
                gstNumber:
                  companyDetails.gstNumber
                    .trim()
                    .toUpperCase(),
              }
            : undefined,

        rentalDurationType: "MONTHS",
        rentalDuration: pricing.duration,

        // Explicit tax treatment
        billingType,
        gstPercentage: effectiveGstPercentage,

        // Entire order rent (all units)
        rentSubtotal: pricing.rentSubtotal,
        gstAmount: pricing.gstAmount,
        rentGstAmount: pricing.gstAmount,
        rentTotalAmount: pricing.rentTotalAmount,

        // Deposit is separate from taxable rent
        securityDeposit: pricing.securityDeposit,

        depositAmountPaid: depositReceived,

        depositPaymentMethod:
          depositReceived > 0
            ? depositPaymentMethod
            : "NONE",

        depositPaymentReference:
          depositReceived > 0
            ? depositPaymentReference.trim()
            : "",

        rentPaidNow,

        rentPaymentMethod: rentPaidNow
          ? rentPaymentMethod
          : "",

        rentPaymentReference: rentPaidNow
          ? rentPaymentReference.trim()
          : "",

        notes: handoverDescription.trim(),
        handoverNotes: handoverDescription.trim(),
      };

      // CUSTOMER SOURCE IS OPTIONAL
      // Only sent when the user actually selected something.
      if (customerSource) {
        payload.customerSource = customerSource;

        if (
          customerSource === "OTHER" &&
          customerSourceOther.trim()
        ) {
          payload.customerSourceOther =
            customerSourceOther.trim();
        }
      }

      console.log("WALK-IN RENTAL PAYLOAD", payload);

      const response =
        await createWalkInRentalRequest(payload);

      if (
        response?.success === false ||
        response?.data?.success === false
      ) {
        throw new Error(
          response?.message ||
            response?.data?.message ||
            "Rental creation failed."
        );
      }

      orderCreated = true;

      const { rentals, warnings } =
        getCreatedRentals(response);

      if (!rentals.length) {
        toast.warning(
          "Rental may have been created, but rental IDs are missing. Check Orders before retrying to avoid duplicates."
        );

        navigate(
          "/receptionist-dashboard/rental/orders"
        );

        return;
      }

      // ================================================
      // VERIFY BACKEND TAX / PRICING / BRANCH
      // ================================================

      for (const rental of rentals) {
        const savedBillingType = String(
          rental.billingType || ""
        ).toUpperCase();

        if (
          savedBillingType &&
          savedBillingType !== billingType
        ) {
          toast.warning(
            `Rental ${rental.rentalNumber || ""}: backend billing type differs from selected ${billingType}. Please verify.`
          );
        }

        if (
          billingType === "NON_GST" &&
          (Number(rental.gstPercentage || 0) > 0 ||
            Number(rental.rentGstAmount || 0) > 0)
        ) {
          toast.error(
            `Rental ${rental.rentalNumber || ""}: backend saved GST despite NON_GST selection. Please correct backend before collecting payment.`
          );
        }

        // Warn if backend ignored branch / salesperson
        const savedBranch =
          rental.branchId && typeof rental.branchId === "object"
            ? rental.branchId._id || rental.branchId.id
            : rental.branchId;

        const savedSoldBy =
          rental.soldBy && typeof rental.soldBy === "object"
            ? rental.soldBy._id || rental.soldBy.id
            : rental.soldBy;

        if (!savedBranch || !savedSoldBy) {
          console.warn(
            `Rental ${rental.rentalNumber || ""}: branchId / soldBy not returned by backend.`
          );
        }
      }

      // ================================================
      // DEPOSIT PAYMENT RECORD
      // ================================================

      let paymentFailed = false;

      for (const rental of rentals) {
        const amount = Number(
          rental.depositAmountPaid || 0
        );

        // Do not create a second payment if backend
        // already returned its payment reference.
        if (
          amount <= 0 ||
          rental.securityDepositPaymentId
        ) {
          continue;
        }

        try {
          const paymentResponse = await createPayment({
            paymentFor: "RENTAL",
            paymentType: "SECURITY_DEPOSIT",

            referenceId: rental._id || rental.id,
            amount,

            paymentMethod:
              depositPaymentMethod === "BANK_TRANSFER"
                ? "NET_BANKING"
                : depositPaymentMethod === "ONLINE"
                ? "UPI"
                : depositPaymentMethod,

            paymentStatus: "SUCCESS",

            paymentDate: new Date().toISOString(),
            paidAt: new Date().toISOString(),

            gateway: "",
            transactionId:
              depositPaymentReference.trim(),
            gatewayPaymentId: "",
          });

          if (
            paymentResponse?.success === false ||
            paymentResponse?.data?.success === false
          ) {
            throw new Error(
              "Deposit payment record failed."
            );
          }
        } catch (error) {
          console.error(
            "DEPOSIT PAYMENT ERROR",
            error
          );

          paymentFailed = true;
        }
      }

      // ================================================
      // DOCUMENT UPLOAD
      // ================================================

      let documentsFailed = false;

      try {
        await uploadAllDocuments(
          String(rentals[0]._id || rentals[0].id)
        );
      } catch (error) {
        console.error(
          "DOCUMENT UPLOAD ERROR",
          error
        );

        documentsFailed = true;
      }

      // ================================================
      // CONDITION PHOTO UPLOAD
      // ================================================

      let photosFailed = false;

      const orderedUnitKeys = unitEntries.map(
        (u) => u.key
      );

      const canMatch =
        rentals.length === orderedUnitKeys.length &&
        rentals.every((r, i) => {
          const actual =
            r.rentalProductId &&
            typeof r.rentalProductId === "object"
              ? String(
                  r.rentalProductId._id ||
                    r.rentalProductId.id ||
                    ""
                )
              : String(r.rentalProductId || "");

          return (
            !actual ||
            actual === unitEntries[i].rentalProductId
          );
        });

      if (canMatch) {
        for (let i = 0; i < rentals.length; i++) {
          try {
            await uploadPhotosForRental(
              String(
                rentals[i]._id || rentals[i].id
              ),
              conditionPhotos[orderedUnitKeys[i]]
            );
          } catch (error) {
            console.error(
              "CONDITION PHOTO UPLOAD ERROR",
              error
            );

            photosFailed = true;
          }
        }
      } else {
        photosFailed = true;

        console.warn(
          "Rental order differs from requested units. Photos not attached to avoid wrong-device mapping."
        );
      }

      // ================================================
      // WARNINGS
      // ================================================

      if (paymentFailed) {
        toast.warning(
          "Rental created, but some deposit payment records failed. Verify before retrying payment."
        );
      }

      if (documentsFailed) {
        toast.warning(
          "Rental created, but customer document upload failed."
        );
      }

      if (photosFailed) {
        toast.warning(
          "Rental created, but some laptop condition photos were not uploaded."
        );
      }

      (Array.isArray(warnings) ? warnings : []).forEach(
        (w) => toast.warning(String(w))
      );

      toast.success(
        `${rentals.length} rental(s) created. Billing: ${billingType}. Deposit ${money(
          depositReceived
        )} received; first rent ${
          rentPaidNow ? "marked paid" : "pending"
        }.`
      );

      await loadProducts(true);

      navigate(
        "/receptionist-dashboard/rental/orders",
        {
          state: { rentals },
        }
      );
    } catch (error) {
      console.error(
        "CREATE WALK-IN RENTAL ERROR",
        error
      );

      toast.error(
        (orderCreated
          ? "Rental may already exist. Check Orders before retrying. "
          : "") +
          (error?.response?.data?.message ||
            error?.response?.data?.error ||
            error?.message ||
            "Failed to create walk-in rental.")
      );

      await loadProducts(true);
    } finally {
      setSubmitting(false);
    }
  };

  // ====================================================
  // LOADING
  // ====================================================

  if (loading) {
    return (
      <div className="wir-loading-page">
        <FaSpinner className="wir-spin" />

        <h2>Loading rental laptops...</h2>

        <p>
          Please wait while rental inventory is loaded.
        </p>
      </div>
    );
  }

  // ====================================================
  // JSX
  // ====================================================

  return (
    <div className="wir-page">
      <header className="wir-header">
        <div className="wir-header-left">
          <button
            type="button"
            className="wir-back-btn"
            onClick={() =>
              navigate("/receptionist-dashboard")
            }
          >
            <FaArrowLeft /> Back
          </button>

          <div>
            <h1 className="wir-header-title">
              Walk-In Rental
            </h1>

            <p className="wir-header-subtitle">
              Create rental for walk-in customer
            </p>
          </div>
        </div>

        <div className="wir-source-badge">
          <FaLaptop /> WALK-IN RENTAL
        </div>
      </header>

      <form
        className="wir-form"
        onSubmit={handleSubmit}
      >
        {/* BRANCH + SALESPERSON */}

        <section className="wir-card wir-branch-section">
          <div className="wir-section-title">
            <FaCodeBranch />

            <div>
              <h2>Branch & Salesperson</h2>
              <p>
                Select the branch for this rental. The
                salesperson is the logged-in user.
              </p>
            </div>
          </div>

          <div className="wir-form-grid">
            <div className="wir-form-group">
              <label htmlFor="wirBranch">Branch *</label>

              <div className="wir-input-icon">
                <FaBuilding />

                <select
                  id="wirBranch"
                  value={branchId}
                  onChange={(e) =>
                    setBranchId(e.target.value)
                  }
                  disabled={branchesLoading}
                >
                  <option value="">
                    {branchesLoading
                      ? "Loading branches..."
                      : "Select branch"}
                  </option>

                  {branches.map((branch) => (
                    <option
                      key={branchIdOf(branch)}
                      value={branchIdOf(branch)}
                    >
                      {branchNameOf(branch)}
                    </option>
                  ))}
                </select>
              </div>

              {!branchesLoading && !branches.length && (
                <small className="wir-field-error">
                  No branches found. Please add a branch
                  first.
                </small>
              )}
            </div>

            <div className="wir-form-group">
              <label htmlFor="wirSalesperson">
                Salesperson
              </label>

              <div className="wir-input-icon wir-input-readonly">
                <FaUserTie />

                <input
                  id="wirSalesperson"
                  type="text"
                  readOnly
                  value={
                    salesperson?.name ||
                    "Not logged in"
                  }
                />
              </div>

              {salesperson?.email ? (
                <small>{salesperson.email}</small>
              ) : (
                !salesperson && (
                  <small className="wir-field-error">
                    User details not found. Please log in
                    again.
                  </small>
                )
              )}
            </div>
          </div>
        </section>

        {/* CUSTOMER TYPE */}

        <section className="wir-card wir-customer-type-section">
          <div className="wir-section-title">
            <FaUser />

            <div>
              <h2>Customer Type</h2>
              <p>
                Select individual or company customer
              </p>
            </div>
          </div>

          <div className="wir-customer-type-grid">
            {[
              [
                "INDIVIDUAL",
                "Individual",
                "1 laptop only",
                FaUser,
              ],
              [
                "COMPANY",
                "Company",
                `Up to ${MAX_UNITS_COMPANY} laptops • min ${MIN_MONTHS} months`,
                FaBuilding,
              ],
            ].map(([type, title, subtitle, Icon]) => (
              <button
                type="button"
                key={type}
                className={`wir-type-card ${
                  customerType === type
                    ? "wir-type-card-active"
                    : ""
                }`}
                onClick={() =>
                  changeCustomerType(type)
                }
              >
                <Icon size={26} />
                <strong>{title}</strong>
                <span>{subtitle}</span>
              </button>
            ))}
          </div>
        </section>

        {/* SELECT PRODUCTS */}

        <section className="wir-card">
          <div className="wir-section-title">
            <FaLaptop />

            <div>
              <h2>Select Rental Laptops</h2>

              <p>
                {customerType === "COMPANY"
                  ? `Selected ${cartTotalUnits}/${MAX_UNITS_COMPANY} units`
                  : "Individual customer can rent only 1 laptop"}
              </p>
            </div>
          </div>

          <div className="wir-search-box">
            <FaSearch />

            <input
              value={search}
              onChange={(e) =>
                setSearch(e.target.value)
              }
              placeholder="Search laptop, brand or SKU..."
            />

            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
              >
                <FaTimes />
              </button>
            )}
          </div>

          <div className="wir-refresh-row">
            <button
              type="button"
              className="wir-cancel-btn"
              onClick={() => loadProducts(true)}
              disabled={refreshing}
            >
              <FaRedo
                className={
                  refreshing ? "wir-spin" : ""
                }
              />

              {refreshing
                ? "Refreshing..."
                : "Refresh Stock"}
            </button>
          </div>

          {!filteredProducts.length ? (
            <div className="wir-empty-products">
              <FaLaptop size={42} />

              <h3>
                {search
                  ? "No rental laptop found"
                  : "No rental laptops available"}
              </h3>

              <p>
                {search
                  ? "Try another search."
                  : "Please add rental products from admin panel."}
              </p>
            </div>
          ) : (
            <div className="wir-product-grid">
              {filteredProducts.map((item) => {
                const id = rentalProductId(item);

                const qty = quantityInCart(id);

                const available =
                  availableQuantity(item);

                const img = imageUrl(item);

                return (
                  <article
                    key={id}
                    className={`wir-product-card ${
                      qty
                        ? "wir-product-card-selected"
                        : ""
                    }`}
                  >
                    <div className="wir-product-image">
                      {img ? (
                        <img
                          src={img}
                          alt={productName(item)}
                          onError={(e) => {
                            e.currentTarget.style.display =
                              "none";
                          }}
                        />
                      ) : (
                        <FaLaptop size={30} />
                      )}
                    </div>

                    <div className="wir-product-info">
                      <span className="wir-product-brand">
                        {brandName(item) || "Laptop"}
                      </span>

                      <h3>{productName(item)}</h3>

                      <span className="wir-product-sku">
                        SKU: {productSku(item)}
                      </span>

                      <div className="wir-product-prices">
                        <span>
                          Rent: {money(monthlyRent(item))} / month
                        </span>

                        <span>
                          Deposit: {money(depositAmount(item))}
                        </span>

                        <span>
                          Minimum: {minimumMonths(item)} months
                        </span>
                      </div>

                      <span
                        className={`wir-stock ${
                          available > 0
                            ? "wir-stock-available"
                            : "wir-stock-unavailable"
                        }`}
                      >
                        {available > 0
                          ? `${available} Available`
                          : "Out of Stock"}
                      </span>

                      {qty ? (
                        <div className="wir-stepper wir-product-stepper">
                          <button
                            type="button"
                            onClick={() =>
                              changeQuantity(id, -1)
                            }
                          >
                            <FaMinus />
                          </button>

                          <div className="wir-stepper-value">
                            <strong>{qty}</strong>
                            <span>
                              unit{qty > 1 ? "s" : ""}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              changeQuantity(id, 1)
                            }
                            disabled={
                              qty >= available ||
                              cartTotalUnits >= maxUnits
                            }
                          >
                            <FaPlus />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="wir-submit-btn wir-product-select-btn"
                          onClick={() =>
                            addToCart(item)
                          }
                          disabled={
                            available <= 0 ||
                            cartTotalUnits >= maxUnits
                          }
                        >
                          <FaShoppingCart />
                          Add to Order
                        </button>
                      )}
                    </div>

                    {qty > 0 && (
                      <FaCheckCircle className="wir-selected-check" />
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {cart.length > 0 && (
          <>
            {/* SELECTED CART */}

            <section className="wir-card">
              <div className="wir-section-title">
                <FaCheckCircle />

                <div>
                  <h2>Selected Laptops</h2>

                  <p>
                    {cart.length} laptop type(s) •{" "}
                    {cartTotalUnits} of {maxUnits} units
                  </p>
                </div>
              </div>

              <div className="wir-cart-list">
                {cart.map((c) => (
                  <div
                    key={c.rentalProductId}
                    className="wir-cart-item"
                  >
                    <div className="wir-cart-item-info">
                      <strong>
                        {productName(c.product)}
                      </strong>

                      <span>
                        {brandName(c.product)} • SKU:{" "}
                        {productSku(c.product)}
                      </span>
                    </div>

                    <div className="wir-cart-item-actions">
                      <div className="wir-stepper">
                        <button
                          type="button"
                          onClick={() =>
                            changeQuantity(
                              c.rentalProductId,
                              -1
                            )
                          }
                        >
                          <FaMinus />
                        </button>

                        <div className="wir-stepper-value">
                          <strong>{c.quantity}</strong>
                          <span>units</span>
                        </div>

                        <button
                          type="button"
                          disabled={
                            cartTotalUnits >= maxUnits ||
                            c.quantity >=
                              availableQuantity(c.product)
                          }
                          onClick={() =>
                            changeQuantity(
                              c.rentalProductId,
                              1
                            )
                          }
                        >
                          <FaPlus />
                        </button>
                      </div>

                      <button
                        type="button"
                        className="wir-remove-cart-btn"
                        onClick={() =>
                          removeFromCart(c.rentalProductId)
                        }
                      >
                        <FaTrashAlt />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                className="wir-cancel-btn"
                onClick={resetForm}
              >
                <FaTimes /> Clear All
              </button>
            </section>

            {/* CUSTOMER DETAILS */}

            <section className="wir-card wir-customer-details-section">
              <div className="wir-section-title">
                {customerType === "INDIVIDUAL" ? (
                  <FaUser />
                ) : (
                  <FaBuilding />
                )}

                <div>
                  <h2>Customer Details</h2>
                  <p>
                    Enter walk-in customer information
                  </p>
                </div>
              </div>

              {customerType === "INDIVIDUAL" ? (
                <div className="wir-form-grid wir-customer-form-grid">
                  {[
                    ["fullName", "Full Name *", FaUser],
                    ["phone", "Phone *", FaPhone],
                    ["email", "Email", FaEnvelope],
                  ].map(([key, label, Icon]) => (
                    <div
                      className="wir-form-group"
                      key={key}
                    >
                      <label>{label}</label>

                      <div className="wir-input-icon">
                        <Icon />

                        <input
                          type={
                            key === "email"
                              ? "email"
                              : key === "phone"
                              ? "tel"
                              : "text"
                          }
                          name={key}
                          value={individualDetails[key]}
                          onChange={(e) =>
                            setIndividualDetails(
                              (prev) => ({
                                ...prev,
                                [key]: e.target.value,
                              })
                            )
                          }
                          placeholder={`Enter ${label
                            .replace(" *", "")
                            .toLowerCase()}`}
                        />
                      </div>
                    </div>
                  ))}

                  <div className="wir-form-group wir-form-group-full">
                    <label>Address</label>

                    <div className="wir-input-icon wir-textarea-icon">
                      <FaMapMarkerAlt />

                      <textarea
                        name="address"
                        rows={4}
                        value={individualDetails.address}
                        onChange={(e) =>
                          setIndividualDetails(
                            (prev) => ({
                              ...prev,
                              address: e.target.value,
                            })
                          )
                        }
                        placeholder="Enter customer address"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="wir-form-grid wir-customer-form-grid">
                  {[
                    ["companyName", "Company Name *"],
                    ["contactPerson", "Contact Person *"],
                    ["phone", "Phone *"],
                    ["email", "Email"],
                    ["gstNumber", "GST Number"],
                  ].map(([key, label]) => (
                    <div
                      className="wir-form-group"
                      key={key}
                    >
                      <label>{label}</label>

                      <input
                        type={
                          key === "email"
                            ? "email"
                            : key === "phone"
                            ? "tel"
                            : "text"
                        }
                        name={key}
                        value={companyDetails[key]}
                        onChange={(e) =>
                          setCompanyDetails(
                            (prev) => ({
                              ...prev,
                              [key]: e.target.value,
                            })
                          )
                        }
                        placeholder={`Enter ${label
                          .replace(" *", "")
                          .toLowerCase()}`}
                      />
                    </div>
                  ))}

                  <div className="wir-form-group wir-form-group-full">
                    <label>Office Address</label>

                    <div className="wir-input-icon wir-textarea-icon">
                      <FaMapMarkerAlt />

                      <textarea
                        rows={4}
                        value={companyDetails.officeAddress}
                        onChange={(e) =>
                          setCompanyDetails(
                            (prev) => ({
                              ...prev,
                              officeAddress: e.target.value,
                            })
                          )
                        }
                        placeholder="Enter office address"
                      />
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* CUSTOMER SOURCE (OPTIONAL)
                How did you come to know about ZAID Infotech? */}

            <section className="wir-card wir-customer-source-section">
              <div className="wir-section-title">
                <FaSearch />

                <div>
                  <h2>How did the customer come to know about us?</h2>
                  <p>
                    Helps us track which channels bring customers
                  </p>
                </div>
              </div>

              <div className="wir-form-grid">
                <div className="wir-form-group wir-form-group-full">
                  <label htmlFor="wirCustomerSource">
                    How did you come to know about ZAID Infotech?{" "}
                    <span
                      style={{
                        fontWeight: 400,
                        color: "#64748b",
                      }}
                    >
                      (Optional)
                    </span>
                  </label>

                  <select
                    id="wirCustomerSource"
                    value={customerSource}
                    onChange={(e) => {
                      setCustomerSource(e.target.value);

                      // clear old text when switching away from Other
                      if (e.target.value !== "OTHER") {
                        setCustomerSourceOther("");
                      }
                    }}
                  >
                    <option value="">Select an option</option>

                    {CUSTOMER_SOURCE_OPTIONS.map((option) => (
                      <option
                        key={option.value}
                        value={option.value}
                      >
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                {customerSource === "OTHER" && (
                  <div className="wir-form-group wir-form-group-full">
                    <label htmlFor="wirCustomerSourceOther">
                      Please specify{" "}
                      <span
                        style={{
                          fontWeight: 400,
                          color: "#64748b",
                        }}
                      >
                        (Optional)
                      </span>
                    </label>

                    <input
                      id="wirCustomerSourceOther"
                      type="text"
                      maxLength={200}
                      value={customerSourceOther}
                      onChange={(e) =>
                        setCustomerSourceOther(e.target.value)
                      }
                      placeholder="Please tell us how you came to know about us"
                    />
                  </div>
                )}
              </div>
            </section>

            {/* DOCUMENT UPLOAD */}

            <section className="wir-card wir-documents-section">
              <div className="wir-section-title">
                <FaShieldAlt />

                <div>
                  <h2>Customer Documents</h2>
                  <p>
                    Upload required documents for this rental
                  </p>
                </div>
              </div>

              <div className="wir-document-grid">
                {currentDocuments.map((doc) => (
                  <div
                    key={doc.key}
                    className="wir-document-card"
                  >
                    <div className="wir-document-header">
                      <strong>{doc.label}</strong>
                      <span>Required *</span>
                    </div>

                    {doc.merged && (
                      <div className="wir-doc-type-toggle">
                        {[
                          "OFFICE_ID",
                          "COLLEGE_ID",
                        ].map((type) => (
                          <button
                            type="button"
                            key={type}
                            className={`wir-doc-type-btn ${
                              officeOrCollegeType === type
                                ? "wir-doc-type-btn-active"
                                : ""
                            }`}
                            onClick={() =>
                              setOfficeOrCollegeType(type)
                            }
                          >
                            {type === "OFFICE_ID"
                              ? "Office ID"
                              : "College ID"}
                          </button>
                        ))}
                      </div>
                    )}

                    <label className="wir-document-file-label">
                      <input
                        type="file"
                        accept={doc.accept}
                        onChange={(e) =>
                          handleDocumentChange(
                            doc.key,
                            e
                          )
                        }
                      />

                      <span>
                        {documents[doc.key]?.name ||
                          "Choose document"}
                      </span>
                    </label>

                    {documents[doc.key] && (
                      <div className="wir-document-selected">
                        <FaCheckCircle />

                        <span>
                          {documents[doc.key].name}
                        </span>

                        <button
                          type="button"
                          className="wir-document-remove-btn"
                          onClick={() =>
                            setDocuments((prev) => ({
                              ...prev,
                              [doc.key]: null,
                            }))
                          }
                        >
                          <FaTimes />
                        </button>
                      </div>
                    )}

                    <small>
                      JPG, PNG, WEBP or PDF • Max 10 MB
                    </small>
                  </div>
                ))}
              </div>

              <div className="wir-document-note">
                <FaShieldAlt />

                <span>
                  Customer documents are uploaded once;
                  backend must attach them to each rental
                  in the order.
                </span>
              </div>
            </section>

            {/* CONDITION PHOTOS */}

            <section className="wir-card wir-condition-section">
              <div className="wir-condition-heading">
                <h3>Laptop Condition Photos</h3>

                <p>
                  Upload front, back and full image for{" "}
                  <strong>each physical laptop</strong>{" "}
                  before handover.
                </p>
              </div>

              {unitEntries.map((unit) => (
                <div
                  className="wir-condition-unit"
                  key={unit.key}
                >
                  <h4>
                    {unit.name} — Unit {unit.index}
                  </h4>

                  <div className="wir-condition-grid">
                    {PHOTO_SIDES.map((side) => {
                      const file =
                        conditionPhotos[unit.key]?.[
                          side.key
                        ];

                      return (
                        <div
                          className="wir-condition-card"
                          key={side.key}
                        >
                          <div className="wir-condition-card-title">
                            <strong>{side.label}</strong>
                            <span>Required</span>
                          </div>

                          <ConditionPreview
                            file={file}
                            label={`${unit.name} ${side.label}`}
                          />

                          <label className="wir-condition-upload">
                            {file
                              ? "Change Image"
                              : "Choose Image"}

                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              hidden
                              onChange={(e) =>
                                handlePhotoChange(
                                  unit.key,
                                  side.key,
                                  e
                                )
                              }
                            />
                          </label>

                          {file && (
                            <div className="wir-condition-file">
                              <span title={file.name}>
                                {file.name}
                              </span>

                              <button
                                type="button"
                                onClick={() =>
                                  setConditionPhotos(
                                    (prev) => ({
                                      ...prev,
                                      [unit.key]: {
                                        ...prev[unit.key],
                                        [side.key]: null,
                                      },
                                    })
                                  )
                                }
                              >
                                Remove
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              <p className="wir-condition-note">
                JPG, PNG or WEBP • Max 5 MB per photo •
                All three required per laptop.
              </p>
            </section>

            {/* RENTAL PERIOD */}

            <section className="wir-card">
              <div className="wir-section-title">
                <FaCalendarAlt />

                <div>
                  <h2>Rental Period</h2>
                  <p>Applies to the whole order</p>
                </div>
              </div>

              <div className="wir-form-grid">
                <div className="wir-form-group">
                  <label>Duration Type</label>

                  <select
                    className="wir-duration-select"
                    value="MONTHS"
                    disabled
                  >
                    <option value="MONTHS">
                      Months
                    </option>
                  </select>

                  <small>
                    Minimum 3 months compulsory.
                  </small>
                </div>

                <div className="wir-form-group">
                  <label>Minimum Rental</label>

                  <input
                    readOnly
                    value={`${minDuration} months`}
                  />

                  <small>
                    Based on selected laptops.
                  </small>
                </div>

                <div className="wir-form-group">
                  <label>Rental Duration</label>

                  <div className="wir-stepper">
                    <button
                      type="button"
                      onClick={() =>
                        setRentalDuration((v) =>
                          Math.max(
                            minDuration,
                            v - 1
                          )
                        )
                      }
                      disabled={
                        rentalDuration <= minDuration
                      }
                    >
                      <FaMinus />
                    </button>

                    <div className="wir-stepper-value">
                      <strong>
                        {rentalDuration}
                      </strong>

                      <span>months</span>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setRentalDuration(
                          (v) => v + 1
                        )
                      }
                    >
                      <FaPlus />
                    </button>
                  </div>

                  <small>
                    Cannot be less than {minDuration} months.
                  </small>
                </div>

                <div className="wir-form-group wir-form-group-full">
                  <label>Handover / Notes</label>

                  <textarea
                    rows={4}
                    value={handoverDescription}
                    onChange={(e) =>
                      setHandoverDescription(
                        e.target.value
                      )
                    }
                    placeholder="Laptop condition, charger, bag, accessories or handover notes..."
                  />

                  <small>
                    Saved with each rental.
                  </small>
                </div>
              </div>
            </section>

            {/* NEGOTIATED PRICING */}

            <section className="wir-card wir-pricing-section">
              <div className="wir-section-title">
                <FaRupeeSign />

                <div>
                  <h2>Rental Pricing Negotiation</h2>

                  <p>
                    Change rent per laptop type. Original
                    product master price remains unchanged.
                  </p>
                </div>
              </div>

              <div className="wir-pricing-list">
                {cart.map((c) => {
                  const original =
                    monthlyRent(c.product);

                  const state =
                    negotiations[c.rentalProductId] ||
                    {};

                  const enabled = Boolean(
                    state.enabled
                  );

                  return (
                    <div
                      className="wir-pricing-item"
                      key={c.rentalProductId}
                    >
                      <div className="wir-pricing-item-head">
                        <strong>
                          {productName(c.product)} ×{" "}
                          {c.quantity}
                        </strong>

                        <span>
                          Original: {money(original)} /
                          month / unit
                        </span>
                      </div>

                      <label className="wir-deposit-checkbox">
                        <input
                          type="checkbox"
                          checked={enabled}
                          onChange={(e) =>
                            setNegotiations(
                              (prev) => ({
                                ...prev,
                                [c.rentalProductId]: {
                                  ...prev[
                                    c.rentalProductId
                                  ],
                                  enabled:
                                    e.target.checked,
                                  rate: e.target.checked
                                    ? prev[
                                        c.rentalProductId
                                      ]?.rate ??
                                      String(original)
                                    : String(original),
                                },
                              })
                            )
                          }
                        />

                        <span className="wir-custom-checkbox">
                          {enabled && (
                            <FaCheckCircle />
                          )}
                        </span>

                        <div>
                          <strong>
                            Negotiate Rent
                          </strong>

                          <small>
                            Sales/Admin approval required
                            by backend
                          </small>
                        </div>
                      </label>

                      {enabled && (
                        <div className="wir-form-grid">
                          <div className="wir-form-group">
                            <label>
                              Negotiated Monthly Rent (₹) *
                            </label>

                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={
                                state.rate ??
                                String(original)
                              }
                              onChange={(e) =>
                                setNegotiations(
                                  (prev) => ({
                                    ...prev,
                                    [c.rentalProductId]: {
                                      ...prev[
                                        c.rentalProductId
                                      ],
                                      rate:
                                        e.target.value,
                                    },
                                  })
                                )
                              }
                            />
                          </div>

                          <div className="wir-form-group">
                            <label>
                              Difference per Unit / Month
                            </label>

                            <input
                              readOnly
                              value={money(
                                Number(
                                  state.rate ?? original
                                ) - original
                              )}
                            />
                          </div>

                          <div className="wir-form-group wir-form-group-full">
                            <label>
                              Negotiation Reason *
                            </label>

                            <textarea
                              rows={2}
                              value={
                                state.reason || ""
                              }
                              onChange={(e) =>
                                setNegotiations(
                                  (prev) => ({
                                    ...prev,
                                    [c.rentalProductId]: {
                                      ...prev[
                                        c.rentalProductId
                                      ],
                                      reason:
                                        e.target.value,
                                    },
                                  })
                                )
                              }
                              placeholder="Discount, special agreement, revised pricing..."
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            {/* GST / NON GST */}

            <section className="wir-card wir-tax-section">
              <div className="wir-section-title">
                <FaRupeeSign />

                <div>
                  <h2>GST / Non-GST Billing</h2>

                  <p>
                    Choose the legally applicable invoice
                    treatment.
                  </p>
                </div>
              </div>

              <div className="wir-customer-type-grid">
                {[
                  [
                    "GST",
                    "GST Billing",
                    "GST calculated on rental amount",
                  ],
                  [
                    "NON_GST",
                    "Non-GST Billing",
                    "No GST added to rental amount",
                  ],
                ].map(
                  ([type, label, description]) => (
                    <button
                      type="button"
                      key={type}
                      className={`wir-type-card ${
                        billingType === type
                          ? "wir-type-card-active"
                          : ""
                      }`}
                      onClick={() =>
                        setBillingType(type)
                      }
                    >
                      <strong>{label}</strong>
                      <span>{description}</span>
                    </button>
                  )
                )}
              </div>

              {billingType === "GST" && (
                <div className="wir-form-grid">
                  <div className="wir-form-group">
                    <label>
                      Applicable GST Rate (%) *
                    </label>

                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={gstPercentage}
                      onChange={(e) =>
                        setGstPercentage(
                          e.target.value
                        )
                      }
                    />

                    <small>
                      Verify the applicable rate with your
                      tax/accounting team.
                    </small>
                  </div>
                </div>
              )}

              <div className="wir-summary-lines">
                <div>
                  <span>Rental Subtotal</span>
                  <strong>
                    {money(pricing.rentSubtotal)}
                  </strong>
                </div>

                <div>
                  <span>
                    GST (
                    {isNonGst
                      ? "Not charged"
                      : `${effectiveGstPercentage}%`}
                    )
                  </span>

                  <strong>
                    {money(pricing.gstAmount)}
                  </strong>
                </div>

                <div>
                  <span>Rent Including Tax</span>
                  <strong>
                    {money(pricing.rentTotalAmount)}
                  </strong>
                </div>
              </div>
            </section>

            {/* SECURITY DEPOSIT */}

            <section className="wir-card wir-deposit-section">
              <div className="wir-section-title">
                <FaShieldAlt />

                <div>
                  <h2>Security Deposit Payment</h2>
                  <p>
                    Record actual received deposit
                  </p>
                </div>
              </div>

              <div className="wir-deposit-box">
                <div className="wir-deposit-header">
                  <div>
                    <span className="wir-deposit-label">
                      Required Security Deposit (all units)
                    </span>

                    <strong>
                      {money(depositExpected)}
                    </strong>
                  </div>

                  <div
                    className={`wir-deposit-badge wir-deposit-badge-${depositStatus.toLowerCase()}`}
                  >
                    {depositStatus}
                  </div>
                </div>

                <label className="wir-deposit-checkbox">
                  <input
                    type="checkbox"
                    checked={depositPaid}
                    onChange={(e) =>
                      changeDepositPaid(
                        e.target.checked
                      )
                    }
                    disabled={depositExpected <= 0}
                  />

                  <span className="wir-custom-checkbox">
                    {depositPaid && (
                      <FaCheckCircle />
                    )}
                  </span>

                  <div>
                    <strong>Deposit Paid</strong>

                    <small>
                      Tick only when customer has actually
                      paid.
                    </small>
                  </div>
                </label>

                {depositPaid ? (
                  <div className="wir-form-grid wir-deposit-grid">
                    <div className="wir-form-group">
                      <label>
                        Deposit Amount Paid *
                      </label>

                      <div className="wir-input-icon">
                        <FaRupeeSign />

                        <input
                          type="number"
                          min="0"
                          max={depositExpected}
                          step="0.01"
                          value={depositAmountPaid}
                          onChange={(e) =>
                            setDepositAmountPaid(
                              e.target.value
                            )
                          }
                        />
                      </div>

                      {depositBalance > 0 && (
                        <small>
                          Remaining:{" "}
                          {money(depositBalance)}
                        </small>
                      )}
                    </div>

                    <div className="wir-form-group">
                      <label>
                        Payment Method *
                      </label>

                      <div className="wir-input-icon">
                        {depositPaymentMethod ===
                        "CASH" ? (
                          <FaMoneyBillWave />
                        ) : depositPaymentMethod ===
                          "BANK_TRANSFER" ? (
                          <FaUniversity />
                        ) : (
                          <FaCreditCard />
                        )}

                        <select
                          value={depositPaymentMethod}
                          onChange={(e) =>
                            setDepositPaymentMethod(
                              e.target.value
                            )
                          }
                        >
                          {PAYMENT_METHODS.map(
                            (method) => (
                              <option
                                key={method.value}
                                value={method.value}
                              >
                                {method.label}
                              </option>
                            )
                          )}
                        </select>
                      </div>
                    </div>

                    <div className="wir-form-group wir-form-group-full">
                      <label>
                        Transaction / Payment Reference{" "}
                        {depositPaymentMethod !==
                        "CASH"
                          ? "*"
                          : ""}
                      </label>

                      <input
                        value={
                          depositPaymentReference
                        }
                        onChange={(e) =>
                          setDepositPaymentReference(
                            e.target.value
                          )
                        }
                        placeholder="Transaction ID / receipt reference"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="wir-deposit-unpaid-note">
                    <FaShieldAlt />

                    <div>
                      <strong>
                        Deposit not received
                      </strong>

                      <span>
                        Rental can still be created with
                        deposit pending.
                      </span>
                    </div>
                  </div>
                )}

                {depositStatus === "PARTIAL" && (
                  <div className="wir-deposit-partial-note">
                    <FaShieldAlt />

                    <span>
                      Partial deposit received:{" "}
                      <strong>
                        {money(depositReceived)}
                      </strong>{" "}
                      of{" "}
                      <strong>
                        {money(depositExpected)}
                      </strong>
                    </span>
                  </div>
                )}
              </div>
            </section>

            {/* RENT PAYMENT */}

            <section className="wir-card wir-deposit-section">
              <div className="wir-section-title">
                <FaRupeeSign />

                <div>
                  <h2>Rent Payment</h2>

                  <p>
                    Month-wise tracking •{" "}
                    {pricing.installmentCount} installments
                  </p>
                </div>
              </div>

              <div className="wir-deposit-box">
                <div className="wir-deposit-header">
                  <div>
                    <span className="wir-deposit-label">
                      First Month Rent (
                      {isNonGst
                        ? "Non-GST"
                        : "incl. GST"}
                      , all units)
                    </span>

                    <strong>
                      {money(
                        pricing.firstInstallmentTotal
                      )}
                    </strong>
                  </div>

                  <div
                    className={`wir-deposit-badge wir-deposit-badge-${
                      rentPaidNow
                        ? "paid"
                        : "unpaid"
                    }`}
                  >
                    {rentPaidNow
                      ? "PAID"
                      : "UNPAID"}
                  </div>
                </div>

                <label className="wir-deposit-checkbox">
                  <input
                    type="checkbox"
                    checked={rentPaidNow}
                    onChange={(e) => {
                      setRentPaidNow(
                        e.target.checked
                      );

                      if (!e.target.checked) {
                        setRentPaymentReference("");
                      }
                    }}
                  />

                  <span className="wir-custom-checkbox">
                    {rentPaidNow && (
                      <FaCheckCircle />
                    )}
                  </span>

                  <div>
                    <strong>
                      First Month Rent Paid
                    </strong>

                    <small>
                      Tick only when payment is actually
                      received. Remaining months can be
                      collected later.
                    </small>
                  </div>
                </label>

                {rentPaidNow ? (
                  <div className="wir-form-grid wir-deposit-grid">
                    <div className="wir-form-group">
                      <label>
                        Payment Method *
                      </label>

                      <div className="wir-input-icon">
                        <FaMoneyBillWave />

                        <select
                          value={rentPaymentMethod}
                          onChange={(e) =>
                            setRentPaymentMethod(
                              e.target.value
                            )
                          }
                        >
                          {PAYMENT_METHODS.map(
                            (method) => (
                              <option
                                key={method.value}
                                value={method.value}
                              >
                                {method.label}
                              </option>
                            )
                          )}
                        </select>
                      </div>
                    </div>

                    <div className="wir-form-group">
                      <label>
                        Transaction / Payment Reference{" "}
                        {rentPaymentMethod !==
                        "CASH"
                          ? "*"
                          : ""}
                      </label>

                      <input
                        value={
                          rentPaymentReference
                        }
                        onChange={(e) =>
                          setRentPaymentReference(
                            e.target.value
                          )
                        }
                        placeholder="Transaction ID / receipt reference"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="wir-deposit-unpaid-note">
                    <FaShieldAlt />

                    <div>
                      <strong>
                        Rent not received yet
                      </strong>

                      <span>
                        First installment remains pending
                        in the rent schedule.
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* RENTAL SUMMARY */}

            <section className="wir-card wir-summary-card">
              <div className="wir-section-title">
                <FaRupeeSign />

                <div>
                  <h2>Rental Summary</h2>

                  <p>
                    Negotiated pricing and tax calculation
                  </p>
                </div>
              </div>

              <div className="wir-cart-summary-lines">
                {pricing.items.map((item) => (
                  <div
                    key={item.rentalProductId}
                    className="wir-cart-summary-line"
                  >
                    <span>
                      {item.name} × {item.quantity} —{" "}
                      {money(item.monthlyRent)}
                      /month
                      {item.negotiated
                        ? " (negotiated)"
                        : ""}
                    </span>

                    <strong>
                      {money(item.lineTotal)}
                    </strong>
                  </div>
                ))}
              </div>

              <div className="wir-summary-lines">
                <div>
                  <span>Branch</span>

                  <strong>
                    {branchId
                      ? branchNameOf(
                          branches.find(
                            (b) =>
                              branchIdOf(b) === branchId
                          )
                        )
                      : "Not selected"}
                  </strong>
                </div>

                <div>
                  <span>Salesperson</span>

                  <strong>
                    {salesperson?.name || "—"}
                  </strong>
                </div>

                <div>
                  <span>Rental Period</span>

                  <strong>
                    {pricing.duration} months
                  </strong>
                </div>

                <div>
                  <span>
                    Billing Type
                  </span>

                  <strong>
                    {billingType}
                  </strong>
                </div>

                <div>
                  <span>
                    Monthly Installment ({billingType})
                  </span>

                  <strong>
                    {money(
                      pricing.firstInstallmentTotal
                    )}
                  </strong>
                </div>

                <div>
                  <span>
                    Rental Amount
                  </span>

                  <strong>
                    {money(pricing.rentSubtotal)}
                  </strong>
                </div>

                <div>
                  <span>
                    GST (
                    {isNonGst
                      ? "not charged"
                      : `${effectiveGstPercentage}%`}
                    )
                  </span>

                  <strong>
                    {money(pricing.gstAmount)}
                  </strong>
                </div>

                <div>
                  <span>
                    Total Rent Including Tax
                  </span>

                  <strong>
                    {money(
                      pricing.rentTotalAmount
                    )}
                  </strong>
                </div>

                <div>
                  <span>
                    Security Deposit
                  </span>

                  <strong>
                    {money(depositExpected)}
                  </strong>
                </div>

                <div>
                  <span>
                    Deposit Paid
                  </span>

                  <strong
                    className={
                      depositReceived
                        ? "wir-text-paid"
                        : "wir-text-unpaid"
                    }
                  >
                    {money(depositReceived)}
                  </strong>
                </div>

                <div>
                  <span>
                    Deposit Remaining
                  </span>

                  <strong
                    className={
                      depositBalance
                        ? "wir-text-partial"
                        : "wir-text-paid"
                    }
                  >
                    {money(depositBalance)}
                  </strong>
                </div>

                <div>
                  <span>
                    Deposit Status
                  </span>

                  <strong
                    className={`wir-text-${depositStatus.toLowerCase()}`}
                  >
                    {depositStatus}
                  </strong>
                </div>

                <div>
                  <span>
                    First Rent Installment
                  </span>

                  <strong
                    className={
                      rentPaidNow
                        ? "wir-text-paid"
                        : "wir-text-unpaid"
                    }
                  >
                    {rentPaidNow
                      ? "PAID"
                      : "PENDING"}
                  </strong>
                </div>

                <div className="wir-summary-total">
                  <span>
                    Total Payable (including refundable
                    deposit)
                  </span>

                  <strong>
                    {money(pricing.totalAmount)}
                  </strong>
                </div>
              </div>

              <div className="wir-submit-help">
                <FaShieldAlt />

                Security deposit is refundable subject to
                actual receipt, rental return condition
                and rental agreement.
              </div>

              <div className="wir-submit-row">
                <button
                  type="button"
                  className="wir-cancel-btn"
                  onClick={resetForm}
                  disabled={submitting}
                >
                  <FaTimes /> Reset
                </button>

                <button
                  type="submit"
                  className="wir-submit-btn"
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <FaSpinner className="wir-spin" />
                      Creating Rentals...
                    </>
                  ) : (
                    <>
                      <FaCheckCircle />

                      Create Walk-In Rental{" "}
                      {cartTotalUnits > 1
                        ? `(${cartTotalUnits} units)`
                        : ""}
                    </>
                  )}
                </button>
              </div>
            </section>
          </>
        )}
      </form>
    </div>
  );
}

export default WalkInRental;
