import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";

vi.mock("@matrix/client", () => ({
  getClient: vi.fn(() => ({
    getUserId: vi.fn().mockReturnValue("@me:localhost"),
    mxcUrlToHttp: vi.fn((url: string) => url),
    getRoom: vi.fn(),
  })),
}));

vi.mock("@matrix/media", () => ({
  getThumbnailUrl: vi.fn().mockReturnValue(""),
  downloadMedia: vi.fn(),
}));

describe("messageBubble", () => {
  const mockTextEvent = {
    getId: () => "$event1",
    getSender: () => "@alice:localhost",
    getContent: () => ({ msgtype: "m.text", body: "Hello World" }),
    getDate: () => new Date("2026-01-01T12:00:00Z"),
    getType: () => "m.room.message",
    getTs: () => 1735732800000,
  };

  it("should render text message content", async () => {
    const MessageBubble = (
      await import("@/features/chat/components/MessageBubble.vue")
    ).default;
    const wrapper = mount(MessageBubble, {
      props: {
        event: mockTextEvent as any,
        isMine: false,
        showSender: true,
        groupPosition: "alone",
      },
    });
    expect(wrapper.text()).toContain("Hello World");
  });

  it("should show sender name", async () => {
    const MessageBubble = (
      await import("@/features/chat/components/MessageBubble.vue")
    ).default;
    const wrapper = mount(MessageBubble, {
      props: {
        event: mockTextEvent as any,
        isMine: false,
        showSender: true,
        groupPosition: "alone",
      },
    });
    expect(wrapper.text()).toContain("alice");
  });
});
