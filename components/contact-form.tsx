"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Status = "idle" | "sending" | "sent" | "error";

export function ContactForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setStatus("sending");
    setError(null);

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: String(data.get("name") ?? ""),
          email: String(data.get("email") ?? ""),
          company: String(data.get("company") ?? ""),
          message: String(data.get("message") ?? ""),
          website: String(data.get("website") ?? ""),
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
      } | null;
      if (!response.ok || !payload?.ok) {
        setStatus("error");
        setError(payload?.error || "Could not send that message. Try again shortly.");
        return;
      }
      form.reset();
      setStatus("sent");
    } catch {
      setStatus("error");
      setError("Could not send that message. Try again shortly.");
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
          placeholder="Legends, sizes, colours, and quantity."
          disabled={status === "sending"}
          className="min-h-32 rounded-none"
        />
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
