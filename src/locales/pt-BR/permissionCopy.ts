export const ptBRPermissionCopy = {
  workOrders: {
    emptyAssigned: {
      Pending: "Nenhuma OS pendente atribuída a você.",
      InProgress: "Nenhuma OS em andamento atribuída a você.",
      Completed: "Nenhuma OS concluída atribuída a você.",
      Canceled: "Nenhuma OS cancelada atribuída a você.",
    },
    execution: {
      assigneeLoading: "Carregando técnicos...",
      assigneeUpdated: "Técnico atualizado.",
      assigneeCleared: "Atribuição removida.",
    },
    errors: {
      notAssignedOrForbidden:
        "Você não tem permissão para ver esta ordem de serviço, ou ela não está atribuída a você.",
      assignFailed: "Não foi possível atualizar o técnico desta ordem de serviço.",
    },
  },
} as const
