"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatPerthDateTime } from "@/lib/orders";

type DecisionState = {
  status: "approved" | "changes_requested";
  approvedName: string;
  approvedAt: string | null;
  changeComment: string;
  changeRequestedAt: string | null;
};

export function ProofDecision({ token, statement }: { token: string; statement: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<"approve" | "changes" | null>(null);
  const [done, setDone] = useState<DecisionState | null>(null);

  async function submit(action: "approve" | "changes") {
    setError(null);
    setPending(action);
    try {
      const response = await fetch(`/api/proof/${token}/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          action === "approve"
            ? { action, name, confirmed }
            : { action, comment }
        ),
      });
      const payload = (await response.json().catch(() => null)) as
        | (DecisionState & { ok?: boolean; error?: string; status?: DecisionState["status"] })
        | null;
      if (!response.ok || !payload?.ok || !payload.status) {
        setError(payload?.error || "Could not save that response.");
        setPending(null);
        return;
      }
      setDone({
        status: payload.status,
        approvedName: payload.approvedName,
        approvedAt: payload.approvedAt,
        changeComment: payload.changeComment,
        changeRequestedAt: payload.changeRequestedAt,
      });
      setPending(null);
      router.refresh();
    } catch {
      setError("Could not save that response.");
      setPending(null);
    }
  }

  if (done?.status === "approved" && done.approvedAt) {
    return (
      <p role="status" className="border border-emerald-700/30 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
        Approved by {done.approvedName} on {formatPerthDateTime(done.approvedAt)} (Perth).
      </p>
    );
  }
  if (done?.status === "changes_requested") {
    return (
      <div role="status" className="border border-amber-700/30 bg-amber-50 px-4 py-3 text-sm text-amber-950">
        <p>
          Change request received
          {done.changeRequestedAt ? ` on ${formatPerthDateTime(done.changeRequestedAt)} (Perth)` : ""}.
        </p>
        {done.changeComment ? (
          <p className="mt-2 whitespace-pre-wrap">{done.changeComment}</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <form
        className="flex flex-col gap-4 border bg-card p-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit("approve");
        }}
      >
        <h2 className="font-heading text-lg font-semibold">Approve for production</h2>
        <label className="flex flex-col gap-1.5 text-sm" htmlFor="approver-name">
          Your full name
          <input
            id="approver-name"
            name="name"
            autoComplete="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="h-10 rounded-lg border bg-background px-3"
            required
          />
        </label>
        <label className="flex items-start gap-3 text-sm leading-relaxed">
          <input
            type="checkbox"
            className="mt-1 size-4 accent-[#12151a]"
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
            required
          />
          <span>{statement}</span>
        </label>
        <button
          type="submit"
          disabled={pending !== null}
          className="h-11 rounded-lg bg-[#12151a] font-medium text-white disabled:opacity-60"
        >
          {pending === "approve" ? "Approving…" : "Approve"}
        </button>
      </form>

      <form
        className="flex flex-col gap-4 border bg-card p-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit("changes");
        }}
      >
        <h2 className="font-heading text-lg font-semibold">Request changes</h2>
        <label className="flex flex-col gap-1.5 text-sm" htmlFor="change-comment">
          What should change?
          <textarea
            id="change-comment"
            name="comment"
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            rows={4}
            required
            className="rounded-lg border bg-background px-3 py-2"
          />
        </label>
        <button
          type="submit"
          disabled={pending !== null}
          className="h-11 rounded-lg border font-medium disabled:opacity-60"
        >
          {pending === "changes" ? "Sending…" : "Request changes"}
        </button>
      </form>
      {error ? (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
