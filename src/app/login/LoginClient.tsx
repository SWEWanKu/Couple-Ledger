"use client";

import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Divider, Footer, Icon, Input, Loading, Title } from "animal-island-ui";
import { createClient } from "@/lib/supabase/client";

const leaves = [
  "left-[8%] top-[17%] rotate-[-24deg] bg-[#6fba2c]/45",
  "left-[5%] bottom-[20%] rotate-[18deg] bg-[#f7cd67]/50",
  "right-[8%] top-[22%] rotate-[30deg] bg-[#6fba2c]/40",
  "right-[13%] bottom-[15%] rotate-[-18deg] bg-[#f8f8f0]/45"
] as const;

type FormStatus = {
  type: "idle" | "success" | "error";
  message: string;
};

const initialStatus: FormStatus = {
  type: "idle",
  message: "输入约定好的邮箱，我们会寄出邮箱验证码。"
};

function isEmailLike(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function getErrorText(error: unknown, key: "code" | "message") {
  if (typeof error !== "object" || error === null || !(key in error)) {
    return "";
  }

  const value = (error as Record<string, unknown>)[key];

  return typeof value === "string" ? value.trim() : "";
}

function getErrorStatus(error: unknown) {
  if (typeof error !== "object" || error === null || !("status" in error)) {
    return 0;
  }

  const value = (error as Record<string, unknown>).status;

  return typeof value === "number" ? value : 0;
}

function getSafeErrorMessage(error: unknown, fallback: string, serverErrorMessage = "认证服务暂时不可用，请稍后再试。") {
  const code = getErrorText(error, "code");
  const message = error instanceof Error ? error.message.trim() : getErrorText(error, "message");
  const normalizedMessage = message.toLowerCase();
  const status = getErrorStatus(error);

  if (
    status >= 500 ||
    code === "unexpected_failure" ||
    normalizedMessage.includes("error sending magic link email")
  ) {
    return serverErrorMessage;
  }

  if (code === "signup_disabled" || normalizedMessage.includes("signups not allowed")) {
    return "\u8fd9\u4e2a\u90ae\u7bb1\u8fd8\u6ca1\u6709\u52a0\u5165\u5c0f\u5c9b\u540d\u518c\uff0c\u8bf7\u5148\u6dfb\u52a0\u4e3a\u53ef\u767b\u5f55\u90ae\u7bb1\u3002";
  }

  if (normalizedMessage.includes("rate limit") || normalizedMessage.includes("too many")) {
    return "验证码发送太频繁，请稍等一分钟后再试。";
  }

  if (message && message !== "{}") {
    return message;
  }

  if (typeof error === "string") {
    const text = error.trim();

    if (text && text !== "{}") {
      return text;
    }
  }

  return fallback;
}

export default function LoginClient() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [sentEmail, setSentEmail] = useState("");
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [isEnteringIsland, setIsEnteringIsland] = useState(false);
  const [status, setStatus] = useState<FormStatus>(initialStatus);
  const isBusy = isSendingOtp || isVerifyingOtp || isEnteringIsland;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    if (params.get("error") === "auth_callback_failed") {
      setStatus({
        type: "error",
        message: "验证码验证失败，请重新发送一封新的验证码。"
      });
    }
  }, []);

  function handleEmailChange(event: ChangeEvent<HTMLInputElement>) {
    const nextEmail = event.target.value;
    setEmail(nextEmail);

    if (isOtpSent && nextEmail.trim() !== sentEmail) {
      setOtp("");
      setIsOtpSent(false);
      setSentEmail("");
      setStatus(initialStatus);
    }
  }

  function validateEmail() {
    const normalizedEmail = email.trim();

    if (!normalizedEmail) {
      setStatus({ type: "error", message: "请输入约定邮箱。" });
      return null;
    }

    if (!isEmailLike(normalizedEmail)) {
      setStatus({ type: "error", message: "请输入有效的邮箱地址。" });
      return null;
    }

    return normalizedEmail;
  }

  async function handleSendOtp() {
    const normalizedEmail = validateEmail();

    if (!normalizedEmail) {
      return;
    }

    setIsSendingOtp(true);
    setStatus(initialStatus);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email: normalizedEmail,
        options: {
          shouldCreateUser: false
        }
      });

      if (error) {
        throw error;
      }

      setSentEmail(normalizedEmail);
      setIsOtpSent(true);
      setOtp("");
      setStatus({ type: "success", message: "验证码已经寄出，请去邮箱查收" });
    } catch (error) {
      setStatus({
        type: "error",
        message: getSafeErrorMessage(
          error,
          "验证码寄送失败，请稍后再试。",
          "\u90ae\u4ef6\u670d\u52a1\u6682\u65f6\u4e0d\u53ef\u7528\uff0c\u8bf7\u7a0d\u540e\u518d\u8bd5\u6216\u68c0\u67e5\u90ae\u4ef6\u914d\u7f6e\u3002"
        )
      });
    } finally {
      setIsSendingOtp(false);
    }
  }

  async function handleVerifyOtp() {
    const normalizedEmail = validateEmail();
    const normalizedOtp = otp.replace(/\s+/g, "");

    if (!normalizedEmail) {
      return;
    }

    if (!normalizedOtp) {
      setStatus({ type: "error", message: "请输入邮箱验证码。" });
      return;
    }

    if (sentEmail && normalizedEmail !== sentEmail) {
      setStatus({ type: "error", message: "邮箱已修改，请重新发送验证码。" });
      setIsOtpSent(false);
      setOtp("");
      return;
    }

    setIsVerifyingOtp(true);
    setStatus({ type: "idle", message: "正在验证邮箱验证码..." });

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.verifyOtp({
        email: normalizedEmail,
        token: normalizedOtp,
        type: "email"
      });

      if (error) {
        throw error;
      }

      setIsEnteringIsland(true);
      setStatus({ type: "success", message: "验证成功，正在进入小岛..." });
      window.setTimeout(() => router.push("/dashboard"), 650);
    } catch (error) {
      setStatus({
        type: "error",
        message: getSafeErrorMessage(error, "验证码验证失败，请检查后再试。")
      });
    } finally {
      setIsVerifyingOtp(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isOtpSent) {
      void handleVerifyOtp();
      return;
    }

    void handleSendOtp();
  }

  return (
    <main
      className="relative min-h-screen overflow-hidden bg-[#7DC395] px-3 py-4 text-[#794f27] sm:px-6 lg:px-8"
      style={{
        fontFamily:
          'Nunito, "Noto Sans SC", -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif'
      }}
    >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-90"
          style={{
            backgroundImage:
              "radial-gradient(circle at 18% 16%, rgba(248,248,240,0.34) 0 74px, transparent 75px), radial-gradient(circle at 86% 18%, rgba(247,205,103,0.34) 0 96px, transparent 97px), radial-gradient(circle at 6% 72%, rgba(25,200,185,0.22) 0 120px, transparent 121px), linear-gradient(135deg, rgba(255,255,255,0.17) 0 11%, transparent 11% 50%, rgba(255,255,255,0.12) 50% 61%, transparent 61% 100%)",
            backgroundSize: "auto, auto, auto, 40px 40px"
          }}
        />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-[linear-gradient(180deg,rgba(248,248,240,0.2),transparent)]" />
        <div className="pointer-events-none absolute -bottom-14 left-[-10%] h-44 w-[120%] rounded-[50%_50%_0_0] bg-[#6fba2c]/28" />
        {leaves.map((leaf) => (
          <span
            key={leaf}
            aria-hidden="true"
            className={`pointer-events-none absolute h-9 w-5 rounded-[100%_0_100%_0] ${leaf}`}
          />
        ))}

        <section className="relative z-10 mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-lg items-center py-4 sm:py-6">
          <Card color="default" pattern="app-teal" className="relative w-full overflow-hidden p-5 shadow-[0_14px_0_rgba(93,112,67,0.24),0_26px_54px_rgba(55,86,54,0.22)] sm:p-6">
            <div aria-hidden="true" className="absolute -right-10 -top-12 h-28 w-28 rounded-full bg-[#f7cd67]/25" />
            <div aria-hidden="true" className="absolute -bottom-10 -left-10 h-28 w-28 rounded-full bg-[#82d5bb]/25" />

            <div className="relative text-center">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/75 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-[#9f927d] shadow-[0_5px_0_rgba(121,79,39,0.10)]">
                <Icon name="icon-map" size={21} bounce />
                Island Pass
              </div>
              <h1 className="sr-only">小岛账本</h1>
              <div className="mt-3">
                <Title size="large" color="app-yellow" style={{ fontSize: 32 }}>
                  小岛账本
                </Title>
              </div>
              <p className="mt-3 text-lg font-black text-[#794f27]">两个人的小账本入口</p>
              <p className="mx-auto mt-2 max-w-sm text-sm font-bold leading-6 text-[#725d42]">
                输入邮箱验证码，回到只属于两个人的小岛。
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2 text-xs font-black text-[#725d42]">
                <span className="rounded-full bg-white/75 px-3 py-2 shadow-[inset_0_0_0_2px_rgba(217,196,155,0.45)]">
                  仅限两个人使用
                </span>
                <span className="rounded-full bg-white/75 px-3 py-2 shadow-[inset_0_0_0_2px_rgba(217,196,155,0.45)]">
                  不开放注册
                </span>
              </div>
            </div>

            <Divider type="wave-yellow" className="my-5" />

            <form className="relative grid gap-4" aria-label="小岛账本登录表单" onSubmit={handleSubmit} noValidate>
              <label className="grid gap-2 text-sm font-black text-[#794f27]" htmlFor="login-email">
                邮箱
              </label>
              <Input
                id="login-email"
                type="email"
                size="middle"
                shadow
                value={email}
                onChange={handleEmailChange}
                placeholder="you@example.com"
                disabled={isBusy}
                aria-invalid={status.type === "error"}
                aria-describedby="login-email-status"
                prefix={<Icon name="icon-chat" size={18} />}
              />

              {isOtpSent ? (
                <div className="grid gap-2">
                  <label className="grid gap-2 text-sm font-black text-[#794f27]" htmlFor="login-otp">
                    邮箱验证码
                  </label>
                  <Input
                    id="login-otp"
                    type="text"
                    size="middle"
                    shadow
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={otp}
                    onChange={(event) => setOtp(event.target.value)}
                    placeholder="123456"
                    disabled={isBusy}
                    aria-invalid={status.type === "error"}
                    aria-describedby="login-email-status"
                    prefix={<Icon name="icon-design" size={18} />}
                  />
                </div>
              ) : null}

              <Button
                type="primary"
                size="middle"
                htmlType="submit"
                block
                disabled={isBusy}
                icon={<Icon name="icon-helicopter" size={18} />}
              >
                {isOtpSent ? "\u9a8c\u8bc1\u5e76\u8fdb\u5165\u5c0f\u5c9b" : "\u53d1\u9001\u90ae\u7bb1\u9a8c\u8bc1\u7801"}
              </Button>

              {isOtpSent ? (
                <Button
                  type="dashed"
                  size="middle"
                  htmlType="button"
                  block
                  disabled={isBusy}
                  onClick={() => void handleSendOtp()}
                >
                  重新发送验证码
                </Button>
              ) : null}
            </form>

            {status.type === "idle" && !isOtpSent ? (
              <p id="login-email-status" className="relative mt-4 text-center text-xs font-bold leading-5 text-[#9f927d]">
                {status.message}
              </p>
            ) : (
              <div
                id="login-email-status"
                role={status.type === "error" ? "alert" : "status"}
                aria-live="polite"
                className={`relative mt-4 rounded-[20px] border-2 border-dashed px-4 py-3 text-xs font-black leading-6 ${
                  status.type === "success"
                    ? "border-[#82d5bb] bg-[#e6f6ee] text-[#2f7a5a]"
                    : status.type === "error"
                      ? "border-[#fc736d] bg-[#fff1ed] text-[#b14c46]"
                      : "border-[#d9c49b] bg-white/75 text-[#9f927d]"
                }`}
              >
                {status.message}
                {isOtpSent ? (
                  <span className="mt-2 block text-[#725d42]">
                    如果 QQ 邮箱没有自动跳回浏览器，请复制验证码回到这里填写。
                  </span>
                ) : null}
              </div>
            )}
          </Card>
        </section>

      {isEnteringIsland ? (
        <div className="fixed inset-0 z-50 bg-black" role="status" aria-label="正在进入小岛">
          <Loading active />
        </div>
      ) : null}
      <Footer type="sea" seamless className="pointer-events-none absolute bottom-0 left-0 right-0 opacity-80" />
    </main>
  );
}
