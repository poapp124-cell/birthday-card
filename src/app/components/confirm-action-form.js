"use client";

export default function ConfirmActionForm({
  action,
  message,
  buttonLabel,
  hiddenFields = [],
  className,
  buttonClassName,
}) {
  function confirmAction(event) {
    if (!window.confirm(message)) event.preventDefault();
  }

  return (
    <form action={action} onSubmit={confirmAction} className={className}>
      {hiddenFields.map(({ name, value }) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <button className={buttonClassName} type="submit">
        {buttonLabel}
      </button>
    </form>
  );
}
