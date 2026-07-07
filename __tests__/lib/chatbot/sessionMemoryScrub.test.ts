import { scrubPii } from "@/lib/chatbot/sessionMemory";

// Pressure-test mem-01: scrubPii must strip names introduced explicitly, while
// preserving the place names / preferences that are the memory's whole point.

describe("scrubPii name stripping (pressure-test mem-01)", () => {
  it("strips English name-introducer phrases", () => {
    expect(scrubPii("My name is Maria Garcia and I want a DMZ tour")).not.toMatch(/Maria|Garcia/);
    expect(scrubPii("I'm John, planning a Jeju trip for 4")).not.toMatch(/\bJohn\b/);
    expect(scrubPii("this is Alex Kim, budget conscious")).not.toMatch(/Alex|Kim/);
  });

  it("strips Korean name-introducer phrases", () => {
    expect(scrubPii("제 이름은 마리아입니다. 제주 투어 원해요")).not.toMatch(/마리아/);
  });

  it("keeps place names and durable preferences", () => {
    const s = scrubPii("Traveler wants a DMZ tour and a Jeju trip for 4 in October, wheelchair access");
    expect(s).toMatch(/DMZ/);
    expect(s).toMatch(/Jeju/);
    expect(s).toMatch(/wheelchair/);
    expect(s).toMatch(/October/);
    expect(s).toMatch(/4/);
  });

  it("still strips emails, phones, and booking refs", () => {
    const s = scrubPii("Contact me@x.com or +82 10-1234-5678, ref A2C-9K2P, Busan tour");
    expect(s).not.toMatch(/me@x\.com/);
    expect(s).not.toMatch(/1234/);
    expect(s).not.toMatch(/A2C/);
    expect(s).toMatch(/Busan/);
  });
});
