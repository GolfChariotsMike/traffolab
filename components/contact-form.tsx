"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ATTACHMENT_ACCEPT,
  ATTACHMENT_HELP,
  validateAttachment,
} from "@/lib/contact-attachment";

type Status = "idle" | "sending" | "sent" | "error";

const SEND_ERROR = "Could not send that message. Try again shortly.";

export function ContactForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const selected = data.get("attachment");
    if (selected instanceof File && (selected.name.trim() || selected.size > 0)) {
      const checked = validateAttachment({
        name: selected.name,
        size: selected.size,
      });
      if (!checked.ok) {
        setStatus("error");
        setError(checked.error);
        return;
      }
    }

    setStatus("sending");
    setError(null);

    try {
      const response = await fetch("/api/contact/", {
        method: "POST",
        body: data,
      });
      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
      } | null;
      if (!response.ok || !payload?.ok) {
        setStatus("error");
        setError(payload?.error || SEND_ERROR);
        return;
      }
      form.reset();
      setStatus("sent");
    } catch {
      setStatus("error");
      setError(SEND_ERROR);
    }
  }

  return (
    <form onSubmit={onSubmit} className="relative flex max-w-xl flex-col gap-4">
      <div className="absolute -left-[9999px] h-0 w-0 overflow-hidden" aria-hidden="true">
        <label htmlFor="contact-website">Website</label>
        <input
          id="contact-website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="contact-name">Name</Label>
        <Input
          id="contact-name"
          name="name"
          required
          autoComplete="name"
          disabled={status === "sending"}
          className="h-10 rounded-none"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="contact-email">Email</Label>
        <Input
          id="contact-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          disabled={status === "sending"}
          className="h-10 rounded-none"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="contact-company">Company</Label>
        <Input
          id="contact-company"
          name="company"
          autoComplete="organization"
          disabled={status === "sending"}
          className="h-10 rounded-none"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="contact-message">Job</Label>
        <Textarea
          id="contact-message"
          name="message"
          required
          rows={6}
          placeholder="Legends, sizes, colours, and quantity — or a note about the file."
          disabled={status === "sending"}
          className="min-h-32 rounded-none"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="contact-attachment">File</Label>
        <Input
          id="contact-attachment"
          name="attachment"
          type="file"
          accept={ATTACHMENT_ACCEPT}
          disabled={status === "sending"}
          className="h-11 rounded-none py-2 file:text-foreground"
        />
        <p className="text-xs text-muted-foreground">{ATTACHMENT_HELP}</p>
      </div>
      <Button
        type="submit"
        disabled={status === "sending"}
        className="h-12 w-fit rounded-none bg-laser px-6 text-base font-semibold text-charcoal hover:bg-laser/90"
      >
        {status === "sending" ? "Sending…" : "Contact Us"}
      </Button>
      {status === "sent" ? (
        <p role="status" className="text-sm text-foreground">
          Sent. We&apos;ll reply to the email you entered.
        </p>
      ) : null}
      {status === "error" && error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </form>
  );
}
