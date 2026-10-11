import { describe, expect, it } from "vitest";
import { parseSms, sampleSms } from "@/lib/smsParse";

const AT = Date.UTC(2026, 9, 11, 6, 30);
const p = (body: string) => parseSms(body, AT);

describe("SMS parser — money in", () => {
  it("HDFC 'Money Received' with a payout VPA → Swiggy", () => {
    expect(p("Money Received - INR 380.00 in your HDFC Bank A/c xx1234 on 11-10-26 by VPA swiggy.payouts@icici (UPI Ref No 628412345678)")).toMatchObject({
      direction: "in", amountPaise: 38000, source: "swiggy", ref: "628412345678", counterparty: "swiggy.payouts@icici",
    });
  });
  it("SBI 'credited by Rs.200' from a VPA → Rapido", () => {
    expect(p("Your a/c no. XXXXXXXX1234 is credited by Rs.200.00 on 11Oct26 by a/c linked to VPA rapido.captain@ybl (UPI Ref no 628412345679).")).toMatchObject({
      direction: "in", amountPaise: 20000, source: "rapido", ref: "628412345679",
    });
  });
  it("UPI/CR info string with a name → Zomato, Indian digit grouping", () => {
    expect(p("INR 1,250.50 credited to your A/c XX1234 on 11/10/2026. Info: UPI/CR/628412345680/ZOMATO MEDIA. Avl Bal INR 12,345.00 -Axis Bank")).toMatchObject({
      direction: "in", amountPaise: 125050, source: "zomato", ref: "628412345680", counterparty: "ZOMATO MEDIA".replace(/\b\w/g, (c) => c).slice(0, 28),
    });
  });
  it("unknown sender is 'other UPI', and the balance amount is never taken", () => {
    const r = p("Rs.500.00 credited to A/c XX9876 on 11-10-26 from RAMESH K. UPI Ref 628412345681. Avl bal Rs.8,200.00 -Kotak");
    expect(r).toMatchObject({ direction: "in", amountPaise: 50000, source: "other", counterparty: "RAMESH K" });
  });
});

describe("SMS parser — money out", () => {
  it("SBI debit to a fuel VPA → Petrol", () => {
    expect(p("Rs.150.00 debited from A/c XX1234 on 11-10-26 to VPA hpcl.fuelstation@okaxis UPI Ref 628412345682 -SBI")).toMatchObject({
      direction: "out", amountPaise: 15000, category: "fuel",
    });
  });
  it("ICICI 'debited …; X credited' is a debit, not a credit → Food", () => {
    expect(p("ICICI Bank Acct XX123 debited for Rs 60.00 on 11-Oct-26; Sri Darshini Tiffin credited. UPI:628412345683. Call 18002662 for dispute.")).toMatchObject({
      direction: "out", amountPaise: 6000, category: "food", counterparty: "Sri Darshini Tiffin", ref: "628412345683",
    });
  });
  it("HDFC 'Sent Rs … To NAME' → Phone recharge", () => {
    expect(p("Sent Rs.239.00 From HDFC Bank A/C x1234 To JIO PREPAID On 11/10/26 Ref 628412345684 Not You? Call 18002586161")).toMatchObject({
      direction: "out", amountPaise: 23900, category: "phone",
    });
  });
  it("paid to a person's phone-number UPI ID → Sent to a person", () => {
    expect(p("You have paid Rs.300.00 to 9876543210@ybl from A/c XX1234 via UPI. Ref 628412345685")).toMatchObject({
      direction: "out", amountPaise: 30000, category: "transfer",
    });
  });
  it("garage payment → Repairs", () => {
    expect(p("Rs 450.00 debited from a/c **1234 on 11-10-26 to SRI GANESH BIKE GARAGE. UPI ref 628412345686")).toMatchObject({ direction: "out", category: "repair" });
  });
});

describe("SMS parser — ignored", () => {
  it.each([
    ["OTP", "123456 is your OTP for UPI transaction of Rs.500 at Swiggy. Do not share it with anyone."],
    ["collect request", "ZOMATO has requested Rs.200.00 from your A/c XX1234 via UPI. Approve in your UPI app."],
    ["failed payment", "Your UPI transaction of Rs.150.00 to HPCL from A/c XX1234 has failed. Amount will be refunded."],
    ["promotion", "Get Rs.500 cashback on your first UPI payment! Offer valid till 31 Oct. T&C apply"],
    ["balance alert", "Available balance in your A/c XX1234 is Rs.5,000.00 as on 11-10-26."],
    ["loan promo", "Pre-approved loan of Rs.50,000 credited instantly! Apply now"],
    ["not money", "Your Rapido ride is arriving in 3 minutes. Captain: Suresh"],
  ])("%s", (_name, body) => {
    expect(p(body)).toBeNull();
  });

  it("the same SMS always gives the same dedupe key", () => {
    const body = "Rs.80.00 debited from A/c XX1234 to TEA STALL";
    expect(p(body)?.ref).toBe(p(body)?.ref);
    expect(p(body)?.ref).toMatch(/^h/);
  });
});

describe("sample SMS for demos", () => {
  it("every sample parses: two payments in, two spends out", () => {
    const parsed = sampleSms(AT).map((m) => parseSms(m.body, m.at));
    expect(parsed.every(Boolean)).toBe(true);
    expect(parsed.map((r) => r!.direction)).toEqual(["in", "out", "in", "out"]);
    expect(parsed.map((r) => r!.source ?? r!.category)).toEqual(["swiggy", "fuel", "rapido", "food"]);
  });
});
