import { describe, expect, it } from "vitest";
import { DEFAULT_BANK_ACCOUNT, isBankConfigured, transferContent, vietQrImageUrl } from "../bank";

describe("chuyển khoản VietQR", () => {
  it("nội dung CK khớp mã đơn, không quá 50 ký tự", () => {
    expect(transferContent("BK-1001", "deposit")).toBe("COC BK-1001");
    expect(transferContent("BK-1001", "balance")).toBe("TT BK-1001");
    expect(transferContent("BK-1001")).toHaveLength(11);
  });

  it("URL VietQR chứa BIN, STK, số tiền và nội dung", () => {
    const url = vietQrImageUrl(DEFAULT_BANK_ACCOUNT, 1_700_000, "COC BK-1001");
    expect(url).toContain("img.vietqr.io/image/");
    expect(url).toContain(DEFAULT_BANK_ACCOUNT.bankBin);
    expect(url).toContain(DEFAULT_BANK_ACCOUNT.accountNo);
    expect(url).toContain("amount=1700000");
    expect(url).toContain("COC");
  });

  it("từ chối STK quá ngắn", () => {
    expect(isBankConfigured({ ...DEFAULT_BANK_ACCOUNT, accountNo: "12" })).toBe(false);
    expect(isBankConfigured(DEFAULT_BANK_ACCOUNT)).toBe(true);
  });
});
