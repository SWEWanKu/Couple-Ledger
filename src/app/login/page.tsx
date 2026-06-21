import LoginClient from "./LoginClient";

export const dynamic = "force-dynamic";

function isDevLoginEnabled() {
  return process.env.NODE_ENV !== "production" && process.env.ENABLE_DEV_LOGIN === "true";
}

export default function LoginPage() {
  return <LoginClient isDevLoginEnabled={isDevLoginEnabled()} />;
}
