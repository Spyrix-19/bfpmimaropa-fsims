import UsersLedger from "./UsersLedger";

export default function ActiveUsers() {
  return (
    <UsersLedger
      variant="active"
      title="Active Users"
      description="Members currently authorized to access FSIMS. Deactivate to revoke access."
    />
  );
}
