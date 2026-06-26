"use client";

import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, HeartHandshake, LockKeyhole, Mail, Send, Sparkles } from "lucide-react";
import { Button, Card, Divider, Footer, Icon, Title, Wallet } from "animal-island-ui";
import { IslandRitualPending } from "@/components/IslandRitualPending";
import { IslandLink } from "@/components/IslandLink";
import { createClient } from "@/lib/supabase/client";

const leaves = [
  "left-[8%] top-[17%] rotate-[-24deg] bg-[#6fba2c]/45",
  "left-[5%] bottom-[20%] rotate-[18deg] bg-[#f7cd67]/50",
  "right-[8%] top-[22%] rotate-[30deg] bg-[#6fba2c]/40",
  "right-[13%] bottom-[15%] rotate-[-18deg] bg-[#f8f8f0]/45"
] as const;

const accessNotes = ["约定邮箱", "双人小岛", "不开放注册"] as const;

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

type LoginClientProps = {
  isDevLoginEnabled: boolean;
  isPartnerDevLoginConfigured: boolean;
};

export default function LoginClient({ isDevLoginEnabled, isPartnerDevLoginConfigured }: LoginClientProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [sentEmail, setSentEmail] = useState("");
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [status, setStatus] = useState<FormStatus>(initialStatus);
  const isBusy = isSendingOtp || isVerifyingOtp;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    if (params.get("error") === "auth_callback_failed") {
      setStatus({
        type: "error",
        message: "验证码验证失败，请重新发送一封新的验证码。"
      });
    }

    const devLoginStatus = params.get("devLogin");

    if (devLoginStatus === "failed") {
      setStatus({
        type: "error",
        message: "本地测试登录失败，请检查本机测试账号配置。"
      });
    }

    if (devLoginStatus === "partner_missing") {
      setStatus({
        type: "error",
        message:
          "第二位本地测试账号还没配置。请在 .env.local 设置 DEV_LOGIN_PARTNER_EMAIL 和 DEV_LOGIN_PARTNER_PASSWORD；系统不会自动创建用户或成员。"
      });
    }

    if (devLoginStatus === "partner_failed") {
      setStatus({
        type: "error",
        message: "\u7b2c\u4e8c\u4f4d\u672c\u5730\u6d4b\u8bd5\u767b\u5f55\u5931\u8d25\uff0c\u8bf7\u786e\u8ba4\u8fd9\u4e2a\u90ae\u7bb1\u3001\u5bc6\u7801\u548c\u5c0f\u5c9b\u6210\u5458\u5173\u7cfb\u90fd\u5df2\u914d\u7f6e\u597d\u3002"
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

      setStatus({ type: "success", message: "验证成功，正在进入小岛..." });
      router.push("/dashboard");
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

        <section className="relative z-10 mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-5xl items-center py-4 sm:py-6">
          <div className="relative w-full rounded-[34px] border-[7px] border-[#e3bd74] bg-[#f8f8f0] p-3 shadow-[0_16px_0_rgba(93,112,67,0.32),0_30px_70px_rgba(55,86,54,0.26)] sm:rounded-[48px] sm:p-5">
            <div aria-hidden="true" className="absolute -left-3 top-20 h-8 w-8 rounded-full bg-[#f7cd67] shadow-[0_5px_0_rgba(121,79,39,0.16)] sm:-left-5 sm:h-12 sm:w-12" />
            <div aria-hidden="true" className="absolute -right-3 bottom-24 h-10 w-10 rounded-full bg-[#82d5bb] shadow-[0_5px_0_rgba(121,79,39,0.12)] sm:-right-6 sm:h-14 sm:w-14" />

            <div className="rounded-[26px] border-2 border-dashed border-[#d9c49b] bg-[rgb(247,243,223)] px-4 py-6 shadow-[inset_0_0_0_6px_rgba(255,255,255,0.42)] sm:rounded-[38px] sm:px-7 lg:px-10">
              <IslandLink
                href="/"
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-white/80 px-4 py-2 text-sm font-black text-[#9f927d] shadow-[0_5px_0_rgba(121,79,39,0.12)] transition hover:-translate-y-0.5 hover:text-[#794f27] hover:shadow-[0_7px_0_rgba(121,79,39,0.12)] focus:outline-none focus:ring-4 focus:ring-[#19c8b9]/25"
              >
                <ArrowLeft aria-hidden="true" size={17} />
                返回首页
              </IslandLink>

              <div className="mt-5 flex flex-col items-center gap-3 text-center">
                <div className="inline-flex items-center gap-2 rounded-full bg-white/75 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-[#9f927d] shadow-[0_5px_0_rgba(121,79,39,0.12)]">
                  <Icon name="icon-map" size={22} bounce />
                  Island Pass
                  <Icon name="icon-chat" size={22} bounce />
                </div>
                <h1 className="sr-only">进入小岛</h1>
                <Title size="large" color="app-yellow" style={{ fontSize: 36 }}>
                  进入小岛
                </Title>
                <p className="text-xl font-black leading-tight text-[#794f27] sm:text-2xl">小岛账本</p>
                <p className="max-w-2xl text-sm font-bold leading-7 text-[#725d42] sm:text-base">
                  输入邮箱验证码，回到只属于两个人的小岛
                </p>
              </div>

              <div className="mt-7 grid items-stretch gap-5 lg:grid-cols-[1.02fr_0.98fr]">
                <Card color="default" pattern="app-teal" className="p-5 sm:p-6">
                  <div className="flex items-start gap-4">
                    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#82d5bb] text-white shadow-[0_6px_0_#5fb89f]">
                      <LockKeyhole aria-hidden="true" size={27} />
                    </span>
                    <div>
                      <p className="text-lg font-black text-[#794f27]">仅限两个人使用，不开放注册</p>
                      <p className="mt-2 text-sm font-bold leading-7 text-[#725d42]">
                        QQ 邮箱可能会在不同页面打开链接，复制邮件里的验证码回来填写会更稳。
                      </p>
                    </div>
                  </div>

                  <Divider type="wave-yellow" className="my-5" />

                  <form className="grid gap-4" aria-label="小岛账本登录表单" onSubmit={handleSubmit} noValidate>
                    <label className="grid gap-2 text-sm font-black text-[#794f27]" htmlFor="login-email">
                      邮箱
                    </label>
                    <div className="relative">
                      <Mail
                        aria-hidden="true"
                        className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#9f927d]"
                        size={18}
                      />
                      <input
                        id="login-email"
                        type="email"
                        value={email}
                        onChange={handleEmailChange}
                        placeholder="you@example.com"
                        disabled={isBusy}
                        aria-invalid={status.type === "error"}
                        aria-describedby="login-email-status"
                        className="h-14 w-full rounded-full border-2 border-[#d9c49b] bg-[#fffdf3] pl-12 pr-4 text-sm font-bold text-[#794f27] shadow-[inset_0_0_0_4px_rgba(255,255,255,0.5),0_5px_0_rgba(121,79,39,0.08)] outline-none transition placeholder:text-[#9f927d]/70 focus:border-[#19c8b9] focus:ring-4 focus:ring-[#19c8b9]/25"
                      />
                    </div>

                    {isOtpSent ? (
                      <div className="grid gap-2">
                        <label className="grid gap-2 text-sm font-black text-[#794f27]" htmlFor="login-otp">
                          邮箱验证码
                        </label>
                        <div className="relative">
                          <LockKeyhole
                            aria-hidden="true"
                            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#9f927d]"
                            size={18}
                          />
                          <input
                            id="login-otp"
                            type="text"
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            value={otp}
                            onChange={(event) => setOtp(event.target.value)}
                            placeholder="123456"
                            disabled={isBusy}
                            aria-invalid={status.type === "error"}
                            aria-describedby="login-email-status"
                            className="h-14 w-full rounded-full border-2 border-[#d9c49b] bg-[#fffdf3] pl-12 pr-4 text-center text-lg font-black tracking-[0.24em] text-[#794f27] shadow-[inset_0_0_0_4px_rgba(255,255,255,0.5),0_5px_0_rgba(121,79,39,0.08)] outline-none transition placeholder:text-[#9f927d]/70 focus:border-[#19c8b9] focus:ring-4 focus:ring-[#19c8b9]/25"
                          />
                        </div>
                      </div>
                    ) : null}

                    <Button
                      type="primary"
                      size="large"
                      htmlType="submit"
                      block
                      disabled={isBusy}
                      icon={<Send aria-hidden="true" size={18} />}
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

                    {isVerifyingOtp ? (
                      <IslandRitualPending
                        compact
                        dataScope="login-entry"
                        description="通行信已经对上，正在把你送回两个人的私密账本。"
                        iconName="icon-map"
                        title="正在打开两个人的小岛..."
                      />
                    ) : isSendingOtp ? (
                      <IslandRitualPending
                        compact
                        dataScope="login-send-otp"
                        description="验证码只用于这次登岛，不会公开任何账本内容。"
                        iconName="icon-chat"
                        title="正在寄出小岛通行信..."
                      />
                    ) : null}
                  </form>

                  {isDevLoginEnabled ? (
                    <div className="mt-4 grid gap-3 rounded-[24px] border-2 border-dashed border-[#19c8b9] bg-[#e6f6ee]/80 p-3 shadow-[0_5px_0_rgba(47,122,90,0.14)]">
                      <p className="text-xs font-black leading-5 text-[#2f7a5a]">本地双人烟测入口</p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <IslandLink
                          href="/dev-login"
                          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border-2 border-dashed border-[#19c8b9] bg-[#e6f6ee] px-4 py-2 text-center text-sm font-black leading-5 text-[#2f7a5a] shadow-[0_5px_0_rgba(47,122,90,0.16)] transition hover:-translate-y-0.5 hover:shadow-[0_7px_0_rgba(47,122,90,0.16)] focus:outline-none focus:ring-4 focus:ring-[#19c8b9]/25"
                        >
                          <Sparkles aria-hidden="true" size={18} />
                          本地测试登录 · 我
                        </IslandLink>
                        {isPartnerDevLoginConfigured ? (
                          <IslandLink
                            href="/dev-login?persona=partner"
                            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border-2 border-dashed border-[#f7cd67] bg-[#fff8da] px-4 py-2 text-center text-sm font-black leading-5 text-[#794f27] shadow-[0_5px_0_rgba(121,79,39,0.14)] transition hover:-translate-y-0.5 hover:shadow-[0_7px_0_rgba(121,79,39,0.14)] focus:outline-none focus:ring-4 focus:ring-[#f7cd67]/35"
                          >
                            <Sparkles aria-hidden="true" size={18} />
                            本地测试登录 · 对方
                          </IslandLink>
                        ) : null}
                      </div>
                      <p className="rounded-[18px] bg-white/75 px-3 py-2 text-[11px] font-bold leading-5 text-[#725d42] shadow-[inset_0_0_0_2px_rgba(217,196,155,0.45)]">
                        {isPartnerDevLoginConfigured ? (
                          "\u7b2c\u4e8c\u4f4d\u5165\u53e3\u53ea\u4f1a\u767b\u5f55\u5df2\u52a0\u5165\u5c0f\u5c9b\u540d\u518c\u7684\u90ae\u7bb1\uff0c\u5e76\u786e\u8ba4\u662f\u5426\u5c5e\u4e8e\u540c\u4e00\u4e2a\u5c0f\u5c9b\u3002"
                        ) : (
                          <>
                            第二位本地测试账号未配置：
                            <code className="font-black">DEV_LOGIN_PARTNER_EMAIL</code>
                            {" / "}
                            <code className="font-black">DEV_LOGIN_PARTNER_PASSWORD</code>
                            。不会自动创建用户或成员。
                          </>
                        )}
                      </p>
                    </div>
                  ) : null}

                  <div
                    id="login-email-status"
                    role={status.type === "error" ? "alert" : "status"}
                    aria-live="polite"
                    className={`mt-5 rounded-[24px] border-2 border-dashed px-4 py-3 text-xs font-black leading-6 ${
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
                </Card>

                <Card color="default" pattern="app-yellow" className="relative overflow-hidden p-5 sm:p-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-[#9f927d]">Private Dock</p>
                      <h2 className="mt-2 text-3xl font-black text-[#794f27]">邮箱验证码</h2>
                      <p className="mt-2 text-sm font-bold leading-7 text-[#725d42]">
                        像一张放在码头边的便签，只验证邮箱暗号，不展示真实账本。
                      </p>
                    </div>
                    <Wallet value="2 人" size="small" />
                  </div>

                  <Divider type="dashed-brown" className="my-5" />

                  <div className="rounded-[30px] bg-[#fffdf3] p-4 shadow-[inset_0_0_0_2px_rgba(217,196,155,0.72),0_8px_0_rgba(121,79,39,0.10)]">
                    <div className="flex items-center justify-between gap-3 rounded-[24px] bg-[#82d5bb] px-4 py-3 text-white shadow-[0_5px_0_#5fb89f]">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.14em] opacity-80">Only Us</p>
                        <p className="text-xl font-black">只属于两个人</p>
                      </div>
                      <Icon name="icon-helicopter" size={34} bounce />
                    </div>

                    <div className="mt-4 grid gap-3">
                      {accessNotes.map((note, index) => (
                        <div
                          key={note}
                          className="grid grid-cols-[auto_1fr] items-center gap-3 rounded-[22px] bg-[#f8f8f0] px-4 py-3 text-[#725d42] shadow-[0_3px_0_rgba(121,79,39,0.08)]"
                        >
                          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#f7cd67] text-[#794f27]">
                            {index === 0 ? (
                              <Mail aria-hidden="true" size={18} />
                            ) : index === 1 ? (
                              <HeartHandshake aria-hidden="true" size={18} />
                            ) : (
                              <Sparkles aria-hidden="true" size={18} />
                            )}
                          </span>
                          <span className="min-w-0 text-sm font-black text-[#794f27]">{note}</span>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[22px] bg-[#f7cd67]/55 px-4 py-3 text-sm font-black text-[#794f27]">
                      <span>仅限两个人使用，不开放注册</span>
                      <span>Preview only</span>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          </div>
        </section>

      <Footer type="sea" seamless className="pointer-events-none absolute bottom-0 left-0 right-0 opacity-80" />
    </main>
  );
}
