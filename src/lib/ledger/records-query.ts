import {
  getCurrentMonthRange,
  normalizeRecordsMonth,
  type LedgerRecordFilters,
  type LedgerRecordTypeFilter
} from "@/lib/ledger/list-records";

export function getRecordsHref(month?: string | null, filters: LedgerRecordFilters = {}) {
  const query = getRecordsQuery(month, filters);

  return query ? `/records?${query}` : "/records";
}

export function getCurrentRecordsHref(filters: LedgerRecordFilters = {}, now: Date = new Date()) {
  return getRecordsHref(getCurrentMonthRange(now).month, filters);
}

export function getNewRecordHref(month?: string | null, filters: LedgerRecordFilters = {}) {
  const query = getRecordsQuery(month, filters);

  return query ? `/records/new?${query}` : "/records/new";
}

export function getRecordDetailHref(recordId: string, month: string, filters: LedgerRecordFilters = {}) {
  const query = getRecordsQuery(month, filters);

  return query ? `/records/${recordId}?${query}` : `/records/${recordId}`;
}

function getRecordsQuery(month?: string | null, filters: LedgerRecordFilters = {}) {
  const params = new URLSearchParams();
  const safeMonth = normalizeRecordsMonth(month);

  if (safeMonth) {
    params.set("month", safeMonth);
  }

  const type = normalizeRecordType(filters.type);

  if (type && type !== "all") {
    params.set("type", type);
  }

  const categoryId = normalizeQueryValue(filters.categoryId);

  if (categoryId) {
    params.set("category", categoryId);
  }

  const paidBy = normalizeQueryValue(filters.paidBy);

  if (paidBy) {
    params.set("member", paidBy);
  }

  const keyword = normalizeQueryValue(filters.keyword);

  if (keyword) {
    params.set("q", keyword.slice(0, 80));
  }

  return params.toString();
}

function normalizeRecordType(type: LedgerRecordTypeFilter | undefined) {
  return type === "all" || type === "expense" || type === "income" ? type : undefined;
}

function normalizeQueryValue(value: string | null | undefined) {
  const trimmed = value?.trim();

  return trimmed || null;
}
