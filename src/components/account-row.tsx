type AccountRowProps = {
  username: string;
  name: string;
  status?: string;
  initials: string;
};

export function AccountRow({ username, name, status = "Not following you", initials }: AccountRowProps) {
  return (
    <article className="accountRow">
      <div className="avatar" aria-hidden="true">{initials}</div>
      <div className="accountCopy">
        <strong>{username}</strong>
        <span>{name}</span>
        <small>{status}</small>
      </div>
      <button className="rowAction" type="button">Review</button>
    </article>
  );
}
