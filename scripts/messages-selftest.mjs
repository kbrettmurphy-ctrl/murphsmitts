import fs from "node:fs";
import assert from "node:assert/strict";

const admin = fs.readFileSync(new URL("../admin/admin.js", import.meta.url), "utf8");
const adminCss = fs.readFileSync(new URL("../admin/admin.css", import.meta.url), "utf8");
const adminHtml = fs.readFileSync(new URL("../admin/index.html", import.meta.url), "utf8");

let tests = 0;
let assertions = 0;
const ok = (value, message) => { assertions += 1; assert.ok(value, message); };
const equal = (actual, expected, message) => { assertions += 1; assert.equal(actual, expected, message); };
const test = async (name, fn) => {
  await fn();
  tests += 1;
  console.log(`  ok  ${name}`);
};

await test("conversation context uses the standard Messages topbar", () => {
  ok(adminHtml.includes('id="messagesBackBtn" class="secondary messages-topbar-back"'));
  ok(adminHtml.includes('id="messagesTitle" class="topbar-title"'));
  ok(adminHtml.includes('id="msgThreadDeleteBtn" class="secondary topbar-icon-action messages-thread-delete"'));
  const header = admin.match(/function setMessagesTopbar\([\s\S]*?\n\}/)?.[0] || "";
  ok(header.includes('messagesTitle.textContent = inThread'));
  ok(header.includes('messagesCount.textContent = parts.join(" · ")'));
  ok(header.includes("msgThreadDeleteBtn.dataset.delThread"));
  equal(admin.match(/<div class="msg-convo-head">/g)?.length || 0, 0);
});

await test("refreshes update only the open message stream", () => {
  const refresh = admin.match(/async function refreshMessages\([\s\S]*?\n\}/)?.[0] || "";
  ok(refresh.includes("refreshOpenMessageThread()"));
  equal(refresh.includes("document.activeElement"), false);
  const stream = admin.match(/function renderOpenMessageStream\([\s\S]*?\n\}/)?.[0] || "";
  ok(stream.includes("const previousTop = convo.scrollTop"));
  ok(stream.includes("forceBottom ? convo.scrollHeight : previousTop"));
  ok(stream.includes("messageThreadPinned = forceBottom || isMessageThreadNearBottom(convo)"));
  ok(admin.includes('messagesPanel.addEventListener("scroll"'));
  ok(admin.includes('if (latest) latest.hidden = true'));
});

await test("messages show useful send state and timestamps", () => {
  const bubbles = admin.match(/function buildMessageBubbles\([\s\S]*?\n\}/)?.[0] || "";
  ok(bubbles.includes('m.state === "pending"'));
  ok(bubbles.includes('m.state === "failed"'));
  ok(bubbles.includes('formatConversationMessageTime(m.createdAt)'));
  ok(bubbles.includes('<span class="msg-time">'));
  const send = admin.match(/async function handleMessageReply\([\s\S]*?\n\}/)?.[0] || "";
  ok(send.includes('id: optimisticId'));
  ok(send.includes('state: "pending"'));
  ok(send.includes('pending.state = "failed"'));
  ok(send.includes("refreshOpenMessageThread()"));
});

await test("composer behaves like a chat composer", () => {
  const composer = admin.match(/function syncMessageComposer\([\s\S]*?\n\}/)?.[0] || "";
  ok(composer.includes('input.style.height = "auto"'));
  ok(composer.includes("Math.min(input.scrollHeight, 120)"));
  ok(composer.includes("btn.disabled = messageSending"));
  ok(admin.includes('e.target?.id !== "msgReplyInput" || e.key !== "Enter" || e.shiftKey'));
  ok(admin.includes('window.matchMedia("(hover: hover) and (pointer: fine)")'));
  ok(admin.includes('data-msg-latest hidden>New messages'));
});

await test("Messages v2 styling remains isolated to the inbox", () => {
  ok(adminCss.includes("MESSAGES V2 — DEER ISLAND CHAT FLOW"));
  ok(adminCss.includes("#messagesView.active{"));
  ok(adminCss.includes("#messagesPanel{"));
  ok(adminCss.includes("overflow-y:auto"));
  ok(adminCss.includes(".msg-convo-shell .msg-convo{"));
  ok(adminCss.includes("overscroll-behavior:contain"));
  ok(adminCss.includes(".msg-jump-latest{"));
  ok(adminCss.includes(".msg-send-btn:disabled{"));
});

console.log(`\nMessages self-test: ${tests} tests, ${assertions} assertions passed.`);
