import UsersLedger from "./UsersLedger";

export default function AvailableUsers() {
  return (
    <UsersLedger
      variant="available"
      title="Available Users"
      description="Members not yet granted access to FSIMS. Activate to enable system access."
    />
  );
}
