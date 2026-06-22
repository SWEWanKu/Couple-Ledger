import LoginClient from "./LoginClient";

export const dynamic = "force-dynamic";

function isDevLoginEnabled() {
  return process.env.NODE_ENV !== "production" && process.env.ENABLE_DEV_LOGIN === "true";
}

function isPartnerDevLoginConfigured() {
  return Boolean(process.env.DEV_LOGIN_PARTNER_EMAIL?.trim() && process.env.DEV_LOGIN_PARTNER_PASSWORD);
}

export default function LoginPage() {
  const devLoginEnabled = isDevLoginEnabled();

  return (
    <LoginClient
      isDevLoginEnabled={devLoginEnabled}
      isPartnerDevLoginConfigured={devLoginEnabled && isPartnerDevLoginConfigured()}
    />
  );
}
