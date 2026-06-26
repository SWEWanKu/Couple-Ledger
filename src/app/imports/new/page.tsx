import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AlertCircle, ArrowLeft, FileSpreadsheet, FileText, FileUp, ShieldCheck } from "lucide-react";
import { Card, Divider, Icon, Title } from "animal-island-ui";
import { IslandLink } from "@/components/IslandLink";
import { AppShell } from "@/components/layout/AppShell";
import { PrivateIslandTrail, islandTrailLabels } from "@/components/PrivateIslandTrail";
import { RitualSubmitButton } from "@/components/RitualSubmitButton";
import {
  getCreateImportBatchErrorMessage,
  getImportReviewHouseholdMembership,
  getMaxImportUploadMegabytes
} from "@/lib/import-review/batches";
import { createClient } from "@/lib/supabase/server";
import { createImportBatchAction } from "./actions";

type NewImportPageProps = {
  searchParams?: Promise<{
    error?: string | string[];
  }>;
};

export const metadata: Metadata = {
  title: "导入新账单 | 小岛账本"
};

const radioCardClassName =
  "relative flex cursor-pointer gap-3 rounded-[24px] border-2 border-dashed border-[#d9c49b] bg-[#fffdf3] px-4 py-4 text-[#725d42] shadow-[0_5px_0_rgba(121,79,39,0.08)] transition hover:-translate-y-0.5 hover:bg-white has-[:checked]:border-[#82d5bb] has-[:checked]:bg-[#e9fbf4] has-[:checked]:shadow-[0_5px_0_rgba(31,122,112,0.16)]";

export default async function NewImportPage({ searchParams }: NewImportPageProps) {
  const params = searchParams ? await searchParams : {};
  await requireImportsAccess();
  const errorMessage = getCreateImportBatchErrorMessage(getSingleParam(params.error));

  return (
    <AppShell title="导入新账单" subtitle="先把外部流水放进待对账池，不会直接入账">
      <div className="mx-auto grid max-w-5xl gap-6">
        <PrivateIslandTrail
          items={[
            { label: islandTrailLabels.home, href: "/dashboard" },
            { label: "待对账账单", href: "/imports" },
            { label: "导入新账单", current: true }
          ]}
        />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <IslandLink
            href="/imports"
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-[#d9c49b] bg-white px-4 py-2 text-sm font-black text-[#794f27] shadow-[0_5px_0_rgba(121,79,39,0.12)] transition hover:-translate-y-0.5 hover:shadow-[0_7px_0_rgba(121,79,39,0.12)] focus:outline-none focus:ring-4 focus:ring-[#19c8b9]/25"
          >
            <ArrowLeft aria-hidden="true" size={17} />
            回到待对账池
          </IslandLink>
        </div>

        <Card color="default" pattern="app-yellow" className="relative overflow-visible p-5 sm:p-7">
          <span
            aria-hidden="true"
            className="absolute -top-4 left-8 h-8 w-28 -rotate-2 rounded-[10px] bg-[#82d5bb]/65 shadow-[0_5px_0_rgba(121,79,39,0.08)]"
          />
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_260px]">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border-2 border-[#d9c49b] bg-white/85 px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-[#8a7556] shadow-[0_5px_0_rgba(121,79,39,0.1)]">
                <Icon name="icon-shopping" size={22} bounce />
                Upload Memo
              </p>
              <div className="mt-5">
                <Title size="large" color="app-yellow">
                  把账单放进待对账池
                </Title>
              </div>
              <p className="mt-5 max-w-2xl text-sm font-bold leading-7 text-[#725d42] sm:text-base">
                账单会先变成一叠待确认的小纸条。它不会直接写入正式账本，也不会改动结算；后续需要你们一条条确认后才会入账。
              </p>
            </div>

            <div className="rounded-[30px] border-2 border-dashed border-[#d9c49b] bg-[#fffdf3] p-5 shadow-[0_7px_0_rgba(121,79,39,0.09)]">
              <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-[#9f927d]">
                <ShieldCheck aria-hidden="true" size={17} />
                上传说明
              </p>
              <p className="mt-3 text-sm font-bold leading-7 text-[#725d42]">
                只保存解析后的待对账条目，不保存原始文件；最大 {getMaxImportUploadMegabytes()}MB。
              </p>
            </div>
          </div>

          <Divider type="wave-yellow" className="my-6" />

          {errorMessage ? <FormNotice tone="error" message={errorMessage} /> : null}

          <form action={createImportBatchAction} className="mt-5 grid gap-5" noValidate>
            <fieldset className="rounded-[28px] border-2 border-dashed border-[#d9c49b] bg-white/70 p-4">
              <legend className="px-2 text-sm font-black text-[#794f27]">账单来源</legend>
              <div className="grid gap-3 md:grid-cols-2">
                <label className={radioCardClassName}>
                  <input
                    className="mt-1 h-5 w-5 accent-[#19c8b9]"
                    defaultChecked
                    name="source"
                    type="radio"
                    value="wechat"
                  />
                  <span className="min-w-0">
                    <span className="flex items-center gap-2 text-base font-black text-[#794f27]">
                      <FileSpreadsheet aria-hidden="true" size={20} />
                      微信支付账单 xlsx
                    </span>
                    <span className="mt-1 block text-sm font-bold leading-6 text-[#725d42]">
                      选择微信支付导出的 .xlsx 文件。
                    </span>
                  </span>
                </label>

                <label className={radioCardClassName}>
                  <input className="mt-1 h-5 w-5 accent-[#19c8b9]" name="source" type="radio" value="alipay" />
                  <span className="min-w-0">
                    <span className="flex items-center gap-2 text-base font-black text-[#794f27]">
                      <FileText aria-hidden="true" size={20} />
                      支付宝账单 csv
                    </span>
                    <span className="mt-1 block text-sm font-bold leading-6 text-[#725d42]">
                      选择支付宝导出的 .csv 文件。
                    </span>
                  </span>
                </label>
              </div>
            </fieldset>

            <label className="grid gap-2 text-sm font-black text-[#794f27]" htmlFor="import-file">
              <span className="flex items-center gap-2">
                <FileUp aria-hidden="true" size={18} />
                选择账单文件
              </span>
              <input
                id="import-file"
                name="file"
                type="file"
                accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                required
                className="min-h-14 rounded-[22px] border-2 border-[#d9c49b] bg-[#fffdf3] px-4 py-3 text-sm font-bold text-[#725d42] shadow-[inset_0_0_0_2px_rgba(255,255,255,0.55)] file:mr-4 file:rounded-full file:border-0 file:bg-[#82d5bb] file:px-4 file:py-2 file:text-sm file:font-black file:text-white"
              />
            </label>

            <RitualSubmitButton
              block
              dataPendingScope="import-upload"
              icon="upload"
              idleLabel="放进待对账池"
              pendingLabel="正在整理账单..."
              ritual={{
                title: "正在把账单放进待对账池...",
                description: "不会直接写入正式账本，正在整理成待对账卡片。",
                iconName: "icon-shopping"
              }}
              size="large"
              type="primary"
            />
          </form>
        </Card>
      </div>
    </AppShell>
  );
}

async function requireImportsAccess() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const membership = await getImportReviewHouseholdMembership(supabase, user.id);

  if (!membership) {
    redirect("/not-invited");
  }

  return { supabase, user, membership };
}

function FormNotice({ tone, message }: { tone: "error"; message: string }) {
  const classes = tone === "error" ? "border-[#fc736d] bg-[#fff1ed] text-[#b14c46]" : "";

  return (
    <div
      role="alert"
      className={`mb-5 flex items-start gap-3 rounded-[24px] border-2 border-dashed px-4 py-3 text-sm font-black leading-6 ${classes}`}
    >
      <AlertCircle aria-hidden="true" size={18} className="mt-0.5 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

function getSingleParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}
