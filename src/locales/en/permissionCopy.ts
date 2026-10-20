export const enPermissionCopy = {
  workOrders: {
    emptyAssigned: {
      Open: "No open work orders are assigned to you.",
      Pending: "No pending work orders are assigned to you.",
      InProgress: "No in-progress work orders are assigned to you.",
      Completed: "No completed work orders are assigned to you.",
      Canceled: "No canceled work orders are assigned to you.",
    },
    execution: {
      assigneeLoading: "Loading technicians...",
      assigneeUpdated: "Technician updated.",
      assigneeCleared: "Assignment cleared.",
    },
    errors: {
      notAssignedOrForbidden:
        "You do not have permission to view this work order, or it is not assigned to you.",
      assignFailed: "Could not update the technician on this work order.",
    },
  },
} as const
