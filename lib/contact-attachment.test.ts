import assert from "node:assert/strict";
import {
  ATTACHMENT_EMPTY_ERROR,
  ATTACHMENT_SIZE_ERROR,
  ATTACHMENT_TYPE_ERROR,
  MAX_ATTACHMENT_BYTES,
  toResendAttachment,
  validateAttachment,
} from "./contact-attachment";
import { buildJobEmail, formatJobText, parseRecipients } from "./contact-mail";

{
  for (const name of [
    "board.csv",
    "BOARD.CSV",
    "schedule.xls",
    "schedule.xlsx",
    "drawing.pdf",
    "photo.png",
    "photo.jpg",
    "photo.jpeg",
    "notes.txt",
    "art.svg",
  ]) {
    const checked = validateAttachment({ name, size: 12 });
    assert.equal(checked.ok, true, name);
  }
}

{
  const tooBig = validateAttachment({
    name: "big.pdf",
    size: MAX_ATTACHMENT_BYTES + 1,
  });
  assert.deepEqual(tooBig, { ok: false, error: ATTACHMENT_SIZE_ERROR });
  const atLimit = validateAttachment({
    name: "limit.pdf",
    size: MAX_ATTACHMENT_BYTES,
  });
  assert.equal(atLimit.ok, true);
}

{
  assert.equal(
    validateAttachment({ name: "virus.exe", size: 20 }).ok,
    false,
  );
  assert.deepEqual(validateAttachment({ name: "photo.jpg.exe", size: 20 }), {
    ok: false,
    error: ATTACHMENT_TYPE_ERROR,
  });
  assert.deepEqual(validateAttachment({ name: "notes", size: 20 }), {
    ok: false,
    error: ATTACHMENT_TYPE_ERROR,
  });
  assert.deepEqual(validateAttachment({ name: "empty.csv", size: 0 }), {
    ok: false,
    error: ATTACHMENT_EMPTY_ERROR,
  });
}

{
  const nested = validateAttachment({
    name: "../../secret schedule (final).PDF",
    size: 40,
  });
  assert.equal(nested.ok, true);
  if (nested.ok) {
    assert.equal(nested.filename, "secret_schedule_final.pdf");
    assert.equal(nested.contentType, "application/pdf");
    assert.equal(nested.filename.includes("/"), false);
    assert.equal(nested.filename.includes(".."), false);
  }
}

{
  const bytes = Buffer.from("plate,qty\nMAIN,2\n");
  const attached = toResendAttachment({
    filename: "board.csv",
    contentType: "text/csv",
    content: bytes,
  });
  assert.equal(attached.filename, "board.csv");
  assert.equal(attached.contentType, "text/csv");
  assert.equal(Buffer.from(attached.content, "base64").toString(), bytes.toString());
}

{
  const enquiry = {
    name: "Ada",
    email: "ada@example.com",
    company: "North Workshop",
    message: "Please engrave the attached schedule.",
    attachmentName: "board.csv",
  };
  const text = formatJobText(enquiry);
  assert.match(text, /Attachment: board.csv/);
  assert.match(text, /Please engrave the attached schedule/);
  const payload = buildJobEmail(enquiry, {
    from: "TraffLabels <jobs@example.com>",
    to: ["desk@example.com"],
    attachment: {
      filename: "board.csv",
      contentType: "text/csv",
      content: Buffer.from("ok"),
    },
  });
  assert.equal(payload.replyTo, "ada@example.com");
  assert.equal(payload.attachments?.[0]?.filename, "board.csv");
  assert.equal(payload.attachments?.[0]?.content, Buffer.from("ok").toString("base64"));
  assert.match(payload.subject, /TraffLabels job — Ada/);
  assert.deepEqual(parseRecipients("a@example.com, not-an-email; b@example.com"), [
    "a@example.com",
    "b@example.com",
  ]);
  const plain = buildJobEmail(
    { ...enquiry, attachmentName: undefined, company: "" },
    { from: "from@example.com", to: ["desk@example.com"] },
  );
  assert.equal(plain.attachments, undefined);
  assert.match(plain.text, /Attachment: \(none\)/);
}

console.log("contact attachment tests passed");
