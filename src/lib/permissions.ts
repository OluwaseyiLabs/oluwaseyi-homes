/** Everything a role can be allowed to do. A role holds some of these; the Owner role always holds all of them. */
export const permissionList = [
  { key: "view", label: "See the dashboard, traffic, leads and transactions" },
  { key: "submissions", label: "See owner submissions and mark them contacted" },
  { key: "drafts", label: "Add and edit properties as drafts" },
  { key: "publish", label: "Publish, unpublish and delete properties" },
  { key: "approve", label: "Approve or reject owner submissions, and add owners and agreements" },
  { key: "release", label: "Approve enquiries and release the landlord's contact to the client" },
  { key: "transactions", label: "Update lead and transaction statuses, check completions, issue invoices and confirm payments" },
  { key: "content", label: "Edit website text, images and company name" },
  { key: "refunds", label: "Send refunds of listing fees to owners (moves money out of the Paystack balance)" },
  { key: "team", label: "Invite team members, create roles, change what roles can do, and change the fees" },
] as const;

export const BUILT_IN_ROLES = ["Owner", "Manager", "Staff"];
