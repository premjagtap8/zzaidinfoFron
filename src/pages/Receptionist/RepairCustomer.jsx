import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  FiSearch,
  FiPlus,
  FiUser,
  FiPhone,
  FiTool,
  FiClock,
  FiCheckCircle,
  FiX,
  FiRefreshCw,
  FiEye,
  FiMonitor,
  FiMessageSquare,
  FiUserCheck,
  FiInbox,
  FiCalendar,
  FiPrinter,
  FiCreditCard,
  FiSave,
  FiChevronDown,
  FiChevronUp,
  FiShare2,
} from "react-icons/fi";
import { FaRupeeSign } from "react-icons/fa";
import { toast } from "react-toastify";
import "./RepairCustomer.css";
import JobExtraFields, {
    WarrantyBadge,
    JobExtraSummary
} from "../../components/repair/JobExtraFields";

import TransferJobModal from "../../components/repair/TransferJobModal";

import { getSalespersonNames } from "../../services/repairJobService";
import { getEmployees } from "../../services/userService";
// =====================================================
// API CONFIGURATION (sirf .env se - VITE_API_URL)
// =====================================================

const API_URL = String(import.meta.env.VITE_API_URL || "").replace(
  /\/+$/,
  ""
);

const BASE_URL = `${API_URL}/newRepair`;
const TECHNICIAN_URL = `${API_URL}/newRepair/technicians`;
const SERVICE_URL = `${API_URL}/repair-service`;
const BRANCH_URL = `${API_URL}/branches`;

// Backend mein ye route hona zaroori hai: PATCH /newRepair/:id/status
const getStatusUpdateUrl = (repairId) => `${BASE_URL}/${repairId}/status`;

const REPAIR_STATUSES = [
  "Received",
  "Assigned",
  "In Progress",
  "Waiting for Parts",
  "Ready for Delivery",
  "Completed",
  "Cancelled",
];

// =====================================================
// CUSTOMER SOURCE (how the customer found us)
// value = what is stored in MongoDB (customerSource)
// =====================================================

// KEY   -> saved in the database (never change a key later)
// LABEL -> shown to the user / used in reports
const CUSTOMER_SOURCE_MAP = {
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

const CUSTOMER_SOURCES = Object.entries(CUSTOMER_SOURCE_MAP).map(
  ([value, label]) => ({ value, label })
);

// Returns { value, label } for a repair. Old records without a source show "—".
const getSourceInfo = (repair) => {
  const value = String(repair?.customerSource || "").toUpperCase().trim();

  if (!value) return { value: "", label: "—" };

  const match = CUSTOMER_SOURCES.find((item) => item.value === value);
  const baseLabel =
    match?.label ||
    value
      .replaceAll("_", " ")
      .toLowerCase()
      .replace(/\b\w/g, (letter) => letter.toUpperCase());

  const other = String(repair?.customerSourceOther || "").trim();

  return {
    value,
    label: value === "OTHER" && other ? `Other: ${other}` : baseLabel,
  };
};

const getSourceClass = (repair) => {
  const { value } = getSourceInfo(repair);

  return value
    ? `rc-source-${value.toLowerCase().replaceAll("_", "-")}`
    : "rc-source-none";
};

// =====================================================
// RUPEE FORMATTER
// =====================================================

const formatRupees = (value) => {
  const amount = Number(value || 0);

  return `₹${amount.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const getServiceTotal = (service) =>
  service?.totalCost !== undefined && service?.totalCost !== null
    ? Number(service.totalCost) || 0
    : (Number(service?.partCost) || 0) + (Number(service?.laborCost) || 0);

const getTodayLocalDate = () => {
  const today = new Date();
  const offset = today.getTimezoneOffset();

  return new Date(today.getTime() - offset * 60 * 1000)
    .toISOString()
    .slice(0, 10);
};

// =====================================================
// BRANCH PURE HELPERS (component ke bahar)
// =====================================================

// Branch value string / populated object / ObjectId kuch bhi ho, id nikalta hai.
const getBranchId = (value) => {
  if (!value) return "";

  if (typeof value === "object") {
    if (value._id) return String(value._id);
    if (value.id) return String(value.id);

    const text = typeof value.toString === "function" ? value.toString() : "";
    return text && text !== "[object Object]" ? text : "";
  }

  return String(value);
};

const isBranchActive = (branch) =>
  String(branch?.status || "ACTIVE").toUpperCase() === "ACTIVE" &&
  branch?.isDeleted !== true;

const formatBranchAddress = (branch) => {
  if (!branch?.address) return "";

  if (typeof branch.address === "string") return branch.address;

  return [
    branch.address.line1,
    branch.address.line2,
    branch.address.street,
  ]
    .filter(Boolean)
    .join(", ");
};

// Client-approved laptop issue categories and specific problems.
const LAPTOP_PROBLEMS = {
  "Power & Startup Issues": ["Laptop Not Powering On", "Laptop Not Charging", "Laptop Not Turning On With Charger", "Power Button Not Working", "No Power Indicator Light", "Laptop Turns On but No Display", "Laptop Shuts Down Automatically", "Laptop Restarts Repeatedly", "Laptop Stuck on Manufacturer Logo", "Laptop Stuck in Boot Loop"],
  "Display & Screen Issues": ["Laptop Screen Broken / Cracked", "Display Flickering", "No Display / Black Screen", "White Screen / Blank Screen", "Lines on Screen", "Dim Display / Backlight Issue", "External Monitor Not Working", "Display Cable Issue", "Screen Bezel Damaged", "Display Hinge Damage"],
  "Keyboard & Touchpad Issues": ["Keyboard Not Working", "Some Keyboard Keys Not Working", "Keyboard Replacement", "Touchpad Not Working", "Touchpad Buttons Not Working", "Laptop Mouse Not Detected", "Power Button / Keyboard Panel Issue"],
  "Battery & Charging Issues": ["Battery Draining Quickly", "Battery Not Detected", "Battery Not Charging", "Battery Replacement", "Battery Swelling", "Charger / Adapter Not Working", "Charging Port / DC Jack Damaged", "Intermittent Charging Issue"],
  "Motherboard & Hardware Issues": ["Motherboard Repair", "Motherboard Short Circuit", "RAM Not Detected", "RAM Upgrade / Replacement", "SSD / HDD Not Detected", "SSD / HDD Upgrade", "M.2 SSD Not Detected", "USB Port Not Working", "HDMI / DisplayPort Not Working", "Audio Jack Not Working", "Wi-Fi / Bluetooth Hardware Issue", "Fan Not Working", "Speaker Not Working", "Webcam Not Working", "Fingerprint Reader Not Working", "External Device Not Detected"],
  "Heating & Performance Issues": ["Laptop Overheating", "Fan Noise / Loud Fan", "Laptop Running Slowly", "Laptop Hanging / Freezing", "Automatic Shutdown Due to Overheating", "Thermal Paste Replacement", "Internal Cleaning / Dust Removal"],
  "Windows & Operating System Issues": ["Windows Installation", "Windows Activation Issue", "Windows Boot Error", "Blue Screen Error (BSOD)", "Windows Update Issue", "Driver Installation / Update", "BIOS Update / Configuration", "BIOS Password Issue", "Forgotten Windows Password", "Laptop Stuck on Automatic Repair", "Operating System Corrupted", "Sleep / Wake Issue"],
  "Software & Data Services": ["Software Installation", "Microsoft Office Installation", "Virus / Malware Removal", "Data Backup / Transfer", "Data Recovery"],
  "Network & Connectivity Issues": ["Wi-Fi Not Detected", "Wi-Fi Not Connecting", "Bluetooth Not Working", "LAN / Ethernet Not Working", "Internet Connectivity Issue", "Microphone Not Working", "No Sound / Audio Issue", "Camera Not Detected"],
  "Physical Damage & Body Issues": ["Liquid / Water Damage", "Accidental / Physical Damage", "Laptop Body / Casing Broken", "Hinge Broken / Tight Hinge", "Screw Thread / Mounting Damage"],
  "General Service & Maintenance": ["Full Laptop Servicing", "General Diagnosis / Inspection", "Preventive Maintenance", "Laptop Cleaning"],
  Other: ["Other / Problem Not Listed"],
};

// Preserve new intake metadata even when existing backend only stores issueDescription.
// Support separate MongoDB fields later without changing the display code.
const getJobDetails = (repair = {}) => {
  const text = String(repair.issueDescription || "");
  const readLine = (label) => text.split(/\r?\n/).find(line => line.startsWith(`${label}: `))?.slice(label.length + 2).trim() || "";
  return {
    problemCategory: repair.problemCategory || readLine("Problem Category"),
    specificProblem: repair.specificProblem || readLine("Specific Problem"),
    customerDescription: repair.customerDescription || readLine("Customer Description"),
    deviceBrand: repair.deviceBrand || readLine("Device Brand"),
    serialNumber: repair.serialNumber || readLine("Serial Number"),
    accessoriesReceived: repair.accessoriesReceived || readLine("Accessories Received"),
    physicalCondition: repair.physicalCondition || readLine("Physical Condition"),
  };
};

// Printable and on-screen repair problem details.
const ProblemDetails = ({ repair }) => {
  const info = getJobDetails(repair);
  if (!info.problemCategory && !info.specificProblem) return null;
  return (
    <div className="rc-problem-details" style={{ marginTop: 12, padding: 12, border: "1px solid #cbd5e1", borderRadius: 8, background: "#f8fafc", color: "#0f172a", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
      <strong style={{ display: "block", marginBottom: 8 }}>REPORTED PROBLEM DETAILS</strong>
      <div><strong>Problem Category:</strong> {info.problemCategory || "N/A"}</div>
      <div><strong>Specific Problem:</strong> {info.specificProblem || "N/A"}</div>
      {info.customerDescription && <div><strong>Customer Description:</strong> {info.customerDescription}</div>}
      {info.deviceBrand && <div><strong>Device Brand:</strong> {info.deviceBrand}</div>}
      {info.serialNumber && <div><strong>Serial Number:</strong> {info.serialNumber}</div>}
      {info.accessoriesReceived && <div><strong>Accessories Received:</strong> {info.accessoriesReceived}</div>}
      {info.physicalCondition && <div><strong>Physical Condition:</strong> {info.physicalCondition}</div>}
    </div>
  );
};

// =====================================================
// SEARCH / FILTER / SORT HELPERS
// =====================================================

// Special filter value meaning "field is empty" (old records, no branch, etc.)
const NONE_VALUE = "__NONE__";

const normValue = (value) =>
  String(value ?? "")
    .trim()
    .toUpperCase();

const prettifyValue = (value) =>
  String(value || "")
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const REPAIR_SORT_OPTIONS = [
  { value: "DEFAULT", label: "Default order" },
  { value: "DATE_DESC", label: "Job date: Newest first" },
  { value: "DATE_ASC", label: "Job date: Oldest first" },
  { value: "CUSTOMER_ASC", label: "Customer: A → Z" },
  { value: "CUSTOMER_DESC", label: "Customer: Z → A" },
  { value: "COST_DESC", label: "Repair cost: High → Low" },
  { value: "COST_ASC", label: "Repair cost: Low → High" },
  { value: "DUE_DESC", label: "Balance due: High → Low" },
];

const DEFAULT_DEVICE_TYPES = ["Laptop", "Desktop", "Printer", "Monitor", "Other"];
const DEFAULT_PRIORITIES = ["Low", "Medium", "High"];
const DEFAULT_WARRANTY_STATUSES = [
  "IN_WARRANTY",
  "OUT_OF_WARRANTY",
  "NOT_SPECIFIED",
];

// Time used for job-date filtering / sorting (job date, else created date)
const getRepairTime = (repair) => {
  const time = new Date(repair?.jobDate || repair?.createdAt || 0).getTime();
  return Number.isFinite(time) ? time : 0;
};

// Same rule the table always used for "Latest Ticket"
const pickLatestRepair = (repairs) =>
  repairs && repairs.length
    ? [...repairs].sort(
        (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
      )[0]
    : null;

// Technician id from a populated object or a plain id string
const getTechId = (repair) => {
  const tech = repair?.assignedTechnician;

  if (tech && typeof tech === "object") return String(tech._id || tech.id || "");

  if (typeof tech === "string" && /^[0-9a-fA-F]{24}$/.test(tech)) return tech;

  return "";
};

// Unique values (uppercased) from repairs, merged with a default list
const mergeRepairValues = (defaults, repairs, pick) => {
  const map = new Map();

  defaults.forEach((value) => map.set(normValue(value), value));

  repairs.forEach((repair) => {
    const raw = pick(repair);
    const key = normValue(raw);

    if (key && !map.has(key)) map.set(key, String(raw).trim());
  });

  return Array.from(map, ([key, label]) => ({ key, label }));
};

// =====================================================
// SALES STAFF HELPERS
// =====================================================

// Role can be a string, an object, or an array depending on the backend.
const isSalesRole = (user) => {
  const roles = [user?.role, user?.roleName, user?.userRole, user?.roles]
    .flat()
    .filter(Boolean);

  return roles.some((role) => {
    const value =
      typeof role === "object"
        ? role.name || role.roleName || role.role || ""
        : role;

    return ["sales", "salesperson"].includes(String(value).trim().toLowerCase());
  });
};

const getPersonName = (person) =>
  [person?.firstName, person?.lastName].filter(Boolean).join(" ").trim() ||
  person?.name ||
  person?.fullName ||
  person?.username ||
  "";

// =====================================================
// INITIAL FORM
// =====================================================

const initialForm = {
  customerName: "",
  customerPhone: "",
  customerEmail: "",

  // How the customer found us (mandatory)
  customerSource: "",
  customerSourceOther: "",

  branchId: "",

  jobDate: getTodayLocalDate(),

  deviceType: "",
  deviceModel: "",
  deviceBrand: "",
  serialNumber: "",
  problemCategory: "",
  specificProblem: "",
  accessoriesReceived: "",
  physicalCondition: "",

  issueDescription: "",
  estimatedCompletionDate: "",
  repairCost: "",

  selectedServiceId: "",
  serviceName: "",
  partCost: 0,
  laborCost: 0,
  technicianName: "",
  assignedTechnician: "",
  remarks: "",

  warrantyStatus: "",
  warrantyProvider: "",
  warrantyExpiryDate: "",
  warrantyDetails: "",
  salespersonName: "",
};

// =====================================================
// PAYMENT FORM
// =====================================================

const initialPaymentForm = {
  paidAmount: "",
  paymentMethod: "CASH",
  paymentId: "",
};

// Inline styles for the search / filter bar (no extra CSS file needed)
const filterBarStyle = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "flex-end",
  gap: "12px 14px",
  padding: "14px 1.25rem",
  borderBottom: "1px solid #e2e8f0",
  background: "#ffffff",
};

const filterGroupStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "4px",
  minWidth: 0,
  flex: "1 1 150px",
  maxWidth: "220px",
};

const filterLabelStyle = {
  fontSize: "0.75rem",
  fontWeight: 600,
  color: "#64748b",
};

const filterControlStyle = {
  width: "100%",
  height: "38px",
  boxSizing: "border-box",
  padding: "0 0.65rem",
};

const filterActionsStyle = {
  display: "flex",
  alignItems: "center",
  flexWrap: "wrap",
  gap: "8px",
};

const filterButtonStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  height: "38px",
  padding: "0 14px",
  borderRadius: "6px",
  fontSize: "0.85rem",
  fontWeight: 600,
  whiteSpace: "nowrap",
  cursor: "pointer",
  background: "#ffffff",
};

const filterBadgeStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: "20px",
  height: "20px",
  padding: "0 6px",
  borderRadius: "999px",
  background: "#2563eb",
  color: "#ffffff",
  fontSize: "0.72rem",
  fontWeight: 700,
};

const resultCountStyle = {
  padding: "10px 1.25rem",
  fontSize: "0.8rem",
  color: "#64748b",
  borderBottom: "1px solid #f1f5f9",
};

// =====================================================
// COMPONENT
// =====================================================

const RepairCustomer = () => {
  const [repairs, setRepairs] = useState([]);
  const [technicians, setTechnicians] = useState([]);

  const [services, setServices] = useState([]);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [selectedServiceId, setSelectedServiceId] = useState("");

  // branches = SAARI branches (old tickets ka branch dikhane ke liye)
  // activeBranches = sirf ACTIVE (new Job Card dropdown ke liye)
  const [branches, setBranches] = useState([]);
  const [branchesLoading, setBranchesLoading] = useState(false);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);
  const [statusUpdatingId, setStatusUpdatingId] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // ---------- extra filters + sort ----------
  const [paymentFilter, setPaymentFilter] = useState("ALL");
  const [branchFilter, setBranchFilter] = useState("ALL");
  const [technicianFilter, setTechnicianFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState("DEFAULT");
  const [priorityFilter, setPriorityFilter] = useState("ALL");
  const [sourceFilter, setSourceFilter] = useState("ALL");
  const [salespersonFilter, setSalespersonFilter] = useState("ALL");
  const [warrantyFilter, setWarrantyFilter] = useState("ALL");
  const [deviceFilter, setDeviceFilter] = useState("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showMoreFilters, setShowMoreFilters] = useState(false);

  const [showAddForm, setShowAddForm] = useState(false);

  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  const [selectedPaymentRepair, setSelectedPaymentRepair] = useState(null);

  const [transferRepairItem, setTransferRepairItem] = useState(null);
  const [salespersons, setSalespersons] = useState([]);

  // Employees with the "sales" role (used by the Salesperson filter)
  const [salesStaff, setSalesStaff] = useState([]);

  // Latest Ticket "More / Less" toggle (key = repair id)
  const [expandedTickets, setExpandedTickets] = useState({});

  const [form, setForm] = useState(initialForm);
  const [paymentForm, setPaymentForm] = useState(initialPaymentForm);

  const activeBranches = useMemo(
    () => branches.filter(isBranchActive),
    [branches]
  );

  const toggleTicketDetails = (key) => {
    setExpandedTickets((previous) => ({
      ...previous,
      [key]: !previous[key],
    }));
  };

  // ===================================================
  // AUTH CONFIG
  // ===================================================

  const getAuthConfig = () => {
    const token =
      localStorage.getItem("token") || localStorage.getItem("accessToken");

    return {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    };
  };

  // ===================================================
  // TECHNICIAN NAME
  // ===================================================

  const resolveTechName = (techOrId) => {
    if (!techOrId) return "Unassigned";

    if (
      typeof techOrId === "string" &&
      !techOrId.match(/^[0-9a-fA-F]{24}$/)
    ) {
      return techOrId;
    }

    const techObj =
      typeof techOrId === "object"
        ? techOrId
        : technicians.find((t) => t._id === techOrId);

    if (!techObj) return "Unassigned";

    const full = `${techObj.firstName || ""} ${techObj.lastName || ""}`.trim();

    return (
      full ||
      techObj.name ||
      techObj.fullName ||
      techObj.username ||
      "Technician"
    );
  };

  const getTechnicianName = (repair) =>
    resolveTechName(repair?.assignedTechnician || repair?.technicianName);

  // ===================================================
  // BRANCH HELPERS (repair record ke liye)
  // ===================================================

  const getBranchInfo = (repair) => {
    if (!repair) return null;

    const rawBranch =
      repair.branchId || repair.branch || repair.branchDetails || null;

    // Already populated branch object
    if (
      rawBranch &&
      typeof rawBranch === "object" &&
      (rawBranch.name ||
        rawBranch.branchName ||
        rawBranch.title ||
        rawBranch.code ||
        rawBranch.branchCode)
    ) {
      return rawBranch;
    }

    // Branch ID -> fetched (saari) branches list mein dhoondo
    const branchId = getBranchId(rawBranch);

    if (branchId) {
      const found = branches.find((branch) => getBranchId(branch) === branchId);
      if (found) return found;
    }

    // Purane records mein sirf branchName ho sakta hai
    if (repair.branchName) {
      return {
        name: repair.branchName,
        code: repair.branchCode || "",
      };
    }

    return null;
  };

  const getBranchName = (repair) => {
    const branch = getBranchInfo(repair);

    return (
      branch?.name ||
      branch?.branchName ||
      branch?.title ||
      repair?.branchName ||
      "Branch Not Available"
    );
  };

  const getBranchLabel = (repair) => {
    const branch = getBranchInfo(repair);
    const name = getBranchName(repair);
    const code = branch?.code || branch?.branchCode || "";

    return code ? `${name} (${code})` : name;
  };

  // ===================================================
  // PAYMENT HELPERS
  // ===================================================

  const getRepairCost = (repair) => {
    return Math.max(Number(repair?.repairCost || 0), 0);
  };

  const getPaidAmount = (repair) => {
    const paid = Number(repair?.paidAmount || 0);
    const total = getRepairCost(repair);

    return Math.min(Math.max(paid, 0), total);
  };

  const getBalanceAmount = (repair) => {
    const total = getRepairCost(repair);
    const paid = getPaidAmount(repair);

    if (repair?.balanceAmount !== undefined && repair?.balanceAmount !== null) {
      return Math.max(Number(repair.balanceAmount || 0), 0);
    }

    return Math.max(total - paid, 0);
  };

  const getPaymentStatus = (repair) => {
    const total = getRepairCost(repair);
    const paid = getPaidAmount(repair);

    const rawStatus = String(repair?.paymentStatus || "").toUpperCase();

    if (rawStatus === "REFUNDED") return "REFUNDED";
    if (rawStatus === "FAILED") return "FAILED";

    if (total <= 0) {
      return rawStatus || "PENDING";
    }

    if (paid >= total) {
      return "PAID";
    }

    if (paid > 0) {
      return "PARTIAL";
    }

    return "PENDING";
  };

  const getPaymentStatusClass = (status) => {
    switch (String(status || "").toUpperCase()) {
      case "PAID":
        return "rc-payment-paid";

      case "PARTIAL":
        return "rc-payment-partial";

      case "FAILED":
        return "rc-payment-failed";

      case "REFUNDED":
        return "rc-payment-refunded";

      default:
        return "rc-payment-pending";
    }
  };

  const getPaymentStatusLabel = (status) => {
    return String(status || "PENDING")
      .replaceAll("_", " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  };

  // ===================================================
  // FETCH REPAIRS
  // ===================================================

  const fetchRepairs = async () => {
    try {
      setLoading(true);

      const res = await axios.get(`${BASE_URL}/`, getAuthConfig());

      const data =
        res.data?.repairs ||
        res.data?.data?.repairs ||
        res.data?.results ||
        res.data?.data?.results ||
        res.data?.data ||
        (Array.isArray(res.data) ? res.data : []);

      setRepairs(Array.isArray(data) ? data : []);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to load repairs");
    } finally {
      setLoading(false);
    }
  };

  // ===================================================
  // FETCH TECHNICIANS
  // ===================================================

  const fetchTechnicians = async () => {
    try {
      const res = await axios.get(TECHNICIAN_URL, getAuthConfig());

      const data =
        res.data?.technicians ||
        res.data?.data ||
        (Array.isArray(res.data) ? res.data : []);

      setTechnicians(Array.isArray(data) ? data : []);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to load technicians");
    }
  };

  // ===================================================
  // FETCH SERVICES (Admin service rates)
  // ===================================================

  const fetchServices = async () => {
    try {
      setServicesLoading(true);

      const res = await axios.get(
        `${SERVICE_URL}/get-services`,
        getAuthConfig()
      );

      const data = res.data?.services || res.data?.data || [];

      setServices(Array.isArray(data) ? data : []);
    } catch (err) {
      toast.error(
        err.response?.data?.message || "Failed to load service rates"
      );
    } finally {
      setServicesLoading(false);
    }
  };

  // ===================================================
  // FETCH ALL BRANCHES
  // Saari branches load hoti hain taaki purane tickets / receipts
  // mein inactive branch ka naam bhi dikhe. Dropdown mein sirf
  // ACTIVE branches dikhengi (activeBranches).
  // ===================================================

  const fetchBranches = async () => {
    try {
      setBranchesLoading(true);

      const res = await axios.get(BRANCH_URL, getAuthConfig());

      const responseData = res.data;

      let data = [];

      if (Array.isArray(responseData)) {
        data = responseData;
      } else if (Array.isArray(responseData?.branches)) {
        data = responseData.branches;
      } else if (Array.isArray(responseData?.data)) {
        data = responseData.data;
      } else if (Array.isArray(responseData?.data?.branches)) {
        data = responseData.data.branches;
      } else if (Array.isArray(responseData?.results)) {
        data = responseData.results;
      } else if (Array.isArray(responseData?.data?.results)) {
        data = responseData.data.results;
      }

      setBranches(data);
    } catch (error) {
      setBranches([]);

      toast.error(
        error.response?.data?.message ||
          "Failed to load branches. Check /branches API."
      );
    } finally {
      setBranchesLoading(false);
    }
  };

  // ===================================================
  // FETCH SALES STAFF (employees with the "sales" role)
  // ===================================================

  const fetchSalesStaff = async () => {
    try {
      const res = await getEmployees();
      const body = res?.data;

      const list = Array.isArray(body)
        ? body
        : body?.employees ||
          body?.users ||
          body?.data?.employees ||
          body?.data?.users ||
          body?.data ||
          [];

      setSalesStaff(Array.isArray(list) ? list.filter(isSalesRole) : []);
    } catch (err) {
      setSalesStaff([]);
      toast.error(err.response?.data?.message || "Failed to load salespersons");
    }
  };

  // ===================================================
  // INITIAL LOAD
  // ===================================================

  useEffect(() => {
    fetchRepairs();
    fetchTechnicians();
    fetchServices();
    fetchBranches();
    fetchSalesStaff();
    getSalespersonNames().then(setSalespersons);
  }, []);

  // ===================================================
  // FORM CHANGE
  // ===================================================

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(previous => ({
      ...previous,
      [name]: value,
      ...(name === "problemCategory" ? { specificProblem: "" } : {}),
      ...(name === "deviceType" ? { problemCategory: "", specificProblem: "" } : {}),
      // Clear the "other" text when a different source is picked.
      ...(name === "customerSource" && value !== "OTHER" ? { customerSourceOther: "" } : {}),
    }));
  };

  // ===================================================
  // TECHNICIAN CHANGE
  // ===================================================

  const handleTechnicianChange = (e) => {
    const id = e.target.value;

    setForm((previous) => ({
      ...previous,
      assignedTechnician: id,
      technicianName: id ? resolveTechName(id) : "",
    }));
  };

  // ===================================================
  // SERVICE RATE CHANGE
  // ===================================================

  const handleServiceChange = (e) => {
    const id = e.target.value;
    setSelectedServiceId(id);

    const selected = services.find((service) => service._id === id);

    if (!selected) {
      setForm((previous) => ({
        ...previous,
        selectedServiceId: "",
        serviceName: "",
        partCost: 0,
        laborCost: 0,
        repairCost: "",
      }));
      return;
    }

    const partCost = Number(selected.partCost) || 0;
    const laborCost = Number(selected.laborCost) || 0;
    const totalCost = getServiceTotal(selected);

    setForm((previous) => ({
      ...previous,
      selectedServiceId: selected._id,
      serviceName: selected.serviceName || "",
      partCost,
      laborCost,
      repairCost: String(totalCost),
    }));
  };

  // ===================================================
  // CREATE REPAIR
  // ===================================================

  const handleCreateRepair = async (e) => {
    e.preventDefault();

    // Branch validation (mandatory)
    if (!form.branchId) {
      return toast.error("Please select a branch for this Job Card.");
    }

    const selectedBranch = activeBranches.find(
      (branch) => getBranchId(branch) === form.branchId
    );

    if (!selectedBranch) {
      return toast.error(
        "Selected branch is invalid or inactive. Please select an active branch."
      );
    }

    // Customer source is mandatory; "Other" also needs a short description.
    if (!form.customerSource) {
      return toast.error("Please select how the customer found us (Source).");
    }
    if (form.customerSource === "OTHER" && !form.customerSourceOther.trim()) {
      return toast.error("Please specify the source when selecting Other.");
    }
    if (!form.warrantyStatus) {
      return toast.error(
        "Please select Warranty Status (Under Warranty / Out of Warranty)."
      );
    }
    // Keep the user-selected problem in issueDescription for legacy backend compatibility.
    const isLaptop = form.deviceType === "Laptop";
    if (isLaptop && (!form.problemCategory || !form.specificProblem)) {
      return toast.error("Please select Problem Category and Specific Problem.");
    }
    if (isLaptop && form.specificProblem === "Other / Problem Not Listed" && !form.issueDescription.trim()) {
      return toast.error("Please describe the problem when selecting Other.");
    }
    const issueText = isLaptop
      ? [
          `Problem Category: ${form.problemCategory}`,
          `Specific Problem: ${form.specificProblem}`,
          form.issueDescription.trim() ? `Customer Description: ${form.issueDescription.trim()}` : "",
          form.deviceBrand.trim() ? `Device Brand: ${form.deviceBrand.trim()}` : "",
          form.serialNumber.trim() ? `Serial Number: ${form.serialNumber.trim()}` : "",
          form.accessoriesReceived.trim() ? `Accessories Received: ${form.accessoriesReceived.trim()}` : "",
          form.physicalCondition.trim() ? `Physical Condition: ${form.physicalCondition.trim()}` : "",
        ].filter(Boolean).join("\n")
      : form.issueDescription.trim();

    if (
      !form.customerName.trim() ||
      !form.customerPhone.trim() ||
      !form.jobDate ||
      !form.deviceType.trim() ||
      !form.deviceModel.trim() ||
      !issueText
    ) {
      return toast.error("Please fill in all mandatory fields.");
    }

    try {
      setSubmitting(true);

      const payload = {
        branchId: form.branchId,

        customerName: form.customerName.trim(),
        customerPhone: form.customerPhone.trim(),

        // How the customer found us
        customerSource: form.customerSource,
        customerSourceOther:
          form.customerSource === "OTHER" ? form.customerSourceOther.trim() : "",

        jobDate: form.jobDate,

        deviceType: form.deviceType.trim(),
        deviceModel: form.deviceModel.trim(),

        issueDescription: issueText,

        estimatedCompletionDate: form.estimatedCompletionDate || undefined,

        repairCost: form.repairCost ? Number(form.repairCost) : 0,

        // Selected service ka snapshot
        selectedServiceId: form.selectedServiceId || undefined,
        serviceName: form.serviceName || undefined,
        partCost: Number(form.partCost) || 0,
        laborCost: Number(form.laborCost) || 0,

        technicianName: form.technicianName.trim(),

        assignedTechnician: form.assignedTechnician || null,

        remarks: form.remarks.trim(),

        warrantyStatus: form.warrantyStatus,
        warrantyProvider: form.warrantyProvider.trim(),
        warrantyExpiryDate: form.warrantyExpiryDate || undefined,
        warrantyDetails: form.warrantyDetails.trim(),
        salespersonName: form.salespersonName.trim(),
      };

      const email = form.customerEmail.trim();

      if (email) {
        payload.customerEmail = email;
      }

      const res = await axios.post(
        `${BASE_URL}/request`,
        payload,
        getAuthConfig()
      );

      toast.success(res.data?.message || "Repair created successfully");

      setShowAddForm(false);
      setForm(initialForm);
      setSelectedServiceId("");

      await fetchRepairs();
    } catch (err) {
      const errorMsg =
        err.response?.data?.errors?.[0] ||
        err.response?.data?.message ||
        "Failed to create repair ticket";

      toast.error(errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  // ===================================================
  // UPDATE REPAIR STATUS
  // ===================================================

  const handleStatusUpdate = async (repair, newStatus) => {
    if (!repair?._id || !newStatus) {
      toast.error("Repair ticket or status is missing.");
      return;
    }

    if (newStatus === (repair.status || "Received")) {
      return;
    }

    try {
      setStatusUpdatingId(repair._id);

      const response = await axios.patch(
        getStatusUpdateUrl(repair._id),
        { status: newStatus },
        getAuthConfig()
      );

      const updatedRepair =
        response.data?.repair ||
        response.data?.data ||
        response.data?.updatedRepair;

      const hasUpdatedRepair =
        updatedRepair && typeof updatedRepair === "object";

      // API success ke baad hi local data update hoga.
      if (hasUpdatedRepair) {
        setRepairs((previous) =>
          previous.map((item) =>
            item._id === repair._id ? { ...item, ...updatedRepair } : item
          )
        );
      } else {
        await fetchRepairs();
      }

      toast.success(
        response.data?.message || `Repair status updated to ${newStatus}.`
      );

      // Open customer timeline ko sync rakho.
      setSelectedCustomer((previous) => {
        if (!previous) return previous;

        return {
          ...previous,
          repairs: previous.repairs.map((item) =>
            item._id === repair._id
              ? {
                  ...item,
                  ...(hasUpdatedRepair ? updatedRepair : {}),
                  status: newStatus,
                }
              : item
          ),
        };
      });

      // Open receipt ko sync rakho.
      setSelectedInvoice((previous) => {
        if (!previous || previous._id !== repair._id) {
          return previous;
        }

        return {
          ...previous,
          ...(hasUpdatedRepair ? updatedRepair : {}),
          status: newStatus,
        };
      });
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          error.response?.data?.errors?.[0] ||
          "Status update failed. Please check the backend status API."
      );
    } finally {
      setStatusUpdatingId("");
    }
  };

  // ===================================================
  // STATUS DROPDOWN (table + customer history dono me use)
  // ===================================================

  const renderStatusSelect = (repair, style = {}) => {
    if (!repair?._id) return null;

    return (
      <>
        <select
          className="rc-select"
          style={{
            display: "block",
            width: "100%",
            marginTop: "8px",
            ...style,
          }}
          value={repair.status || "Received"}
          disabled={statusUpdatingId === repair._id}
          onChange={(event) => handleStatusUpdate(repair, event.target.value)}
          aria-label={`Update status for ${
            repair.repairNumber || "repair ticket"
          }`}
        >
          {REPAIR_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>

        {statusUpdatingId === repair._id && (
          <small style={{ display: "block", marginTop: "5px" }}>
            Updating status...
          </small>
        )}
      </>
    );
  };

  // ===================================================
  // CUSTOMERS GROUPING
  // ===================================================

  const customers = useMemo(() => {
    const map = new Map();

    repairs.forEach((repair) => {
      if (!repair.customerPhone) return;

      if (!map.has(repair.customerPhone)) {
        map.set(repair.customerPhone, {
          customerName: repair.customerName || "Unknown Customer",

          customerPhone: repair.customerPhone,

          customerEmail: repair.customerEmail || "",

          repairs: [],
        });
      }

      map.get(repair.customerPhone).repairs.push(repair);
    });

    return Array.from(map.values());
  }, [repairs]);

  // ===================================================
  // FILTER DROPDOWN OPTIONS
  // ===================================================

  // Branch dropdown = every branch from the /branches API
  const branchFilterOptions = useMemo(
    () =>
      branches
        .map((branch) => ({
          id: getBranchId(branch),
          name: String(branch?.name || branch?.branchName || "").trim(),
          code: String(branch?.code || branch?.branchCode || "").trim(),
        }))
        .filter((branch) => branch.id && branch.name)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [branches]
  );

  // Technician dropdown = technicians from the technicians API
  const technicianFilterOptions = useMemo(
    () =>
      technicians
        .filter((tech) => tech?._id)
        .map((tech) => ({ id: tech._id, name: resolveTechName(tech) }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [technicians]
  );

  const priorityOptions = useMemo(
    () => mergeRepairValues(DEFAULT_PRIORITIES, repairs, (r) => r.priority),
    [repairs]
  );

  const deviceOptions = useMemo(
    () => mergeRepairValues(DEFAULT_DEVICE_TYPES, repairs, (r) => r.deviceType),
    [repairs]
  );

  const warrantyOptions = useMemo(
    () =>
      mergeRepairValues(
        DEFAULT_WARRANTY_STATUSES,
        repairs,
        (r) => r.warrantyStatus
      ),
    [repairs]
  );

  // Source filter dropdown: ONLY the sources defined in customerSources.js,
  // sorted A-Z by label with "Other" pinned last.
  const sourceOptions = CUSTOMER_SOURCES.filter(
    (item) => item.value !== "OTHER"
  )
    .sort((a, b) => a.label.localeCompare(b.label))
    .concat(CUSTOMER_SOURCES.filter((item) => item.value === "OTHER"));

  // Salesperson dropdown = every employee with the "sales" role
  // + any name already saved on a job (so old jobs stay filterable)
  const salespersonOptions = useMemo(() => {
    const map = new Map();

    const add = (name) => {
      const clean = String(name || "").trim();
      const key = clean.toLowerCase();
      if (key && !map.has(key)) map.set(key, clean);
    };

    salesStaff.forEach((person) => add(getPersonName(person)));
    repairs.forEach((repair) => add(repair.salespersonName));

    return Array.from(map, ([key, name]) => ({ key, name })).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }, [repairs, salesStaff]);

  // ===================================================
  // SEARCH + FILTER + SORT (customers)
  //
  // Filters are checked per repair. A customer row stays visible when at
  // least one of their repairs matches EVERY active filter, and the row
  // then shows the latest repair that matched.
  // ===================================================

  const { filteredCustomers, matchedMap } = useMemo(() => {
    const q = search.toLowerCase().trim();

    const from = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null;
    const to = dateTo ? new Date(`${dateTo}T23:59:59.999`).getTime() : null;

    const selectedTech =
      technicianFilter !== "ALL" && technicianFilter !== NONE_VALUE
        ? technicians.find((tech) => tech._id === technicianFilter)
        : null;

    const selectedTechName = selectedTech
      ? resolveTechName(selectedTech).toLowerCase()
      : "";

    const repairMatches = (repair, customer) => {
      // ---- search ----
      if (q) {
        const details = getJobDetails(repair);
        const branch = getBranchInfo(repair);

        const haystack = [
          customer.customerName,
          customer.customerPhone,
          customer.customerEmail,
          repair.customerName,
          repair.customerPhone,
          repair.customerEmail,
          repair.repairNumber,
          repair.deviceModel,
          repair.laptopModel,
          repair.deviceType,
          details.deviceBrand,
          details.serialNumber,
          details.problemCategory,
          details.specificProblem,
          repair.serviceName,
          repair.status,
          getPaymentStatusLabel(getPaymentStatus(repair)),
          getSourceInfo(repair).label,
          getTechnicianName(repair),
          branch?.name,
          branch?.code,
          repair.salespersonName,
          repair.remarks,
          repair.issueDescription,
        ]
          .map((value) => String(value || "").toLowerCase())
          .join("\n");

        if (!haystack.includes(q)) return false;
      }

      // ---- status ----
      if (
        statusFilter !== "ALL" &&
        String(repair.status || "Received").toLowerCase() !==
          statusFilter.toLowerCase()
      ) {
        return false;
      }

      // ---- payment ----
      if (paymentFilter !== "ALL" && getPaymentStatus(repair) !== paymentFilter) {
        return false;
      }

      // ---- branch ----
      if (branchFilter !== "ALL") {
        const id = getBranchId(repair.branchId || repair.branch);

        if (branchFilter === NONE_VALUE ? id !== "" : id !== branchFilter) {
          return false;
        }
      }

      // ---- technician ----
      if (technicianFilter !== "ALL") {
        const techId = getTechId(repair);
        const techText = String(repair.technicianName || "").trim().toLowerCase();

        if (technicianFilter === NONE_VALUE) {
          if (techId || techText) return false;
        } else if (
          techId !== technicianFilter &&
          !(
            !techId &&
            selectedTechName &&
            techText === selectedTechName
          )
        ) {
          return false;
        }
      }

      // ---- priority ----
      if (priorityFilter !== "ALL" && normValue(repair.priority) !== priorityFilter) {
        return false;
      }

      // ---- customer source ----
      if (sourceFilter !== "ALL") {
        const value = getSourceInfo(repair).value;

        if (sourceFilter === NONE_VALUE ? value !== "" : value !== sourceFilter) {
          return false;
        }
      }

      // ---- salesperson ----
      if (salespersonFilter !== "ALL") {
        const key = String(repair.salespersonName || "").trim().toLowerCase();

        if (salespersonFilter === NONE_VALUE ? key !== "" : key !== salespersonFilter) {
          return false;
        }
      }

      // ---- warranty ----
      if (
        warrantyFilter !== "ALL" &&
        (normValue(repair.warrantyStatus) || "NOT_SPECIFIED") !== warrantyFilter
      ) {
        return false;
      }

      // ---- device type ----
      if (deviceFilter !== "ALL" && normValue(repair.deviceType) !== deviceFilter) {
        return false;
      }

      // ---- job date range ----
      if (from !== null || to !== null) {
        if (!repair.jobDate && !repair.createdAt) return false;

        const time = getRepairTime(repair);

        if (from !== null && time < from) return false;
        if (to !== null && time > to) return false;
      }

      return true;
    };

    const matched = new Map();
    const list = [];

    customers.forEach((customer) => {
      const hits = customer.repairs.filter((repair) =>
        repairMatches(repair, customer)
      );

      if (hits.length > 0) {
        matched.set(customer.customerPhone, hits);
        list.push(customer);
      }
    });

    // ---- sort (uses the repair shown in the row) ----
    const shown = (customer) =>
      pickLatestRepair(matched.get(customer.customerPhone)) || {};

    const comparators = {
      DATE_DESC: (a, b) => getRepairTime(shown(b)) - getRepairTime(shown(a)),
      DATE_ASC: (a, b) => getRepairTime(shown(a)) - getRepairTime(shown(b)),
      CUSTOMER_ASC: (a, b) =>
        a.customerName.toLowerCase().localeCompare(b.customerName.toLowerCase()),
      CUSTOMER_DESC: (a, b) =>
        b.customerName.toLowerCase().localeCompare(a.customerName.toLowerCase()),
      COST_DESC: (a, b) => getRepairCost(shown(b)) - getRepairCost(shown(a)),
      COST_ASC: (a, b) => getRepairCost(shown(a)) - getRepairCost(shown(b)),
      DUE_DESC: (a, b) => getBalanceAmount(shown(b)) - getBalanceAmount(shown(a)),
    };

    const compare = comparators[sortBy];

    return {
      filteredCustomers: compare ? [...list].sort(compare) : list,
      matchedMap: matched,
    };
  }, [
    customers,
    search,
    statusFilter,
    paymentFilter,
    branchFilter,
    technicianFilter,
    priorityFilter,
    sourceFilter,
    salespersonFilter,
    warrantyFilter,
    deviceFilter,
    dateFrom,
    dateTo,
    sortBy,
    technicians,
    branches,
  ]);

  const hasActiveFilters =
    search.trim() !== "" ||
    statusFilter !== "ALL" ||
    paymentFilter !== "ALL" ||
    branchFilter !== "ALL" ||
    technicianFilter !== "ALL" ||
    priorityFilter !== "ALL" ||
    sourceFilter !== "ALL" ||
    salespersonFilter !== "ALL" ||
    warrantyFilter !== "ALL" ||
    deviceFilter !== "ALL" ||
    dateFrom !== "" ||
    dateTo !== "" ||
    sortBy !== "DEFAULT";

  // Number of filters set inside the "More filters" panel
  const moreFiltersCount =
    (priorityFilter !== "ALL" ? 1 : 0) +
    (sourceFilter !== "ALL" ? 1 : 0) +
    (salespersonFilter !== "ALL" ? 1 : 0) +
    (warrantyFilter !== "ALL" ? 1 : 0) +
    (deviceFilter !== "ALL" ? 1 : 0) +
    (dateFrom !== "" ? 1 : 0) +
    (dateTo !== "" ? 1 : 0);

  const resetFilters = () => {
    setSearch("");
    setStatusFilter("ALL");
    setPaymentFilter("ALL");
    setBranchFilter("ALL");
    setTechnicianFilter("ALL");
    setPriorityFilter("ALL");
    setSourceFilter("ALL");
    setSalespersonFilter("ALL");
    setWarrantyFilter("ALL");
    setDeviceFilter("ALL");
    setDateFrom("");
    setDateTo("");
    setSortBy("DEFAULT");
  };

  // ===================================================
  // LATEST REPAIR
  // ===================================================

  const getLatestRepair = (customer) => pickLatestRepair(customer.repairs);

  // Repair shown in the table row: the latest one that matches the active
  // search / filters (identical to getLatestRepair when nothing is filtered).
  const getDisplayRepair = (customer) =>
    pickLatestRepair(matchedMap.get(customer.customerPhone)) ||
    getLatestRepair(customer);

  // ===================================================
  // STATUS HELPERS
  // ===================================================

  const getStatusClass = (status) =>
    status
      ? `rc-status-${String(status).toLowerCase().replaceAll(" ", "-")}`
      : "rc-status-default";

  const getStatusLabel = (status) =>
    status
      ? String(status)
          .replaceAll("_", " ")
          .replace(/\b\w/g, (letter) => letter.toUpperCase())
      : "Received";

  // ===================================================
  // OPEN RECEIPT
  // ===================================================

  const openReceipt = (repairItem, fallbackCustomer = {}) => {
    if (!repairItem) return;

    setSelectedInvoice({
      ...repairItem,

      customerName:
        repairItem.customerName || fallbackCustomer.customerName || "Customer",

      customerPhone:
        repairItem.customerPhone || fallbackCustomer.customerPhone || "N/A",

      customerEmail:
        repairItem.customerEmail || fallbackCustomer.customerEmail || "",

      technicianName: getTechnicianName(repairItem),
    });
  };

  // ===================================================
  // OPEN PAYMENT MODAL
  // ===================================================

  const openPaymentModal = (repair) => {
    if (!repair) return;

    const paid = getPaidAmount(repair);
    const balance = getBalanceAmount(repair);

    setSelectedPaymentRepair(repair);

    setPaymentForm({
      paidAmount: balance > 0 ? String(balance) : String(paid),

      paymentMethod: repair.paymentMethod || "CASH",

      paymentId: repair.paymentId || "",
    });
  };

  // ===================================================
  // PAYMENT FORM CHANGE
  // ===================================================

  const handlePaymentChange = (e) => {
    setPaymentForm((previous) => ({
      ...previous,
      [e.target.name]: e.target.value,
    }));
  };

  // ===================================================
  // SAVE PAYMENT
  // ===================================================

  const handleSavePayment = async (e) => {
    e.preventDefault();

    if (!selectedPaymentRepair?._id) {
      toast.error("Repair ID is missing.");
      return;
    }

    const total = getRepairCost(selectedPaymentRepair);

    const paidAmount = Number(paymentForm.paidAmount);

    if (!Number.isFinite(paidAmount)) {
      toast.error("Please enter a valid paid amount.");
      return;
    }

    if (paidAmount < 0) {
      toast.error("Paid amount cannot be negative.");
      return;
    }

    if (paidAmount > total) {
      toast.error(
        `Paid amount cannot exceed repair cost ${formatRupees(total)}.`
      );
      return;
    }

    try {
      setPaymentSubmitting(true);

      const res = await axios.patch(
        `${BASE_URL}/${selectedPaymentRepair._id}/payment`,
        {
          paidAmount,
          paymentMethod: paymentForm.paymentMethod,
          paymentId: paymentForm.paymentId.trim(),
        },
        getAuthConfig()
      );

      toast.success(
        res.data?.message || "Repair payment updated successfully."
      );

      setSelectedPaymentRepair(null);
      setPaymentForm(initialPaymentForm);

      await fetchRepairs();

      // Refresh selected invoice if it is open
      if (selectedInvoice?._id === selectedPaymentRepair._id) {
        setSelectedInvoice(null);
      }
    } catch (err) {
      toast.error(
        err.response?.data?.message || "Failed to update repair payment."
      );
    } finally {
      setPaymentSubmitting(false);
    }
  };

  // ===================================================
  // PRINT
  // ===================================================

  const handlePrint = () => {
    window.print();
  };

  const handleTransferred = async (updatedRepair) => {
    setTransferRepairItem(null);

    if (updatedRepair?._id) {
      setSelectedCustomer((previous) =>
        previous
          ? {
              ...previous,
              repairs: previous.repairs.map((item) =>
                item._id === updatedRepair._id
                  ? { ...item, ...updatedRepair }
                  : item
              ),
            }
          : previous
      );
    }

    await fetchRepairs();
  };

  // Receipt ke liye branch details (render se pehle compute)
  const invoiceBranch = selectedInvoice ? getBranchInfo(selectedInvoice) : null;
  const invoiceBranchAddress = formatBranchAddress(invoiceBranch);

  // ===================================================
  // RENDER
  // ===================================================

  return (
    <div className="rc-dashboard">
      {/* =================================================
          HEADER
      ================================================= */}

      <header className="rc-header no-print">
        <div className="rc-header-titles">
          <span className="rc-eyebrow">Repair Operations</span>

          <h1>Repair Service Registry</h1>

          <p>
            Monitor customer equipment intake, workshop assignments, and job
            tickets.
          </p>
        </div>

        <button
          type="button"
          className="rc-btn rc-btn-primary"
          onClick={() => setShowAddForm(true)}
        >
          <FiPlus />
          <span>New Repair Job</span>
        </button>
      </header>

      {/* =================================================
          STATS
      ================================================= */}

      <section className="rc-stats-grid no-print">
        <div className="rc-stat-card">
          <div className="rc-stat-icon rc-icon-blue">
            <FiUser />
          </div>

          <div className="rc-stat-info">
            <span className="rc-stat-label">Total Customers</span>

            <strong className="rc-stat-val">{customers.length}</strong>
          </div>
        </div>

        <div className="rc-stat-card">
          <div className="rc-stat-icon rc-icon-purple">
            <FiTool />
          </div>

          <div className="rc-stat-info">
            <span className="rc-stat-label">Total Repairs</span>

            <strong className="rc-stat-val">{repairs.length}</strong>
          </div>
        </div>

        <div className="rc-stat-card">
          <div className="rc-stat-icon rc-icon-amber">
            <FiClock />
          </div>

          <div className="rc-stat-info">
            <span className="rc-stat-label">Pending / Received</span>

            <strong className="rc-stat-val">
              {
                repairs.filter(
                  (repair) =>
                    !repair.status ||
                    String(repair.status).toLowerCase() === "received"
                ).length
              }
            </strong>
          </div>
        </div>

        <div className="rc-stat-card">
          <div className="rc-stat-icon rc-icon-emerald">
            <FiCheckCircle />
          </div>

          <div className="rc-stat-info">
            <span className="rc-stat-label">Delivered & Closed</span>

            <strong className="rc-stat-val">
              {
                repairs.filter((repair) =>
                  ["delivered", "completed"].includes(
                    String(repair.status).toLowerCase()
                  )
                ).length
              }
            </strong>
          </div>
        </div>
      </section>

      {/* =================================================
          DIRECTORY
      ================================================= */}

      <section className="rc-main-card no-print">
        <div className="rc-card-toolbar">
          <div className="rc-search-wrap">
            <FiSearch className="rc-search-ico" />

            <input
              type="text"
              placeholder="Search customer, phone, ticket, device, serial no., technician, branch..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            {search && (
              <button
                type="button"
                className="rc-btn-clear"
                onClick={() => setSearch("")}
              >
                <FiX />
              </button>
            )}
          </div>

          <div className="rc-toolbar-actions">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rc-select"
            >
              <option value="ALL">All Statuses</option>

              {REPAIR_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>

            <button
              type="button"
              className="rc-btn rc-btn-secondary"
              onClick={() => {
                fetchRepairs();
                fetchSalesStaff();
              }}
              disabled={loading}
            >
              <FiRefreshCw className={loading ? "rc-spin" : ""} />

              <span>Sync</span>
            </button>
          </div>
        </div>

        {/* ---------- FILTERS ---------- */}

        <div style={filterBarStyle}>
          <div style={filterGroupStyle}>
            <label style={filterLabelStyle} htmlFor="rc-f-payment">Payment</label>

            <select
              id="rc-f-payment"
              className="rc-select"
              style={filterControlStyle}
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
            >
              <option value="ALL">All Payments</option>
              <option value="PAID">Paid</option>
              <option value="PARTIAL">Partial</option>
              <option value="PENDING">Pending</option>
              <option value="FAILED">Failed</option>
              <option value="REFUNDED">Refunded</option>
            </select>
          </div>

          <div style={filterGroupStyle}>
            <label style={filterLabelStyle} htmlFor="rc-f-branch">Branch</label>

            <select
              id="rc-f-branch"
              className="rc-select"
              style={filterControlStyle}
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              disabled={branchesLoading}
            >
              <option value="ALL">
                {branchesLoading ? "Loading branches..." : "All Branches"}
              </option>

              {branchFilterOptions.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                  {branch.code ? ` (${branch.code})` : ""}
                </option>
              ))}

              <option value={NONE_VALUE}>No branch assigned</option>
            </select>
          </div>

          <div style={filterGroupStyle}>
            <label style={filterLabelStyle} htmlFor="rc-f-tech">Technician</label>

            <select
              id="rc-f-tech"
              className="rc-select"
              style={filterControlStyle}
              value={technicianFilter}
              onChange={(e) => setTechnicianFilter(e.target.value)}
            >
              <option value="ALL">All Technicians</option>

              {technicianFilterOptions.map((tech) => (
                <option key={tech.id} value={tech.id}>
                  {tech.name}
                </option>
              ))}

              <option value={NONE_VALUE}>Unassigned</option>
            </select>
          </div>

          <div style={filterGroupStyle}>
            <label style={filterLabelStyle} htmlFor="rc-f-sort">Sort by</label>

            <select
              id="rc-f-sort"
              className="rc-select"
              style={filterControlStyle}
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              {REPAIR_SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div style={filterActionsStyle}>
            <button
              type="button"
              style={{
                ...filterButtonStyle,
                border:
                  showMoreFilters || moreFiltersCount > 0
                    ? "1px solid #2563eb"
                    : "1px solid #e2e8f0",
                color:
                  showMoreFilters || moreFiltersCount > 0
                    ? "#2563eb"
                    : "#334155",
                background:
                  showMoreFilters || moreFiltersCount > 0
                    ? "#eff6ff"
                    : "#ffffff",
              }}
              aria-expanded={showMoreFilters}
              aria-controls="rc-more-filters"
              onClick={() => setShowMoreFilters((open) => !open)}
            >
              More filters
              {moreFiltersCount > 0 && (
                <span style={filterBadgeStyle}>{moreFiltersCount}</span>
              )}
              {showMoreFilters ? <FiChevronUp /> : <FiChevronDown />}
            </button>

            {hasActiveFilters && (
              <button
                type="button"
                style={{
                  ...filterButtonStyle,
                  border: "1px solid #dc2626",
                  color: "#dc2626",
                }}
                onClick={resetFilters}
              >
                Clear filters
              </button>
            )}
          </div>
        </div>

        {showMoreFilters && (
          <div id="rc-more-filters" style={{ ...filterBarStyle, background: "#f8fafc" }}>
            <div style={filterGroupStyle}>
              <label style={filterLabelStyle} htmlFor="rc-f-priority">Priority</label>

              <select
                id="rc-f-priority"
                className="rc-select"
                style={filterControlStyle}
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
              >
                <option value="ALL">All Priorities</option>

                {priorityOptions.map((option) => (
                  <option key={option.key} value={option.key}>
                    {prettifyValue(option.label)}
                  </option>
                ))}
              </select>
            </div>

            <div style={filterGroupStyle}>
              <label style={filterLabelStyle} htmlFor="rc-f-source">Customer source</label>

              <select
                id="rc-f-source"
                className="rc-select"
                style={filterControlStyle}
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
              >
                <option value="ALL">All Sources</option>

                {sourceOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}

                <option value={NONE_VALUE}>Not specified</option>
              </select>
            </div>

            <div style={filterGroupStyle}>
              <label style={filterLabelStyle} htmlFor="rc-f-salesperson">Salesperson</label>

              <select
                id="rc-f-salesperson"
                className="rc-select"
                style={filterControlStyle}
                value={salespersonFilter}
                onChange={(e) => setSalespersonFilter(e.target.value)}
              >
                <option value="ALL">All Salespersons</option>

                {salespersonOptions.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.name}
                  </option>
                ))}

                <option value={NONE_VALUE}>No salesperson</option>
              </select>
            </div>

            <div style={filterGroupStyle}>
              <label style={filterLabelStyle} htmlFor="rc-f-warranty">Warranty</label>

              <select
                id="rc-f-warranty"
                className="rc-select"
                style={filterControlStyle}
                value={warrantyFilter}
                onChange={(e) => setWarrantyFilter(e.target.value)}
              >
                <option value="ALL">All Warranty</option>

                {warrantyOptions.map((option) => (
                  <option key={option.key} value={option.key}>
                    {prettifyValue(option.key)}
                  </option>
                ))}
              </select>
            </div>

            <div style={filterGroupStyle}>
              <label style={filterLabelStyle} htmlFor="rc-f-device">Device</label>

              <select
                id="rc-f-device"
                className="rc-select"
                style={filterControlStyle}
                value={deviceFilter}
                onChange={(e) => setDeviceFilter(e.target.value)}
              >
                <option value="ALL">All Devices</option>

                {deviceOptions.map((option) => (
                  <option key={option.key} value={option.key}>
                    {prettifyValue(option.label)}
                  </option>
                ))}
              </select>
            </div>

            <div style={filterGroupStyle}>
              <label style={filterLabelStyle} htmlFor="rc-f-date-from">Job date from</label>

              <input
                id="rc-f-date-from"
                type="date"
                style={filterControlStyle}
                value={dateFrom}
                max={dateTo || undefined}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>

            <div style={filterGroupStyle}>
              <label style={filterLabelStyle} htmlFor="rc-f-date-to">Job date to</label>

              <input
                id="rc-f-date-to"
                type="date"
                style={filterControlStyle}
                value={dateTo}
                min={dateFrom || undefined}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          </div>
        )}

        {!loading && (
          <div style={resultCountStyle}>
            Showing {filteredCustomers.length} of {customers.length} customers
            {hasActiveFilters &&
              ` • ${Array.from(matchedMap.values()).reduce(
                (total, list) => total + list.length,
                0
              )} of ${repairs.length} jobs match`}
          </div>
        )}

        {loading ? (
          <div className="rc-state-box">
            <div className="rc-spinner"></div>
            <p>Loading database records...</p>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="rc-state-box">
            <div className="rc-empty-ico">
              <FiInbox />
            </div>

            <h3>No Customer Records Found</h3>

            <p>Adjust your search filters or register a new repair ticket.</p>

            <button
              type="button"
              className="rc-btn rc-btn-primary"
              onClick={() => setShowAddForm(true)}
            >
              <FiPlus />
              New Ticket
            </button>
          </div>
        ) : (
          <div className="rc-table-scroll">
            <table className="rc-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Contact Info</th>
                  <th>Branch</th>
                  <th>Source</th>
                  <th>Salesperson</th>
                  <th>Workloads</th>
                  <th>Latest Ticket</th>
                  <th>Assigned Tech</th>
                  <th>Status</th>
                  <th>Payment</th>
                  <th className="rc-th-right">Action</th>
                </tr>
              </thead>

              <tbody>
                {filteredCustomers.map((customer) => {
                  const latestRepair = getDisplayRepair(customer);

                  const paymentStatus = getPaymentStatus(latestRepair);

                  const ticketKey = latestRepair?._id || customer.customerPhone;
                  const isTicketExpanded = !!expandedTickets[ticketKey];
                  const jobDetails = getJobDetails(latestRepair || {});

                  return (
                    <tr key={customer.customerPhone}>
                      {/* CUSTOMER */}

                      <td data-label="Customer">
                        <div className="rc-cell-user">
                          <div className="rc-avatar">
                            {customer.customerName.charAt(0).toUpperCase()}
                          </div>

                          <div>
                            <strong>{customer.customerName}</strong>

                            <span>
                              Client ID: {customer.customerPhone.slice(-4)}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* CONTACT */}

                      <td data-label="Contact">
                        <div className="rc-contact-block">
                          <span className="rc-phone-chip">
                            <FiPhone />
                            {customer.customerPhone}
                          </span>

                          {customer.customerEmail && (
                            <span className="rc-email-sub">
                              {customer.customerEmail}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* BRANCH */}

                      <td data-label="Branch">
                        {getBranchInfo(latestRepair) ? (
                          <div className="rc-contact-block">
                            <strong>{getBranchName(latestRepair)}</strong>

                            {(getBranchInfo(latestRepair)?.code ||
                              getBranchInfo(latestRepair)?.branchCode) && (
                              <span className="rc-email-sub">
                                {getBranchInfo(latestRepair)?.code ||
                                  getBranchInfo(latestRepair)?.branchCode}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="rc-email-sub">—</span>
                        )}
                      </td>

                      {/* SOURCE */}

                      <td data-label="Source">
                        <span
                          className={`rc-source-badge ${getSourceClass(
                            latestRepair
                          )}`}
                          title={getSourceInfo(latestRepair).label}
                        >
                          {getSourceInfo(latestRepair).label}
                        </span>
                      </td>

                      {/* SALESPERSON */}

                      <td data-label="Salesperson">
                        {String(latestRepair?.salespersonName || "").trim() ? (
                          <span className="rc-tech-tag">
                            <FiUser />
                            {String(latestRepair.salespersonName).trim()}
                          </span>
                        ) : (
                          <span className="rc-email-sub">—</span>
                        )}
                      </td>

                      {/* WORKLOAD */}

                      <td data-label="Workloads">
                        <span className="rc-badge-count">
                          {customer.repairs.length}{" "}
                          {customer.repairs.length === 1 ? "Job" : "Jobs"}
                        </span>
                      </td>

                      {/* TICKET (compact + More button) */}

                      <td data-label="Latest Ticket">
                        <div className="rc-ticket-col">
                          <span className="rc-ticket-id">
                            {latestRepair?.repairNumber || "TICKET-NEW"}
                          </span>

                          <span className="rc-device-tag">
                            Device: {latestRepair?.deviceType || "N/A"}
                          </span>

                          <span className="rc-device-tag">
                            Hardware:{" "}
                            {latestRepair?.deviceModel ||
                              latestRepair?.laptopModel ||
                              "N/A"}
                          </span>

                          {isTicketExpanded && (
                            <div className="rc-ticket-more">
                              {jobDetails.problemCategory && (
                                <span className="rc-device-tag">
                                  Problem Category: {jobDetails.problemCategory}
                                </span>
                              )}

                              {jobDetails.specificProblem && (
                                <span className="rc-device-tag">
                                  Specific Problem: {jobDetails.specificProblem}
                                </span>
                              )}

                              <span className="rc-device-tag">
                                <WarrantyBadge repair={latestRepair} />
                              </span>

                              {latestRepair?.salespersonName && (
                                <span className="rc-device-tag">
                                  Salesperson: {latestRepair.salespersonName}
                                </span>
                              )}

                              {latestRepair?.technicianNotes && (
                                <span
                                  className="rc-device-tag"
                                  style={{ whiteSpace: "pre-wrap" }}
                                >
                                  Tech Notes: {latestRepair.technicianNotes}
                                </span>
                              )}

                              {latestRepair?.serviceName && (
                                <span className="rc-device-tag">
                                  Service: {latestRepair.serviceName}
                                </span>
                              )}

                              <span className="rc-device-tag">
                                Job Date:{" "}
                                {latestRepair?.jobDate
                                  ? new Date(
                                      latestRepair.jobDate
                                    ).toLocaleDateString("en-IN")
                                  : latestRepair?.createdAt
                                  ? new Date(
                                      latestRepair.createdAt
                                    ).toLocaleDateString("en-IN")
                                  : "N/A"}
                              </span>
                            </div>
                          )}

                          <button
                            type="button"
                            className="rc-btn-more"
                            onClick={() => toggleTicketDetails(ticketKey)}
                            aria-expanded={isTicketExpanded}
                          >
                            {isTicketExpanded ? (
                              <>
                                Less <FiChevronUp />
                              </>
                            ) : (
                              <>
                                More <FiChevronDown />
                              </>
                            )}
                          </button>
                        </div>
                      </td>

                      {/* TECHNICIAN */}

                      <td data-label="Technician">
                        <span className="rc-tech-tag">
                          <FiUserCheck />
                          {getTechnicianName(latestRepair)}
                        </span>
                      </td>

                      {/* STATUS + EDITABLE DROPDOWN */}

                      <td data-label="Status">
                        <div className="rc-status-cell">
                          <span
                            className={`rc-status-pill ${getStatusClass(
                              latestRepair?.status
                            )}`}
                          >
                            {getStatusLabel(latestRepair?.status)}
                          </span>

                          {renderStatusSelect(latestRepair)}
                        </div>
                      </td>

                      {/* PAYMENT */}

                      <td data-label="Payment">
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "5px",
                            minWidth: "100px",
                          }}
                        >
                          <span
                            className={`rc-payment-badge ${getPaymentStatusClass(
                              paymentStatus
                            )}`}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              padding: "5px 8px",
                              borderRadius: "999px",
                              fontSize: "11px",
                              fontWeight: 700,
                            }}
                          >
                            {getPaymentStatusLabel(paymentStatus)}
                          </span>

                          <small
                            style={{
                              fontSize: "11px",
                              color: "#64748b",
                            }}
                          >
                            Paid {formatRupees(getPaidAmount(latestRepair))}
                          </small>

                          <small
                            style={{
                              fontSize: "11px",
                              color: "#64748b",
                            }}
                          >
                            Due {formatRupees(getBalanceAmount(latestRepair))}
                          </small>
                        </div>
                      </td>

                      {/* ACTION */}

                      <td className="rc-td-right" data-label="Action">
                        <div className="rc-table-actions-group">
                          <button
                            type="button"
                            className="rc-btn-action"
                            onClick={() => setSelectedCustomer(customer)}
                            title="View customer timeline & history"
                          >
                            <FiEye />
                            <span>View</span>
                          </button>

                          <button
                            type="button"
                            className="rc-btn-action rc-btn-receipt"
                            onClick={() => openReceipt(latestRepair, customer)}
                            title="View and print invoice receipt"
                          >
                            <FiPrinter />
                            <span>Receipt</span>
                          </button>

                          <button
                            type="button"
                            className="rc-btn-action"
                            onClick={() => openPaymentModal(latestRepair)}
                            title="Update repair payment"
                          >
                            <FiCreditCard />
                            <span>Payment</span>
                          </button>

                          <button
                            type="button"
                            className="rc-btn-action"
                            onClick={() => setTransferRepairItem(latestRepair)}
                            title="Transfer / reassign to another technician"
                          >
                            <FiUserCheck />
                            <span>Transfer</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* =================================================
          NEW REPAIR INTAKE MODAL
      ================================================= */}

      {showAddForm && (
        <div
          className="rc-modal-overlay no-print"
          onMouseDown={(e) =>
            e.target === e.currentTarget && setShowAddForm(false)
          }
        >
          <div className="rc-modal-box">
            <div className="rc-modal-top">
              <div>
                <span className="rc-eyebrow">Intake Form</span>

                <h2>New Repair Intake</h2>

                <p>
                  Register client details, hardware model, and issue diagnosis.
                </p>
              </div>

              <button
                type="button"
                className="rc-btn-close"
                onClick={() => setShowAddForm(false)}
              >
                <FiX />
              </button>
            </div>

            <form onSubmit={handleCreateRepair} className="rc-form-stack">
              <div className="rc-field-group">
                <span className="rc-group-title">Client Details</span>

                <div className="rc-grid-2">
                  <div className="rc-input-field">
                    <label>
                      Customer Full Name <span>*</span>
                    </label>

                    <input
                      type="text"
                      name="customerName"
                      value={form.customerName}
                      onChange={handleChange}
                      placeholder="e.g. Aarav Sharma"
                      required
                    />
                  </div>

                  <div className="rc-input-field">
                    <label>
                      Phone Number <span>*</span>
                    </label>

                    <input
                      type="tel"
                      name="customerPhone"
                      value={form.customerPhone}
                      onChange={handleChange}
                      placeholder="e.g. 9876543210"
                      required
                    />
                  </div>
                </div>

                {/* EMAIL OPTIONAL */}

                <div className="rc-grid-2" style={{ marginTop: "1rem" }}>
                  <div className="rc-input-field">
                    <label>
                      Customer Email{" "}
                      <span style={{ fontWeight: "400", color: "#64748b" }}>
                        (Optional)
                      </span>
                    </label>

                    <input
                      type="email"
                      name="customerEmail"
                      value={form.customerEmail}
                      onChange={handleChange}
                      placeholder="e.g. aarav@example.com"
                    />
                  </div>

                  {/* CUSTOMER SOURCE */}

                  <div className="rc-input-field">
                    <label>
                      Customer Source <span>*</span>
                    </label>

                    <select
                      name="customerSource"
                      value={form.customerSource}
                      onChange={handleChange}
                      className="rc-select"
                      required
                    >
                      <option value="">-- How did they find us? --</option>

                      {CUSTOMER_SOURCES.map((source) => (
                        <option key={source.value} value={source.value}>
                          {source.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {form.customerSource === "OTHER" && (
                    <div className="rc-input-field">
                      <label>
                        Specify Source <span>*</span>
                      </label>

                      <input
                        type="text"
                        name="customerSourceOther"
                        value={form.customerSourceOther}
                        onChange={handleChange}
                        placeholder="e.g. Newspaper ad, society notice board..."
                        maxLength={80}
                        required
                      />
                    </div>
                  )}

                  <div className="rc-input-field">
                    <label>
                      Job Date <span>*</span>
                    </label>

                    <input
                      type="date"
                      name="jobDate"
                      value={form.jobDate}
                      onChange={handleChange}
                      required
                    />
                  </div>

                  {/* BRANCH SELECT */}

                  <div className="rc-input-field">
                    <label>
                      Select Branch <span>*</span>
                    </label>

                    <select
                      name="branchId"
                      value={form.branchId}
                      onChange={handleChange}
                      className="rc-select"
                      required
                      disabled={branchesLoading || activeBranches.length === 0}
                    >
                      <option value="">
                        {branchesLoading
                          ? "Loading branches..."
                          : activeBranches.length === 0
                          ? "No active branches available"
                          : "-- Select Branch --"}
                      </option>

                      {activeBranches.map((branch) => (
                        <option
                          key={getBranchId(branch)}
                          value={getBranchId(branch)}
                        >
                          {branch.name || branch.branchName || "Unnamed Branch"}
                          {branch.code || branch.branchCode
                            ? ` (${branch.code || branch.branchCode})`
                            : ""}
                        </option>
                      ))}
                    </select>

                    {!branchesLoading && activeBranches.length === 0 && (
                      <small style={{ color: "#dc2626" }}>
                        Please add or activate a branch from Branch Management
                        before creating a Job Card.
                      </small>
                    )}
                  </div>

                  <div className="rc-input-field">
                    <label>Estimated Completion Date</label>

                    <input
                      type="date"
                      name="estimatedCompletionDate"
                      value={form.estimatedCompletionDate}
                      onChange={handleChange}
                    />
                  </div>
                </div>
              </div>

              <div className="rc-field-group">
                <span className="rc-group-title">Device & Service Details</span>

                <div className="rc-grid-3">
                  <div className="rc-input-field">
                    <label>
                      Device <span>*</span>
                    </label>

                    <select
                      name="deviceType"
                      value={form.deviceType}
                      onChange={handleChange}
                      className="rc-select"
                      required
                    >
                      <option value="">-- Select Device --</option>
                      <option value="Laptop">Laptop</option>
                      <option value="Desktop">Desktop</option>
                      <option value="Printer">Printer</option>
                      <option value="Monitor">Monitor</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div className="rc-input-field">
                    <label>
                      Hardware Model <span>*</span>
                    </label>

                    <input
                      type="text"
                      name="deviceModel"
                      value={form.deviceModel}
                      onChange={handleChange}
                      placeholder="e.g. ThinkPad E14 Gen 4"
                      required
                    />
                  </div>

                  {/* LAPTOP PROBLEM CATEGORY + SPECIFIC PROBLEM */}
                  <div className="rc-input-field">
                    <label>Device Brand</label>
                    <input name="deviceBrand" value={form.deviceBrand} onChange={handleChange} placeholder="HP, Dell, ASUS, MSI..." />
                  </div>
                  <div className="rc-input-field">
                    <label>Serial Number</label>
                    <input name="serialNumber" value={form.serialNumber} onChange={handleChange} placeholder="Serial / Service Tag" />
                  </div>
                  {form.deviceType === "Laptop" && (
                    <>
                      <div className="rc-input-field">
                        <label>Problem Category <span>*</span></label>
                        <select className="rc-select" name="problemCategory" value={form.problemCategory} onChange={handleChange} required>
                          <option value="">-- Select Category --</option>
                          {Object.keys(LAPTOP_PROBLEMS).map(category => <option key={category} value={category}>{category}</option>)}
                        </select>
                      </div>
                      <div className="rc-input-field">
                        <label>Specific Problem <span>*</span></label>
                        <select className="rc-select" name="specificProblem" value={form.specificProblem} onChange={handleChange} disabled={!form.problemCategory} required>
                          <option value="">{form.problemCategory ? "-- Select Specific Problem --" : "-- Select Category First --"}</option>
                          {(LAPTOP_PROBLEMS[form.problemCategory] || []).map(problem => <option key={problem} value={problem}>{problem}</option>)}
                        </select>
                      </div>
                    </>
                  )}

                  {/* SERVICE RATE SELECT */}

                  <div className="rc-input-field">
                    <label>Select Service Rate</label>

                    <select
                      className="rc-select"
                      value={selectedServiceId}
                      disabled={servicesLoading}
                      onChange={handleServiceChange}
                    >
                      <option value="">
                        {servicesLoading
                          ? "Loading service rates..."
                          : "-- Select Service --"}
                      </option>

                      {services.map((service) => (
                        <option key={service._id} value={service._id}>
                          {service.serviceName} —{" "}
                          {formatRupees(getServiceTotal(service))}
                        </option>
                      ))}
                    </select>

                    {!servicesLoading && services.length === 0 && (
                      <small>
                        No service rates found. Please add rates from the
                        Technician or Admin service catalog.
                      </small>
                    )}

                    {selectedServiceId && (
                      <div style={{ marginTop: 8 }}>
                        {(() => {
                          const service = services.find(
                            (item) => item._id === selectedServiceId
                          );

                          if (!service) return null;

                          return (
                            <>
                              <div>
                                Part Cost: {formatRupees(service.partCost)}
                              </div>
                              <div>
                                Labour Cost: {formatRupees(service.laborCost)}
                              </div>
                              <strong>
                                Total: {formatRupees(getServiceTotal(service))}
                              </strong>
                            </>
                          );
                        })()}
                      </div>
                    )}
                  </div>

                  <div className="rc-input-field">
                    <label>Estimated Cost (₹)</label>

                    <input
                      type="number"
                      name="repairCost"
                      value={form.repairCost}
                      onChange={handleChange}
                      placeholder="0.00"
                      min="0"
                      step="0.01"
                    />
                  </div>

                  <div className="rc-input-field">
                    <label>Assign Workshop Tech</label>

                    <select
                      name="assignedTechnician"
                      value={form.assignedTechnician}
                      onChange={handleTechnicianChange}
                      className="rc-select"
                    >
                      <option value="">-- Unassigned --</option>

                      {technicians.map((tech) => (
                        <option key={tech._id} value={tech._id}>
                          {resolveTechName(tech)}

                          {tech.email ? ` (${tech.email})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="rc-grid-2" style={{ marginTop: "1rem" }}>
                  <div className="rc-input-field">
                    <label>Accessories Received</label>
                    <textarea rows="2" name="accessoriesReceived" value={form.accessoriesReceived} onChange={handleChange} placeholder="Charger, bag, mouse..." />
                  </div>
                  <div className="rc-input-field">
                    <label>Physical Condition</label>
                    <textarea rows="2" name="physicalCondition" value={form.physicalCondition} onChange={handleChange} placeholder="Scratches, cracks, dents..." />
                  </div>
                </div>

                <div className="rc-input-field" style={{ marginTop: "1rem" }}>
                  <label>
                    {form.deviceType === "Laptop" ? "Customer Description / Other Problem" : "Reported Issue Description"}
                    {(form.deviceType !== "Laptop" || form.specificProblem === "Other / Problem Not Listed") && <span> *</span>}
                  </label>

                  <textarea
                    name="issueDescription"
                    rows="3"
                    value={form.issueDescription}
                    onChange={handleChange}
                    placeholder="Describe failure symptoms, errors, liquid contact, etc."
                    required={form.deviceType !== "Laptop" || form.specificProblem === "Other / Problem Not Listed"}
                  />
                </div>

                <div className="rc-input-field" style={{ marginTop: "1rem" }}>
                  <label>Front-Desk / Physical Remarks</label>

                  <textarea
                    name="remarks"
                    rows="2"
                    value={form.remarks}
                    onChange={handleChange}
                    placeholder="Physical scratches, original power adapter included, password received..."
                  />
                </div>
              </div>

              <div className="rc-field-group">
                <span className="rc-group-title">
                  Warranty & Sales Details
                </span>

                <JobExtraFields
                  form={form}
                  onChange={handleChange}
                  salespersons={salespersons}
                />
              </div>

              <div className="rc-modal-footer">
                <button
                  type="button"
                  className="rc-btn rc-btn-secondary"
                  onClick={() => setShowAddForm(false)}
                  disabled={submitting}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="rc-btn rc-btn-primary"
                  disabled={
                    submitting || branchesLoading || activeBranches.length === 0
                  }
                >
                  {submitting ? "Registering Job..." : "Register Repair Ticket"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =================================================
          CUSTOMER TIMELINE MODAL
      ================================================= */}

      {selectedCustomer && (
        <div
          className="rc-modal-overlay no-print"
          onMouseDown={(e) =>
            e.target === e.currentTarget && setSelectedCustomer(null)
          }
        >
          <div className="rc-modal-box rc-modal-large">
            <div className="rc-modal-top">
              <div>
                <span className="rc-eyebrow">Customer History</span>

                <h2>{selectedCustomer.customerName}</h2>

                <p>
                  <FiPhone style={{ verticalAlign: "middle" }} />{" "}
                  {selectedCustomer.customerPhone}
                  {selectedCustomer.customerEmail &&
                    ` • ${selectedCustomer.customerEmail}`}
                </p>
              </div>

              <button
                type="button"
                className="rc-btn-close"
                onClick={() => setSelectedCustomer(null)}
              >
                <FiX />
              </button>
            </div>

            <div className="rc-history-content">
              <div className="rc-profile-badge">
                <div className="rc-avatar rc-avatar-lg">
                  {selectedCustomer.customerName.charAt(0).toUpperCase()}
                </div>

                <div>
                  <h3>{selectedCustomer.customerName}</h3>

                  <span>
                    Total Repair History: {selectedCustomer.repairs.length}{" "}
                    Job(s)
                  </span>
                </div>
              </div>

              <h4 className="rc-timeline-heading">
                <FiClock />
                Workshop History Timeline
              </h4>

              <div className="rc-timeline-list">
                {selectedCustomer.repairs.map((repair, index) => {
                  const paymentStatus = getPaymentStatus(repair);

                  return (
                    <div
                      className="rc-timeline-card"
                      key={repair._id || `repair-${index}`}
                    >
                      <div className="rc-card-head">
                        <strong className="rc-badge-ref">
                          {repair.repairNumber || "Ticket"}
                        </strong>

                        <div
                          style={{
                            display: "flex",
                            gap: "8px",
                            alignItems: "flex-start",
                            flexWrap: "wrap",
                          }}
                        >
                          <div style={{ minWidth: "170px" }}>
                            <span
                              className={`rc-status-pill ${getStatusClass(
                                repair.status
                              )}`}
                            >
                              {getStatusLabel(repair.status)}
                            </span>

                            {/* Har purane ticket ka status yahin se update */}
                            {renderStatusSelect(repair)}
                          </div>

                          <span
                            className={`rc-payment-badge ${getPaymentStatusClass(
                              paymentStatus
                            )}`}
                            style={{
                              padding: "5px 9px",
                              borderRadius: "999px",
                              fontSize: "11px",
                              fontWeight: 700,
                            }}
                          >
                            {getPaymentStatusLabel(paymentStatus)}
                          </span>
                        </div>
                      </div>

                      <div className="rc-grid-3 rc-meta-row">
                        <div>
                          <span className="rc-meta-lbl">
                            <FiMonitor />
                            Hardware
                          </span>

                          <strong className="rc-meta-txt">
                            {repair.deviceType ? `${repair.deviceType} - ` : ""}
                            {repair.deviceModel || repair.laptopModel || "N/A"}
                          </strong>
                        </div>

                        <div>
                          <span className="rc-meta-lbl">
                            <FiUserCheck />
                            Technician
                          </span>

                          <strong className="rc-meta-txt">
                            {getTechnicianName(repair)}
                          </strong>
                        </div>

                        <div>
                          <span className="rc-meta-lbl">
                            <FaRupeeSign />
                            Repair Cost
                          </span>

                          <strong className="rc-meta-txt">
                            {formatRupees(getRepairCost(repair))}
                          </strong>
                        </div>

                        <div>
                          <span className="rc-meta-lbl">
                            <FiInbox />
                            Branch
                          </span>

                          <strong className="rc-meta-txt">
                            {getBranchLabel(repair)}
                          </strong>
                        </div>
                      </div>

                      {/* CUSTOMER SOURCE */}

                      <div className="rc-date-row">
                        <FiShare2 />
                        Source:{" "}
                        <span
                          className={`rc-source-badge ${getSourceClass(repair)}`}
                        >
                          {getSourceInfo(repair).label}
                        </span>
                      </div>

                      {repair.serviceName && (
                        <div className="rc-date-row">
                          <FiTool />
                          Service: {repair.serviceName}
                          {" • Part "}
                          {formatRupees(repair.partCost)}
                          {" • Labour "}
                          {formatRupees(repair.laborCost)}
                        </div>
                      )}

                      {/* PAYMENT SUMMARY */}

                      <div
                        className="rc-payment-summary"
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                          gap: "10px",
                          marginTop: "12px",
                          padding: "12px",
                          borderRadius: "10px",
                          background: "#f8fafc",
                          border: "1px solid #e2e8f0",
                        }}
                      >
                        <div>
                          <small
                            style={{
                              display: "block",
                              color: "#64748b",
                            }}
                          >
                            Total
                          </small>

                          <strong>{formatRupees(getRepairCost(repair))}</strong>
                        </div>

                        <div>
                          <small
                            style={{
                              display: "block",
                              color: "#64748b",
                            }}
                          >
                            Paid
                          </small>

                          <strong>{formatRupees(getPaidAmount(repair))}</strong>
                        </div>

                        <div>
                          <small
                            style={{
                              display: "block",
                              color: "#64748b",
                            }}
                          >
                            Balance
                          </small>

                          <strong>
                            {formatRupees(getBalanceAmount(repair))}
                          </strong>
                        </div>
                      </div>

                      {repair.paymentMethod && (
                        <div
                          style={{
                            marginTop: "8px",
                            fontSize: "12px",
                            color: "#475569",
                          }}
                        >
                          Payment Method: <strong>{repair.paymentMethod}</strong>
                          {repair.paymentId ? ` • ${repair.paymentId}` : ""}
                        </div>
                      )}

                      {repair.estimatedCompletionDate && (
                        <div className="rc-date-row">
                          <FiCalendar />
                          Estimated Completion:{" "}
                          {new Date(
                            repair.estimatedCompletionDate
                          ).toLocaleDateString()}
                        </div>
                      )}

                      <ProblemDetails repair={repair} />

                      <JobExtraSummary
                        repair={repair}
                        showNotes
                        showTransfers
                      />

                      <div className="rc-note-card">
                        <FiMessageSquare className="rc-note-ico" />

                        <div>
                          <strong>Problem Reported:</strong>

                          <p>
                            {repair.issueDescription ||
                              "No issue details registered."}
                          </p>
                        </div>
                      </div>

                      {repair.remarks && (
                        <div className="rc-note-card rc-note-muted">
                          <div>
                            <strong>Intake Remarks:</strong>

                            <p>{repair.remarks}</p>
                          </div>
                        </div>
                      )}

                      <div
                        style={{
                          marginTop: "10px",
                          display: "flex",
                          gap: "8px",
                          flexWrap: "wrap",
                        }}
                      >
                        <button
                          type="button"
                          className="rc-btn-action rc-btn-receipt"
                          onClick={() => openReceipt(repair, selectedCustomer)}
                          title="View and print invoice receipt"
                        >
                          <FiPrinter />
                          <span>Receipt</span>
                        </button>

                        <button
                          type="button"
                          className="rc-btn-action"
                          onClick={() => openPaymentModal(repair)}
                          title="Update repair payment"
                        >
                          <FiCreditCard />
                          <span>Payment</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TRANSFER JOB MODAL */}

      {transferRepairItem && (
        <TransferJobModal
          repair={transferRepairItem}
          onClose={() => setTransferRepairItem(null)}
          onDone={handleTransferred}
        />
      )}

      {/* =================================================
          PAYMENT MODAL
      ================================================= */}

      {selectedPaymentRepair && (
        <div
          className="rc-modal-overlay no-print"
          style={{ zIndex: 1400 }}
          onMouseDown={(e) =>
            e.target === e.currentTarget && setSelectedPaymentRepair(null)
          }
        >
          <div className="rc-modal-box" style={{ maxWidth: "520px" }}>
            <div className="rc-modal-top">
              <div>
                <span className="rc-eyebrow">Repair Billing</span>

                <h2>Update Payment</h2>

                <p>{selectedPaymentRepair.repairNumber || "Repair Ticket"}</p>
              </div>

              <button
                type="button"
                className="rc-btn-close"
                onClick={() => setSelectedPaymentRepair(null)}
              >
                <FiX />
              </button>
            </div>

            <form onSubmit={handleSavePayment} className="rc-form-stack">
              {/* BILL SUMMARY */}

              <div
                className="rc-bill-summary"
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: "10px",
                }}
              >
                <div
                  style={{
                    padding: "12px",
                    border: "1px solid #e2e8f0",
                    borderRadius: "10px",
                  }}
                >
                  <small>Total</small>

                  <strong style={{ display: "block", marginTop: "4px" }}>
                    {formatRupees(getRepairCost(selectedPaymentRepair))}
                  </strong>
                </div>

                <div
                  style={{
                    padding: "12px",
                    border: "1px solid #e2e8f0",
                    borderRadius: "10px",
                  }}
                >
                  <small>Already Paid</small>

                  <strong style={{ display: "block", marginTop: "4px" }}>
                    {formatRupees(getPaidAmount(selectedPaymentRepair))}
                  </strong>
                </div>

                <div
                  style={{
                    padding: "12px",
                    border: "1px solid #e2e8f0",
                    borderRadius: "10px",
                  }}
                >
                  <small>Balance</small>

                  <strong style={{ display: "block", marginTop: "4px" }}>
                    {formatRupees(getBalanceAmount(selectedPaymentRepair))}
                  </strong>
                </div>
              </div>

              {/* PAID AMOUNT */}

              <div className="rc-input-field">
                <label>
                  Paid Amount (₹) <span>*</span>
                </label>

                <input
                  type="number"
                  name="paidAmount"
                  value={paymentForm.paidAmount}
                  onChange={handlePaymentChange}
                  min="0"
                  max={getRepairCost(selectedPaymentRepair)}
                  step="0.01"
                  placeholder="Enter paid amount"
                  required
                />
              </div>

              {/* PAYMENT METHOD */}

              <div className="rc-input-field">
                <label>Payment Method</label>

                <select
                  name="paymentMethod"
                  value={paymentForm.paymentMethod}
                  onChange={handlePaymentChange}
                  className="rc-select"
                >
                  <option value="CASH">Cash</option>

                  <option value="UPI">UPI</option>

                  <option value="CARD">Card</option>

                  <option value="BANK_TRANSFER">Bank Transfer</option>

                  <option value="RAZORPAY">Razorpay</option>

                  <option value="OTHER">Other</option>
                </select>
              </div>

              {/* PAYMENT ID */}

              <div className="rc-input-field">
                <label>Payment / Transaction ID</label>

                <input
                  type="text"
                  name="paymentId"
                  value={paymentForm.paymentId}
                  onChange={handlePaymentChange}
                  placeholder="UPI / transaction / reference ID"
                />
              </div>

              <div className="rc-modal-footer">
                <button
                  type="button"
                  className="rc-btn rc-btn-secondary"
                  onClick={() => setSelectedPaymentRepair(null)}
                  disabled={paymentSubmitting}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="rc-btn rc-btn-primary"
                  disabled={paymentSubmitting}
                >
                  <FiSave />

                  {paymentSubmitting ? "Saving..." : "Save Payment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =================================================
          SERVICE DELIVERY INVOICE
      ================================================= */}

      {selectedInvoice && (
        <div
          className="rc-modal-overlay"
          style={{ zIndex: 1250 }}
          onMouseDown={(e) =>
            e.target === e.currentTarget && setSelectedInvoice(null)
          }
        >
          <div className="rc-modal-box rc-receipt-modal-box">
            <div className="rc-modal-top no-print">
              <div>
                <span className="rc-eyebrow">Billing & Deliveries</span>

                <h2>Service Delivery Voucher</h2>

                <p>Official workshop repair diagnosis and bill summary</p>
              </div>

              <button
                type="button"
                className="rc-btn-close"
                onClick={() => setSelectedInvoice(null)}
              >
                <FiX />
              </button>
            </div>

            <div className="trh-invoice-sheet" id="printable-receipt">
              {/* INVOICE HEADER */}

              <div className="invoice-header">
                <div>
                  <h1 className="brand-title">ZAID INFOTECH</h1>

                  <p className="brand-tagline">
                    Premium Hardware Repairs, Micro-Soldering & IT Solutions
                  </p>
                </div>

                <div className="invoice-badge-block">
                  <h3>SERVICE RECEIPT</h3>

                  <div>
                    Ticket:{" "}
                    <strong>
                      {selectedInvoice.repairNumber ||
                        selectedInvoice._id?.slice(-6).toUpperCase()}
                    </strong>
                  </div>

                  <div>
                    Date:{" "}
                    {new Date(
                      selectedInvoice.updatedAt ||
                        selectedInvoice.createdAt ||
                        Date.now()
                    ).toLocaleDateString()}
                  </div>
                </div>
              </div>

              {/* BRANCH DETAILS */}

              <div
                className="invoice-branch-details"
                style={{
                  marginTop: "14px",
                  marginBottom: "14px",
                  padding: "12px",
                  border: "1px solid #cbd5e1",
                  borderRadius: "8px",
                }}
              >
                <strong>JOB CARD BRANCH DETAILS</strong>

                <div style={{ marginTop: "8px" }}>
                  <strong>{getBranchName(selectedInvoice)}</strong>
                </div>

                {(invoiceBranch?.code || invoiceBranch?.branchCode) && (
                  <div>
                    Branch Code: {invoiceBranch.code || invoiceBranch.branchCode}
                  </div>
                )}

                {invoiceBranch?.phone && (
                  <div>Phone: {invoiceBranch.phone}</div>
                )}

                {invoiceBranch?.email && (
                  <div>Email: {invoiceBranch.email}</div>
                )}

                {invoiceBranchAddress && (
                  <div>Address: {invoiceBranchAddress}</div>
                )}

                {(invoiceBranch?.city ||
                  invoiceBranch?.state ||
                  invoiceBranch?.pincode) && (
                  <div>
                    {[
                      invoiceBranch?.city,
                      invoiceBranch?.state,
                      invoiceBranch?.pincode,
                    ]
                      .filter(Boolean)
                      .join(", ")}
                  </div>
                )}

                {invoiceBranch?.gstin && (
                  <div>GSTIN: {invoiceBranch.gstin}</div>
                )}
              </div>

              {/* PARTIES */}

              <div className="invoice-parties-grid">
                <div className="party-card">
                  <span className="party-title">CUSTOMER DETAILS</span>

                  <strong className="party-name">
                    {selectedInvoice.customerName}
                  </strong>

                  <div className="party-sub">
                    Phone: {selectedInvoice.customerPhone}
                  </div>

                  {selectedInvoice.customerEmail && (
                    <div className="party-sub">
                      Email: {selectedInvoice.customerEmail}
                    </div>
                  )}
                </div>

                <div className="party-card">
                  <span className="party-title">HARDWARE REPAIRED</span>

                  <strong className="party-name">
                    {selectedInvoice.deviceModel ||
                      selectedInvoice.laptopModel ||
                      "Standard Device"}
                  </strong>

                  {selectedInvoice.deviceType && (
                    <div className="party-sub">
                      Device: {selectedInvoice.deviceType}
                    </div>
                  )}

                  <div className="party-sub">
                    Technician:{" "}
                    {selectedInvoice.technicianName || "Assigned Specialist"}
                  </div>

                  <div className="party-sub">
                    Status:{" "}
                    <span className="status-highlight">
                      {selectedInvoice.status || "Delivered"}
                    </span>
                  </div>

                  <div className="party-sub">
                    Payment:{" "}
                    <strong>
                      {getPaymentStatusLabel(getPaymentStatus(selectedInvoice))}
                    </strong>
                  </div>
                </div>
              </div>

              {/* CUSTOMER'S SELECTED PROBLEM DETAILS - INCLUDED WHEN PRINTING */}
              <ProblemDetails repair={selectedInvoice} />

              <JobExtraSummary repair={selectedInvoice} />
              {/* SERVICE TABLE */}

              <div className="invoice-table-wrapper">
                <table className="invoice-data-table">
                  <thead>
                    <tr>
                      <th>Service / Problem Breakdown</th>

                      <th className="cell-right">Part (₹)</th>

                      <th className="cell-right">Labor (₹)</th>

                      <th className="cell-right">Total (₹)</th>
                    </tr>
                  </thead>

                  <tbody>
                    {Array.isArray(selectedInvoice.services) &&
                    selectedInvoice.services.length > 0 ? (
                      selectedInvoice.services.map((srv, idx) => {
                        const part = Number(srv.partCost || 0);

                        const labor = Number(srv.laborCost || 0);

                        const itemTotal = Number(srv.totalCost ?? part + labor);

                        return (
                          <tr key={idx}>
                            <td>
                              <strong>{srv.serviceName || srv.name}</strong>

                              {srv.category && (
                                <span className="service-category-tag">
                                  {srv.category}
                                </span>
                              )}

                              {idx === 0 && selectedInvoice.issueDescription && (
                                <p className="invoice-service-note">
                                  Intake Issue: {selectedInvoice.issueDescription}
                                </p>
                              )}
                            </td>

                            <td className="cell-right">{formatRupees(part)}</td>

                            <td className="cell-right">
                              {formatRupees(labor)}
                            </td>

                            <td className="cell-right">
                              {formatRupees(itemTotal)}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td>
                          <strong>
                            {selectedInvoice.serviceName ||
                              "Repair Diagnostics & Technician Service"}
                          </strong>

                          <p className="invoice-service-note">
                            {selectedInvoice.issueDescription ||
                              "General Hardware Issue"}
                          </p>
                        </td>

                        <td className="cell-right">
                          {formatRupees(Number(selectedInvoice.partCost || 0))}
                        </td>

                        <td className="cell-right">
                          {formatRupees(
                            Number(
                              selectedInvoice.laborCost ??
                                Number(selectedInvoice.repairCost || 0) -
                                  Number(selectedInvoice.partCost || 0)
                            )
                          )}
                        </td>

                        <td className="cell-right">
                          {formatRupees(
                            Number(selectedInvoice.repairCost || 0)
                          )}
                        </td>
                      </tr>
                    )}

                    {selectedInvoice.remarks && (
                      <tr className="remarks-row">
                        <td colSpan={3}>
                          <em>Intake Remarks: {selectedInvoice.remarks}</em>
                        </td>

                        <td className="cell-right">—</td>
                      </tr>
                    )}
                  </tbody>

                  {/* PAYMENT TOTALS */}

                  <tfoot>
                    <tr>
                      <th
                        colSpan={3}
                        className="cell-right grand-total-label"
                      >
                        Total Amount:
                      </th>

                      <th className="cell-right grand-total-val">
                        {formatRupees(getRepairCost(selectedInvoice))}
                      </th>
                    </tr>

                    <tr>
                      <th colSpan={3} className="cell-right">
                        Paid Amount:
                      </th>

                      <th className="cell-right">
                        {formatRupees(getPaidAmount(selectedInvoice))}
                      </th>
                    </tr>

                    <tr>
                      <th colSpan={3} className="cell-right">
                        Balance Due:
                      </th>

                      <th className="cell-right">
                        {formatRupees(getBalanceAmount(selectedInvoice))}
                      </th>
                    </tr>

                    <tr>
                      <th colSpan={3} className="cell-right">
                        Payment Status:
                      </th>

                      <th className="cell-right">
                        {getPaymentStatusLabel(getPaymentStatus(selectedInvoice))}
                      </th>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* PAYMENT INFORMATION */}

              <div
                style={{
                  marginTop: "18px",
                  padding: "14px",
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                }}
              >
                <strong>PAYMENT INFORMATION</strong>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: "12px",
                    marginTop: "10px",
                  }}
                >
                  <div>
                    <small>Method</small>

                    <div>{selectedInvoice.paymentMethod || "Not Recorded"}</div>
                  </div>

                  <div>
                    <small>Transaction ID</small>

                    <div>{selectedInvoice.paymentId || "N/A"}</div>
                  </div>

                  <div>
                    <small>Paid At</small>

                    <div>
                      {selectedInvoice.paidAt
                        ? new Date(selectedInvoice.paidAt).toLocaleString()
                        : "N/A"}
                    </div>
                  </div>
                </div>
              </div>

              {/* FOOTER */}

              <div className="invoice-footer-clause">
                <p>Thank you for choosing Zaid Infotech.</p>

                <p>
                  30 Days service warranty applies on replaced components and
                  verified service repairs.
                </p>
              </div>
            </div>

            <div className="rc-modal-footer no-print">
              <button
                type="button"
                className="rc-btn rc-btn-secondary"
                onClick={() => setSelectedInvoice(null)}
              >
                Close
              </button>

              <button
                type="button"
                className="rc-btn rc-btn-primary"
                onClick={handlePrint}
              >
                <FiPrinter />
                Print Voucher
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RepairCustomer;
