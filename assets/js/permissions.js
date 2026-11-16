(function () {
  const CANCELLABLE = ["pending", "pending_approval", "approved"];
  const DISPATCHABLE = ["approved", "pending"];
  const CONFIRMABLE = ["delivered"];

  function ownsCustomerRecord(session, customerId) {
    return session.role === "administrator" || Number(session.customerId) === Number(customerId);
  }

  function inZone(session, zoneId) {
    if (session.role === "administrator") return true;
    if (session.role === "zone_officer") return Number(session.zoneId) === Number(zoneId);
    return false;
  }

  function operatorHydrant(session, hydrantId) {
    if (session.role === "administrator") return true;
    if (session.role === "hydrant_operator") return Number(session.hydrantId) === Number(hydrantId);
    return false;
  }

  function driverTrip(session, driverId) {
    if (session.role === "administrator") return true;
    if (session.role === "driver") return Number(session.driverId) === Number(driverId);
    return false;
  }

  window.PLPerm = {
    CANCELLABLE,
    DISPATCHABLE,
    CONFIRMABLE,
    ownsCustomerRecord,
    inZone,
    operatorHydrant,
    driverTrip,
    can(action, session, record = {}) {
      switch (action) {
        case "book":
          return session.role === "customer";
        case "cancel_booking":
          return session.role === "customer" && ownsCustomerRecord(session, record.customerId) && CANCELLABLE.includes(record.status);
        case "confirm_delivery":
        case "dispute_delivery":
          return session.role === "customer" && ownsCustomerRecord(session, record.customerId) && CONFIRMABLE.includes(record.status);
        case "approve_subsidy":
        case "approve_booking":
        case "resolve_dispute":
          return session.role === "zone_officer" && inZone(session, record.zoneId);
        case "dispatch":
          return session.role === "hydrant_operator" && operatorHydrant(session, record.hydrantId) && DISPATCHABLE.includes(record.status) && record.status !== "pending_approval";
        case "assign_tanker":
        case "assign_driver":
          return session.role === "hydrant_operator" && session.role !== "zone_officer";
        case "update_trip":
          return session.role === "driver" && driverTrip(session, record.driverId);
        case "admin_manage":
          return session.role === "administrator";
        default:
          return false;
      }
    },
    filterBookings(session, bookings) {
      if (session.role === "administrator") return bookings;
      if (session.role === "customer") return bookings.filter((b) => Number(b.customerId) === Number(session.customerId));
      if (session.role === "zone_officer") return bookings.filter((b) => Number(b.zoneId) === Number(session.zoneId));
      if (session.role === "hydrant_operator") return bookings.filter((b) => Number(b.hydrantId) === Number(session.hydrantId));
      if (session.role === "driver") return bookings.filter((b) => Number(b.driverId) === Number(session.driverId));
      return [];
    },
  };
})();
