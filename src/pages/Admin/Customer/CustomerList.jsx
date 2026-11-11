import React, { useEffect, useState } from "react";
import axios from "axios";
import "./CustomerList.css";
import { toast } from "react-toastify";
const API_URL = import.meta.env.VITE_API_URL;

// ---------- sort options ----------
const SORT_OPTIONS = [
  { value: "DEFAULT", label: "Default order" },
  { value: "NAME_ASC", label: "Name: A → Z" },
  { value: "NAME_DESC", label: "Name: Z → A" },
  { value: "DATE_DESC", label: "Joined: Newest first" },
  { value: "DATE_ASC", label: "Joined: Oldest first" },
];

const getFullName = (customer) =>
  customer.firstName || customer.lastName
    ? `${customer.firstName || ""} ${customer.lastName || ""}`.trim()
    : customer.name || "";

const getTime = (customer) =>
  customer?.createdAt ? new Date(customer.createdAt).getTime() : 0;

function CustomerList() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  // New filter / sort state
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState("DEFAULT");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    getCustomers();
  }, []);

  const getCustomers = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");

      // const res = await axios.get("http://localhost:5000/api/users", {
      //   headers: {
      //     Authorization: `Bearer ${token}`,
      //   },
      // });

      // Filter only users with role "CUSTOMER"

const res = await axios.get(
  `${API_URL}/users`,
  {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  }
);

      const userList = res.data?.users || res.data || [];
      const onlyCustomers = userList.filter(
        (item) => item.role === "CUSTOMER" || item.role === "customer"
      );

      setCustomers(onlyCustomers);
      setError("");
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || "Failed to fetch customer data.");
    } finally {
      setLoading(false);
    }
  };

  // ---------- search + filters ----------
  const query = searchTerm.trim().toLowerCase();

  const from = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null;
  const to = dateTo ? new Date(`${dateTo}T23:59:59.999`).getTime() : null;

  const matchedCustomers = customers.filter((customer) => {
    // Search: name, email, phone
    const fullName = `${customer.firstName || ""} ${customer.lastName || ""}`.toLowerCase();
    const email = (customer.email || "").toLowerCase();
    const phone = (customer.phone || "").toLowerCase();

    if (query && !(fullName.includes(query) || email.includes(query) || phone.includes(query))) {
      return false;
    }

    // Status (Active = verified, Pending = not verified)
    if (statusFilter === "ACTIVE" && !customer.isVerified) return false;
    if (statusFilter === "PENDING" && customer.isVerified) return false;

    // Joined date range
    if (from !== null || to !== null) {
      if (!customer.createdAt) return false;
      const time = new Date(customer.createdAt).getTime();
      if (from !== null && time < from) return false;
      if (to !== null && time > to) return false;
    }

    return true;
  });

  // ---------- sort ----------
  const sortCustomers = (list) => {
    if (sortBy === "DEFAULT") return list;

    const comparators = {
      NAME_ASC: (a, b) =>
        getFullName(a).toLowerCase().localeCompare(getFullName(b).toLowerCase()),
      NAME_DESC: (a, b) =>
        getFullName(b).toLowerCase().localeCompare(getFullName(a).toLowerCase()),
      DATE_DESC: (a, b) => getTime(b) - getTime(a),
      DATE_ASC: (a, b) => getTime(a) - getTime(b),
    };

    return [...list].sort(comparators[sortBy]);
  };

  const filteredCustomers = sortCustomers(matchedCustomers);

  const hasActiveFilters =
    searchTerm.trim() !== "" ||
    statusFilter !== "ALL" ||
    sortBy !== "DEFAULT" ||
    dateFrom !== "" ||
    dateTo !== "";

  const resetFilters = () => {
    setSearchTerm("");
    setStatusFilter("ALL");
    setSortBy("DEFAULT");
    setDateFrom("");
    setDateTo("");
  };

  return (
    <div className="customer-list-container">
      <div className="customer-card">

        {/* Header Section */}
        <div className="card-header">
          <div>
            <h2>Customer Directory</h2>
            <p>View and manage all registered customers.</p>
          </div>
          <span className="customer-badge">{filteredCustomers.length} Total</span>
        </div>

        {/* Toolbar Section */}
        <div className="toolbar">
          <input
            type="text"
            className="search-input"
            placeholder="Search by name, email, or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <button className="refresh-btn" onClick={getCustomers} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh List"}
          </button>
        </div>

        {/* Filter Section */}
        <div className="customer-filters">
          <div className="customer-filter-group">
            <label htmlFor="customer-status">Status</label>
            <select
              id="customer-status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="ALL">All Status</option>
              <option value="ACTIVE">Active</option>
              <option value="PENDING">Pending</option>
            </select>
          </div>

          <div className="customer-filter-group">
            <label htmlFor="customer-sort">Sort by</label>
            <select
              id="customer-sort"
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

          <div className="customer-filter-group">
            <label htmlFor="customer-date-from">Joined from</label>
            <input
              id="customer-date-from"
              type="date"
              value={dateFrom}
              max={dateTo || undefined}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>

          <div className="customer-filter-group">
            <label htmlFor="customer-date-to">Joined to</label>
            <input
              id="customer-date-to"
              type="date"
              value={dateTo}
              min={dateFrom || undefined}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              className="customer-clear-btn"
              onClick={resetFilters}
            >
              Clear filters
            </button>
          )}
        </div>

        {!loading && (
          <div className="customer-result-count">
            Showing {filteredCustomers.length} of {customers.length} customers
          </div>
        )}

        {/* Error Alert */}
        {error && <div className="alert-error">{error}</div>}

        {/* Table Content */}
        <div className="table-wrapper">
          {loading ? (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>Loading customers...</p>
            </div>
          ) : filteredCustomers.length === 0 ? (
            <div className="empty-state">
              <p>No customers found.</p>
            </div>
          ) : (
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Customer Name</th>
                  <th>Email Address</th>
                  <th>Phone Number</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.map((item) => (
                  <tr key={item._id}>
                    <td>
                      <div className="user-avatar-group">
                        <div className="avatar">
                          {(item.firstName?.[0] || item.email?.[0] || "C").toUpperCase()}
                        </div>
                        <span className="user-name">
                          {getFullName(item) || "N/A"}
                        </span>
                      </div>
                    </td>
                    <td className="text-muted">{item.email}</td>
                    <td className="text-muted">{item.phone || "N/A"}</td>
                    <td>
                      <span className={`status-pill ${item.isVerified ? "active" : "pending"}`}>
                        {item.isVerified ? "Active" : "Pending"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

      </div>
    </div>
  );
}

export default CustomerList;
