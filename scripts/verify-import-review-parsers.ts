import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  parseAlipayCsv,
  parseWeChatXlsx,
  type NormalizedImportItemDraft
} from "../src/lib/import-review";

const projectRoot = process.cwd();
const fixturesDir = path.join(projectRoot, "fixtures", "import-review");

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

async function main() {
  const alipayCsv = await readFile(path.join(fixturesDir, "alipay-sample.csv"), "utf8");
  const alipayGbkCsv = Buffer.from(
    (await readFile(path.join(fixturesDir, "alipay-gbk-sample.csv.b64"), "utf8")).trim(),
    "base64"
  );
  const wechatXlsx = await readFile(path.join(fixturesDir, "wechat-sample.xlsx"));

  const alipayItems = parseAlipayCsv(alipayCsv);
  const alipayGbkItems = parseAlipayCsv(alipayGbkCsv);
  const wechatItems = await parseWeChatXlsx(wechatXlsx);

  assert.equal(alipayItems.length, 5, "Alipay fixture should produce five drafts");
  assert.equal(alipayGbkItems.length, 2, "GBK Alipay fixture should produce two drafts");
  assert.equal(wechatItems.length, 5, "WeChat fixture should produce five drafts");

  verifyDrafts("alipay", alipayItems);
  verifyDrafts("alipay", alipayGbkItems);
  verifyDrafts("wechat", wechatItems);

  assert.equal(alipayGbkItems[0].amountCents, 1250, "GBK Alipay amount should normalize");
  assert.equal(alipayGbkItems[1].direction, "transfer", "GBK Alipay transfer row should be detected");

  const allItems = [...alipayItems, ...alipayGbkItems, ...wechatItems];
  assert.ok(
    allItems.some((item) => item.suggestedCategory === "餐饮"),
    "food-related rows should suggest 餐饮"
  );
  assert.ok(
    allItems.some((item) => item.suggestedCategory === "交通"),
    "transport-related rows should suggest 交通"
  );
  assert.ok(
    allItems.some((item) => item.suggestedReviewAction === "skip"),
    "transfer/top-up/wealth rows should be suggested as skip"
  );
  assert.ok(
    allItems.some((item) => item.suggestedReviewAction === "need_discussion"),
    "refund/closed rows should be suggested as need_discussion"
  );
  assert.ok(
    allItems.some((item) => item.amountCents === 700),
    "currency mojibake amount should normalize to integer cents"
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        alipayCount: alipayItems.length,
        alipayGbkCount: alipayGbkItems.length,
        wechatCount: wechatItems.length,
        totalAmountCents: allItems.reduce((sum, item) => sum + item.amountCents, 0)
      },
      null,
      2
    )
  );
}

function verifyDrafts(source: "wechat" | "alipay", items: NormalizedImportItemDraft[]) {
  for (const item of items) {
    assert.equal(item.source, source);
    assert.equal(item.reviewStatus, "pending");
    assert.equal(Number.isInteger(item.amountCents), true);
    assert.ok(item.amountCents >= 0);
    assert.match(item.monthKey, /^\d{4}-(0[1-9]|1[0-2])$/);
    assert.equal(typeof item.transactionTime, "string");
    assert.doesNotThrow(() => new Date(item.transactionTime).toISOString());
    assert.equal(typeof item.rawJson, "object");
    assert.notEqual(item.rawJson, null);
  }
}
