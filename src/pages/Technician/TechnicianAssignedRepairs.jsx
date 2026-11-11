// import React, {
//   useCallback,
//   useEffect,
//   useMemo,
//   useState,
// } from "react";

// import axios from "axios";

// import {
//   FiTool,
//   FiSearch,
//   FiPhone,
//   FiMail,
//   FiCalendar,
//   FiCheckCircle,
//   FiClock,
//   FiAlertCircle,
//   FiRefreshCw,
//   FiInbox,
//   FiMonitor,
//   FiMapPin,
//   FiChevronDown,
//   FiChevronUp,
// } from "react-icons/fi";

// import { toast } from "react-toastify";
// import "./TechnicianWorkOrders2.css";

// // ======================================================
// // API CONFIG
// // ======================================================

// const API_URL = import.meta.env.VITE_API_URL;

// const BASE_URL = `${API_URL}/newRepair`;
// const BRANCH_URL = `${API_URL}/branches`;

// const STATUS_OPTIONS = [
//   "Received",
//   "Assigned",
//   "In Progress",
//   "Waiting for Parts",
//   "Completed",
//   "Cancelled",
//   "Delivered",
// ];

// // ======================================================
// // HELPERS
// // ======================================================

// const getAuthToken = () =>
//   localStorage.getItem("token") ||
//   localStorage.getItem("accessToken") ||
//   "";

// const getAuthConfig = () => {
//   const token = getAuthToken();

//   return {
//     headers: {
//       ...(token ? { Authorization: `Bearer ${token}` } : {}),
//     },
//   };
// };

// const getId = (value) => {
//   if (!value) return "";

//   if (typeof value === "object") {
//     return String(
//       value._id ||
//       value.id ||
//       value.$oid ||
//       ""
//     );
//   }

//   return String(value);
// };

// const getDisplayName = (user) =>
//   [
//     user?.firstName,
//     user?.lastName,
//   ]
//     .filter(Boolean)
//     .join(" ")
//     .trim() ||
//   user?.name ||
//   user?.fullName ||
//   "Technician";

// const formatDate = (value) => {
//   if (!value) return "Not Set";

//   const date = new Date(value);

//   if (Number.isNaN(date.getTime())) {
//     return "Not Set";
//   }

//   return date.toLocaleDateString("en-IN", {
//     day: "2-digit",
//     month: "short",
//     year: "numeric",
//   });
// };

// const normalizeStatus = (status) =>
//   String(status || "Received")
//     .trim()
//     .toLowerCase();

// const getStatusClass = (status) =>
//   `tat-status-${normalizeStatus(status).replace(/\s+/g, "-")}`;

// const extractRepairs = (responseData) => {
//   const candidates = [
//     responseData?.repairs,
//     responseData?.data?.repairs,
//     responseData?.data,
//     responseData?.results,
//     responseData,
//   ];

//   return candidates.find(Array.isArray) || [];
// };

// const extractBranches = (responseData) => {
//   const candidates = [
//     responseData?.branches,
//     responseData?.data?.branches,
//     responseData?.data,
//     responseData?.results,
//     responseData,
//   ];

//   return candidates.find(Array.isArray) || [];
// };

// // ======================================================
// // BRANCH HELPERS
// // ======================================================

// const getBranchName = (branch) => {
//   if (!branch) return "";

//   if (typeof branch === "string") {
//     return "";
//   }

//   return (
//     branch.name ||
//     branch.branchName ||
//     branch.title ||
//     branch.locationName ||
//     ""
//   );
// };

// const getBranchCode = (branch) => {
//   if (!branch || typeof branch !== "object") return "";

//   return branch.code || branch.branchCode || "";
// };

// // ======================================================
// // COMPONENT
// // ======================================================

// export default function TechnicianAssignedTasks() {
//   const [repairs, setRepairs] = useState([]);
//   const [branches, setBranches] = useState([]);

//   const [loading, setLoading] = useState(true);
//   const [branchesLoading, setBranchesLoading] = useState(false);

//   const [searchTerm, setSearchTerm] = useState("");
//   const [statusFilter, setStatusFilter] = useState("ALL");

//   const [updatingId, setUpdatingId] = useState(null);

//   // Tracks expanded issue descriptions independently per ticket.
//   const [expandedIssues, setExpandedIssues] = useState({});

//   const loggedInUser = useMemo(() => {
//     try {
//       return JSON.parse(localStorage.getItem("user") || "{}");
//     } catch {
//       return {};
//     }
//   }, []);

//   const loggedInTechId = getId(
//     loggedInUser._id || loggedInUser.id
//   );

//   const loggedInFullName = getDisplayName(
//     loggedInUser
//   ).toLowerCase();

//   // ====================================================
//   // BRANCH LOOKUP
//   // ====================================================

//   const getBranchDetails = useCallback(
//     (repair) => {
//       const branchValue =
//         repair?.branchId ||
//         repair?.branch ||
//         repair?.branchDetails ||
//         null;

//       if (!branchValue) return null;

//       // Populated branch document
//       if (typeof branchValue === "object") {
//         const populatedName = getBranchName(branchValue);

//         if (populatedName) {
//           return branchValue;
//         }
//       }

//       // Plain branch ID
//       const branchId = getId(branchValue);

//       if (!branchId) return null;

//       return (
//         branches.find(
//           (branch) => getId(branch) === branchId
//         ) || null
//       );
//     },
//     [branches]
//   );

//   const getBranchLabel = useCallback(
//     (repair) => {
//       const branchValue =
//         repair?.branchId ||
//         repair?.branch ||
//         repair?.branchDetails ||
//         null;

//       const branch = getBranchDetails(repair);

//       if (branch) {
//         const name = getBranchName(branch);
//         const code = getBranchCode(branch);

//         if (name && code) {
//           return `${name} (${code})`;
//         }

//         return name || code || "Branch";
//       }

//       const branchId = getId(branchValue);

//       if (branchId) {
//         return `Branch ID: ${branchId.slice(-6)}`;
//       }

//       return "Branch not assigned";
//     },
//     [getBranchDetails]
//   );

//   // ====================================================
//   // FETCH BRANCHES
//   // ====================================================

//   const fetchBranches = useCallback(async () => {
//     if (!API_URL || !getAuthToken()) return;

//     try {
//       setBranchesLoading(true);

//       const response = await axios.get(
//         BRANCH_URL,
//         getAuthConfig()
//       );

//       const data = extractBranches(response.data);

//       setBranches(data);

//       console.log("TECHNICIAN BRANCHES:", data);
//     } catch (error) {
//       console.error(
//         "FETCH BRANCHES ERROR:",
//         error.response?.data || error
//       );

//       setBranches([]);
//     } finally {
//       setBranchesLoading(false);
//     }
//   }, []);

//   // ====================================================
//   // FETCH ASSIGNED REPAIRS
//   // ====================================================

//   const fetchAssignedRepairs = useCallback(
//     async ({ showToast = false } = {}) => {
//       if (!API_URL) {
//         toast.error("VITE_API_URL is not configured.");
//         setLoading(false);
//         return;
//       }

//       if (!getAuthToken()) {
//         setRepairs([]);
//         setLoading(false);

//         toast.error(
//           "Session expired. Please log in again."
//         );

//         return;
//       }

//       try {
//         setLoading(true);

//         const response = await axios.get(
//           `${BASE_URL}/my-assigned-repairs`,
//           getAuthConfig()
//         );

//         const data = extractRepairs(response.data);

//         console.log("ASSIGNED REPAIRS RESPONSE:", data);

//         setRepairs(data);

//         if (showToast) {
//           toast.success(
//             "Assigned repair tasks refreshed."
//           );
//         }
//       } catch (error) {
//         console.error(
//           "FETCH ASSIGNED REPAIRS ERROR:",
//           error.response?.data || error
//         );

//         const statusCode = error.response?.status;

//         const message =
//           error.response?.data?.message ||
//           (statusCode === 401
//             ? "Session expired. Please log in again."
//             : statusCode === 403
//               ? "You do not have permission to view these repairs."
//               : "Failed to load assigned repair tasks.");

//         toast.error(message);
//       } finally {
//         setLoading(false);
//       }
//     },
//     []
//   );

//   // ====================================================
//   // INITIAL LOAD
//   // ====================================================

//   useEffect(() => {
//     fetchAssignedRepairs();
//     fetchBranches();
//   }, [fetchAssignedRepairs, fetchBranches]);

//   // ====================================================
//   // VERIFY ASSIGNMENT
//   // ====================================================

//   const myAssignedJobs = useMemo(() => {
//     return repairs.filter((repair) => {
//       const assignedId = getId(
//         repair.assignedTechnician
//       );

//       if (loggedInTechId && assignedId) {
//         return assignedId === loggedInTechId;
//       }

//       const recordName = String(
//         repair.technicianName || ""
//       )
//         .trim()
//         .toLowerCase();

//       return Boolean(
//         loggedInFullName &&
//         recordName &&
//         recordName === loggedInFullName
//       );
//     });
//   }, [
//     repairs,
//     loggedInTechId,
//     loggedInFullName,
//   ]);

//   // ====================================================
//   // SEARCH AND STATUS FILTER
//   // ====================================================

//   const filteredJobs = useMemo(() => {
//     const query = searchTerm.trim().toLowerCase();

//     return myAssignedJobs.filter((job) => {
//       const model = String(
//         job.deviceModel ||
//         job.laptopModel ||
//         ""
//       );

//       const deviceType = String(
//         job.deviceType || ""
//       );

//       const ticketNumber = String(
//         job.repairNumber ||
//         job._id ||
//         ""
//       );

//       const customerName = String(
//         job.customerName || ""
//       );

//       const customerPhone = String(
//         job.customerPhone || ""
//       );

//       const branchName = getBranchLabel(job);

//       const matchesSearch =
//         !query ||
//         customerName.toLowerCase().includes(query) ||
//         customerPhone.includes(query) ||
//         ticketNumber.toLowerCase().includes(query) ||
//         model.toLowerCase().includes(query) ||
//         deviceType.toLowerCase().includes(query) ||
//         String(job.issueDescription || "")
//           .toLowerCase()
//           .includes(query) ||
//         branchName.toLowerCase().includes(query);

//       const matchesStatus =
//         statusFilter === "ALL" ||
//         normalizeStatus(job.status) ===
//           normalizeStatus(statusFilter);

//       return matchesSearch && matchesStatus;
//     });
//   }, [
//     myAssignedJobs,
//     searchTerm,
//     statusFilter,
//     getBranchLabel,
//   ]);

//   // ====================================================
//   // ISSUE MORE / LESS
//   // ====================================================

//   const toggleIssue = (repairId) => {
//     setExpandedIssues((previous) => ({
//       ...previous,
//       [repairId]: !previous[repairId],
//     }));
//   };

//   const ISSUE_PREVIEW_LENGTH = 115;

//   const getIssueText = (job) =>
//     String(
//       job.issueDescription ||
//       job.problemDescription ||
//       job.issue ||
//       ""
//     ).trim();

//   // ====================================================
//   // UPDATE REPAIR STATUS
//   // ====================================================

//   const handleStatusChange = async (
//     repairId,
//     newStatus
//   ) => {
//     if (!repairId || !newStatus) return;

//     const existingRepair = repairs.find(
//       (repair) => repair._id === repairId
//     );

//     if (!existingRepair) {
//       toast.error("Repair ticket not found.");
//       return;
//     }

//     if (existingRepair.status === newStatus) {
//       return;
//     }

//     try {
//       setUpdatingId(repairId);

//       const response = await axios.patch(
//         `${BASE_URL}/${repairId}/status`,
//         { status: newStatus },
//         getAuthConfig()
//       );

//       const updatedRepair =
//         response.data?.data ||
//         response.data?.repair;

//       setRepairs((previousRepairs) =>
//         previousRepairs.map((repair) =>
//           repair._id === repairId
//             ? {
//                 ...repair,
//                 ...(updatedRepair || {}),
//                 status:
//                   updatedRepair?.status || newStatus,
//               }
//             : repair
//         )
//       );

//       toast.success(
//         `Repair status updated to "${newStatus}".`
//       );
//     } catch (error) {
//       console.error(
//         "UPDATE REPAIR STATUS ERROR:",
//         error.response?.data || error
//       );

//       toast.error(
//         error.response?.data?.message ||
//         "Failed to update repair status."
//       );
//     } finally {
//       setUpdatingId(null);
//     }
//   };

//   // ====================================================
//   // SUMMARY COUNTS
//   // ====================================================

//   const pendingCount = myAssignedJobs.filter((job) =>
//     [
//       "received",
//       "assigned",
//       "in progress",
//       "waiting for parts",
//     ].includes(normalizeStatus(job.status))
//   ).length;

//   const completedCount = myAssignedJobs.filter((job) =>
//     [
//       "completed",
//       "delivered",
//     ].includes(normalizeStatus(job.status))
//   ).length;

//   // ====================================================
//   // RENDER
//   // ====================================================

//   return (
//     <div className="tat-container">

//       {/* HEADER */}

//       <header className="tat-header">
//         <div>
//           <span className="tat-eyebrow">
//             TECHNICIAN WORKBENCH
//           </span>

//           <h1>My Assigned Repair Tasks</h1>

//           <p>
//             Logged in as:{" "}
//             <strong>
//               {getDisplayName(loggedInUser)}
//             </strong>{" "}
//             • Review and update device repairs assigned
//             to you.
//           </p>
//         </div>

//         <button
//           type="button"
//           className="tat-btn-refresh"
//           onClick={() => {
//             fetchAssignedRepairs({ showToast: true });
//             fetchBranches();
//           }}
//           disabled={loading}
//         >
//           <FiRefreshCw
//             className={loading ? "tat-spin" : ""}
//           />

//           <span>
//             {loading ? "Syncing..." : "Sync Tasks"}
//           </span>
//         </button>
//       </header>

//       {/* SUMMARY CARDS */}

//       <section className="tat-metrics">

//         <div className="tat-metric-card">
//           <div className="tat-metric-icon icon-blue">
//             <FiTool />
//           </div>

//           <div>
//             <span className="tat-metric-label">
//               Total Assigned Jobs
//             </span>

//             <strong className="tat-metric-count">
//               {myAssignedJobs.length}
//             </strong>
//           </div>
//         </div>

//         <div className="tat-metric-card">
//           <div className="tat-metric-icon icon-amber">
//             <FiClock />
//           </div>

//           <div>
//             <span className="tat-metric-label">
//               In Progress / Pending
//             </span>

//             <strong className="tat-metric-count">
//               {pendingCount}
//             </strong>
//           </div>
//         </div>

//         <div className="tat-metric-card">
//           <div className="tat-metric-icon icon-green">
//             <FiCheckCircle />
//           </div>

//           <div>
//             <span className="tat-metric-label">
//               Completed / Delivered
//             </span>

//             <strong className="tat-metric-count">
//               {completedCount}
//             </strong>
//           </div>
//         </div>

//       </section>

//       {/* TASK TABLE */}

//       <section className="tat-card">

//         <div className="tat-toolbar">

//           <div className="tat-search-wrap">
//             <FiSearch className="tat-search-ico" />

//             <input
//               type="text"
//               placeholder="Search customer, phone, device, ticket, branch..."
//               value={searchTerm}
//               onChange={(event) =>
//                 setSearchTerm(event.target.value)
//               }
//             />
//           </div>

//           <div className="tat-filter-wrap">
//             <select
//               value={statusFilter}
//               onChange={(event) =>
//                 setStatusFilter(event.target.value)
//               }
//               className="tat-select"
//             >
//               <option value="ALL">
//                 All Statuses
//               </option>

//               {STATUS_OPTIONS.map((status) => (
//                 <option key={status} value={status}>
//                   {status}
//                 </option>
//               ))}
//             </select>
//           </div>

//         </div>

//         {loading ? (
//           <div className="tat-state-box">
//             <div className="tat-spinner" />
//             <p>Loading your assigned repair tickets...</p>
//           </div>
//         ) : filteredJobs.length === 0 ? (
//           <div className="tat-state-box">
//             <div className="tat-empty-icon">
//               <FiInbox />
//             </div>

//             <h3>No Assigned Jobs Found</h3>

//             <p>
//               There are currently no repair tickets assigned
//               to your profile, or no tickets match your filters.
//             </p>
//           </div>
//         ) : (
//           <div className="tat-table-wrap">

//             <table className="tat-table">

//               <thead>
//                 <tr>
//                   <th>Job Ticket</th>
//                   <th>Customer Information</th>
//                   <th>Device / Hardware</th>
//                   <th>Branch</th>
//                   <th>Reported Issue</th>
//                   <th>Counter Remarks</th>
//                   <th>Job Date</th>
//                   <th>Est. Target Date</th>
//                   <th>Current Status</th>
//                   <th className="tat-th-right">
//                     Update Status
//                   </th>
//                 </tr>
//               </thead>

//               <tbody>
//                 {filteredJobs.map((job) => {
//                   const issueText = getIssueText(job);
//                   const isExpanded =
//                     Boolean(expandedIssues[job._id]);

//                   const isLongIssue =
//                     issueText.length > ISSUE_PREVIEW_LENGTH;

//                   const displayedIssue =
//                     isLongIssue && !isExpanded
//                       ? `${issueText.slice(
//                           0,
//                           ISSUE_PREVIEW_LENGTH
//                         ).trim()}...`
//                       : issueText;

//                   return (
//                     <tr key={job._id}>

//                       {/* JOB TICKET */}

//                       <td>
//                         <span className="tat-ticket-code">
//                           {job.repairNumber ||
//                             job._id?.slice(-6).toUpperCase() ||
//                             "N/A"}
//                         </span>
//                       </td>

//                       {/* CUSTOMER */}

//                       <td>
//                         <div className="tat-customer-cell">
//                           <strong>
//                             {job.customerName ||
//                               "Walk-in Customer"}
//                           </strong>

//                           <span className="tat-sub-txt">
//                             <FiPhone />
//                             {job.customerPhone || "No phone"}
//                           </span>

//                           {job.customerEmail && (
//                             <span className="tat-sub-txt">
//                               <FiMail />
//                               {job.customerEmail}
//                             </span>
//                           )}
//                         </div>
//                       </td>

//                       {/* DEVICE */}

//                       <td>
//                         <div className="tat-customer-cell">
//                           <strong className="tat-device-name">
//                             {job.deviceType || "Device"}
//                           </strong>

//                           <span className="tat-sub-txt">
//                             <FiMonitor />
//                             {job.deviceModel ||
//                               job.laptopModel ||
//                               "Hardware not specified"}
//                           </span>

//                           {job.serialNumber && (
//                             <span className="tat-sub-txt">
//                               S/N: {job.serialNumber}
//                             </span>
//                           )}
//                         </div>
//                       </td>

//                       {/* BRANCH */}

//                       <td>
//                         <div className="tat-branch-cell">
//                           <span className="tat-branch-icon">
//                             <FiMapPin />
//                           </span>

//                           <div className="tat-branch-details">
//                             <strong>
//                               {getBranchLabel(job)}
//                             </strong>

//                             {getBranchDetails(job)?.address && (
//                               <span>
//                                 {getBranchDetails(job).address}
//                               </span>
//                             )}

//                             {branchesLoading && (
//                               <small>Loading branch...</small>
//                             )}
//                           </div>
//                         </div>
//                       </td>

//                       {/* REPORTED ISSUE + MORE / LESS */}

//                       <td className="tat-issue-col">
//                         <div className="tat-issue-box">
//                           <FiAlertCircle className="tat-issue-icon" />

//                           <div className="tat-issue-content">
//                             <span className="tat-issue-text">
//                               {displayedIssue ||
//                                 "No issue details"}
//                             </span>

//                             {isLongIssue && (
//                               <button
//                                 type="button"
//                                 className="tat-more-btn"
//                                 onClick={() =>
//                                   toggleIssue(job._id)
//                                 }
//                               >
//                                 {isExpanded ? (
//                                   <>
//                                     Less <FiChevronUp />
//                                   </>
//                                 ) : (
//                                   <>
//                                     More <FiChevronDown />
//                                   </>
//                                 )}
//                               </button>
//                             )}
//                           </div>
//                         </div>
//                       </td>

//                       {/* COUNTER REMARKS */}

//                       <td className="tat-remarks-col">
//                         {job.remarks ? (
//                           <span className="tat-remarks-tag">
//                             {job.remarks}
//                           </span>
//                         ) : (
//                           <span className="tat-muted-dash">
//                             —
//                           </span>
//                         )}
//                       </td>

//                       {/* JOB DATE */}

//                       <td>
//                         <span className="tat-date-badge">
//                           <FiCalendar />
//                           {formatDate(
//                             job.jobDate || job.createdAt
//                           )}
//                         </span>
//                       </td>

//                       {/* TARGET DATE */}

//                       <td>
//                         <span className="tat-date-badge">
//                           <FiCalendar />
//                           {formatDate(
//                             job.estimatedCompletionDate
//                           )}
//                         </span>
//                       </td>

//                       {/* STATUS */}

//                       <td>
//                         <span
//                           className={`tat-status-pill ${getStatusClass(
//                             job.status
//                           )}`}
//                         >
//                           {job.status || "Received"}
//                         </span>
//                       </td>

//                       {/* UPDATE STATUS */}

//                       <td className="tat-td-right">
//                         <select
//                           className="tat-status-changer"
//                           value={job.status || "Received"}
//                           disabled={updatingId === job._id}
//                           onChange={(event) =>
//                             handleStatusChange(
//                               job._id,
//                               event.target.value
//                             )
//                           }
//                         >
//                           {STATUS_OPTIONS.map((status) => (
//                             <option
//                               key={status}
//                               value={status}
//                             >
//                               {status}
//                             </option>
//                           ))}
//                         </select>

//                         {updatingId === job._id && (
//                           <span className="tat-sub-txt tat-updating">
//                             Updating...
//                           </span>
//                         )}
//                       </td>

//                     </tr>
//                   );
//                 })}
//               </tbody>

//             </table>
//           </div>
//         )}

//         <div className="tat-table-footer">
//           Showing {filteredJobs.length} of {myAssignedJobs.length} assigned tasks
//         </div>

//       </section>
//     </div>
//   );
// }



import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import axios from "axios";

import {
  FiTool,
  FiSearch,
  FiPhone,
  FiMail,
  FiCalendar,
  FiCheckCircle,
  FiClock,
  FiAlertCircle,
  FiRefreshCw,
  FiInbox,
  FiMonitor,
  FiMapPin,
  FiChevronDown,
  FiChevronUp,
  FiFilter,
  FiX,
} from "react-icons/fi";

import { toast } from "react-toastify";
import "./TechnicianWorkOrders2.css";

import { saveTechnicianNotes } from "../../services/repairJobService";

import TransferJobModal from "../../components/repair/TransferJobModal";

import { WarrantyBadge } from "../../components/repair/JobExtraFields";

import { getAllBranches } from "../../services/branchService";

// ======================================================
// API CONFIG
// ======================================================

const API_URL = String(
  import.meta.env.VITE_API_URL || ""
).replace(/\/+$/, "");

const BASE_URL = `${API_URL}/newRepair`;

const STATUS_OPTIONS = [
  "Received",
  "Assigned",
  "In Progress",
  "Waiting for Parts",
  "Completed",
  "Cancelled",
  "Delivered",
];

// Same device list as the New Repair Intake form
const DEVICE_TYPE_OPTIONS = [
  "Laptop",
  "Desktop",
  "Printer",
  "Monitor",
  "Other",
];

const SORT_OPTIONS = [
  { value: "newest", label: "Job Date: Newest First" },
  { value: "oldest", label: "Job Date: Oldest First" },
  { value: "target", label: "Target Date: Nearest First" },
  { value: "customer", label: "Customer: A to Z" },
  { value: "status", label: "Status" },
];

const CLOSED_STATUSES = [
  "completed",
  "delivered",
  "cancelled",
];

// ======================================================
// AUTH HELPERS
// ======================================================

const getAuthToken = () =>
  localStorage.getItem("token") ||
  localStorage.getItem("accessToken") ||
  "";

const getAuthConfig = () => {
  const token = getAuthToken();

  return {
    headers: {
      ...(token
        ? { Authorization: `Bearer ${token}` }
        : {}),
    },
  };
};

// ======================================================
// COMMON HELPERS
// ======================================================

const getId = (value) => {
  if (!value) return "";

  if (typeof value === "object") {
    return String(
      value._id ||
      value.id ||
      value.$oid ||
      ""
    );
  }

  return String(value);
};

const getDisplayName = (user) =>
  [
    user?.firstName,
    user?.lastName,
  ]
    .filter(Boolean)
    .join(" ")
    .trim() ||
  user?.name ||
  user?.fullName ||
  user?.username ||
  "Technician";

const formatDate = (value) => {
  if (!value) return "Not Set";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not Set";
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const normalizeStatus = (status) =>
  String(status || "Received")
    .trim()
    .toLowerCase();

const getStatusClass = (status) =>
  `tat-status-${normalizeStatus(status).replace(/\s+/g, "-")}`;

// ======================================================
// FILTER HELPERS
// ======================================================

const toTime = (value) => {
  if (!value) return null;

  const time = new Date(value).getTime();

  return Number.isNaN(time) ? null : time;
};

const getStartOfToday = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today.getTime();
};

const getJobDateValue = (job) =>
  job?.jobDate || job?.createdAt || null;

const getTargetDateValue = (job) =>
  job?.estimatedCompletionDate || null;

const getDeviceTypeValue = (job) =>
  String(job?.deviceType || "").trim();

/**
 * Returns "in", "out" or "unknown".
 * Reads the common warranty field names. If your repair
 * record uses a different field, add it here (it should
 * match what <WarrantyBadge /> reads).
 */
const getWarrantyState = (job) => {
  const flag =
    job?.inWarranty ??
    job?.isInWarranty ??
    job?.isUnderWarranty ??
    job?.underWarranty;

  if (typeof flag === "boolean") {
    return flag ? "in" : "out";
  }

  if (typeof job?.warranty === "boolean") {
    return job.warranty ? "in" : "out";
  }

  const text = String(
    job?.warrantyStatus ||
    job?.warrantyType ||
    (typeof job?.warranty === "string"
      ? job.warranty
      : "") ||
    ""
  )
    .trim()
    .toLowerCase();

  if (text) {
    // Exact values used by the New Repair Intake form
    if (text === "under warranty") return "in";
    if (text === "out of warranty") return "out";
    if (text === "not specified") return "unknown";

    if (/(out|expired|void|no warranty|none)/.test(text)) {
      return "out";
    }

    if (/(in warranty|under|active|valid|yes)/.test(text)) {
      return "in";
    }
  }

  const endTime = toTime(
    job?.warrantyEndDate ||
    job?.warrantyExpiryDate ||
    job?.warrantyExpiry ||
    job?.warranty?.endDate ||
    job?.warranty?.expiryDate
  );

  if (endTime !== null) {
    return endTime >= getStartOfToday() ? "in" : "out";
  }

  return "unknown";
};

const isOverdue = (job) => {
  if (CLOSED_STATUSES.includes(normalizeStatus(job?.status))) {
    return false;
  }

  const target = toTime(getTargetDateValue(job));

  return target !== null && target < getStartOfToday();
};

// ======================================================
// RESPONSE EXTRACTION HELPERS
// ======================================================

const extractRepairs = (responseData) => {
  const candidates = [
    responseData?.repairs,
    responseData?.data?.repairs,
    responseData?.data?.data?.repairs,
    responseData?.results,
    responseData?.data?.results,
    responseData?.data,
    responseData,
  ];

  return candidates.find(Array.isArray) || [];
};

const extractBranches = (responseData) => {
  const candidates = [
    responseData?.branches,
    responseData?.data?.branches,
    responseData?.data?.data?.branches,
    responseData?.results,
    responseData?.data?.results,
    responseData?.data,
    responseData,
  ];

  return candidates.find(Array.isArray) || [];
};

// ======================================================
// BRANCH HELPERS
// ======================================================

const getBranchName = (branch) => {
  if (!branch || typeof branch !== "object") {
    return "";
  }

  return (
    branch.name ||
    branch.branchName ||
    branch.title ||
    branch.locationName ||
    ""
  );
};

const getBranchCode = (branch) => {
  if (!branch || typeof branch !== "object") {
    return "";
  }

  return (
    branch.code ||
    branch.branchCode ||
    ""
  );
};

const getBranchAddress = (branch) => {
  if (!branch || typeof branch !== "object") {
    return "";
  }

  const address = branch.address;

  if (typeof address === "string") {
    return address;
  }

  if (address && typeof address === "object") {
    return [
      address.addressLine1,
      address.addressLine2,
      address.street,
      address.city,
      address.state,
      address.pincode,
    ]
      .filter(Boolean)
      .join(", ");
  }

  return [
    branch.addressLine1,
    branch.addressLine2,
    branch.city,
    branch.state,
    branch.pincode,
  ]
    .filter(Boolean)
    .join(", ");
};

const getBranchPhone = (branch) =>
  branch?.phone ||
  branch?.phoneNumber ||
  branch?.mobile ||
  "";

const getBranchEmail = (branch) =>
  branch?.email ||
  branch?.branchEmail ||
  "";

const getBranchCityState = (branch) =>
  [
    branch?.city,
    branch?.state,
  ]
    .filter(Boolean)
    .join(", ");

const getRepairBranchValue = (repair) =>
  repair?.branchId ||
  repair?.branch ||
  repair?.branchDetails ||
  repair?.branchInfo ||
  null;

// ======================================================
// COMPONENT
// ======================================================

export default function TechnicianAssignedTasks() {
  const [repairs, setRepairs] = useState([]);
  const [branches, setBranches] = useState([]);

  const [loading, setLoading] = useState(true);
  const [branchesLoading, setBranchesLoading] = useState(false);

  // Search, filters and sort
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [branchFilter, setBranchFilter] = useState("ALL");
  const [deviceTypeFilter, setDeviceTypeFilter] = useState("ALL");
  const [warrantyFilter, setWarrantyFilter] = useState("ALL");
  const [dateField, setDateField] = useState("job");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [sortBy, setSortBy] = useState("newest");
  const [showFilters, setShowFilters] = useState(true);

  const [updatingId, setUpdatingId] = useState(null);

  // Expanded issue descriptions
  const [expandedIssues, setExpandedIssues] = useState({});

  // Technician notes (draft text per job)
  const [notesDraft, setNotesDraft] = useState({});
  const [savingNotesId, setSavingNotesId] = useState(null);

  // Transfer job modal
  const [transferJob, setTransferJob] = useState(null);

  // ====================================================
  // LOGGED-IN USER
  // ====================================================

  const loggedInUser = useMemo(() => {
    try {
      return JSON.parse(
        localStorage.getItem("user") || "{}"
      );
    } catch {
      return {};
    }
  }, []);

  const loggedInTechId = getId(
    loggedInUser._id || loggedInUser.id
  );

  const loggedInFullName = getDisplayName(
    loggedInUser
  ).toLowerCase();

  // ====================================================
  // BRANCH LOOKUP
  // ====================================================

  const getBranchDetails = useCallback(
    (repair) => {
      const branchValue = getRepairBranchValue(repair);

      if (!branchValue) {
        return null;
      }

      // Case 1: Populated branch document
      if (
        typeof branchValue === "object" &&
        !Array.isArray(branchValue)
      ) {
        const populatedName = getBranchName(branchValue);

        if (populatedName) {
          return branchValue;
        }
      }

      // Case 2: Branch ID stored as string or object
      const branchId = getId(branchValue);

      if (!branchId) {
        return null;
      }

      const foundBranch = branches.find(
        (branch) => getId(branch) === branchId
      );

      if (foundBranch) {
        return foundBranch;
      }

      // Case 3: Branch object exists but is not fully populated.
      if (
        typeof branchValue === "object" &&
        !Array.isArray(branchValue)
      ) {
        return branchValue;
      }

      return null;
    },
    [branches]
  );

  // ====================================================
  // BRANCH LABEL
  // ====================================================

  const getBranchLabel = useCallback(
    (repair) => {
      const branchValue = getRepairBranchValue(repair);
      const branch = getBranchDetails(repair);

      if (branch) {
        const name = getBranchName(branch);
        const code = getBranchCode(branch);

        if (name && code) {
          return `${name} (${code})`;
        }

        if (name) {
          return name;
        }

        if (code) {
          return code;
        }
      }

      const branchId = getId(branchValue);

      if (branchId) {
        return `Branch ID: ${branchId.slice(-6)}`;
      }

      // Legacy fallback, if old records stored branch name directly.
      if (repair?.branchName) {
        return repair.branchName;
      }

      return "Branch not assigned";
    },
    [getBranchDetails]
  );

  // ====================================================
  // FETCH BRANCHES
  // ====================================================

  const fetchBranches = useCallback(async () => {
    if (!API_URL) {
      console.warn(
        "VITE_API_URL is not configured. Branches cannot be loaded."
      );
      return;
    }

    if (!getAuthToken()) {
      return;
    }

    try {
      setBranchesLoading(true);

      const response = await getAllBranches();

      const data = extractBranches(response.data);

      // Remove deleted/invalid records.
      // Keep inactive branches too because older repair
      // tickets may belong to a branch that is now inactive.
      const validBranches = data.filter(
        (branch) =>
          branch &&
          typeof branch === "object" &&
          branch.isDeleted !== true
      );

      setBranches(validBranches);

      console.log(
        "TECHNICIAN BRANCHES:",
        validBranches
      );
    } catch (error) {
      console.error(
        "FETCH BRANCHES ERROR:",
        error.response?.data || error
      );

      setBranches([]);

      const statusCode = error.response?.status;

      if (statusCode === 401) {
        toast.error(
          "Session expired. Please log in again."
        );
      } else if (statusCode === 403) {
        console.warn(
          "Logged-in technician does not have permission to access the branch list."
        );
      }
    } finally {
      setBranchesLoading(false);
    }
  }, []);

  // ====================================================
  // FETCH ASSIGNED REPAIRS
  // ====================================================

  const fetchAssignedRepairs = useCallback(
    async ({ showToast = false } = {}) => {
      if (!API_URL) {
        toast.error(
          "VITE_API_URL is not configured."
        );

        setLoading(false);
        return;
      }

      if (!getAuthToken()) {
        setRepairs([]);
        setLoading(false);

        toast.error(
          "Session expired. Please log in again."
        );

        return;
      }

      try {
        setLoading(true);

        const response = await axios.get(
          `${BASE_URL}/my-assigned-repairs`,
          getAuthConfig()
        );

        const data = extractRepairs(response.data);

        console.log(
          "ASSIGNED REPAIRS RESPONSE:",
          response.data
        );

        console.log(
          "EXTRACTED ASSIGNED REPAIRS:",
          data
        );

        setRepairs(data);

        if (showToast) {
          toast.success(
            "Assigned repair tasks refreshed."
          );
        }
      } catch (error) {
        console.error(
          "FETCH ASSIGNED REPAIRS ERROR:",
          error.response?.data || error
        );

        const statusCode = error.response?.status;

        const message =
          error.response?.data?.message ||
          (statusCode === 401
            ? "Session expired. Please log in again."
            : statusCode === 403
              ? "You do not have permission to view these repairs."
              : "Failed to load assigned repair tasks.");

        toast.error(message);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // ====================================================
  // INITIAL LOAD
  // ====================================================

  useEffect(() => {
    fetchAssignedRepairs();
    fetchBranches();
  }, [
    fetchAssignedRepairs,
    fetchBranches,
  ]);

  // ====================================================
  // VERIFY ASSIGNMENT
  // ====================================================

  const myAssignedJobs = useMemo(() => {
    return repairs.filter((repair) => {
      const assignedId = getId(
        repair.assignedTechnician
      );

      // Primary check: technician ID
      if (loggedInTechId && assignedId) {
        return assignedId === loggedInTechId;
      }

      // Fallback: technician name
      const recordName = String(
        repair.technicianName || ""
      )
        .trim()
        .toLowerCase();

      return Boolean(
        loggedInFullName &&
        recordName &&
        recordName === loggedInFullName
      );
    });
  }, [
    repairs,
    loggedInTechId,
    loggedInFullName,
  ]);

  // ====================================================
  // FILTER DROPDOWN OPTIONS (built from the technician's
  // own jobs, so they work even if /branches is forbidden)
  // ====================================================

  const branchOptions = useMemo(() => {
    const map = new Map();

    // 1) Every branch returned by getAllBranches()
    branches.forEach((branch) => {
      const id = getId(branch);

      if (!id || map.has(id)) return;

      const name = getBranchName(branch);
      const code = getBranchCode(branch);

      map.set(
        id,
        name && code
          ? `${name} (${code})`
          : name || code || `Branch ID: ${id.slice(-6)}`
      );
    });

    // 2) Any branch found on the technician's own jobs
    //    (keeps the filter working if the branch list is empty)
    myAssignedJobs.forEach((job) => {
      const id = getId(getRepairBranchValue(job));

      if (!id || map.has(id)) return;

      map.set(id, getBranchLabel(job));
    });

    return Array.from(map, ([value, label]) => ({
      value,
      label,
    })).sort((a, b) =>
      a.label.localeCompare(b.label)
    );
  }, [branches, myAssignedJobs, getBranchLabel]);

  const deviceTypeOptions = useMemo(() => {
    // Always show the standard devices, in intake-form order
    const base = DEVICE_TYPE_OPTIONS.map((label) => ({
      value: label.toLowerCase(),
      label,
    }));

    const known = new Set(base.map((option) => option.value));
    const extras = new Map();

    // Plus any other device type found on the jobs
    myAssignedJobs.forEach((job) => {
      const type = getDeviceTypeValue(job);

      if (!type) return;

      const key = type.toLowerCase();

      if (!known.has(key) && !extras.has(key)) {
        extras.set(key, type);
      }
    });

    const extraOptions = Array.from(
      extras,
      ([value, label]) => ({ value, label })
    ).sort((a, b) => a.label.localeCompare(b.label));

    return [...base, ...extraOptions];
  }, [myAssignedJobs]);

  // ====================================================
  // SEARCH, FILTERS AND SORT
  // ====================================================

  const filteredJobs = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    const fromTime = dateFrom
      ? new Date(`${dateFrom}T00:00:00`).getTime()
      : null;

    const toTimeLimit = dateTo
      ? new Date(`${dateTo}T23:59:59.999`).getTime()
      : null;

    const result = myAssignedJobs.filter((job) => {
      const model = String(
        job.deviceModel ||
        job.laptopModel ||
        ""
      );

      const deviceType = getDeviceTypeValue(job);

      const ticketNumber = String(
        job.repairNumber ||
        job._id ||
        ""
      );

      const customerName = String(
        job.customerName || ""
      );

      const customerPhone = String(
        job.customerPhone || ""
      );

      const customerEmail = String(
        job.customerEmail || ""
      );

      const serialNumber = String(
        job.serialNumber || ""
      );

      const deviceBrand = String(
        job.deviceBrand || ""
      );

      const branchName = getBranchLabel(job);

      const branch = getBranchDetails(job);

      const branchAddress = getBranchAddress(branch);

      const branchCode = getBranchCode(branch);

      // ---------- Search ----------

      const matchesSearch =
        !query ||
        customerName.toLowerCase().includes(query) ||
        customerPhone.includes(query) ||
        customerEmail.toLowerCase().includes(query) ||
        ticketNumber.toLowerCase().includes(query) ||
        serialNumber.toLowerCase().includes(query) ||
        deviceBrand.toLowerCase().includes(query) ||
        model.toLowerCase().includes(query) ||
        deviceType.toLowerCase().includes(query) ||
        String(job.issueDescription || "")
          .toLowerCase()
          .includes(query) ||
        String(job.remarks || "")
          .toLowerCase()
          .includes(query) ||
        String(job.technicianNotes || "")
          .toLowerCase()
          .includes(query) ||
        branchName.toLowerCase().includes(query) ||
        branchAddress.toLowerCase().includes(query) ||
        branchCode.toLowerCase().includes(query);

      if (!matchesSearch) return false;

      // ---------- Status ----------

      if (
        statusFilter !== "ALL" &&
        normalizeStatus(job.status) !==
          normalizeStatus(statusFilter)
      ) {
        return false;
      }

      // ---------- Branch ----------

      if (
        branchFilter !== "ALL" &&
        getId(getRepairBranchValue(job)) !== branchFilter
      ) {
        return false;
      }

      // ---------- Device type ----------

      if (
        deviceTypeFilter !== "ALL" &&
        deviceType.toLowerCase() !== deviceTypeFilter
      ) {
        return false;
      }

      // ---------- Warranty ----------

      if (
        warrantyFilter !== "ALL" &&
        getWarrantyState(job) !== warrantyFilter
      ) {
        return false;
      }

      // ---------- Overdue ----------

      if (overdueOnly && !isOverdue(job)) {
        return false;
      }

      // ---------- Date range ----------

      if (fromTime !== null || toTimeLimit !== null) {
        const jobTime = toTime(
          dateField === "target"
            ? getTargetDateValue(job)
            : getJobDateValue(job)
        );

        if (jobTime === null) return false;

        if (fromTime !== null && jobTime < fromTime) {
          return false;
        }

        if (
          toTimeLimit !== null &&
          jobTime > toTimeLimit
        ) {
          return false;
        }
      }

      return true;
    });

    // ---------- Sort ----------

    const sorted = [...result];

    const byDate = (getter, direction) => (a, b) => {
      const timeA = toTime(getter(a));
      const timeB = toTime(getter(b));

      // Records without a date always go last
      if (timeA === null && timeB === null) return 0;
      if (timeA === null) return 1;
      if (timeB === null) return -1;

      return direction === "asc"
        ? timeA - timeB
        : timeB - timeA;
    };

    switch (sortBy) {
      case "oldest":
        sorted.sort(byDate(getJobDateValue, "asc"));
        break;

      case "target":
        sorted.sort(byDate(getTargetDateValue, "asc"));
        break;

      case "customer":
        sorted.sort((a, b) =>
          String(a.customerName || "").localeCompare(
            String(b.customerName || ""),
            undefined,
            { sensitivity: "base" }
          )
        );
        break;

      case "status":
        sorted.sort((a, b) => {
          const indexA = STATUS_OPTIONS.findIndex(
            (status) =>
              normalizeStatus(status) ===
              normalizeStatus(a.status)
          );

          const indexB = STATUS_OPTIONS.findIndex(
            (status) =>
              normalizeStatus(status) ===
              normalizeStatus(b.status)
          );

          return indexA - indexB;
        });
        break;

      case "newest":
      default:
        sorted.sort(byDate(getJobDateValue, "desc"));
        break;
    }

    return sorted;
  }, [
    myAssignedJobs,
    searchTerm,
    statusFilter,
    branchFilter,
    deviceTypeFilter,
    warrantyFilter,
    overdueOnly,
    dateField,
    dateFrom,
    dateTo,
    sortBy,
    getBranchLabel,
    getBranchDetails,
  ]);

  // ====================================================
  // ACTIVE FILTER COUNT + CLEAR
  // ====================================================

  const activeFilterCount = [
    statusFilter !== "ALL",
    branchFilter !== "ALL",
    deviceTypeFilter !== "ALL",
    warrantyFilter !== "ALL",
    overdueOnly,
    Boolean(dateFrom || dateTo),
  ].filter(Boolean).length;

  const hasActiveFilters =
    activeFilterCount > 0 ||
    searchTerm.trim() !== "" ||
    sortBy !== "newest";

  const clearAllFilters = () => {
    setSearchTerm("");
    setStatusFilter("ALL");
    setBranchFilter("ALL");
    setDeviceTypeFilter("ALL");
    setWarrantyFilter("ALL");
    setDateField("job");
    setDateFrom("");
    setDateTo("");
    setOverdueOnly(false);
    setSortBy("newest");
  };

  // ====================================================
  // ISSUE MORE / LESS
  // ====================================================

  const toggleIssue = (repairId) => {
    setExpandedIssues((previous) => ({
      ...previous,
      [repairId]: !previous[repairId],
    }));
  };

  const ISSUE_PREVIEW_LENGTH = 115;

  const getIssueText = (job) =>
    String(
      job.issueDescription ||
      job.problemDescription ||
      job.issue ||
      ""
    ).trim();

  // ====================================================
  // UPDATE REPAIR STATUS
  // ====================================================

  const handleStatusChange = async (
    repairId,
    newStatus
  ) => {
    if (!repairId || !newStatus) {
      return;
    }

    const existingRepair = repairs.find(
      (repair) => repair._id === repairId
    );

    if (!existingRepair) {
      toast.error("Repair ticket not found.");
      return;
    }

    if (
      normalizeStatus(existingRepair.status) ===
      normalizeStatus(newStatus)
    ) {
      return;
    }

    try {
      setUpdatingId(repairId);

      const response = await axios.patch(
        `${BASE_URL}/${repairId}/status`,
        {
          status: newStatus,
        },
        getAuthConfig()
      );

      const updatedRepair =
        response.data?.repair ||
        response.data?.data?.repair ||
        response.data?.data ||
        null;

      setRepairs((previousRepairs) =>
        previousRepairs.map((repair) =>
          repair._id === repairId
            ? {
                ...repair,
                ...(updatedRepair &&
                typeof updatedRepair === "object"
                  ? updatedRepair
                  : {}),
                status:
                  updatedRepair?.status || newStatus,
              }
            : repair
        )
      );

      toast.success(
        `Repair status updated to "${newStatus}".`
      );
    } catch (error) {
      console.error(
        "UPDATE REPAIR STATUS ERROR:",
        error.response?.data || error
      );

      toast.error(
        error.response?.data?.message ||
        "Failed to update repair status."
      );
    } finally {
      setUpdatingId(null);
    }
  };

  // ====================================================
  // TECHNICIAN NOTES
  // ====================================================

  const getNotesValue = (job) =>
    notesDraft[job._id] !== undefined
      ? notesDraft[job._id]
      : job.technicianNotes || "";

  const handleSaveNotes = async (job) => {
    const text = String(getNotesValue(job)).trim();

    if (text === String(job.technicianNotes || "").trim()) {
      toast.info("No changes to save.");
      return;
    }

    try {
      setSavingNotesId(job._id);

      await saveTechnicianNotes(job._id, text);

      setRepairs((previous) =>
        previous.map((repair) =>
          repair._id === job._id
            ? { ...repair, technicianNotes: text }
            : repair
        )
      );

      setNotesDraft((previous) => {
        const next = { ...previous };
        delete next[job._id];
        return next;
      });

      toast.success("Technician notes saved.");
    } catch (error) {
      toast.error(
        error?.response?.data?.message ||
          "Failed to save technician notes."
      );
    } finally {
      setSavingNotesId(null);
    }
  };

  // ====================================================
  // TRANSFER JOB
  // ====================================================

  const handleTransferred = async () => {
    setTransferJob(null);

    await fetchAssignedRepairs();
  };

  // ====================================================
  // SUMMARY COUNTS
  // ====================================================

  const pendingCount = myAssignedJobs.filter(
    (job) =>
      [
        "received",
        "assigned",
        "in progress",
        "waiting for parts",
      ].includes(normalizeStatus(job.status))
  ).length;

  const completedCount = myAssignedJobs.filter(
    (job) =>
      [
        "completed",
        "delivered",
      ].includes(normalizeStatus(job.status))
  ).length;

  // ====================================================
  // RENDER
  // ====================================================

  return (
    <div className="tat-container">

      {/* HEADER */}

      <header className="tat-header">
        <div>
          <span className="tat-eyebrow">
            TECHNICIAN WORKBENCH
          </span>

          <h1>My Assigned Repair Tasks</h1>

          <p>
            Logged in as:{" "}
            <strong>
              {getDisplayName(loggedInUser)}
            </strong>{" "}
            • Review and update device repairs assigned
            to you.
          </p>
        </div>

        <button
          type="button"
          className="tat-btn-refresh"
          onClick={() => {
            fetchAssignedRepairs({
              showToast: true,
            });

            fetchBranches();
          }}
          disabled={loading}
        >
          <FiRefreshCw
            className={loading ? "tat-spin" : ""}
          />

          <span>
            {loading ? "Syncing..." : "Sync Tasks"}
          </span>
        </button>
      </header>

      {/* SUMMARY CARDS */}

      <section className="tat-metrics">

        <div className="tat-metric-card">
          <div className="tat-metric-icon icon-blue">
            <FiTool />
          </div>

          <div>
            <span className="tat-metric-label">
              Total Assigned Jobs
            </span>

            <strong className="tat-metric-count">
              {myAssignedJobs.length}
            </strong>
          </div>
        </div>

        <div className="tat-metric-card">
          <div className="tat-metric-icon icon-amber">
            <FiClock />
          </div>

          <div>
            <span className="tat-metric-label">
              In Progress / Pending
            </span>

            <strong className="tat-metric-count">
              {pendingCount}
            </strong>
          </div>
        </div>

        <div className="tat-metric-card">
          <div className="tat-metric-icon icon-green">
            <FiCheckCircle />
          </div>

          <div>
            <span className="tat-metric-label">
              Completed / Delivered
            </span>

            <strong className="tat-metric-count">
              {completedCount}
            </strong>
          </div>
        </div>

      </section>

      {/* TASK TABLE */}

      <section className="tat-card">

        {/* TOOLBAR: SEARCH + STATUS + SORT + FILTER TOGGLE */}

        <div className="tat-toolbar">

          <div className="tat-search-wrap">
            <FiSearch className="tat-search-ico" />

            <input
              type="text"
              placeholder="Search customer, phone, serial no., device, ticket, branch..."
              value={searchTerm}
              onChange={(event) =>
                setSearchTerm(event.target.value)
              }
            />
          </div>

          <div className="tat-toolbar-actions">

            <div className="tat-filter-wrap">
              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value)
                }
                className="tat-select"
                aria-label="Filter by status"
              >
                <option value="ALL">
                  All Statuses
                </option>

                {STATUS_OPTIONS.map((status) => (
                  <option
                    key={status}
                    value={status}
                  >
                    {status}
                  </option>
                ))}
              </select>
            </div>

            <div className="tat-filter-wrap tat-sort-wrap">
              <select
                value={sortBy}
                onChange={(event) =>
                  setSortBy(event.target.value)
                }
                className="tat-select"
                aria-label="Sort tasks"
              >
                {SORT_OPTIONS.map((option) => (
                  <option
                    key={option.value}
                    value={option.value}
                  >
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              className={`tat-btn-filter ${
                showFilters ? "is-open" : ""
              }`}
              onClick={() =>
                setShowFilters((previous) => !previous)
              }
              aria-expanded={showFilters}
            >
              <FiFilter />

              <span>Filters</span>

              {activeFilterCount > 0 && (
                <span className="tat-filter-badge">
                  {activeFilterCount}
                </span>
              )}
            </button>

          </div>

        </div>

        {/* ADVANCED FILTER PANEL */}

        {showFilters && (
          <div className="tat-filter-panel">

            <div className="tat-filter-field">
              <label htmlFor="tat-f-branch">
                Branch
              </label>

              <select
                id="tat-f-branch"
                className="tat-select"
                value={branchFilter}
                onChange={(event) =>
                  setBranchFilter(event.target.value)
                }
              >
                <option value="ALL">
                  All Branches
                </option>

                {branchOptions.map((option) => (
                  <option
                    key={option.value}
                    value={option.value}
                  >
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="tat-filter-field">
              <label htmlFor="tat-f-device">
                Device / Product
              </label>

              <select
                id="tat-f-device"
                className="tat-select"
                value={deviceTypeFilter}
                onChange={(event) =>
                  setDeviceTypeFilter(event.target.value)
                }
              >
                <option value="ALL">
                  All Devices
                </option>

                {deviceTypeOptions.map((option) => (
                  <option
                    key={option.value}
                    value={option.value}
                  >
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="tat-filter-field">
              <label htmlFor="tat-f-warranty">
                Warranty
              </label>

              <select
                id="tat-f-warranty"
                className="tat-select"
                value={warrantyFilter}
                onChange={(event) =>
                  setWarrantyFilter(event.target.value)
                }
              >
                <option value="ALL">
                  All
                </option>

                <option value="in">
                  Under Warranty
                </option>

                <option value="out">
                  Out of Warranty
                </option>

                <option value="unknown">
                  Not Specified
                </option>
              </select>
            </div>

            <div className="tat-filter-field">
              <label htmlFor="tat-f-datefield">
                Date Type
              </label>

              <select
                id="tat-f-datefield"
                className="tat-select"
                value={dateField}
                onChange={(event) =>
                  setDateField(event.target.value)
                }
              >
                <option value="job">
                  Job Date
                </option>

                <option value="target">
                  Est. Target Date
                </option>
              </select>
            </div>

            <div className="tat-filter-field">
              <label htmlFor="tat-f-from">
                From
              </label>

              <input
                id="tat-f-from"
                type="date"
                className="tat-select"
                value={dateFrom}
                max={dateTo || undefined}
                onChange={(event) =>
                  setDateFrom(event.target.value)
                }
              />
            </div>

            <div className="tat-filter-field">
              <label htmlFor="tat-f-to">
                To
              </label>

              <input
                id="tat-f-to"
                type="date"
                className="tat-select"
                value={dateTo}
                min={dateFrom || undefined}
                onChange={(event) =>
                  setDateTo(event.target.value)
                }
              />
            </div>

            <div className="tat-filter-field tat-filter-check">
              <label
                htmlFor="tat-f-overdue"
                className="tat-check-label"
              >
                <input
                  id="tat-f-overdue"
                  type="checkbox"
                  checked={overdueOnly}
                  onChange={(event) =>
                    setOverdueOnly(event.target.checked)
                  }
                />

                <span>Overdue only</span>
              </label>
            </div>

            <div className="tat-filter-field tat-filter-clear">
              <button
                type="button"
                className="tat-btn-clear"
                onClick={clearAllFilters}
                disabled={!hasActiveFilters}
              >
                <FiX />

                <span>Clear Filters</span>
              </button>
            </div>

          </div>
        )}

        {loading ? (
          <div className="tat-state-box">
            <div className="tat-spinner" />

            <p>
              Loading your assigned repair tickets...
            </p>
          </div>
        ) : filteredJobs.length === 0 ? (
          <div className="tat-state-box">
            <div className="tat-empty-icon">
              <FiInbox />
            </div>

            <h3>No Assigned Jobs Found</h3>

            <p>
              There are currently no repair tickets assigned
              to your profile, or no tickets match your filters.
            </p>

            {hasActiveFilters && (
              <button
                type="button"
                className="tat-btn-clear tat-btn-clear-inline"
                onClick={clearAllFilters}
              >
                <FiX />

                <span>Clear Filters</span>
              </button>
            )}
          </div>
        ) : (
          <div className="tat-table-wrap">

            <table className="tat-table">

              <thead>
                <tr>
                  <th>Job Ticket</th>
                  <th>Customer Information</th>
                  <th>Device / Hardware</th>
                  <th>Branch</th>
                  <th>Reported Issue</th>
                  <th>Counter Remarks</th>
                  <th>Technician Notes</th>
                  <th>Job Date</th>
                  <th>Est. Target Date</th>
                  <th>Current Status</th>
                  <th className="tat-th-right">
                    Update Status
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredJobs.map((job) => {
                  const issueText = getIssueText(job);

                  const isExpanded = Boolean(
                    expandedIssues[job._id]
                  );

                  const isLongIssue =
                    issueText.length >
                    ISSUE_PREVIEW_LENGTH;

                  const displayedIssue =
                    isLongIssue && !isExpanded
                      ? `${issueText
                          .slice(
                            0,
                            ISSUE_PREVIEW_LENGTH
                          )
                          .trim()}...`
                      : issueText;

                  const branch = getBranchDetails(job);

                  const branchName =
                    getBranchLabel(job);

                  const branchAddress =
                    getBranchAddress(branch);

                  const branchPhone =
                    getBranchPhone(branch);

                  const branchEmail =
                    getBranchEmail(branch);

                  const branchCityState =
                    getBranchCityState(branch);

                  const branchCode =
                    getBranchCode(branch);

                  return (
                    <tr key={job._id}>

                      {/* JOB TICKET */}

                      <td>
                        <span className="tat-ticket-code">
                          {job.repairNumber ||
                            job._id
                              ?.slice(-6)
                              .toUpperCase() ||
                            "N/A"}
                        </span>
                      </td>

                      {/* CUSTOMER */}

                      <td>
                        <div className="tat-customer-cell">
                          <strong>
                            {job.customerName ||
                              "Walk-in Customer"}
                          </strong>

                          <span className="tat-sub-txt">
                            <FiPhone />
                            {job.customerPhone ||
                              "No phone"}
                          </span>

                          {job.customerEmail && (
                            <span className="tat-sub-txt">
                              <FiMail />
                              {job.customerEmail}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* DEVICE */}

                      <td>
                        <div className="tat-customer-cell">
                          <strong className="tat-device-name">
                            {job.deviceType || "Device"}
                          </strong>

                          <span className="tat-sub-txt">
                            <FiMonitor />
                            {job.deviceModel ||
                              job.laptopModel ||
                              "Hardware not specified"}
                          </span>

                          {job.deviceBrand && (
                            <span className="tat-sub-txt">
                              Brand: {job.deviceBrand}
                            </span>
                          )}

                          {job.serialNumber && (
                            <span className="tat-sub-txt">
                              S/N: {job.serialNumber}
                            </span>
                          )}

                          <span className="tat-sub-txt">
                            <WarrantyBadge repair={job} />
                          </span>
                        </div>
                      </td>

                      {/* BRANCH */}

                      <td>
                        <div className="tat-branch-cell">
                          <span className="tat-branch-icon">
                            <FiMapPin />
                          </span>

                          <div className="tat-branch-details">

                            <strong>
                              {branchName}
                            </strong>

                            {branchCode && (
                              <span>
                                Code: {branchCode}
                              </span>
                            )}

                            {branchAddress && (
                              <span>
                                {branchAddress}
                              </span>
                            )}

                            {branchCityState && (
                              <span>
                                {branchCityState}
                              </span>
                            )}

                            {branchPhone && (
                              <span>
                                <FiPhone />
                                {branchPhone}
                              </span>
                            )}

                            {branchEmail && (
                              <span>
                                <FiMail />
                                {branchEmail}
                              </span>
                            )}

                            {!branch &&
                              branchesLoading && (
                                <small>
                                  Loading branch...
                                </small>
                              )}

                            {!branch &&
                              !branchesLoading &&
                              !getId(
                                getRepairBranchValue(job)
                              ) && (
                                <small>
                                  No branch assigned
                                </small>
                              )}

                          </div>
                        </div>
                      </td>

                      {/* REPORTED ISSUE + MORE / LESS */}

                      <td className="tat-issue-col">
                        <div className="tat-issue-box">
                          <FiAlertCircle className="tat-issue-icon" />

                          <div className="tat-issue-content">
                            <span className="tat-issue-text">
                              {displayedIssue ||
                                "No issue details"}
                            </span>

                            {isLongIssue && (
                              <button
                                type="button"
                                className="tat-more-btn"
                                onClick={() =>
                                  toggleIssue(job._id)
                                }
                              >
                                {isExpanded ? (
                                  <>
                                    Less <FiChevronUp />
                                  </>
                                ) : (
                                  <>
                                    More <FiChevronDown />
                                  </>
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* COUNTER REMARKS */}

                      <td className="tat-remarks-col">
                        {job.remarks ? (
                          <span className="tat-remarks-tag">
                            {job.remarks}
                          </span>
                        ) : (
                          <span className="tat-muted-dash">
                            —
                          </span>
                        )}
                      </td>

                      {/* TECHNICIAN NOTES */}

                      <td style={{ minWidth: 230 }}>
                        <textarea
                          rows={3}
                          maxLength={3000}
                          placeholder="Diagnosis, observations, repair actions..."
                          value={getNotesValue(job)}
                          onChange={(event) =>
                            setNotesDraft((previous) => ({
                              ...previous,
                              [job._id]: event.target.value,
                            }))
                          }
                          style={{
                            width: "100%",
                            padding: 8,
                            border: "1px solid #cbd5e1",
                            borderRadius: 6,
                            fontSize: 13,
                            fontFamily: "inherit",
                            boxSizing: "border-box",
                            resize: "vertical",
                          }}
                        />

                        <button
                          type="button"
                          className="rjx-btn rjx-btn-primary rjx-btn-sm"
                          style={{ marginTop: 6 }}
                          disabled={savingNotesId === job._id}
                          onClick={() => handleSaveNotes(job)}
                        >
                          {savingNotesId === job._id
                            ? "Saving..."
                            : "Save Notes"}
                        </button>
                      </td>

                      {/* JOB DATE */}

                      <td>
                        <span className="tat-date-badge">
                          <FiCalendar />

                          {formatDate(
                            job.jobDate || job.createdAt
                          )}
                        </span>
                      </td>

                      {/* TARGET DATE */}

                      <td>
                        <span className="tat-date-badge">
                          <FiCalendar />

                          {formatDate(
                            job.estimatedCompletionDate
                          )}
                        </span>

                        {isOverdue(job) && (
                          <span className="tat-overdue-tag">
                            Overdue
                          </span>
                        )}
                      </td>

                      {/* STATUS */}

                      <td>
                        <span
                          className={`tat-status-pill ${getStatusClass(
                            job.status
                          )}`}
                        >
                          {job.status || "Received"}
                        </span>
                      </td>

                      {/* UPDATE STATUS */}

                      <td className="tat-td-right">
                        <select
                          className="tat-status-changer"
                          value={
                            job.status || "Received"
                          }
                          disabled={
                            updatingId === job._id
                          }
                          onChange={(event) =>
                            handleStatusChange(
                              job._id,
                              event.target.value
                            )
                          }
                        >
                          {STATUS_OPTIONS.map(
                            (status) => (
                              <option
                                key={status}
                                value={status}
                              >
                                {status}
                              </option>
                            )
                          )}
                        </select>

                        {updatingId === job._id && (
                          <span className="tat-sub-txt tat-updating">
                            Updating...
                          </span>
                        )}

                        <button
                          type="button"
                          className="rjx-btn rjx-btn-outline rjx-btn-sm"
                          style={{ marginTop: 6 }}
                          onClick={() => setTransferJob(job)}
                        >
                          Transfer Job
                        </button>
                      </td>

                    </tr>
                  );
                })}
              </tbody>

            </table>
          </div>
        )}

        <div className="tat-table-footer">
          Showing {filteredJobs.length} of{" "}
          {myAssignedJobs.length} assigned tasks
        </div>

      </section>

      {/* TRANSFER JOB MODAL */}

      {transferJob && (
        <TransferJobModal
          repair={transferJob}
          onClose={() => setTransferJob(null)}
          onDone={handleTransferred}
        />
      )}
    </div>
  );
}
