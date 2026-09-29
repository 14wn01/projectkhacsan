import { describe, it, expect } from "vitest";
import { isISODate, addDays, nightsBetween, parseLocalDate, toISODate } from "../format";
import { createHold } from "../holds";
import { roomStyle, buildRoomGeometry } from "../room3d";
import { createPayment } from "../payments";
import { guestHash, guestNightlyLabel, isOnRequestRate, parseGuestHash } from "../../components/guest/stay";

describe("Enhancement regressions", () => {
  it("rejects invalid or rolled-over dates", () => {
    for (const d of ["", "hello", "2026-02-30", "2026-13-01", "2026-2-01"]) expect(isISODate(d)).toBe(false);
    expect(isISODate("2028-02-29")).toBe(true);
  });
  it("returns zero nights for invalid dates instead of NaN", () => {
    expect(nightsBetween("", "2026-09-07")).toBe(0);
    expect(nightsBetween("2026-09-07", "2026-09-07")).toBe(0);
    expect(nightsBetween("2026-09-07", "2026-09-09")).toBe(2);
  });
  it("keeps local date through calendar roundtrip", () => {
    expect(toISODate(parseLocalDate("2026-09-07"))).toBe("2026-09-07");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-08", 1)).toBe("2026-03-09");
  });
  it("rejects impossible dates and zero guests in holds", () => {
    expect(createHold([], [], {roomId:"r",checkIn:"x",checkOut:"y",guests:1,sessionId:"test"}).ok).toBe(false);
    expect(createHold([], [], {roomId:"r",checkIn:"2026-09-07",checkOut:"2026-09-08",guests:0,sessionId:"test"}).ok).toBe(false);
  });
  it("maps all six room studies", () => {
    expect(roomStyle("Standard")).toBe("standard");expect(roomStyle("Deluxe")).toBe("deluxe");
    expect(roomStyle("Suite")).toBe("suite");expect(roomStyle("Family Room")).toBe("family");
    expect(roomStyle("Penthouse")).toBe("penthouse");expect(roomStyle("Presidential Suite")).toBe("presidential");
    expect(roomStyle("Garden Pavilion")).toBe("standard");
    expect(roomStyle("Ocean Suite")).toBe("deluxe");
    expect(roomStyle("Horizon Suite")).toBe("suite");
    expect(roomStyle("Family Villa")).toBe("family");
    expect(roomStyle("Sky Residence")).toBe("penthouse");
    expect(roomStyle("Sao Mai Residence")).toBe("presidential");
  });
  it("builds finite triangle geometry with a small budget", () => {
    for (const name of ["standard","deluxe","suite","family","penthouse","presidential"] as const) {
      const {vertices} = buildRoomGeometry(name);
      expect(vertices.length % 30).toBe(0);expect([...vertices].every(Number.isFinite)).toBe(true);
      expect(vertices.byteLength).toBeLessThanOrEqual(250000);
    }
  });
  it("hides Sao Mai Residence as on-request and labels nightly rates from", () => {
    expect(isOnRequestRate({ id: "rt6", name: "Sao Mai Residence" })).toBe(true);
    expect(guestNightlyLabel({ id: "rt6", name: "Sao Mai Residence", basePrice: 45_000_000 })).toBe("Theo yêu cầu");
    expect(guestNightlyLabel({ id: "rt1", name: "Garden Pavilion", basePrice: 6_800_000 })).toMatch(/6\.800\.000|6,800,000/);
  });
  it("routes residences and aliases /rooms", () => {
    const url = guestHash({ view: "residences" }, { checkIn: "2026-09-20", checkOut: "2026-09-22", guests: 2 });
    expect(url).toContain("#/residences?");
    expect(parseGuestHash(url).view).toBe("residences");
    expect(parseGuestHash("#/rooms?ci=2026-09-20&co=2026-09-22&g=2").view).toBe("residences");
    expect(parseGuestHash("#/story?").view).toBe("story");
    expect(parseGuestHash("#/contact?").view).toBe("contact");
  });
  it("does not accept NaN or Infinity payments", async () => {
    for(const amount of [NaN, Infinity, -1, 0]) {
      let rejected=false;
      try { await createPayment("vnpay", {bookingId:"test",purpose:"deposit",amount,description:"test"}); } catch { rejected=true; }
      expect(rejected).toBe(true);
    }
  });
});
