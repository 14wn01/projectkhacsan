import { describe, expect, it } from "vitest";
import { extractBookingCode } from "../bank";
import { draftsFromText, matchInflow, parseBankPayload } from "../bankFeed";
import type { Booking, Payment } from "../types";

function booking(over: Partial<Booking> = {}): Booking {
  return {
    id: "b1",
    code: "BK-1001",
    roomId: "r101",
    customerId: "c1",
    checkIn: "2026-03-10",
    checkOut: "2026-03-12",
    guests: 2,
    status: "reserved",
    roomPricePerNight: 500_000,
    services: [],
    createdAt: "2026-03-01T08:00:00.000Z",
    ...over,
  };
}

function pay(over: Partial<Payment> = {}): Payment {
  return {
    id: "p1",
    bookingId: "b1",
    method: "bank_transfer",
    purpose: "deposit",
    amount: 1_700_000,
    state: "pending",
    gatewayRef: "ref",
    createdAt: "2026-03-01T08:00:00.000Z",
    transferContent: "COC BK-1001",
    ...over,
  };
}

describe("extractBookingCode", () => {
  it("lấy BK-xxxx từ COC / TT / HOAN và dạng không dấu gạch", () => {
    expect(extractBookingCode("COC BK-1001")).toBe("BK-1001");
    expect(extractBookingCode("tt bk1002")).toBe("BK-1002");
    expect(extractBookingCode("Chuyen khoan HOAN BK-9")).toBeNull();
    expect(extractBookingCode("HOAN BK-9001")).toBe("BK-9001");
    expect(extractBookingCode("noi dung BK-1001 ngan hang")).toBe("BK-1001");
    expect(extractBookingCode("mua cafe")).toBeNull();
  });
});

describe("parseBankPayload", () => {
  it("đọc Casso data.records, bỏ số âm", () => {
    const rows = parseBankPayload({
      error: 0,
      data: {
        records: [
          { id: 1, tid: "FT1", amount: 1_700_000, description: "COC BK-1001", when: "2026-03-01 09:00:00" },
          { id: 2, tid: "FT2", amount: -50_000, description: "phi", when: "2026-03-01 09:01:00" },
        ],
      },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].amount).toBe(1_700_000);
    expect(rows[0].bookingCode).toBe("BK-1001");
    expect(rows[0].tid).toBe("FT1");
    expect(rows[0].source).toBe("casso");
  });

  it("đọc webhook SePay một object", () => {
    const rows = parseBankPayload({
      id: 9,
      gateway: "Vietcombank",
      transferType: "in",
      transferAmount: 2_000_000,
      content: "TT BK-1002",
      transactionDate: "2026-03-02 10:00:00",
      referenceCode: "SEP-9",
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].source).toBe("sepay");
    expect(rows[0].amount).toBe(2_000_000);
    expect(rows[0].bookingCode).toBe("BK-1002");
    expect(rows[0].tid).toBe("SEP-9");
  });

  it("đọc mảng JSON và draftsFromText", () => {
    const rows = draftsFromText(
      JSON.stringify([{ amount: 1000, description: "COC BK-1001", tid: "x" }]),
    );
    expect(rows).toHaveLength(1);
    expect(draftsFromText("not json")).toEqual([]);
  });
});

describe("matchInflow", () => {
  const bookings = [booking()];
  const payments = [pay()];

  it("khớp khi đúng mã đơn và số tiền", () => {
    const m = matchInflow(
      { source: "casso", amount: 1_700_000, when: "", description: "COC BK-1001", tid: "1" },
      bookings,
      payments,
    );
    expect(m.match).toBe("matched");
    expect(m.matchedBookingId).toBe("b1");
    expect(m.matchedPaymentId).toBe("p1");
  });

  it("báo lệch tiền khi mã đúng, số khác", () => {
    const m = matchInflow(
      { source: "casso", amount: 1_000_000, when: "", description: "COC BK-1001", tid: "2" },
      bookings,
      payments,
    );
    expect(m.match).toBe("amount_mismatch");
    expect(m.matchedPaymentId).toBe("p1");
  });

  it("không gắn khi không có mã đơn", () => {
    const m = matchInflow(
      { source: "casso", amount: 1_700_000, when: "", description: "chuyen tien", tid: "3" },
      bookings,
      payments,
    );
    expect(m.match).toBe("unmatched");
    expect(m.matchedBookingId).toBeUndefined();
  });
});
