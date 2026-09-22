"use client";

import { type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { contactEmail } from "@/lib/site";

export function ContactForm() {
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get("name") ?? "").trim();
    const email = String(data.get("email") ?? "").trim();
    const company = String(data.get("company") ?? "").trim();
    const message = String(data.get("message") ?? "").trim();
    const body = [
      `Name: ${name}`,
      `Email: ${email}`,
      company ? `Company: ${company}` : null,
      "",
      message,
    ]
      .filter((line) => line !== null)
      .join("\n");
    const href = `mailto:${contactEmail}?subject=${encodeURIComponent("TraffLabels job")}&body=${encodeURIComponent(body)}`;
    window.location.href = href;
  }

  return (
    <form onSubmit={onSubmit} className="flex max-w-xl flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="contact-name">Name</Label>
        <Input
          id="contact-name"
          name="name"
          required
          autoComplete="name"
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
          className="h-10 rounded-none"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="contact-company">Company</Label>
        <Input
          id="contact-company"
          name="company"
          autoComplete="organization"
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
          className="min-h-32 rounded-none"
        />
      </div>
      <Button
        type="submit"
        className="h-12 w-fit rounded-none bg-laser px-6 text-base font-semibold text-charcoal hover:bg-laser/90"
      >
        Contact Us
      </Button>
      <p className="text-sm text-muted-foreground">
        Opens your email app to{" "}
        <a
          href={`mailto:${contactEmail}`}
          className="text-foreground underline underline-offset-2"
        >
          {contactEmail}
        </a>
        .
      </p>
    </form>
  );
}
