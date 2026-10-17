export function FormValidationSummary({ messages }: { messages: string[] }) {
  if (messages.length === 0) {
    return null
  }

  return (
    <ul
      role="status"
      data-testid="form-validation-summary"
      className="list-disc space-y-1 pl-5 text-sm text-destructive"
    >
      {messages.map((message) => (
        <li key={message}>{message}</li>
      ))}
    </ul>
  )
}

export function LiveFieldMessage({ message }: { message?: string }) {
  if (!message) {
    return null
  }

  return <p className="text-sm text-destructive">{message}</p>
}
