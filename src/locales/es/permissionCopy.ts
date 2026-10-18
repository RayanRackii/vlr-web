export const esPermissionCopy = {
  workOrders: {
    emptyAssigned: {
      Pending: "No hay OT pendientes asignadas a usted.",
      InProgress: "No hay OT en curso asignadas a usted.",
      Completed: "No hay OT completadas asignadas a usted.",
      Canceled: "No hay OT canceladas asignadas a usted.",
    },
    execution: {
      assigneeLoading: "Cargando técnicos...",
      assigneeUpdated: "Técnico actualizado.",
      assigneeCleared: "Asignación quitada.",
    },
    errors: {
      notAssignedOrForbidden:
        "No tiene permiso para ver esta orden de trabajo, o no está asignada a usted.",
      assignFailed: "No se pudo actualizar el técnico de esta orden de trabajo.",
    },
  },
} as const
