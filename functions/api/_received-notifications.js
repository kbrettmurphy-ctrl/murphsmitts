export function receivedEmailMessage() {
  return `Got your request — thanks for reaching out!

I'll look over the details and get an estimate to you by email shortly. If you've got photos of the glove handy, just reply and send them over — it helps me figure out exactly what it needs.`;
}

export function receivedSmsBody(orderNumber, trackingToken = "") {
  const orderNum = String(orderNumber || "").trim() || "(unknown)";
  const token = String(trackingToken || "").trim();

  return `Murph's Mitts: Got your request (#${orderNum})!\n\n`
    + `I'll look it over and send an estimate by email. `
    + `Feel free to reply here with photos of the glove — helps me size up the work.`
    + (token ? `\n\nFollow your glove's progress:\nhttps://murphsmitts.com/track/?t=${token}` : "");
}
