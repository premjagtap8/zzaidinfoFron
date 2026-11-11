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
  FiDollarSign,
  FiCalendar,
  FiPrinter,
  FiCreditCard,
  FiShare2,
} from "react-icons/fi";
import { toast } from "react-toastify";
import "./CustomerTicket.css";
import JobExtraFields, {
    WarrantyBadge,
    JobExtraSummary
} from "../../components/repair/JobExtraFields";

import TransferJobModal from "../../components/repair/TransferJobModal";

import { getSalespersonNames } from "../../services/repairJobService";
import { getEmployees } from "../../services/userService";
// =====================================================
// API
// =====================================================

const API_URL = import.meta.env.VITE_API_URL;

const BASE_URL = `${API_URL}/newRepair`;

const TECHNICIAN_URL =
  `${API_URL}/newRepair/technicians`;

const BRANCH_URL = `${API_URL}/branches`;


const getTodayLocalDate = () => {
  const today = new Date();
  const offset = today.getTimezoneOffset();

  return new Date(
    today.getTime() - offset * 60 * 1000
  )
    .toISOString()
    .slice(0, 10);
};


// =====================================================
// CUSTOMER SOURCE OPTIONS
// "How did you come to know about ZAID Infotech?"
// value = saved in database (must match backend customerSource.js keys)
// label = shown in the dropdown
// =====================================================

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

// Turns a saved source key into a readable label.
const getCustomerSourceLabel = (repair = {}) => {
  const key = repair?.customerSource;

  if (!key) {
    return "";
  }

  const option = CUSTOMER_SOURCE_OPTIONS.find(
    (o) => o.value === key
  );

  const label = option ? option.label : key;

  if (key === "OTHER" && repair?.customerSourceOther) {
    return `${label} - ${repair.customerSourceOther}`;
  }

  return label;
};


const LAPTOP_PROBLEMS = {
  "Power & Startup Issues": [
    "Laptop Not Powering On",
    "Laptop Not Charging",
    "Laptop Not Turning On With Charger",
    "Power Button Not Working",
    "No Power Indicator Light",
    "Laptop Turns On but No Display",
    "Laptop Shuts Down Automatically",
    "Laptop Restarts Repeatedly",
    "Laptop Stuck on Manufacturer Logo",
    "Laptop Stuck in Boot Loop"
  ],
  "Display & Screen Issues": [
    "Laptop Screen Broken / Cracked",
    "Display Flickering",
    "No Display / Black Screen",
    "White Screen / Blank Screen",
    "Lines on Screen",
    "Dim Display / Backlight Issue",
    "External Monitor Not Working",
    "Display Cable Issue",
    "Screen Bezel Damaged",
    "Display Hinge Damage"
  ],
  "Keyboard & Touchpad Issues": [
    "Keyboard Not Working",
    "Some Keyboard Keys Not Working",
    "Keyboard Replacement",
    "Touchpad Not Working",
    "Touchpad Buttons Not Working",
    "Laptop Mouse Not Detected",
    "Power Button / Keyboard Panel Issue"
  ],
  "Battery & Charging Issues": [
    "Battery Draining Quickly",
    "Battery Not Detected",
    "Battery Not Charging",
    "Battery Replacement",
    "Battery Swelling",
    "Charger / Adapter Not Working",
    "Charging Port / DC Jack Damaged",
    "Intermittent Charging Issue"
  ],
  "Motherboard & Hardware Issues": [
    "Motherboard Repair",
    "Motherboard Short Circuit",
    "RAM Not Detected",
    "RAM Upgrade / Replacement",
    "SSD / HDD Not Detected",
    "SSD / HDD Upgrade",
    "M.2 SSD Not Detected",
    "USB Port Not Working",
    "HDMI / DisplayPort Not Working",
    "Audio Jack Not Working",
    "Wi-Fi / Bluetooth Hardware Issue",
    "Fan Not Working",
    "Speaker Not Working",
    "Webcam Not Working",
    "Fingerprint Reader Not Working",
    "External Device Not Detected"
  ],
  "Heating & Performance Issues": [
    "Laptop Overheating",
    "Fan Noise / Loud Fan",
    "Laptop Running Slowly",
    "Laptop Hanging / Freezing",
    "Automatic Shutdown Due to Overheating",
    "Thermal Paste Replacement",
    "Internal Cleaning / Dust Removal"
  ],
  "Windows & Operating System Issues": [
    "Windows Installation",
    "Windows Activation Issue",
    "Windows Boot Error",
    "Blue Screen Error (BSOD)",
    "Windows Update Issue",
    "Driver Installation / Update",
    "BIOS Update / Configuration",
    "BIOS Password Issue",
    "Forgotten Windows Password",
    "Laptop Stuck on Automatic Repair",
    "Operating System Corrupted",
    "Sleep / Wake Issue"
  ],
  "Software & Data Services": [
    "Software Installation",
    "Microsoft Office Installation",
    "Virus / Malware Removal",
    "Data Backup / Transfer",
    "Data Recovery"
  ],
  "Network & Connectivity Issues": [
    "Wi-Fi Not Detected",
    "Wi-Fi Not Connecting",
    "Bluetooth Not Working",
    "LAN / Ethernet Not Working",
    "Internet Connectivity Issue",
    "Microphone Not Working",
    "No Sound / Audio Issue",
    "Camera Not Detected"
  ],
  "Physical Damage & Body Issues": [
    "Liquid / Water Damage",
    "Accidental / Physical Damage",
    "Laptop Body / Casing Broken",
    "Hinge Broken / Tight Hinge",
    "Screw Thread / Mounting Damage"
  ],
  "General Service & Maintenance": [
    "Full Laptop Servicing",
    "General Diagnosis / Inspection",
    "Preventive Maintenance",
    "Laptop Cleaning"
  ],
  "Other": [
    "Other / Problem Not Listed"
  ]
};

// Extract values from existing saved issueDescription (legacy backend compatible).
const getRepairProblemDetails = (repair = {}) => {
  const issue = String(repair?.issueDescription || "");
  const read = (key) => {
    const line = issue.split(/\r?\n/).find((part) => part.startsWith(`${key}: `));
    return line ? line.slice(key.length + 2).trim() : "";
  };
  return {
    category: repair.problemCategory || read("Problem Category"),
    problem: repair.specificProblem || read("Specific Problem"),
    description: repair.customerDescription || read("Customer Description") ||
      (!issue.includes("Specific Problem:") ? issue : ""),
    brand: repair.deviceBrand || read("Device Brand"),
    serial: repair.serialNumber || read("Serial Number"),
    accessories: repair.accessoriesReceived || read("Accessories Received"),
    condition: repair.physicalCondition || read("Physical Condition"),
  };
};

// =====================================================
// INITIAL FORM
// =====================================================

const initialForm = {
  customerName: "",
  customerPhone: "",
  customerEmail: "",

  jobDate: getTodayLocalDate(),
  branchId: "",

  // How did the customer come to know about ZAID Infotech? (OPTIONAL)
  customerSource: "",
  customerSourceOther: "",

  deviceType: "",
  deviceModel: "",
  deviceBrand: "",
  serialNumber: "",
  problemCategory: "",
  specificProblem: "",
  customerDescription: "",
  accessoriesReceived: "",
  physicalCondition: "",
  jobStatus: "Received",

  issueDescription: "",
  estimatedCompletionDate: "",
  repairCost: "",
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
// COMPONENT
// =====================================================

const CusromerTicket = () => {

  // ===================================================
  // STATE
  // ===================================================

  const [repairs, setRepairs] = useState([]);

  const [technicians, setTechnicians] = useState([]);
  const [branches, setBranches] = useState([]);
  const [branchesLoading, setBranchesLoading] = useState(false);
  const [transferRepairItem, setTransferRepairItem] = useState(null);
  const [salespersons, setSalespersons] = useState([]);
  const [salesEmployees, setSalesEmployees] = useState([]);
  const [salesLoading, setSalesLoading] = useState(false);
  const [loading, setLoading] = useState(true);

  const [submitting, setSubmitting] =
    useState(false);

  const [paymentSubmitting, setPaymentSubmitting] =
    useState(false);

  const [search, setSearch] =
    useState("");

  const [statusFilter, setStatusFilter] =
    useState("ALL");

  const [showAddForm, setShowAddForm] =
    useState(false);

  const [selectedCustomer, setSelectedCustomer] =
    useState(null);

  const [selectedInvoice, setSelectedInvoice] =
    useState(null);

  const [form, setForm] =
    useState(initialForm);

  const [paymentForm, setPaymentForm] =
    useState({
      paidAmount: "",
      paymentMethod: "CASH",
      paymentId: "",
    });


  // ===================================================
  // AUTH CONFIG
  // ===================================================

  const getAuthConfig = () => {

    const token =
      localStorage.getItem("token") ||
      localStorage.getItem("accessToken");

    return {
      headers: {
        Authorization:
          `Bearer ${token}`,
      },
    };
  };


  // =====================================================
  // BRANCH HELPERS - FIXED
  // =====================================================

  const getBranchId = (branchValue) => {
    if (!branchValue) return "";

    if (typeof branchValue === "string") {
      return branchValue;
    }

    if (typeof branchValue === "object") {
      if (branchValue._id) return String(branchValue._id);
      if (branchValue.id) return String(branchValue.id);

      // Handles MongoDB ObjectId values
      if (branchValue.toString && branchValue.toString() !== "[object Object]") {
        return String(branchValue);
      }
    }

    return "";
  };

  const getBranchName = (branch) => {
    if (!branch) return "Branch details unavailable";

    if (typeof branch === "string") {
      const matchedBranch = branches.find(
        (item) => getBranchId(item) === branch
      );

      return (
        matchedBranch?.name ||
        matchedBranch?.branchName ||
        matchedBranch?.title ||
        `Branch ID: ${branch.slice(-6)}`
      );
    }

    return (
      branch.name ||
      branch.branchName ||
      branch.title ||
      "Branch details unavailable"
    );
  };

  const getBranchInfo = (repair = {}) => {
    const branchValue =
      repair?.branchId ||
      repair?.branch ||
      repair?.branchDetails ||
      null;

    if (!branchValue) return null;

    // Already populated branch object
    if (
      typeof branchValue === "object" &&
      (
        branchValue.name ||
        branchValue.branchName ||
        branchValue.title ||
        branchValue.code ||
        branchValue.branchCode
      )
    ) {
      return branchValue;
    }

    // Otherwise find branch using its ID
    const branchId = getBranchId(branchValue);

    if (!branchId) return null;

    return (
      branches.find(
        (branch) => getBranchId(branch) === branchId
      ) || null
    );
  };

  const getBranchLabel = (repair = {}) => {
    const branch = getBranchInfo(repair);

    if (branch) {
      const name = getBranchName(branch);
      const code = branch.code || branch.branchCode || "";

      return code ? `${name} (${code})` : name;
    }

    const branchValue =
      repair?.branchId ||
      repair?.branch ||
      null;

    const branchId = getBranchId(branchValue);

    return branchId
      ? `Branch ID: ${branchId.slice(-6)}`
      : "Branch details unavailable";
  };


  // ===================================================
  // TECHNICIAN NAME
  // ===================================================

  const resolveTechName = (techOrId) => {

    if (!techOrId) {
      return "Unassigned";
    }

    if (
      typeof techOrId === "string" &&
      !techOrId.match(
        /^[0-9a-fA-F]{24}$/
      )
    ) {
      return techOrId;
    }

    const techObj =
      typeof techOrId === "object"
        ? techOrId
        : technicians.find(
            (t) =>
              t._id === techOrId
          );

    if (!techObj) {
      return "Unassigned";
    }

    const full =
      `${techObj.firstName || ""} ${techObj.lastName || ""}`
        .trim();

    return (
      full ||
      techObj.name ||
      techObj.fullName ||
      techObj.username ||
      "Technician"
    );
  };


  const getTechnicianName = (repair) =>
    resolveTechName(
      repair?.assignedTechnician ||
      repair?.technicianName
    );


  // ===================================================
  // FETCH REPAIRS
  // ===================================================

  const fetchRepairs = async () => {

    try {

      setLoading(true);

      const res =
        await axios.get(
          `${BASE_URL}/`,
          getAuthConfig()
        );

      const data =
        res.data?.repairs ||
        res.data?.data ||
        (
          Array.isArray(res.data)
            ? res.data
            : []
        );

      setRepairs(data);

    } catch (err) {

      toast.error(
        err.response?.data?.message ||
        "Failed to load repairs"
      );

    } finally {

      setLoading(false);

    }
  };


  // ===================================================
  // FETCH TECHNICIANS
  // ===================================================

  const fetchTechnicians = async () => {

    try {

      const res =
        await axios.get(
          TECHNICIAN_URL,
          getAuthConfig()
        );

      const data =
        res.data?.technicians ||
        res.data?.data ||
        (
          Array.isArray(res.data)
            ? res.data
            : []
        );

      setTechnicians(data);

    } catch (err) {

      toast.error(
        err.response?.data?.message ||
        "Failed to load technicians"
      );

    }
  };


  // =====================================================
  // FETCH ALL BRANCHES
  // Keep all branches for old ticket history and receipts
  // =====================================================

  const fetchBranches = async () => {
    try {
      setBranchesLoading(true);

      const res = await axios.get(
        BRANCH_URL,
        getAuthConfig()
      );

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

      console.log("BRANCH API RESPONSE:", responseData);
      console.log("BRANCHES LOADED:", data);

    } catch (err) {
      console.error(
        "FETCH BRANCHES ERROR:",
        err.response?.data || err
      );

      setBranches([]);

      toast.error(
        err.response?.data?.message ||
        "Failed to load branches. Check /branches API."
      );

    } finally {
      setBranchesLoading(false);
    }
  };


  // ===================================================
  // FETCH EMPLOYEES -> KEEP ONLY SALES ROLE
  // ===================================================

  const getEmployeeRoles = (emp = {}) => {
    const raw = [
      emp.role,
      emp.roleName,
      emp.designation,
      emp.position,
      ...(Array.isArray(emp.roles) ? emp.roles : []),
    ];

    return raw
      .filter(Boolean)
      .map((r) =>
        typeof r === "string"
          ? r
          : r?.name || r?.roleName || r?.title || ""
      )
      .map((r) => String(r).toLowerCase());
  };

  const getEmployeeName = (emp = {}) => {
    const full = `${emp.firstName || ""} ${emp.lastName || ""}`.trim();

    return (
      full ||
      emp.name ||
      emp.fullName ||
      emp.username ||
      ""
    );
  };

  const fetchSalesEmployees = async () => {
    try {
      setSalesLoading(true);

      const res = await getEmployees();
      const body = res?.data;

      const list = Array.isArray(body)
        ? body
        : body?.employees ||
          body?.users ||
          body?.data ||
          [];

      const salesOnly = (Array.isArray(list) ? list : [])
        .filter((emp) =>
          getEmployeeRoles(emp).some((r) => r.includes("sales"))
        )
        .map((emp) => ({
          id: emp._id || emp.id,
          name: getEmployeeName(emp),
        }))
        .filter((emp) => emp.name);

      setSalesEmployees(salesOnly);
    } catch (err) {
      setSalesEmployees([]);
      toast.error(
        err.response?.data?.message || "Failed to load salespersons"
      );
    } finally {
      setSalesLoading(false);
    }
  };


  // ===================================================
  // INITIAL LOAD
  // ===================================================

    useEffect(() => {
    fetchRepairs();
    fetchTechnicians();
    fetchBranches();
    getSalespersonNames().then(setSalespersons);
    fetchSalesEmployees();
  }, []);


  // ===================================================
  // FORM CHANGE
  // ===================================================

  const handleChange = (e) => {

    const { name, value } = e.target;
    setForm((p) => ({
      ...p,
      [name]: value,
      ...(name === "problemCategory" ? { specificProblem: "" } : {}),
      ...(name === "deviceType" ? { problemCategory: "", specificProblem: "" } : {}),
      // clear old "Other" text when switching away from Other
      ...(name === "customerSource" && value !== "OTHER"
        ? { customerSourceOther: "" }
        : {}),
    }));

  };


  // ===================================================
  // TECHNICIAN CHANGE
  // ===================================================

  const handleTechnicianChange = (e) => {

    const id =
      e.target.value;

    setForm((p) => ({

      ...p,

      assignedTechnician:
        id,

      technicianName:
        id
          ? resolveTechName(id)
          : "",

    }));

  };


  // ===================================================
  // CREATE REPAIR
  // ===================================================

  const handleCreateRepair = async (e) => {

    e.preventDefault();

    // =================================================
    // EMAIL IS OPTIONAL
    // CUSTOMER SOURCE IS OPTIONAL
    // =================================================

    const isLaptop = form.deviceType === "Laptop";
    const description = isLaptop
      ? form.customerDescription.trim()
      : form.issueDescription.trim();
    const issueText = isLaptop
      ? [
          `Problem Category: ${form.problemCategory}`,
          `Specific Problem: ${form.specificProblem}`,
          description ? `Customer Description: ${description}` : "",
          form.deviceBrand.trim() ? `Device Brand: ${form.deviceBrand.trim()}` : "",
          form.serialNumber.trim() ? `Serial Number: ${form.serialNumber.trim()}` : "",
          form.accessoriesReceived.trim() ? `Accessories Received: ${form.accessoriesReceived.trim()}` : "",
          form.physicalCondition.trim() ? `Physical Condition: ${form.physicalCondition.trim()}` : "",
        ].filter(Boolean).join("\n")
      : description;

    if (
      !form.customerName.trim() ||
      !form.customerPhone.trim() ||
      !form.jobDate ||
      !form.branchId ||
      !form.deviceType.trim() ||
      !form.deviceModel.trim() ||
      (isLaptop && (!form.problemCategory || !form.specificProblem)) ||
      (isLaptop && form.specificProblem === "Other / Problem Not Listed" && !description) ||
      !issueText
    ) {
      return toast.error(
        !form.branchId
          ? "Please select an active branch."
          : "Please fill in all mandatory fields."
      );
    }

    if (!form.warrantyStatus) {
      return toast.error(
        "Please select Warranty Status (Under Warranty / Out of Warranty)."
      );
    }
    // NOTE: "How did you come to know about ZAID Infotech?" is OPTIONAL,
    // so there is intentionally no validation for customerSource here.


    try {

      setSubmitting(true);


      // =================================================
      // BASIC PAYLOAD
      // Email intentionally NOT included initially.
      // =================================================

      const payload = {

        customerName:
          form.customerName.trim(),

        customerPhone:
          form.customerPhone.trim(),

        jobDate: form.jobDate,
        branchId: form.branchId,

        deviceType: form.deviceType.trim(),

        deviceModel:
          form.deviceModel.trim(),

        issueDescription: issueText,

        estimatedCompletionDate:
          form.estimatedCompletionDate ||
          undefined,

        repairCost:
          form.repairCost
            ? Number(form.repairCost)
            : 0,

        technicianName:
          form.technicianName.trim(),

        assignedTechnician:
          form.assignedTechnician ||
          null,

        remarks:
          form.remarks.trim(),
          
        warrantyStatus: form.warrantyStatus,

        warrantyProvider: form.warrantyProvider.trim(),

        warrantyExpiryDate:
          form.warrantyExpiryDate || undefined,

        warrantyDetails: form.warrantyDetails.trim(),

        salespersonName: form.salespersonName.trim(),

      };


      // =================================================
      // EMAIL OPTIONAL
      //
      // If user enters email:
      // customerEmail will be sent.
      //
      // If user leaves it blank:
      // customerEmail will NOT be sent.
      // =================================================

      const email =
        form.customerEmail.trim();

      if (email) {

        payload.customerEmail =
          email;

      }


      // =================================================
      // CUSTOMER SOURCE OPTIONAL
      //
      // Only sent when the user actually selected something.
      // If left empty, the field is not sent at all.
      // =================================================

      if (form.customerSource) {

        payload.customerSource =
          form.customerSource;

        if (
          form.customerSource === "OTHER" &&
          form.customerSourceOther.trim()
        ) {

          payload.customerSourceOther =
            form.customerSourceOther.trim();

        }

      }


      const res =
        await axios.post(
          `${BASE_URL}/request`,
          payload,
          getAuthConfig()
        );


      toast.success(
        res.data?.message ||
        "Repair created successfully"
      );


      setShowAddForm(false);

      setForm(initialForm);

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
  // CUSTOMER GROUPING
  // ===================================================

  const customers = useMemo(() => {

    const map =
      new Map();

    repairs.forEach((r) => {

      if (!r.customerPhone) {
        return;
      }

      if (!map.has(r.customerPhone)) {

        map.set(
          r.customerPhone,
          {
            customerName:
              r.customerName ||
              "Unknown Customer",

            customerPhone:
              r.customerPhone,

            customerEmail:
              r.customerEmail ||
              "",

            repairs: [],
          }
        );

      }

      map
        .get(r.customerPhone)
        .repairs
        .push(r);

    });


    return Array.from(
      map.values()
    );

  }, [repairs]);


  // ===================================================
  // FILTER CUSTOMERS
  // ===================================================

  const filteredCustomers =
    useMemo(() => {

      const q =
        search
          .toLowerCase()
          .trim();

      return customers.filter(
        (c) => {

          const matchSearch =
            !q ||

            c.customerName
              .toLowerCase()
              .includes(q) ||

            c.customerPhone
              .toLowerCase()
              .includes(q) ||

            (
              c.customerEmail &&
              c.customerEmail
                .toLowerCase()
                .includes(q)
            ) ||

            c.repairs.some(
              (r) =>
                [
                  r.repairNumber,
                  r.deviceModel,
                  getTechnicianName(r),
                  getBranchLabel(r),
                  r.branchId?.code,
                  r.branchId?.name,
                  getCustomerSourceLabel(r),
                ].some(
                  (val) =>
                    val
                      ?.toLowerCase()
                      .includes(q)
                )
            );


          const matchStatus =
            statusFilter === "ALL" ||

            c.repairs.some(
              (r) =>
                String(
                  r.status || ""
                ).toLowerCase() ===
                statusFilter.toLowerCase()
            );


          return (
            matchSearch &&
            matchStatus
          );

        }
      );

    }, [
      customers,
      search,
      statusFilter,
      technicians,
      branches,
    ]);


  // ===================================================
  // LATEST REPAIR
  // ===================================================

  const getLatestRepair = (c) =>

    c.repairs.length

      ? [...c.repairs].sort(
          (a, b) =>
            new Date(
              b.createdAt || 0
            ) -
            new Date(
              a.createdAt || 0
            )
        )[0]

      : null;


  // ===================================================
  // STATUS CLASS
  // ===================================================

  const getStatusClass = (status) =>

    status
      ? `rc-status-${String(status)
          .toLowerCase()
          .replaceAll(" ", "-")}`
      : "rc-status-default";


  // ===================================================
  // STATUS LABEL
  // ===================================================

  const getStatusLabel = (status) =>

    status
      ? String(status)
          .replaceAll("_", " ")
          .replace(
            /\b\w/g,
            (l) =>
              l.toUpperCase()
          )
      : "Received";


  // ===================================================
  // PAYMENT STATUS CLASS
  // ===================================================

  const getPaymentStatusClass =
    (status) => {

      const normalized =
        String(
          status || "PENDING"
        ).toUpperCase();

      return `rc-payment-${normalized.toLowerCase()}`;
    };


  // ===================================================
  // PAYMENT STATUS LABEL
  // ===================================================

  const getPaymentStatusLabel =
    (status) => {

      const normalized =
        String(
          status || "PENDING"
        ).toUpperCase();

      return normalized;

    };


  // ===================================================
  // OPEN RECEIPT
  // ===================================================

  const openReceipt = (
    repairItem,
    fallbackCustomer = {}
  ) => {

    if (!repairItem) {
      return;
    }


    const repairCost =
      Number(
        repairItem.repairCost || 0
      );


    const paidAmount =
      Number(
        repairItem.paidAmount || 0
      );


    const balanceAmount =
      repairItem.balanceAmount !==
      undefined
        ? Number(
            repairItem.balanceAmount
          )
        : Math.max(
            repairCost -
              paidAmount,
            0
          );


    setSelectedInvoice({

      ...repairItem,

      customerName:
        repairItem.customerName ||
        fallbackCustomer.customerName ||
        "Customer",

      customerPhone:
        repairItem.customerPhone ||
        fallbackCustomer.customerPhone ||
        "N/A",

      customerEmail:
        repairItem.customerEmail ||
        fallbackCustomer.customerEmail ||
        "",

      technicianName:
        getTechnicianName(
          repairItem
        ),

      repairCost,

      paidAmount,

      balanceAmount,

      paymentStatus:
        repairItem.paymentStatus ||
        (
          paidAmount >= repairCost &&
          repairCost > 0
            ? "PAID"
            : paidAmount > 0
            ? "PARTIAL"
            : "PENDING"
        ),

    });


    setPaymentForm({

      paidAmount:
        paidAmount > 0
          ? String(paidAmount)
          : "",

      paymentMethod:
        repairItem.paymentMethod ||
        "CASH",

      paymentId:
        repairItem.paymentId ||
        "",

    });

  };


  // ===================================================
  // PAYMENT FORM CHANGE
  // ===================================================

  const handlePaymentChange = (e) => {

    setPaymentForm(
      (prev) => ({
        ...prev,
        [e.target.name]:
          e.target.value,
      })
    );

  };


  // ===================================================
  // UPDATE REPAIR PAYMENT
  // ===================================================

  const handleUpdatePayment =
    async () => {

      if (!selectedInvoice?._id) {

        toast.error(
          "Repair record not found."
        );

        return;

      }


      const repairCost =
        Number(
          selectedInvoice.repairCost ||
            0
        );


      const paidAmount =
        Number(
          paymentForm.paidAmount
        );


      if (
        !Number.isFinite(
          paidAmount
        ) ||
        paidAmount < 0
      ) {

        toast.error(
          "Please enter a valid paid amount."
        );

        return;

      }


      if (
        paidAmount >
        repairCost
      ) {

        toast.error(
          `Paid amount cannot be greater than ₹${repairCost.toFixed(
            2
          )}.`
        );

        return;

      }


      try {

        setPaymentSubmitting(true);


        const res =
          await axios.patch(

            `${BASE_URL}/${selectedInvoice._id}/payment`,

            {

              paidAmount,

              paymentMethod:
                paymentForm.paymentMethod,

              paymentId:
                paymentForm.paymentId.trim(),

            },

            getAuthConfig()

          );


        const updatedRepair =
          res.data?.data ||
          res.data?.repair ||
          null;


        if (updatedRepair) {

          setSelectedInvoice(
            (prev) => ({
              ...prev,
              ...updatedRepair,
              technicianName:
                getTechnicianName(
                  updatedRepair
                ),
            })
          );

        }


        toast.success(
          res.data?.message ||
          "Repair payment updated successfully."
        );


        await fetchRepairs();


        // Keep receipt open.
        if (updatedRepair) {

          openReceipt(
            updatedRepair,
            {
              customerName:
                updatedRepair.customerName,

              customerPhone:
                updatedRepair.customerPhone,

              customerEmail:
                updatedRepair.customerEmail,
            }
          );

        }

      } catch (err) {

        toast.error(

          err.response?.data?.message ||

          err.response?.data?.errors?.[0] ||

          "Failed to update repair payment."

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

  const handleTransferred = async () => {
    setTransferRepairItem(null);

    await fetchRepairs();
  };

  // ===================================================
  // CALCULATED SELECTED PAYMENT VALUES
  // ===================================================

  const selectedRepairCost =
    Number(
      selectedInvoice?.repairCost ||
        0
    );


  const selectedPaidAmount =
    Number(
      selectedInvoice?.paidAmount ||
        0
    );


  const selectedBalanceAmount =
    selectedInvoice?.balanceAmount !==
    undefined
      ? Number(
          selectedInvoice.balanceAmount
        )
      : Math.max(
          selectedRepairCost -
            selectedPaidAmount,
          0
        );


  const selectedPaymentStatus =
    selectedInvoice?.paymentStatus ||
    (
      selectedRepairCost === 0
        ? "PAID"
        : selectedPaidAmount >=
          selectedRepairCost
        ? "PAID"
        : selectedPaidAmount > 0
        ? "PARTIAL"
        : "PENDING"
    );


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

          <span className="rc-eyebrow">
            Repair Operations
          </span>

          <h1>
            Repair Service Registry
          </h1>

          <p>
            Manage repair intake, problem categories, specific problems, workshop assignments, and job cards.
          </p>

        </div>


        <button
          type="button"
          className="rc-btn rc-btn-primary"
          onClick={() =>
            setShowAddForm(true)
          }
        >

          <FiPlus />

          <span>
            New Repair Job
          </span>

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

            <span className="rc-stat-label">
              Total Customers
            </span>

            <strong className="rc-stat-val">
              {customers.length}
            </strong>

          </div>

        </div>


        <div className="rc-stat-card">

          <div className="rc-stat-icon rc-icon-purple">
            <FiTool />
          </div>

          <div className="rc-stat-info">

            <span className="rc-stat-label">
              Total Repairs
            </span>

            <strong className="rc-stat-val">
              {repairs.length}
            </strong>

          </div>

        </div>


        <div className="rc-stat-card">

          <div className="rc-stat-icon rc-icon-amber">
            <FiClock />
          </div>

          <div className="rc-stat-info">

            <span className="rc-stat-label">
              Pending / Received
            </span>

            <strong className="rc-stat-val">

              {
                repairs.filter(
                  (r) =>
                    !r.status ||
                    String(r.status)
                      .toLowerCase() ===
                      "received"
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

            <span className="rc-stat-label">
              Delivered & Closed
            </span>

            <strong className="rc-stat-val">

              {
                repairs.filter(
                  (r) =>
                    [
                      "delivered",
                      "completed",
                    ].includes(
                      String(
                        r.status
                      ).toLowerCase()
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
              placeholder="Search customer, phone, device, ticket..."
              value={search}
              onChange={(e) =>
                setSearch(
                  e.target.value
                )
              }
            />

            {search && (

              <button
                type="button"
                className="rc-btn-clear"
                onClick={() =>
                  setSearch("")
                }
              >
                <FiX />
              </button>

            )}

          </div>


          <div className="rc-toolbar-actions">

            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(
                  e.target.value
                )
              }
              className="rc-select"
            >

              <option value="ALL">
                All Statuses
              </option>

              <option value="Received">
                Received
              </option>

              <option value="Assigned">
                Assigned
              </option>

              <option value="In Progress">
                In Progress
              </option>

              <option value="Waiting for Parts">
                Waiting for Parts
              </option>

              <option value="Ready for Delivery">
                Ready for Delivery
              </option>

              <option value="Completed">
                Completed
              </option>

              <option value="Cancelled">
                Cancelled
              </option>

            </select>


            <button
              type="button"
              className="rc-btn rc-btn-secondary"
              onClick={fetchRepairs}
              disabled={loading}
            >

              <FiRefreshCw
                className={
                  loading
                    ? "rc-spin"
                    : ""
                }
              />

              <span>
                Sync
              </span>

            </button>

          </div>

        </div>


        {loading ? (

          <div className="rc-state-box">

            <div className="rc-spinner"></div>

            <p>
              Loading database records...
            </p>

          </div>

        ) : filteredCustomers.length === 0 ? (

          <div className="rc-state-box">

            <div className="rc-empty-ico">
              <FiInbox />
            </div>

            <h3>
              No Customer Records Found
            </h3>

            <p>
              Adjust your search filters
              or register a new repair ticket.
            </p>

            <button
              type="button"
              className="rc-btn rc-btn-primary"
              onClick={() =>
                setShowAddForm(true)
              }
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

                  <th>
                    Customer
                  </th>

                  <th>
                    Contact Info
                  </th>

                  <th>
                    Workloads
                  </th>

                  <th>
                    Latest Ticket
                  </th>

                  <th>
                    Assigned Tech
                  </th>

                  <th>
                    Status
                  </th>

                  <th>
                    Payment
                  </th>

                  <th className="rc-th-right">
                    Action
                  </th>

                </tr>

              </thead>


              <tbody>

                {filteredCustomers.map(
                  (customer) => {

                    const latestRepair =
                      getLatestRepair(
                        customer
                      );


                    return (

                      <tr
                        key={
                          customer.customerPhone
                        }
                      >

                        <td>

                          <div className="rc-cell-user">

                            <div className="rc-avatar">

                              {customer
                                .customerName
                                .charAt(0)
                                .toUpperCase()}

                            </div>

                            <div>

                              <strong>
                                {
                                  customer.customerName
                                }
                              </strong>

                              <span>
                                Client ID:{" "}
                                {
                                  customer.customerPhone.slice(
                                    -4
                                  )
                                }
                              </span>

                            </div>

                          </div>

                        </td>


                        <td>

                          <div className="rc-contact-block">

                            <span className="rc-phone-chip">

                              <FiPhone />

                              {
                                customer.customerPhone
                              }

                            </span>


                            {customer.customerEmail && (

                              <span className="rc-email-sub">

                                {
                                  customer.customerEmail
                                }

                              </span>

                            )}

                          </div>

                        </td>


                        <td>

                          <span className="rc-badge-count">

                            {
                              customer.repairs.length
                            }{" "}

                            {
                              customer.repairs.length ===
                              1
                                ? "Job"
                                : "Jobs"
                            }

                          </span>

                        </td>


                        <td>

                          <div className="rc-ticket-col">

                            <span className="rc-ticket-id">

                              {
                                latestRepair?.repairNumber ||
                                "TICKET-NEW"
                              }

                            </span>

                            <span className="rc-device-tag">
                              Device: {latestRepair?.deviceType || "N/A"}
                            </span>

                            <span className="rc-device-tag">
                              Hardware: {
                                latestRepair?.deviceModel ||
                                latestRepair?.laptopModel ||
                                "N/A"
                              }
                            </span>

                            {getRepairProblemDetails(latestRepair).category && (
                              <span className="rc-device-tag" style={{ display: "block", whiteSpace: "normal" }}>
                                Category: {getRepairProblemDetails(latestRepair).category}
                              </span>
                            )}
                            {getRepairProblemDetails(latestRepair).problem && (
                              <span className="rc-device-tag" style={{ display: "block", whiteSpace: "normal" }}>
                                Problem: {getRepairProblemDetails(latestRepair).problem}
                              </span>
                            )}

                            {getCustomerSourceLabel(latestRepair) && (
                              <span className="rc-device-tag" style={{ display: "block", whiteSpace: "normal" }}>
                                Source: {getCustomerSourceLabel(latestRepair)}
                              </span>
                            )}

                            <span className="rc-device-tag">
                              Job Date: {
                                latestRepair?.jobDate
                                  ? new Date(latestRepair.jobDate).toLocaleDateString("en-IN")
                                  : latestRepair?.createdAt
                                    ? new Date(latestRepair.createdAt).toLocaleDateString("en-IN")
                                    : "N/A"
                              }
                            </span>

                            <span className="rc-device-tag" style={{ display: "block", whiteSpace: "normal" }}>
                              Branch: {getBranchLabel(latestRepair)}
                            </span>
                            
                            <span className="rc-device-tag" style={{ display: "block", whiteSpace: "normal" }}>
                              <WarrantyBadge repair={latestRepair} />
                            </span>

                            {latestRepair?.salespersonName && (
                              <span className="rc-device-tag" style={{ display: "block", whiteSpace: "normal" }}>
                                Salesperson: {latestRepair.salespersonName}
                              </span>
                            )}

                          </div>

                        </td>


                        <td>

                          <span className="rc-tech-tag">

                            <FiUserCheck />

                            {
                              getTechnicianName(
                                latestRepair
                              )
                            }

                          </span>

                        </td>


                        <td>

                          <span
                            className={
                              `rc-status-pill ${
                                getStatusClass(
                                  latestRepair?.status
                                )
                              }`
                            }
                          >

                            {
                              getStatusLabel(
                                latestRepair?.status
                              )
                            }

                          </span>

                        </td>


                        {/* =================================
                            PAYMENT STATUS
                        ================================= */}

                        <td>

                          <span
                            className={
                              `rc-status-pill ${
                                getPaymentStatusClass(
                                  latestRepair?.paymentStatus
                                )
                              }`
                            }
                          >

                            {
                              getPaymentStatusLabel(
                                latestRepair?.paymentStatus
                              )
                            }

                          </span>

                        </td>


                        <td className="rc-td-right">

                          <div className="rc-table-actions-group">

                            <button
                              type="button"
                              className="rc-btn-action"
                              onClick={() =>
                                setSelectedCustomer(
                                  customer
                                )
                              }
                              title="View customer timeline & history"
                            >

                              <FiEye />

                              <span>
                                View
                              </span>

                            </button>


                            <button
                              type="button"
                              className="rc-btn-action rc-btn-receipt"
                              onClick={() =>
                                openReceipt(
                                  latestRepair,
                                  customer
                                )
                              }
                              title="View and print invoice receipt"
                            >

                              <FiPrinter />

                              <span>
                                Receipt
                              </span>

                            </button>
                            
                            <button
                              type="button"
                              className="rc-btn-action"
                              onClick={() =>
                                setTransferRepairItem(latestRepair)
                              }
                              title="Transfer / reassign to another technician"
                            >

                              <FiUserCheck />

                              <span>
                                Transfer
                              </span>

                            </button>

                          </div>

                        </td>

                      </tr>

                    );

                  }
                )}

              </tbody>

            </table>

          </div>

        )}

      </section>


      {/* =================================================
          NEW REPAIR MODAL
      ================================================= */}

      {showAddForm && (

        <div
          className="rc-modal-overlay no-print"
          onMouseDown={(e) =>
            e.target ===
              e.currentTarget &&
            setShowAddForm(false)
          }
        >

          <div className="rc-modal-box">

            <div className="rc-modal-top">

              <div>

                <span className="rc-eyebrow">
                  Intake Form
                </span>

                <h2>
                  New Repair Intake
                </h2>

                <p>
                  Register client details,
                  hardware model, and issue diagnosis.
                </p>

              </div>


              <button
                type="button"
                className="rc-btn-close"
                onClick={() =>
                  setShowAddForm(false)
                }
              >

                <FiX />

              </button>

            </div>


            <form
              onSubmit={
                handleCreateRepair
              }
              className="rc-form-stack"
            >

              <div className="rc-field-group">

                <span className="rc-group-title">
                  Client Details
                </span>


                <div className="rc-grid-2">

                  <div className="rc-input-field">

                    <label>
                      Customer Full Name{" "}
                      <span>*</span>
                    </label>

                    <input
                      type="text"
                      name="customerName"
                      value={
                        form.customerName
                      }
                      onChange={
                        handleChange
                      }
                      placeholder="e.g. Aarav Sharma"
                      required
                    />

                  </div>


                  <div className="rc-input-field">

                    <label>
                      Phone Number{" "}
                      <span>*</span>
                    </label>

                    <input
                      type="tel"
                      name="customerPhone"
                      value={
                        form.customerPhone
                      }
                      onChange={
                        handleChange
                      }
                      placeholder="e.g. 9876543210"
                      required
                    />

                  </div>

                </div>


                {/* =========================================
                    EMAIL IS OPTIONAL
                ========================================= */}

                <div
                  className="rc-grid-2"
                  style={{
                    marginTop:
                      "1rem",
                  }}
                >

                  <div className="rc-input-field">

                    <label>
                      Customer Email{" "}
                      <span
                        style={{
                          fontWeight: "400",
                          color: "#64748b",
                        }}
                      >
                        (Optional)
                      </span>
                    </label>

                    <input
                      type="email"
                      name="customerEmail"
                      value={
                        form.customerEmail
                      }
                      onChange={
                        handleChange
                      }
                      placeholder="e.g. aarav@example.com"
                    />

                  </div>

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
                      disabled={
                        submitting ||
                        branchesLoading ||
                        !branches.some(
                          (branch) =>
                            String(branch.status || "ACTIVE").toUpperCase() === "ACTIVE" &&
                            !branch.isDeleted
                        )
                      }
                    >
                      <option value="">
                        {branchesLoading
                          ? "Loading active branches..."
                          : branches.length
                            ? "-- Select Repair Branch --"
                            : "No active branches available"}
                      </option>
                      {branches.map((branch) => (
                        <option key={getBranchId(branch)} value={getBranchId(branch)}>
                          {(branch.name || branch.branchName || branch.title || "Unnamed Branch")}
                          {(branch.code || branch.branchCode)
                            ? ` (${branch.code || branch.branchCode})`
                            : ""}
                        </option>
                      ))}
                    </select>
                    <small style={{ color: "#64748b" }}>
                      Select the shop where the customer submitted the device.
                    </small>
                  </div>


                  <div className="rc-input-field">

                    <label>
                      Estimated Completion Date
                    </label>

                    <input
                      type="date"
                      name="estimatedCompletionDate"
                      value={
                        form.estimatedCompletionDate
                      }
                      onChange={
                        handleChange
                      }
                    />

                  </div>


                  {/* =========================================
                      CUSTOMER SOURCE (OPTIONAL)
                      How did you come to know about ZAID Infotech?
                  ========================================= */}

                  <div className="rc-input-field">

                    <label htmlFor="customerSource">
                      How did the customer come to know about ZAID Infotech?{" "}
                      <span
                        style={{
                          fontWeight: "400",
                          color: "#64748b",
                        }}
                      >
                        (Optional)
                      </span>
                    </label>

                    <select
                      id="customerSource"
                      name="customerSource"
                      className="rc-select rc-select-full"
                      value={form.customerSource}
                      onChange={handleChange}
                    >

                      <option value="">
                        -- Select an option --
                      </option>

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


                  {form.customerSource === "OTHER" && (

                    <div className="rc-input-field rc-col-span-2">

                      <label htmlFor="customerSourceOther">
                        Please specify{" "}
                        <span
                          style={{
                            fontWeight: "400",
                            color: "#64748b",
                          }}
                        >
                          (Optional)
                        </span>
                      </label>

                      <input
                        id="customerSourceOther"
                        type="text"
                        name="customerSourceOther"
                        value={form.customerSourceOther}
                        onChange={handleChange}
                        maxLength={200}
                        placeholder="Please tell us how the customer came to know about us"
                      />

                    </div>

                  )}

                </div>

              </div>


              <div className="rc-field-group">

                <span className="rc-group-title">
                  Device & Service Details
                </span>


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


                  <div className="rc-input-field">

                    <label>
                      Estimated Cost (₹)
                    </label>

                    <input
                      type="number"
                      name="repairCost"
                      value={
                        form.repairCost
                      }
                      onChange={
                        handleChange
                      }
                      placeholder="0.00"
                      min="0"
                    />

                  </div>


                  <div className="rc-input-field">

                    <label>
                      Assign Workshop Tech
                    </label>

                    <select
                      name="assignedTechnician"
                      value={
                        form.assignedTechnician
                      }
                      onChange={
                        handleTechnicianChange
                      }
                      className="rc-select"
                    >

                      <option value="">
                        -- Unassigned --
                      </option>

                      {technicians.map(
                        (tech) => (

                          <option
                            key={tech._id}
                            value={tech._id}
                          >

                            {
                              resolveTechName(
                                tech
                              )
                            }

                            {tech.email
                              ? ` (${tech.email})`
                              : ""}

                          </option>

                        )
                      )}

                    </select>

                  </div>

                </div>


                <div className="rc-grid-3" style={{ marginTop: "1rem" }}>
                  <div className="rc-input-field">
                    <label>Device Brand</label>
                    <input name="deviceBrand" value={form.deviceBrand} onChange={handleChange} placeholder="e.g. MSI, HP, Dell" />
                  </div>
                  <div className="rc-input-field">
                    <label>Serial Number</label>
                    <input name="serialNumber" value={form.serialNumber} onChange={handleChange} placeholder="Serial / Service Tag" />
                  </div>
                  <div className="rc-input-field">
                    <label>Job Status</label>
                    <select name="jobStatus" className="rc-select" value={form.jobStatus} onChange={handleChange}>
                      {["Received", "Assigned", "In Progress", "Waiting for Parts", "Ready for Delivery", "Completed", "Cancelled"].map(x => <option key={x} value={x}>{x}</option>)}
                    </select>
                  </div>
                </div>

                {form.deviceType === "Laptop" && (
                  <div className="rc-grid-2" style={{ marginTop: "1rem" }}>
                    <div className="rc-input-field">
                      <label>Problem Category <span>*</span></label>
                      <select name="problemCategory" className="rc-select" value={form.problemCategory} onChange={handleChange} required>
                        <option value="">-- Select Category --</option>
                        {Object.keys(LAPTOP_PROBLEMS).map(category => (
                          <option key={category} value={category}>{category}</option>
                        ))}
                      </select>
                    </div>
                    <div className="rc-input-field">
                      <label>Specific Problem <span>*</span></label>
                      <select name="specificProblem" className="rc-select" value={form.specificProblem} onChange={handleChange} disabled={!form.problemCategory} required>
                        <option value="">{form.problemCategory ? "-- Select Specific Problem --" : "-- First Select Category --"}</option>
                        {(LAPTOP_PROBLEMS[form.problemCategory] || []).map(problem => (
                          <option key={problem} value={problem}>{problem}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

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

                <div
                  className="rc-input-field"
                  style={{
                    marginTop:
                      "1rem",
                  }}
                >

                  <label>
                    Customer Description / Reported Issue{" "}
                    <span>*</span>
                  </label>

                  <textarea
                    name={form.deviceType === "Laptop" ? "customerDescription" : "issueDescription"}
                    rows="3"
                    value={form.deviceType === "Laptop" ? form.customerDescription : form.issueDescription}
                    onChange={handleChange}
                    placeholder="Describe failure symptoms, errors, liquid contact, etc."
                    required={form.deviceType !== "Laptop" || form.specificProblem === "Other / Problem Not Listed"}
                  />

                </div>


                <div
                  className="rc-input-field"
                  style={{
                    marginTop:
                      "1rem",
                  }}
                >

                  <label>
                    Front-Desk / Physical Remarks
                  </label>

                  <textarea
                    name="remarks"
                    rows="2"
                    value={
                      form.remarks
                    }
                    onChange={
                      handleChange
                    }
                    placeholder="Physical scratches, original power adapter included, password received..."
                  />

                </div>

              </div>
              <div className="rc-field-group rc-warranty-sales">

                <span className="rc-group-title">
                  Warranty & Sales Details
                </span>

                <JobExtraFields
                  form={form}
                  onChange={handleChange}
                  salespersons={salespersons}
                />

                {/* SALESPERSON DROPDOWN (sales role employees only) */}
                <div
                  className="rc-input-field rc-sales-select-field"
                  style={{ marginTop: "1rem" }}
                >
                  <label htmlFor="salespersonName">
                    Salesperson Name{" "}
                    <span style={{ fontWeight: "400", color: "#64748b" }}>
                      (Optional)
                    </span>
                  </label>

                  <select
                    id="salespersonName"
                    name="salespersonName"
                    className="rc-select rc-select-full"
                    value={form.salespersonName}
                    onChange={handleChange}
                    disabled={salesLoading}
                  >
                    <option value="">
                      {salesLoading
                        ? "Loading salespersons..."
                        : salesEmployees.length
                          ? "-- Select Salesperson --"
                          : "No salesperson available"}
                    </option>

                    {salesEmployees.map((emp) => (
                      <option key={emp.id || emp.name} value={emp.name}>
                        {emp.name}
                      </option>
                    ))}
                  </select>
                </div>

              </div>
              <div className="rc-modal-footer">

                <button
                  type="button"
                  className="rc-btn rc-btn-secondary"
                  onClick={() =>
                    setShowAddForm(false)
                  }
                  disabled={
                    submitting
                  }
                >

                  Cancel

                </button>


                <button
                  type="submit"
                  className="rc-btn rc-btn-primary"
                  disabled={
                    submitting ||
                    branchesLoading ||
                    !branches.some(
                      (branch) =>
                        String(branch.status || "ACTIVE").toUpperCase() === "ACTIVE" &&
                        !branch.isDeleted
                    )
                  }
                >

                  {
                    submitting
                      ? "Registering Job..."
                      : "Register Repair Ticket"
                  }

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
            e.target ===
              e.currentTarget &&
            setSelectedCustomer(null)
          }
        >

          <div className="rc-modal-box rc-modal-large">

            <div className="rc-modal-top">

              <div>

                <span className="rc-eyebrow">
                  Customer History
                </span>

                <h2>
                  {
                    selectedCustomer.customerName
                  }
                </h2>

                <p>

                  <FiPhone
                    style={{
                      verticalAlign:
                        "middle",
                    }}
                  />{" "}

                  {
                    selectedCustomer.customerPhone
                  }

                  {
                    selectedCustomer.customerEmail &&
                    ` • ${selectedCustomer.customerEmail}`
                  }

                </p>

              </div>


              <button
                type="button"
                className="rc-btn-close"
                onClick={() =>
                  setSelectedCustomer(null)
                }
              >

                <FiX />

              </button>

            </div>


            <div className="rc-history-content">

              <div className="rc-profile-badge">

                <div className="rc-avatar rc-avatar-lg">

                  {
                    selectedCustomer
                      .customerName
                      .charAt(0)
                      .toUpperCase()
                  }

                </div>

                <div>

                  <h3>
                    {
                      selectedCustomer.customerName
                    }
                  </h3>

                  <span>
                    Total Repair History:{" "}
                    {
                      selectedCustomer
                        .repairs
                        .length
                    }{" "}
                    Job(s)
                  </span>

                </div>

              </div>


              <h4 className="rc-timeline-heading">

                <FiClock />

                Workshop History Timeline

              </h4>


              <div className="rc-timeline-list">

                {selectedCustomer.repairs.map(
                  (repair) => (

                    <div
                      className="rc-timeline-card"
                      key={
                        repair._id ||
                        Math.random()
                      }
                    >

                      <div className="rc-card-head">

                        <strong className="rc-badge-ref">

                          {
                            repair.repairNumber ||
                            "Ticket"
                          }

                        </strong>


                        <span
                          className={
                            `rc-status-pill ${
                              getStatusClass(
                                repair.status
                              )
                            }`
                          }
                        >

                          {
                            getStatusLabel(
                              repair.status
                            )
                          }

                        </span>

                      </div>

                      <div className="rc-date-row" style={{ marginTop: 8 }}>
                        <strong>Branch:</strong>&nbsp;{getBranchLabel(repair)}
                      </div>


                      <div className="rc-grid-3 rc-meta-row">

                        <div>

                          <span className="rc-meta-lbl">

                            <FiMonitor />

                            Hardware

                          </span>

                          <strong className="rc-meta-txt">

                            {
                              repair.deviceModel ||
                              repair.laptopModel ||
                              "N/A"
                            }

                          </strong>

                        </div>


                        <div>

                          <span className="rc-meta-lbl">

                            <FiUserCheck />

                            Technician

                          </span>

                          <strong className="rc-meta-txt">

                            {
                              getTechnicianName(
                                repair
                              )
                            }

                          </strong>

                        </div>


                        <div>

                          <span className="rc-meta-lbl">

                            Repair Cost

                          </span>

                          <strong className="rc-meta-txt">

                            ₹
                            {
                              Number(
                                repair.repairCost ||
                                0
                              ).toFixed(2)
                            }

                          </strong>

                        </div>

                      </div>


                      {/* PAYMENT DETAILS */}

                      <div className="rc-grid-3 rc-meta-row">

                        <div>

                          <span className="rc-meta-lbl">

                            <FiDollarSign />

                            Paid

                          </span>

                          <strong className="rc-meta-txt">

                            ₹
                            {
                              Number(
                                repair.paidAmount ||
                                0
                              ).toFixed(2)
                            }

                          </strong>

                        </div>


                        <div>

                          <span className="rc-meta-lbl">

                            <FiDollarSign />

                            Balance

                          </span>

                          <strong className="rc-meta-txt">

                            ₹
                            {
                              Number(
                                repair.balanceAmount ??
                                (
                                  Number(
                                    repair.repairCost ||
                                    0
                                  ) -
                                  Number(
                                    repair.paidAmount ||
                                    0
                                  )
                                )
                              ).toFixed(2)
                            }

                          </strong>

                        </div>


                        <div>

                          <span className="rc-meta-lbl">

                            <FiCreditCard />

                            Payment

                          </span>

                          <strong className="rc-meta-txt">

                            {
                              repair.paymentStatus ||
                              "PENDING"
                            }

                          </strong>

                        </div>

                      </div>


                      {repair.estimatedCompletionDate && (

                        <div className="rc-date-row">

                          <FiCalendar />

                          Estimated Completion:{" "}

                          {
                            new Date(
                              repair.estimatedCompletionDate
                            ).toLocaleDateString()
                          }

                        </div>

                      )}


                      <JobExtraSummary
                        repair={repair}
                        showNotes
                        showTransfers
                      />

                      {/* CUSTOMER SOURCE */}

                      {getCustomerSourceLabel(repair) && (

                        <div className="rc-date-row">

                          <FiShare2 />

                          Came to know via:{" "}

                          <strong>
                            {getCustomerSourceLabel(repair)}
                          </strong>

                        </div>

                      )}


                      <div className="rc-note-card">

                        <FiMessageSquare
                          className="rc-note-ico"
                        />

                        <div>

                          <strong>
                            Problem Reported:
                          </strong>

                          <p>

                            {
                              repair.issueDescription ||
                              "No issue details registered."
                            }

                          </p>

                        </div>

                      </div>


                      {(getRepairProblemDetails(repair).category || getRepairProblemDetails(repair).problem) && (
                        <div className="rc-note-card">
                          <div>
                            <strong>Problem Category:</strong> {getRepairProblemDetails(repair).category || "N/A"}
                            <p><strong>Specific Problem:</strong> {getRepairProblemDetails(repair).problem || "N/A"}</p>
                            {getRepairProblemDetails(repair).description && <p><strong>Customer Description:</strong> {getRepairProblemDetails(repair).description}</p>}
                          </div>
                        </div>
                      )}

                      {repair.remarks && (

                        <div className="rc-note-card rc-note-muted">

                          <div>

                            <strong>
                              Intake Remarks:
                            </strong>

                            <p>
                              {
                                repair.remarks
                              }
                            </p>

                          </div>

                        </div>

                      )}

                    </div>

                  )
                )}

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
          SERVICE DELIVERY INVOICE MODAL
      ================================================= */}

      {selectedInvoice && (

        <div
          className="rc-modal-overlay"
          style={{
            zIndex: 1250,
          }}
          onMouseDown={(e) =>
            e.target ===
              e.currentTarget &&
            setSelectedInvoice(null)
          }
        >

          <div className="rc-modal-box rc-receipt-modal-box">

            {/* ===========================================
                MODAL HEADER
            =========================================== */}

            <div className="rc-modal-top no-print">

              <div>

                <span className="rc-eyebrow">
                  Billing & Deliveries
                </span>

                <h2>
                  Service Delivery Voucher
                </h2>

                <p>
                  Official workshop repair
                  diagnosis and bill summary
                </p>

              </div>


              <button
                type="button"
                className="rc-btn-close"
                onClick={() =>
                  setSelectedInvoice(null)
                }
              >

                <FiX />

              </button>

            </div>


            {/* ===========================================
                PAYMENT UPDATE SECTION
            =========================================== */}

            <div className="no-print">

              <div
                style={{
                  padding:
                    "18px",
                  marginBottom:
                    "18px",
                  border:
                    "1px solid #e5e7eb",
                  borderRadius:
                    "12px",
                  background:
                    "#f8fafc",
                }}
              >

                <div
                  style={{
                    display:
                      "grid",
                    gridTemplateColumns:
                      "repeat(4, minmax(0, 1fr))",
                    gap:
                      "12px",
                    marginBottom:
                      "15px",
                  }}
                >

                  <div>

                    <small>
                      Total
                    </small>

                    <strong
                      style={{
                        display:
                          "block",
                        fontSize:
                          "18px",
                      }}
                    >

                      ₹
                      {
                        selectedRepairCost.toFixed(
                          2
                        )
                      }

                    </strong>

                  </div>


                  <div>

                    <small>
                      Paid
                    </small>

                    <strong
                      style={{
                        display:
                          "block",
                        fontSize:
                          "18px",
                      }}
                    >

                      ₹
                      {
                        selectedPaidAmount.toFixed(
                          2
                        )
                      }

                    </strong>

                  </div>


                  <div>

                    <small>
                      Balance
                    </small>

                    <strong
                      style={{
                        display:
                          "block",
                        fontSize:
                          "18px",
                      }}
                    >

                      ₹
                      {
                        selectedBalanceAmount.toFixed(
                          2
                        )
                      }

                    </strong>

                  </div>


                  <div>

                    <small>
                      Payment Status
                    </small>

                    <strong
                      style={{
                        display:
                          "block",
                        fontSize:
                          "18px",
                      }}
                    >

                      {
                        selectedPaymentStatus
                      }

                    </strong>

                  </div>

                </div>


                <div
                  style={{
                    display:
                      "grid",
                    gridTemplateColumns:
                      "1fr 1fr 1fr auto",
                    gap:
                      "12px",
                    alignItems:
                      "end",
                  }}
                >

                  <div className="rc-input-field">

                    <label>
                      Paid Amount (₹)
                    </label>

                    <input
                      type="number"
                      min="0"
                      max={
                        selectedRepairCost
                      }
                      step="0.01"
                      name="paidAmount"
                      value={
                        paymentForm.paidAmount
                      }
                      onChange={
                        handlePaymentChange
                      }
                      placeholder="Enter paid amount"
                    />

                  </div>


                  <div className="rc-input-field">

                    <label>
                      Payment Method
                    </label>

                    <select
                      name="paymentMethod"
                      value={
                        paymentForm.paymentMethod
                      }
                      onChange={
                        handlePaymentChange
                      }
                      className="rc-select"
                    >

                      <option value="CASH">
                        Cash
                      </option>

                      <option value="UPI">
                        UPI
                      </option>

                      <option value="CARD">
                        Card
                      </option>

                      <option value="BANK_TRANSFER">
                        Bank Transfer
                      </option>

                      <option value="RAZORPAY">
                        Razorpay
                      </option>

                      <option value="OTHER">
                        Other
                      </option>

                    </select>

                  </div>


                  <div className="rc-input-field">

                    <label>
                      Payment ID
                    </label>

                    <input
                      type="text"
                      name="paymentId"
                      value={
                        paymentForm.paymentId
                      }
                      onChange={
                        handlePaymentChange
                      }
                      placeholder="UPI / Razorpay / Reference ID"
                    />

                  </div>


                  <button
                    type="button"
                    className="rc-btn rc-btn-primary"
                    onClick={
                      handleUpdatePayment
                    }
                    disabled={
                      paymentSubmitting
                    }
                  >

                    <FiCreditCard />

                    {
                      paymentSubmitting
                        ? "Saving..."
                        : "Update Payment"
                    }

                  </button>

                </div>

              </div>

            </div>


            {/* ===========================================
                PRINTABLE RECEIPT
            =========================================== */}

            <div
              className="trh-invoice-sheet"
              id="printable-receipt"
            >

              <div className="invoice-header">

                <div>

                  <h1 className="brand-title">
                    ZAID INFOTECH
                  </h1>

                  <p className="brand-tagline">
                    Premium Hardware Repairs,
                    Micro-Soldering & IT Solutions
                  </p>

                </div>


                <div className="invoice-badge-block">

                  <h3>
                    SERVICE RECEIPT
                  </h3>

                  <div>

                    Ticket:{" "}

                    <strong>

                      {
                        selectedInvoice.repairNumber ||
                        selectedInvoice._id
                          ?.slice(-6)
                          .toUpperCase()
                      }

                    </strong>

                  </div>

                  <div>

                    Date:{" "}

                    {
                      new Date(
                        selectedInvoice.updatedAt ||
                        selectedInvoice.createdAt ||
                        Date.now()
                      ).toLocaleDateString()
                    }

                  </div>

                </div>

              </div>


              {/* =========================================
                  CUSTOMER + DEVICE
              ========================================= */}

              <div className="invoice-parties-grid">

                <div className="party-card">

                  <span className="party-title">
                    CUSTOMER DETAILS
                  </span>

                  <strong className="party-name">
                    {
                      selectedInvoice.customerName
                    }
                  </strong>

                  <div className="party-sub">
                    Phone:{" "}
                    {
                      selectedInvoice.customerPhone
                    }
                  </div>

                  {selectedInvoice.customerEmail && (

                    <div className="party-sub">

                      Email:{" "}

                      {
                        selectedInvoice.customerEmail
                      }

                    </div>

                  )}

                </div>


                <div className="party-card">

                  <span className="party-title">
                    HARDWARE REPAIRED
                  </span>

                  <strong className="party-name">

                    {
                      selectedInvoice.deviceModel ||
                      selectedInvoice.laptopModel ||
                      "Standard Device"
                    }

                  </strong>

                  <div className="party-sub">

                    Technician:{" "}

                    {
                      selectedInvoice.technicianName ||
                      "Assigned Specialist"
                    }

                  </div>

                  <div className="party-sub">

                    Status:{" "}

                    <span className="status-highlight">

                      {
                        selectedInvoice.status ||
                        "Delivered"
                      }

                    </span>

                  </div>

                </div>

              </div>


              {/* BRANCH DETAILS ON JOB CARD / RECEIPT */}
              <section
                className="rc-receipt-branch-details"
                style={{
                  margin: "14px 0",
                  padding: 14,
                  border: "1px solid #cbd5e1",
                  borderRadius: 8,
                }}
              >
                <h3 style={{ margin: "0 0 8px", fontSize: 15 }}>
                  JOB CARD BRANCH DETAILS
                </h3>

                {(() => {
                  const branch = getBranchInfo(selectedInvoice);

                  return (
                    <>
                      <div>
                        <strong>Branch:</strong>{" "}
                        {getBranchLabel(selectedInvoice)}
                      </div>

                      <div>
                        <strong>Branch Code:</strong>{" "}
                        {branch?.code || branch?.branchCode || "N/A"}
                      </div>

                      <div>
                        <strong>Phone:</strong>{" "}
                        {branch?.phone || "N/A"}
                      </div>

                      <div>
                        <strong>Email:</strong>{" "}
                        {branch?.email || "N/A"}
                      </div>

                      <div>
                        <strong>Address:</strong>{" "}
                        {typeof branch?.address === "string"
                          ? branch.address
                          : [
                              branch?.address?.line1,
                              branch?.address?.line2,
                            ].filter(Boolean).join(", ") || "N/A"}
                      </div>

                      <div>
                        <strong>Location:</strong>{" "}
                        {[
                          branch?.city,
                          branch?.state,
                          branch?.pincode,
                        ].filter(Boolean).join(", ") || "N/A"}
                      </div>

                      <div>
                        <strong>GSTIN:</strong>{" "}
                        {branch?.gstin || "N/A"}
                      </div>
                    </>
                  );
                })()}
              </section>


              {/* PROBLEM DETAILS: INCLUDED IN PRINTED VOUCHER */}
              <section className="rc-receipt-problem-details" style={{ margin: "16px 0", padding: 14, border: "1px solid #cbd5e1", borderRadius: 8, whiteSpace: "pre-wrap" }}>
                <h3 style={{ margin: "0 0 10px", fontSize: 15 }}>DEVICE PROBLEM / JOB CARD DETAILS</h3>
                <div><strong>Device:</strong> {selectedInvoice.deviceType || "N/A"}</div>
                <div><strong>Brand:</strong> {getRepairProblemDetails(selectedInvoice).brand || "N/A"}</div>
                <div><strong>Model:</strong> {selectedInvoice.deviceModel || "N/A"}</div>
                <div><strong>Serial Number:</strong> {getRepairProblemDetails(selectedInvoice).serial || "N/A"}</div>
                <div><strong>Problem Category:</strong> {getRepairProblemDetails(selectedInvoice).category || "N/A"}</div>
                <div><strong>Specific Problem:</strong> {getRepairProblemDetails(selectedInvoice).problem || "N/A"}</div>
                <div><strong>Customer Description:</strong> {getRepairProblemDetails(selectedInvoice).description || "N/A"}</div>
                <div><strong>Accessories Received:</strong> {getRepairProblemDetails(selectedInvoice).accessories || "N/A"}</div>
                <div><strong>Physical Condition:</strong> {getRepairProblemDetails(selectedInvoice).condition || "N/A"}</div>
                <div><strong>Technician:</strong> {selectedInvoice.technicianName || "Unassigned"}</div>
                <div><strong>Job Status:</strong> {selectedInvoice.status || "Received"}</div>
                                <JobExtraSummary repair={selectedInvoice} />
              </section>

              {/* =========================================
                  SERVICE TABLE
              ========================================= */}

              <div className="invoice-table-wrapper">

                <table className="invoice-data-table">

                  <thead>

                    <tr>

                      <th>
                        Service / Problem Breakdown
                      </th>

                      <th className="cell-right">
                        Part (₹)
                      </th>

                      <th className="cell-right">
                        Labor (₹)
                      </th>

                      <th className="cell-right">
                        Total (₹)
                      </th>

                    </tr>

                  </thead>


                  <tbody>

                    {
                      Array.isArray(
                        selectedInvoice.services
                      ) &&
                      selectedInvoice.services.length >
                        0
                    ? (

                      selectedInvoice.services.map(
                        (srv, idx) => {

                          const part =
                            Number(
                              srv.partCost ||
                              0
                            );

                          const labor =
                            Number(
                              srv.laborCost ||
                              0
                            );

                          const itemTotal =
                            Number(
                              srv.totalCost ??
                              part + labor
                            );


                          return (

                            <tr key={idx}>

                              <td>

                                <strong>

                                  {
                                    srv.serviceName ||
                                    srv.name
                                  }

                                </strong>


                                {srv.category && (

                                  <span className="service-category-tag">

                                    {
                                      srv.category
                                    }

                                  </span>

                                )}


                                {idx === 0 &&
                                  selectedInvoice.issueDescription && (

                                  <p className="invoice-service-note">

                                    Intake Issue:{" "}

                                    {
                                      selectedInvoice.issueDescription
                                    }

                                  </p>

                                )}

                              </td>


                              <td className="cell-right">

                                {
                                  part.toFixed(2)
                                }

                              </td>


                              <td className="cell-right">

                                {
                                  labor.toFixed(2)
                                }

                              </td>


                              <td className="cell-right">

                                {
                                  itemTotal.toFixed(2)
                                }

                              </td>

                            </tr>

                          );

                        }
                      )

                    ) : (

                      <tr>

                        <td>

                          <strong>
                            Repair Diagnostics
                            & Technician Service
                          </strong>

                          <p className="invoice-service-note">

                            {
                              selectedInvoice.issueDescription ||
                              "General Hardware Issue"
                            }

                          </p>

                        </td>


                        <td className="cell-right">

                          {
                            Number(
                              selectedInvoice.partCost ||
                              0
                            ).toFixed(2)
                          }

                        </td>


                        <td className="cell-right">

                          {
                            Number(
                              selectedInvoice.laborCost ??
                              (
                                Number(
                                  selectedInvoice.repairCost ||
                                  0
                                ) -
                                Number(
                                  selectedInvoice.partCost ||
                                  0
                                )
                              )
                            ).toFixed(2)
                          }

                        </td>


                        <td className="cell-right">

                          {
                            Number(
                              selectedInvoice.repairCost ||
                              0
                            ).toFixed(2)
                          }

                        </td>

                      </tr>

                    )}


                    {selectedInvoice.remarks && (

                      <tr className="remarks-row">

                        <td colSpan={3}>

                          <em>

                            Intake Remarks:{" "}

                            {
                              selectedInvoice.remarks
                            }

                          </em>

                        </td>

                        <td className="cell-right">
                          —
                        </td>

                      </tr>

                    )}

                  </tbody>


                  {/* =====================================
                      PAYMENT TOTAL
                  ===================================== */}

                  <tfoot>

                    <tr>

                      <th
                        colSpan={3}
                        className="cell-right grand-total-label"
                      >
                        Total Repair Amount:
                      </th>

                      <th className="cell-right grand-total-val">

                        ₹
                        {
                          selectedRepairCost.toFixed(
                            2
                          )
                        }

                      </th>

                    </tr>


                    <tr>

                      <th
                        colSpan={3}
                        className="cell-right"
                      >
                        Paid Amount:
                      </th>

                      <th className="cell-right">

                        ₹
                        {
                          selectedPaidAmount.toFixed(
                            2
                          )
                        }

                      </th>

                    </tr>


                    <tr>

                      <th
                        colSpan={3}
                        className="cell-right"
                      >
                        Balance Amount:
                      </th>

                      <th className="cell-right">

                        ₹
                        {
                          selectedBalanceAmount.toFixed(
                            2
                          )
                        }

                      </th>

                    </tr>


                    <tr>

                      <th
                        colSpan={3}
                        className="cell-right"
                      >
                        Payment Status:
                      </th>

                      <th className="cell-right">

                        {
                          selectedPaymentStatus
                        }

                      </th>

                    </tr>


                    {selectedInvoice.paymentMethod && (

                      <tr>

                        <th
                          colSpan={3}
                          className="cell-right"
                        >
                          Payment Method:
                        </th>

                        <th className="cell-right">

                          {
                            selectedInvoice.paymentMethod
                          }

                        </th>

                      </tr>

                    )}


                    {selectedInvoice.paymentId && (

                      <tr>

                        <th
                          colSpan={3}
                          className="cell-right"
                        >
                          Payment ID:
                        </th>

                        <th className="cell-right">

                          {
                            selectedInvoice.paymentId
                          }

                        </th>

                      </tr>

                    )}

                  </tfoot>

                </table>

              </div>


              {/* =========================================
                  PAYMENT SUMMARY
              ========================================= */}

              <div
                style={{
                  marginTop:
                    "20px",
                  padding:
                    "15px",
                  border:
                    "1px solid #ddd",
                  borderRadius:
                    "8px",
                }}
              >

                <div
                  style={{
                    display:
                      "flex",
                    justifyContent:
                      "space-between",
                    gap:
                      "15px",
                    flexWrap:
                      "wrap",
                  }}
                >

                  <div>

                    <strong>
                      Total
                    </strong>

                    <div>
                      ₹
                      {
                        selectedRepairCost.toFixed(
                          2
                        )
                      }
                    </div>

                  </div>


                  <div>

                    <strong>
                      Paid
                    </strong>

                    <div>
                      ₹
                      {
                        selectedPaidAmount.toFixed(
                          2
                        )
                      }
                    </div>

                  </div>


                  <div>

                    <strong>
                      Balance
                    </strong>

                    <div>
                      ₹
                      {
                        selectedBalanceAmount.toFixed(
                          2
                        )
                      }
                    </div>

                  </div>


                  <div>

                    <strong>
                      Payment Status
                    </strong>

                    <div>

                      {
                        selectedPaymentStatus
                      }

                    </div>

                  </div>

                </div>

              </div>


              {/* =========================================
                  FOOTER
              ========================================= */}

              <div className="invoice-footer-clause">

                <p>
                  Thank you for choosing Zaid Infotech.
                </p>

                <p>
                  30 Days service warranty applies
                  on replaced components and verified
                  service repairs.
                </p>

              </div>

            </div>


            {/* =========================================
                MODAL FOOTER
            ========================================= */}

            <div className="rc-modal-footer no-print">

              <button
                type="button"
                className="rc-btn rc-btn-secondary"
                onClick={() =>
                  setSelectedInvoice(null)
                }
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


// =====================================================
// EXPORT
// =====================================================

export default CusromerTicket;
