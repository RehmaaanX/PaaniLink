/**
 * Domain services: Fetch-based CRUD plus Phase 1 business-rule checks.
 * Authoritative enforcement moves to the real backend in Phase 2.
 */
(function () {
  const api = () => window.PLApi;
  const cfg = window.PL_CONFIG;

  async function log(userId, action, details) {
    return api().post("activityLogs", { userId, action, details, createdAt: new Date().toISOString() });
  }

  async function notify(userId, title, message, link) {
    return api().post("notifications", {
      userId,
      title,
      message,
      link: link || "",
      read: false,
      createdAt: new Date().toISOString(),
    });
  }

  function appendHistory(booking, status, byUserId, note) {
    const statusHistory = Array.isArray(booking.statusHistory) ? [...booking.statusHistory] : [];
    statusHistory.push({ status, at: new Date().toISOString(), byUserId, note: note || "" });
    return statusHistory;
  }

  async function getRates() {
    return api().get("rates");
  }

  async function estimateCharges(type, capacityGallons) {
    const rates = await getRates();
    const rate = rates.find((r) => r.type === type && Number(r.capacityGallons) === Number(capacityGallons));
    if (!rate) throw new Error("No rate configured for this capacity and booking type.");
    return rate.amountPKR;
  }

  function dateKey(isoDate) {
    return String(isoDate).slice(0, 10);
  }

  async function hydrantUsageOn(hydrantId, date) {
    const dispatches = await api().get("dispatches", { hydrantId });
    const day = dateKey(date);
    return dispatches
      .filter((d) => d.gallonsFilled && dateKey(d.fillingCompletedAt || d.createdAt) === day)
      .reduce((sum, d) => sum + Number(d.gallonsFilled || 0), 0);
  }

  async function overlappingAssignment(kind, resourceId, date, excludeDispatchId) {
    const query = kind === "tanker" ? { tankerId: resourceId } : { driverId: resourceId };
    const dispatches = await api().get("dispatches", query);
    const day = dateKey(date);
    return dispatches.some((d) => {
      if (excludeDispatchId && Number(d.id) === Number(excludeDispatchId)) return false;
      if (["cancelled", "completed", "failed"].includes(d.status)) return false;
      return dateKey(d.deliveryDate || d.createdAt) === day;
    });
  }

  async function monthlySubsidisedUsed(customerId, monthPrefix) {
    const bookings = await api().get("bookings", { customerId, type: "subsidised" });
    return bookings
      .filter((b) => !["rejected", "cancelled"].includes(b.status) && String(b.createdAt).startsWith(monthPrefix))
      .reduce((sum, b) => sum + Number(b.capacityGallons || 0), 0);
  }

  const Services = {
    log,
    notify,
    estimateCharges,
    hydrantUsageOn,
    overlappingAssignment,

    users: {
      list: (q) => api().get("users", q),
      get: (id) => api().get(`users/${id}`),
      create: (body) => api().post("users", body),
      update: (id, body) => api().patch(`users/${id}`, body),
    },
    zones: {
      list: (q) => api().get("zones", q),
      get: (id) => api().get(`zones/${id}`),
      create: (body) => api().post("zones", body),
      update: (id, body) => api().patch(`zones/${id}`, body),
    },
    hydrants: {
      list: (q) => api().get("hydrants", q),
      get: (id) => api().get(`hydrants/${id}`),
      create: (body) => api().post("hydrants", body),
      update: (id, body) => api().patch(`hydrants/${id}`, body),
    },
    tankers: {
      list: (q) => api().get("tankers", q),
      get: (id) => api().get(`tankers/${id}`),
      create: (body) => api().post("tankers", body),
      update: (id, body) => api().patch(`tankers/${id}`, body),
    },
    drivers: {
      list: (q) => api().get("drivers", q),
      get: (id) => api().get(`drivers/${id}`),
      create: (body) => api().post("drivers", body),
      update: (id, body) => api().patch(`drivers/${id}`, body),
    },
    customers: {
      list: (q) => api().get("customers", q),
      get: (id) => api().get(`customers/${id}`),
      create: (body) => api().post("customers", body),
      update: (id, body) => api().patch(`customers/${id}`, body),
    },
    bookings: {
      list: (q) => api().get("bookings", q),
      get: (id) => api().get(`bookings/${id}`),
      async create(payload, session) {
        const hydrant = await api().get(`hydrants/${payload.hydrantId}`);
        if (hydrant.status !== "active") throw new Error("Selected hydrant is not available.");
        if (hydrant.zoneId !== Number(payload.zoneId)) throw new Error("Hydrant does not belong to the selected zone.");
        const hoursErr = window.PLValidate.withinHours(payload.preferredTime, hydrant.operatingHoursStart, hydrant.operatingHoursEnd);
        if (hoursErr) throw new Error(hoursErr);
        const capErr = window.PLValidate.capacity(payload.capacityGallons);
        if (capErr) throw new Error(capErr);

        const type = payload.type;
        const customer = await api().get(`customers/${payload.customerId}`);
        let status = "pending";
        if (type === "subsidised") {
          if (customer.subsidyStatus !== "verified") {
            throw new Error("Subsidised booking requires verified subsidy eligibility.");
          }
          const month = new Date().toISOString().slice(0, 7);
          const used = await monthlySubsidisedUsed(customer.id, month);
          const limit = customer.monthlySubsidyLimitGallons || cfg.MONTHLY_SUBSIDY_LIMIT_GALLONS;
          if (used + Number(payload.capacityGallons) > limit) {
            throw new Error(`Monthly subsidised limit of ${limit} gallons would be exceeded.`);
          }
          status = "pending_approval";
        }
        const estimatedCharges = await estimateCharges(type === "group" ? "commercial" : type, payload.capacityGallons);
        const booking = await api().post("bookings", {
          ...payload,
          driverId: null,
          tankerId: null,
          estimatedCharges,
          status,
          statusHistory: appendHistory({}, status, session.userId, "Booking submitted"),
          createdAt: new Date().toISOString(),
        });
        await log(session.userId, "booking.create", `Booking #${booking.id} (${type})`);
        return booking;
      },
      async cancel(id, session, reason) {
        const booking = await api().get(`bookings/${id}`);
        if (!window.PLPerm.can("cancel_booking", session, booking)) {
          throw new Error("This booking cannot be cancelled.");
        }
        const updated = await api().patch(`bookings/${id}`, {
          status: "cancelled",
          cancelReason: reason || "Customer cancelled",
          statusHistory: appendHistory(booking, "cancelled", session.userId, reason || "Cancelled"),
        });
        await log(session.userId, "booking.cancel", `Booking #${id} cancelled`);
        return updated;
      },
      async confirm(id, session) {
        const booking = await api().get(`bookings/${id}`);
        if (!window.PLPerm.can("confirm_delivery", session, booking)) {
          throw new Error("Delivery cannot be confirmed in the current status.");
        }
        const updated = await api().patch(`bookings/${id}`, {
          status: "confirmed",
          customerConfirmedAt: new Date().toISOString(),
          statusHistory: appendHistory(booking, "confirmed", session.userId, "Customer confirmed delivery"),
        });
        await log(session.userId, "booking.confirm", `Booking #${id} confirmed`);
        return updated;
      },
      async approve(id, session, remarks) {
        const booking = await api().get(`bookings/${id}`);
        if (!window.PLPerm.can("approve_booking", session, booking)) {
          throw new Error("You cannot approve this booking.");
        }
        if (booking.status !== "pending_approval") throw new Error("Only pending subsidised bookings can be approved.");
        const updated = await api().patch(`bookings/${id}`, {
          status: "approved",
          officerRemarks: remarks || "Approved",
          statusHistory: appendHistory(booking, "approved", session.userId, remarks || "Approved by zone officer"),
        });
        const customer = await api().get(`customers/${booking.customerId}`);
        await notify(customer.userId, "Booking approved", `Subsidised booking #${id} was approved.`, "../customer/booking-details.html?id=" + id);
        await log(session.userId, "booking.approve", `Booking #${id} approved`);
        return updated;
      },
      async reject(id, session, remarks) {
        const booking = await api().get(`bookings/${id}`);
        if (!window.PLPerm.can("approve_booking", session, booking)) {
          throw new Error("You cannot reject this booking.");
        }
        if (!remarks) throw new Error("A rejection reason is required.");
        const updated = await api().patch(`bookings/${id}`, {
          status: "rejected",
          officerRemarks: remarks,
          statusHistory: appendHistory(booking, "rejected", session.userId, remarks),
        });
        const customer = await api().get(`customers/${booking.customerId}`);
        await notify(customer.userId, "Booking rejected", `Booking #${id}: ${remarks}`, "../customer/booking-details.html?id=" + id);
        await log(session.userId, "booking.reject", `Booking #${id} rejected`);
        return updated;
      },
    },
    subsidy: {
      list: (q) => api().get("subsidyApplications", q),
      get: (id) => api().get(`subsidyApplications/${id}`),
      async apply(body, session) {
        const existing = await api().get("subsidyApplications", { customerId: body.customerId, status: "pending" });
        if (existing.length) throw new Error("You already have a pending subsidy application.");
        const app = await api().post("subsidyApplications", {
          ...body,
          status: "pending",
          officerRemarks: "",
          createdAt: new Date().toISOString(),
        });
        await api().patch(`customers/${body.customerId}`, { subsidyStatus: "pending" });
        await log(session.userId, "subsidy.apply", `Subsidy application #${app.id}`);
        return app;
      },
      async decide(id, session, status, remarks) {
        const app = await api().get(`subsidyApplications/${id}`);
        const customer = await api().get(`customers/${app.customerId}`);
        if (!window.PLPerm.inZone(session, customer.zoneId)) throw new Error("This application is outside your zone.");
        if (!remarks && status === "rejected") throw new Error("A rejection reason is required.");
        const updated = await api().patch(`subsidyApplications/${id}`, {
          status,
          officerRemarks: remarks || (status === "verified" ? "Verified" : ""),
          reviewedAt: new Date().toISOString(),
        });
        await api().patch(`customers/${customer.id}`, { subsidyStatus: status === "verified" ? "verified" : "rejected" });
        await notify(customer.userId, "Subsidy decision", `Your subsidy application was ${status}. ${remarks || ""}`, "../customer/subsidy.html");
        await log(session.userId, "subsidy.decide", `Application #${id} ${status}`);
        return updated;
      },
    },
    dispatches: {
      list: (q) => api().get("dispatches", q),
      get: (id) => api().get(`dispatches/${id}`),
      async create(bookingId, tankerId, driverId, session) {
        const booking = await api().get(`bookings/${bookingId}`);
        if (booking.status === "pending_approval") throw new Error("Unapproved subsidised bookings cannot be dispatched.");
        if (!["pending", "approved"].includes(booking.status)) {
          throw new Error("Only pending commercial or approved bookings can be dispatched.");
        }
        if (!window.PLPerm.operatorHydrant(session, booking.hydrantId)) {
          throw new Error("You can only dispatch bookings for your assigned hydrant.");
        }
        const tanker = await api().get(`tankers/${tankerId}`);
        const driver = await api().get(`drivers/${driverId}`);
        if (tanker.status !== "available") throw new Error("Selected tanker is not available.");
        if (driver.status !== "available") throw new Error("Selected driver is not available.");
        if (Number(tanker.hydrantId) !== Number(booking.hydrantId)) {
          throw new Error("Tanker must belong to this hydrant fleet.");
        }
        if (Number(driver.hydrantId) !== Number(booking.hydrantId)) {
          throw new Error("Driver must belong to this hydrant.");
        }
        if (Number(tanker.capacityGallons) !== Number(booking.capacityGallons)) {
          throw new Error("Tanker capacity must match the booking capacity.");
        }
        if (await overlappingAssignment("tanker", tankerId, booking.preferredDate)) {
          throw new Error("This tanker already has a trip on the selected delivery date.");
        }
        if (await overlappingAssignment("driver", driverId, booking.preferredDate)) {
          throw new Error("This driver already has a trip on the selected delivery date.");
        }
        const hydrant = await api().get(`hydrants/${booking.hydrantId}`);
        const used = await hydrantUsageOn(hydrant.id, booking.preferredDate);
        if (used + Number(booking.capacityGallons) > Number(hydrant.dailyQuotaGallons)) {
          throw new Error("Dispatch would exceed the hydrant daily water quota.");
        }
        const dispatch = await api().post("dispatches", {
          bookingId: booking.id,
          hydrantId: booking.hydrantId,
          tankerId,
          driverId,
          deliveryDate: booking.preferredDate,
          fillingStartedAt: null,
          fillingCompletedAt: null,
          gallonsFilled: 0,
          departedAt: null,
          status: "assigned",
          createdAt: new Date().toISOString(),
        });
        const trip = await api().post("trips", {
          dispatchId: dispatch.id,
          bookingId: booking.id,
          driverId,
          tankerId,
          status: "assigned",
          failureReason: "",
          failureDescription: "",
          arrivedAt: null,
          completedAt: null,
          createdAt: new Date().toISOString(),
        });
        await api().patch(`bookings/${booking.id}`, {
          status: "dispatched",
          tankerId,
          driverId,
          dispatchId: dispatch.id,
          tripId: trip.id,
          statusHistory: appendHistory(booking, "dispatched", session.userId, `Tanker ${tanker.registrationNumber}, driver ${driver.name}`),
        });
        await api().patch(`tankers/${tankerId}`, { status: "in_service" });
        await api().patch(`drivers/${driverId}`, { status: "on_trip" });
        const customer = await api().get(`customers/${booking.customerId}`);
        await notify(customer.userId, "Tanker dispatched", `Booking #${booking.id} has been assigned a tanker and driver.`, "../customer/booking-details.html?id=" + booking.id);
        const driverUser = (await api().get("users", { driverId }))[0];
        if (driverUser) await notify(driverUser.id, "New trip assigned", `Trip for booking #${booking.id}.`, "../driver/trip-details.html?id=" + trip.id);
        await log(session.userId, "dispatch.create", `Dispatch #${dispatch.id} for booking #${booking.id}`);
        return { dispatch, trip };
      },
      async startFilling(dispatchId, session) {
        const dispatch = await api().get(`dispatches/${dispatchId}`);
        const booking = await api().get(`bookings/${dispatch.bookingId}`);
        const updated = await api().patch(`dispatches/${dispatchId}`, {
          status: "filling",
          fillingStartedAt: new Date().toISOString(),
        });
        await api().patch(`bookings/${booking.id}`, {
          status: "filling",
          statusHistory: appendHistory(booking, "filling", session.userId, "Filling started"),
        });
        await log(session.userId, "filling.start", `Dispatch #${dispatchId}`);
        return updated;
      },
      async completeFilling(dispatchId, gallonsFilled, session) {
        const n = Number(gallonsFilled);
        if (!Number.isFinite(n) || n <= 0) throw new Error("Gallons filled must be a positive number.");
        const dispatch = await api().get(`dispatches/${dispatchId}`);
        const booking = await api().get(`bookings/${dispatch.bookingId}`);
        const hydrant = await api().get(`hydrants/${dispatch.hydrantId}`);
        const used = await hydrantUsageOn(hydrant.id, dispatch.deliveryDate);
        if (used + n > Number(hydrant.dailyQuotaGallons)) {
          throw new Error("Gallons filled would exceed the hydrant daily quota.");
        }
        const updated = await api().patch(`dispatches/${dispatchId}`, {
          gallonsFilled: n,
          fillingCompletedAt: new Date().toISOString(),
        });
        await api().patch(`bookings/${booking.id}`, {
          statusHistory: appendHistory(booking, booking.status, session.userId, `Filled ${n} gallons`),
        });
        await log(session.userId, "filling.complete", `Dispatch #${dispatchId} filled ${n}`);
        return updated;
      },
      async depart(dispatchId, session) {
        const dispatch = await api().get(`dispatches/${dispatchId}`);
        if (!dispatch.fillingCompletedAt) throw new Error("Complete filling before recording departure.");
        const booking = await api().get(`bookings/${dispatch.bookingId}`);
        const updated = await api().patch(`dispatches/${dispatchId}`, {
          status: "departed",
          departedAt: new Date().toISOString(),
        });
        await api().patch(`bookings/${booking.id}`, {
          status: "departed",
          statusHistory: appendHistory(booking, "departed", session.userId, "Tanker departed hydrant"),
        });
        await log(session.userId, "dispatch.depart", `Dispatch #${dispatchId}`);
        return updated;
      },
    },
    trips: {
      list: (q) => api().get("trips", q),
      get: (id) => api().get(`trips/${id}`),
      async updateStatus(tripId, status, session, extra = {}) {
        const trip = await api().get(`trips/${tripId}`);
        if (!window.PLPerm.can("update_trip", session, trip)) throw new Error("You can only update your assigned trips.");
        const booking = await api().get(`bookings/${trip.bookingId}`);
        if (status === "failed") {
          if (!extra.failureReason) throw new Error("A failure reason is required.");
          if (extra.failureReason === "other" && !extra.failureDescription) {
            throw new Error("Please describe the failure when selecting Other.");
          }
        }
        const patch = { status };
        if (status === "arrived") patch.arrivedAt = new Date().toISOString();
        if (status === "delivered" || status === "failed") patch.completedAt = new Date().toISOString();
        if (status === "failed") {
          patch.failureReason = extra.failureReason;
          patch.failureDescription = extra.failureDescription || "";
        }
        const updated = await api().patch(`trips/${tripId}`, patch);
        await api().patch(`bookings/${booking.id}`, {
          status,
          statusHistory: appendHistory(booking, status, session.userId, extra.failureDescription || extra.failureReason || status),
        });
        if (status === "delivered" || status === "failed") {
          await api().patch(`dispatches/${trip.dispatchId}`, { status: status === "delivered" ? "completed" : "failed" });
          if (trip.tankerId) await api().patch(`tankers/${trip.tankerId}`, { status: "available" });
          if (trip.driverId) await api().patch(`drivers/${trip.driverId}`, { status: "available" });
          const customer = await api().get(`customers/${booking.customerId}`);
          await notify(
            customer.userId,
            status === "delivered" ? "Tanker delivered" : "Delivery failed",
            `Booking #${booking.id} is now ${status}.`,
            "../customer/booking-details.html?id=" + booking.id
          );
        }
        await log(session.userId, "trip.update", `Trip #${tripId} → ${status}`);
        return updated;
      },
    },
    payments: {
      list: (q) => api().get("payments", q),
      get: (id) => api().get(`payments/${id}`),
      create: (body) => api().post("payments", body),
    },
    disputes: {
      list: (q) => api().get("disputes", q),
      get: (id) => api().get(`disputes/${id}`),
      async open(bookingId, description, session) {
        if (!description || description.length < 10) throw new Error("Please describe the dispute in at least 10 characters.");
        const booking = await api().get(`bookings/${bookingId}`);
        if (!window.PLPerm.can("dispute_delivery", session, booking)) throw new Error("This delivery cannot be disputed.");
        const dispute = await api().post("disputes", {
          bookingId,
          customerId: booking.customerId,
          zoneId: booking.zoneId,
          description,
          status: "open",
          officerRemarks: "",
          createdAt: new Date().toISOString(),
        });
        await api().patch(`bookings/${bookingId}`, {
          status: "disputed",
          statusHistory: appendHistory(booking, "disputed", session.userId, description),
        });
        await log(session.userId, "dispute.open", `Dispute #${dispute.id}`);
        return dispute;
      },
      async resolve(id, remarks, session) {
        if (!remarks) throw new Error("Resolution remarks are required.");
        const dispute = await api().get(`disputes/${id}`);
        const booking = await api().get(`bookings/${dispute.bookingId}`);
        if (!window.PLPerm.can("resolve_dispute", session, booking)) throw new Error("You cannot resolve this dispute.");
        const updated = await api().patch(`disputes/${id}`, {
          status: "resolved",
          officerRemarks: remarks,
          resolvedAt: new Date().toISOString(),
        });
        await api().patch(`bookings/${booking.id}`, {
          status: "confirmed",
          statusHistory: appendHistory(booking, "confirmed", session.userId, "Dispute resolved: " + remarks),
        });
        const customer = await api().get(`customers/${booking.customerId}`);
        await notify(customer.userId, "Dispute resolved", remarks, "../customer/booking-details.html?id=" + booking.id);
        await log(session.userId, "dispute.resolve", `Dispute #${id}`);
        return updated;
      },
    },
    notifications: {
      list: (q) => api().get("notifications", q),
      markRead: (id) => api().patch(`notifications/${id}`, { read: true }),
    },
    rates: {
      list: () => api().get("rates"),
      update: (id, body) => api().patch(`rates/${id}`, body),
    },
    logs: {
      list: (q) => api().get("activityLogs", q),
    },
    groupBookings: {
      list: (q) => api().get("groupBookings", q),
      get: (id) => api().get(`groupBookings/${id}`),
      async create(payload, session) {
        if (!payload.groupName) throw new Error("Group or institution name is required.");
        const deliveries = payload.deliveries || [];
        if (deliveries.length < 2) throw new Error("A group booking needs at least two delivery addresses.");
        const totalGallons = deliveries.reduce((s, d) => s + Number(d.gallons || 0), 0);
        if (totalGallons <= 0) throw new Error("Total gallons must be greater than zero.");
        deliveries.forEach((d, i) => {
          if (!d.address) throw new Error(`Delivery ${i + 1} needs an address.`);
          if (!cfg.CAPACITIES.includes(Number(d.gallons))) {
            throw new Error(`Delivery ${i + 1} capacity must be 1,000, 3,000 or 6,000 gallons.`);
          }
        });
        const group = await api().post("groupBookings", {
          customerId: payload.customerId,
          groupName: payload.groupName,
          householdCount: Number(payload.householdCount),
          hydrantId: Number(payload.hydrantId),
          zoneId: Number(payload.zoneId),
          preferredDate: payload.preferredDate,
          preferredTime: payload.preferredTime,
          deliveries,
          totalGallons,
          status: "pending",
          createdAt: new Date().toISOString(),
        });
        for (const d of deliveries) {
          await Services.bookings.create(
            {
              customerId: payload.customerId,
              type: "group",
              capacityGallons: Number(d.gallons),
              zoneId: Number(payload.zoneId),
              hydrantId: Number(payload.hydrantId),
              deliveryAddress: d.address,
              preferredDate: payload.preferredDate,
              preferredTime: payload.preferredTime,
              groupBookingId: group.id,
              notes: `Group: ${payload.groupName}`,
            },
            session
          );
        }
        await log(session.userId, "group.create", `Group booking #${group.id}`);
        return group;
      },
    },
  };

  window.PLServices = Services;
})();
