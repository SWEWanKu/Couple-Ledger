import type { ImportDirection, SuggestedReviewAction } from "./types";

type SuggestionInput = {
  direction: ImportDirection;
  counterparty?: string | null;
  description?: string | null;
  sourceCategory?: string | null;
  sourceStatus?: string | null;
  paymentMethod?: string | null;
};

export function suggestImportReviewFields({
  direction,
  counterparty,
  description,
  sourceCategory,
  sourceStatus,
  paymentMethod
}: SuggestionInput): {
  suggestedCategory: string | null;
  suggestedReviewAction: SuggestedReviewAction;
} {
  const haystack = [counterparty, description, sourceCategory, sourceStatus, paymentMethod]
    .filter(Boolean)
    .join(" ");

  if (matches(haystack, skipKeywords) || direction === "transfer") {
    return {
      suggestedCategory: null,
      suggestedReviewAction: "skip"
    };
  }

  if (direction === "refund" || matches(haystack, needDiscussionKeywords)) {
    return {
      suggestedCategory: null,
      suggestedReviewAction: "need_discussion"
    };
  }

  return {
    suggestedCategory: suggestCategory(haystack),
    suggestedReviewAction: "review"
  };
}

function suggestCategory(value: string) {
  for (const rule of categoryRules) {
    if (matches(value, rule.keywords)) {
      return rule.category;
    }
  }

  return null;
}

function matches(value: string, keywords: readonly string[]) {
  return keywords.some((keyword) => value.includes(keyword));
}

const categoryRules = [
  {
    category: "餐饮",
    keywords: [
      "美团",
      "大众点评",
      "外卖",
      "麦当劳",
      "肯德基",
      "蜜雪冰城",
      "餐饮",
      "咖啡",
      "奶茶"
    ]
  },
  {
    category: "交通",
    keywords: ["地铁", "公交", "滴滴", "哈啰", "高德打车", "出租", "打车"]
  },
  {
    category: "购物",
    keywords: ["超市", "便利店", "淘宝", "天猫", "京东", "拼多多", "购物"]
  },
  {
    category: "住房",
    keywords: ["房租", "水电", "燃气", "物业", "宽带"]
  },
  {
    category: "娱乐",
    keywords: ["电影", "游戏", "KTV", "演出", "影院"]
  }
] as const;

const skipKeywords = [
  "提现",
  "充值",
  "转账",
  "余额宝",
  "零钱通",
  "理财",
  "基金",
  "不计收支"
];

const needDiscussionKeywords = ["退款", "退回", "已退款", "交易关闭", "关闭", "撤销"];
