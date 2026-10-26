import InviteScreen from "@/components/invite/InviteScreen";

// Link de invitación personal que se manda por WhatsApp: /invitacion/<token>
export default async function InvitacionPage({ params }: PageProps<"/invitacion/[token]">) {
  const { token } = await params;
  return <InviteScreen key={token} token={token} />;
}
