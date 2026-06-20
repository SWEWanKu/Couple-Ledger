import type { LedgerStat, PendingBill, RecentBill } from "@/types/ledger";

export const mockDataNotice = "Mock/fallback 数据：尚未接入 Supabase，仅用于页面骨架展示。";

export const dashboardStats: LedgerStat[] = [
  {
    label: "本月共同支出",
    value: "¥4,286.30",
    helper: "覆盖房租、餐饮和日用品",
    tone: "teal"
  },
  {
    label: "本月我付款",
    value: "¥2,730.00",
    helper: "约占共同支出的 64%",
    tone: "coral"
  },
  {
    label: "本月对方付款",
    value: "¥1,556.30",
    helper: "等待后续同步真实账单",
    tone: "amber"
  },
  {
    label: "当前谁该还谁",
    value: "对方还我 ¥586.85",
    helper: "按 50/50 mock 规则估算",
    tone: "ink"
  }
];

export const pendingBills: PendingBill[] = [
  {
    id: "pending-001",
    title: "超市周末采购",
    payer: "我付款",
    amount: "¥368.40",
    date: "06-18"
  },
  {
    id: "pending-002",
    title: "两人晚餐",
    payer: "对方付款",
    amount: "¥216.00",
    date: "06-16"
  }
];

export const recentBills: RecentBill[] = [
  {
    id: "bill-001",
    title: "房租",
    payer: "我付款",
    share: "共同",
    amount: "¥3,000.00",
    date: "06-05"
  },
  {
    id: "bill-002",
    title: "咖啡豆",
    payer: "对方付款",
    share: "共同",
    amount: "¥128.00",
    date: "06-11"
  },
  {
    id: "bill-003",
    title: "地铁通勤",
    payer: "我付款",
    share: "个人",
    amount: "¥42.00",
    date: "06-13"
  }
];
