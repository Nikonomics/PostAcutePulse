import React, { useState, useRef } from "react";
import { Plus, X } from "lucide-react";

// Multiselect Dropdown Component
const MultiSelectDropdown = ({
  options,
  selectedValues,
  onSelectionChange,
  placeholder = "Select options...",
  label,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);

  // Helper: normalize selected values to user objects if needed (for display)
  const normalizeSelected = (selected) => {
    if (!selected) return [];
    // If selected is an array of objects with a "user" property, use user
    if (selected.length > 0 && selected[0]?.user) {
      return selected.map((item) => ({
        id: item.user.id,
        name: `${item.user.first_name} ${item.user.last_name}`,
        role: item.user.role,
        // Remove email from display as per instruction
        // email: item.user.email,
      }));
    }
    // If selected is array of user objects (id, name, etc)
    if (selected.length > 0 && selected[0]?.id && selected[0]?.name) {
      // Remove email from display as per instruction
      return selected.map(({ email, ...rest }) => rest);
    }
    // If selected is array of user ids, map to options
    if (selected.length > 0 && typeof selected[0] === "number") {
      return options
        .filter((opt) => selected.includes(opt.id))
        .map(({ email, ...rest }) => rest);
    }
    return [];
  };

  // Always normalize for display and filtering
  const normalizedSelectedValues = normalizeSelected(selectedValues);

  const filteredOptions = options.filter(
    (option) =>
      option.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
      !normalizedSelectedValues.some(
        (selected) => selected.id === option.id
      )
  );

  const getOptionKey = (option) => option.id + "-" + option.name;

  // Add option to selected
  const handleOptionClick = (option) => {
    if (
      !normalizedSelectedValues.some(
        (selected) => selected.id === option.id
      )
    ) {
      // Always pass as array of user objects without email and without user object
      let newSelected = [
        ...normalizedSelectedValues,
        {
          id: option.id,
          name: option.name,
          role: option.role,
          type: option.type || "core", // default to core if not present
        },
      ];
      onSelectionChange(newSelected);
    }
    setSearchTerm("");
    setIsOpen(false);
    if (inputRef.current) inputRef.current.blur();
  };

  // Remove option from selected
  const handleRemoveItem = (item) => {
    let newSelected = normalizedSelectedValues.filter(
      (selected) => selected.id !== item.id
    );
    onSelectionChange(newSelected);
  };

  // Handle blur: close dropdown only if focus is outside input and dropdown
  const handleBlur = (e) => {
    setTimeout(() => {
      if (
        document.activeElement !== inputRef.current &&
        (!dropdownRef.current ||
          !dropdownRef.current.contains(document.activeElement))
      ) {
        setIsOpen(false);
      }
    }, 100);
  };

  return (
    <div className="multiselect-container" style={{ position: "relative" }}>
      <label className="form-label">{label}</label>

      {/* Selected Items Display */}
      {normalizedSelectedValues.length > 0 && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "8px",
            marginBottom: "8px",
            padding: "8px",
            backgroundColor: "#f8fafc",
            borderRadius: "6px",
            border: "1px solid #e2e8f0",
          }}
        >
          {normalizedSelectedValues.map((item) => (
            <div
              key={getOptionKey(item)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "4px",
                padding: "4px 8px",
                backgroundColor: "#3b82f6",
                color: "white",
                borderRadius: "4px",
                fontSize: "12px",
              }}
            >
              <span>
                {item.name}
                {/* Email removed from display */}
              </span>
              <button
                type="button"
                tabIndex={0}
                onClick={() => handleRemoveItem(item)}
                style={{
                  background: "none",
                  border: "none",
                  color: "white",
                  cursor: "pointer",
                  padding: "0",
                  display: "flex",
                  alignItems: "center",
                }}
                aria-label={`Remove ${item.name}`}
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Dropdown Input */}
      <div style={{ position: "relative" }}>
        <input
          ref={inputRef}
          type="text"
          className="form-input"
          placeholder={placeholder}
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onBlur={handleBlur}
          style={{ paddingRight: "30px" }}
          autoComplete="off"
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => {
            setIsOpen((prev) => !prev);
            if (inputRef.current) inputRef.current.focus();
          }}
          style={{
            position: "absolute",
            right: "8px",
            top: "50%",
            transform: "translateY(-50%)",
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "4px",
          }}
          aria-label="Toggle dropdown"
        >
          <Plus size={16} />
        </button>
      </div>

      {/* Dropdown List */}
      {isOpen && (
        <div
          ref={dropdownRef}
          tabIndex={-1}
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            backgroundColor: "white",
            border: "1px solid #e2e8f0",
            borderRadius: "6px",
            boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
            zIndex: 1000,
            maxHeight: "200px",
            overflowY: "auto",
          }}
        >
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option) => (
              <div
                key={getOptionKey(option)}
                onClick={() => handleOptionClick(option)}
                style={{
                  padding: "12px",
                  cursor: "pointer",
                  borderBottom: "1px solid #f1f5f9",
                  transition: "background-color 0.2s",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.backgroundColor = "#f8fafc")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.backgroundColor = "white")
                }
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    handleOptionClick(option);
                  }
                }}
                aria-label={`Select ${option.name}`}
              >
                <div style={{ fontWeight: "500", fontSize: "14px" }}>
                  {option.name}
                </div>
                {option.role && (
                  <div style={{ fontSize: "12px", color: "#64748b" }}>
                    {option.role}
                  </div>
                )}
                {/* Email removed from dropdown list as well */}
              </div>
            ))
          ) : (
            <div
              style={{ padding: "12px", color: "#64748b", fontSize: "14px" }}
            >
              No options available
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const renderStep3 = (
  usersData,
  formData,
  handleInputChange,
  handleStep3Change,
  handleNotificationChange,
  validationErrors = {}
) => {
  console.log('formData',formData);
  // Available team members for selection
  const availableTeamMembers = usersData.map((user) => ({
    id: user.id,
    name: user.first_name + " " + user.last_name,
    role: user.role,
    // email: user.email, // not needed for display
  }));

  // Available external advisors for selection (fixed: unique IDs)
  const availabledeal_external_advisors = usersData.map((user) => ({
    id: user.id,
    name: user.first_name + " " + user.last_name,
    role: user.role,
    // email: user.email, // not needed for display
  }));

  // Normalize selected core team members to user objects (for display, no email)
  const normalizeCoreTeam = (selected) => {
    if (!selected) return [];
    // If deal_team_members is array of {user: {...}}
    if (selected.length > 0 && selected[0]?.user) {
      return selected.map((item) => ({
        id: item.user.id,
        name: `${item.user.first_name} ${item.user.last_name}`,
        role: item.user.role,
        // email: item.user.email, // remove email
        type: "core",
      }));
    }
    // If already normalized
    if (selected.length > 0 && selected[0]?.id && selected[0]?.name) {
      // Remove email if present
      return selected.map(({ email, ...rest }) => rest);
    }
    // If array of ids
    if (selected.length > 0 && typeof selected[0] === "number") {
      return availableTeamMembers
        .filter((opt) => selected.includes(opt.id))
        .map(({ email, ...rest }) => rest);
    }
    return [];
  };

  // Normalize selected external advisors to user objects (for display, no email)
  const normalizeExternalAdvisors = (selected) => {
    if (!selected) return [];
    if (selected.length > 0 && selected[0]?.user) {
      return selected.map((item) => ({
        id: item.user.id,
        name: `${item.user.first_name} ${item.user.last_name}`,
        role: item.user.role,
        // email: item.user.email, // remove email
        assigned: true,
      }));
    }
    if (selected.length > 0 && selected[0]?.id && selected[0]?.name) {
      // Remove email if present
      return selected.map(({ email, ...rest }) => rest);
    }
    if (selected.length > 0 && typeof selected[0] === "number") {
      return availabledeal_external_advisors
        .filter((opt) => selected.includes(opt.id))
        .map(({ email, ...rest }) => rest);
    }
    return [];
  };

  const permissionMatrix = {
    deal_lead_id: [true, true, true, true, true, true],
    deal_team_members: [true, true, true, true, false, false],
    external: [true, false, false, false, false, false],
    advisors: [true, false, false, false, false, false],
  };

  // Handle core team selection
  const handledeal_team_membersSelection = (selectedMembers) => {
    // Always pass as array of user objects without email and without user object
    const newSelected = selectedMembers.map((member) => ({
      id: member.id,
      name: member.name,
      role: member.role,
      type: "core",
    }));
    handleInputChange("deal_team_members", newSelected);
  };

  // Handle external advisor selection
  const handledeal_external_advisorselection = (selectedAdvisors) => {
    const newSelected = selectedAdvisors.map((advisor) => ({
      id: advisor.id,
      name: advisor.name,
      role: advisor.role,
      assigned: true,
    }));
    handleInputChange("deal_external_advisors", newSelected);
  };

  return (
    <div className="row">
      <div className="col-lg-8">
        {/* Team Assignment */}
        <div className="form-container">
          <div className="form-section">
            <h2>Team Assignment</h2>

            {/* Deal Lead & Assistant Deal Lead */}
            <h3 className="py-4">Deal Lead & Assistant Deal Lead</h3>
            <div className="form-row">
              <div className="form-group mb-3">
                <label className="form-label required">Deal Lead</label>
                <select
                  className={`form-select ${
                    validationErrors.deal_lead_id ? "error" : ""
                  }`}
                  value={formData.deal_lead_id || ""}
                  onChange={(e) => {
                    handleInputChange("deal_lead_id", e.target.value);
                  }}
                >
                  <option value="">Select user</option>
                  {usersData.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.first_name} {user.last_name}
                    </option>
                  ))}
                </select>
                {validationErrors.deal_lead_id && (
                  <span className="error-message">
                    {validationErrors.deal_lead_id}
                  </span>
                )}
              </div>
              <div className="form-group mb-3">
                <label className="form-label">Assistant Deal Lead</label>
                <select
                  className="form-select"
                  value={formData.assistant_deal_lead_id || ""}
                  onChange={(e) => {
                    handleInputChange("assistant_deal_lead_id", e.target.value);
                  }}
                >
                  <option value="">Select user</option>
                  {usersData.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.first_name} {user.last_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
         

          {/* Core Team Members - Multiselect */}
          <div className="form-group">
            <MultiSelectDropdown
              label="Core Team Members"
              options={availableTeamMembers}
              selectedValues={normalizeCoreTeam(formData.deal_team_members || [])}
              onSelectionChange={handledeal_team_membersSelection}
              placeholder="Search and select team members..."
            />
          </div>

          {/* External Advisors - Multiselect */}
          <div className="form-group">
            <MultiSelectDropdown
              label="External Advisors"
              options={availabledeal_external_advisors}
              selectedValues={normalizeExternalAdvisors(formData.deal_external_advisors || [])}
              onSelectionChange={handledeal_external_advisorselection}
              placeholder="Search and select external advisors..."
            />
          </div>

          {/* Notification Settings */}
          <h3 className="py-4">Notification Settings</h3>
          <div className="notify-checkbox">
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="checkbox"
                checked={formData.notificationSettings?.email_notification_major_updates ?? false}
                onChange={() => handleInputChange('notificationSettings', {
                  ...formData.notificationSettings,
                  email_notification_major_updates: !formData.notificationSettings?.email_notification_major_updates
                })}
                style={{ width: '16px', height: '16px' }}
              />
              <span style={{ fontSize: '14px' }}>Email notifications for major updates</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="checkbox"
                checked={formData.notificationSettings?.document_upload_notification ?? false}
                onChange={() => handleInputChange('notificationSettings', {
                  ...formData.notificationSettings,
                  document_upload_notification: !formData.notificationSettings?.document_upload_notification
                })}
                style={{ width: '16px', height: '16px' }}
              />
              <span style={{ fontSize: '14px' }}>Document upload notifications</span>
            </label>
          </div>
          </div>
        </div>
      </div>
      {/* Access Control & Permissions */}
      <div className="col-lg-4">
        <div className="form-container">
          <div className="form-section">
            <h2>Access Control & Permissions</h2>

            {/* Permission Matrix */}
            <h3 className="py-4">Permission Matrix</h3>
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  fontSize: "14px",
                  borderCollapse: "collapse",
                }}
              >
                <thead>
                  <tr style={{ backgroundColor: "#f8fafc" }}>
                    <th
                      style={{
                        textAlign: "left",
                        padding: "8px",
                        fontWeight: "600",
                        color: "#374151",
                      }}
                    >
                      Role
                    </th>
                    <th
                      style={{
                        textAlign: "center",
                        padding: "8px",
                        fontWeight: "600",
                        color: "#374151",
                      }}
                    >
                      View
                    </th>
                    <th
                      style={{
                        textAlign: "center",
                        padding: "8px",
                        fontWeight: "600",
                        color: "#374151",
                      }}
                    >
                      Edit
                    </th>
                    <th
                      style={{
                        textAlign: "center",
                        padding: "8px",
                        fontWeight: "600",
                        color: "#374151",
                      }}
                    >
                      Delete
                    </th>
                    <th
                      style={{
                        textAlign: "center",
                        padding: "8px",
                        fontWeight: "600",
                        color: "#374151",
                      }}
                    >
                      Approve
                    </th>
                    <th
                      style={{
                        textAlign: "center",
                        padding: "8px",
                        fontWeight: "600",
                        color: "#374151",
                      }}
                    >
                      Export
                    </th>
                    <th
                      style={{
                        textAlign: "center",
                        padding: "8px",
                        fontWeight: "600",
                        color: "#374151",
                      }}
                    >
                      Admin
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { key: "deal_lead_id", label: "Deal Lead" },
                    { key: "deal_team_members", label: "Deal Manager" },
                    { key: "external", label: "Analyst" },
                    { key: "advisors", label: "Reviewer" },
                    { key: "external", label: "External Advisor" },
                  ].map((role, idx) => (
                    <tr key={idx} style={{ borderBottom: "1px solid #e2e8f0" }}>
                      <td
                        style={{
                          padding: "8px",
                          fontWeight: "600",
                          color: "#1e293b",
                        }}
                      >
                        {role.label}
                      </td>
                      {permissionMatrix[role.key]
                        ? permissionMatrix[role.key].map((val, permIdx) => (
                            <td
                              key={permIdx}
                              style={{ textAlign: "center", padding: "8px" }}
                            >
                              <span
                                style={{
                                  display: "inline-block",
                                  width: "12px",
                                  height: "12px",
                                  borderRadius: "50%",
                                  backgroundColor: val
                                    ? "#10b981"
                                    : permIdx < 3
                                    ? "#f59e0b"
                                    : "#ef4444",
                                }}
                              ></span>
                            </td>
                          ))
                        : Array(6)
                            .fill(0)
                            .map((_, permIdx) => (
                              <td
                                key={permIdx}
                                style={{ textAlign: "center", padding: "8px" }}
                              >
                                <span
                                  style={{
                                    display: "inline-block",
                                    width: "12px",
                                    height: "12px",
                                    borderRadius: "50%",
                                    backgroundColor:
                                      permIdx < 2
                                        ? "#10b981"
                                        : permIdx < 4
                                        ? "#f59e0b"
                                        : "#ef4444",
                                  }}
                                ></span>
                              </td>
                            ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="d-flex flex-wrap gap-3 pt-3">
              <div style={{ display: "flex", alignItems: "center" }}>
                <span
                  style={{
                    width: "12px",
                    height: "12px",
                    backgroundColor: "#10b981",
                    borderRadius: "50%",
                    marginRight: "4px",
                  }}
                ></span>
                Full Access
              </div>
              <div style={{ display: "flex", alignItems: "center" }}>
                <span
                  style={{
                    width: "12px",
                    height: "12px",
                    backgroundColor: "#f59e0b",
                    borderRadius: "50%",
                    marginRight: "4px",
                  }}
                ></span>
                Limited
              </div>
              <div style={{ display: "flex", alignItems: "center" }}>
                <span
                  style={{
                    width: "12px",
                    height: "12px",
                    backgroundColor: "#ef4444",
                    borderRadius: "50%",
                    marginRight: "4px",
                  }}
                ></span>
                No Access
              </div>
            </div>
      

          {/* Document Access Control */}
          <h3 className="py-4">Document Access Control</h3>
          <div
            style={{ display: "flex", flexDirection: "column", gap: "12px" }} >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px",
                backgroundColor: "#f0fdf4",
                borderRadius: "8px",
              }}
            >
              <span className="deal-text">
                Financial documents - Core team only
              </span>
              <span
                style={{ backgroundColor: "#ef4444" }}
                className="dot-deals"
              ></span>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px",
                backgroundColor: "#fffbeb",
                borderRadius: "8px",
              }}
            >
              <span className="deal-text">
                Legal documents - Lead + Legal counsel
              </span>
              <span
                style={{ backgroundColor: "#f59e0b" }}
                className="dot-deals"
              ></span>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px",
                backgroundColor: "#f0fdf4",
                borderRadius: "8px",
              }}
            >
              <span className="deal-text">
                Operational docs - All team members
              </span>
              <span
                style={{ backgroundColor: "#10b981" }}
                className="dot-deals"
              ></span>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px",
                backgroundColor: "#f0fdf4",
                borderRadius: "8px",
              }}
            >
              <span className="deal-text">
                Comments/Notes - All assigned users
              </span>
              <span
                style={{ backgroundColor: "#10b981" }}
                className="dot-deals"
              ></span>
            </div>
          </div>

          {/* Security Settings */}
          <h3 className="py-4">Security Settings</h3>
          <div
            style={{ display: "flex", flexDirection: "column", gap: "12px" }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px",
                backgroundColor: "#f0fdf4",
                borderRadius: "8px",
              }}
            >
              <span className="deal-text">
                Two-factor authentication required
              </span>
              <span
                style={{ backgroundColor: "#10b981" }}
                className="dot-deals"
              ></span>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px",
                backgroundColor: "#fef2f2",
                borderRadius: "8px",
              }}
            >
              <span className="deal-text">Download restrictions enabled</span>
              <span
                style={{ backgroundColor: "#ef4444" }}
                className="dot-deals"
              ></span>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px",
                backgroundColor: "#f0fdf4",
                borderRadius: "8px",
              }}
            >
              <span className="deal-text">Audit logging enabled</span>
              <span
                style={{ backgroundColor: "#10b981" }}
                className="dot-deals"
              ></span>
            </div>
          </div>
          {/* Current Data Debug Display */}
          <div
            style={{
              marginTop: "20px",
              padding: "12px",
              backgroundColor: "#f8fafc",
              borderRadius: "8px",
              fontSize: "12px",
            }}
          >
            <h4 style={{ fontSize: "14px", marginBottom: "8px" }}>
              Debug - Current Data:
            </h4>
            <div>Deal Lead: {formData.deal_lead_id}</div>
            <div>Assistant Lead: {formData.assistant_deal_lead_id}</div>
            <div>
              Core Team: {formData.deal_team_members?.length || 0} members
            </div>
            <div>
              External Advisors:{" "}
              {formData.deal_external_advisors?.length || 0} advisors
            </div>
            <div>
              Notifications:{" "}
              {
                Object.keys(formData.notificationSettings || {}).filter(
                  (key) => formData.notificationSettings[key]
                ).length
              }{" "}
              enabled
            </div>
          </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default renderStep3;
