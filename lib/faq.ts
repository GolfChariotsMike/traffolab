export type FaqSegment = string | { text: string; href: string };

export type FaqItem = {
  question: string;
  /** Plain text, or text with inline links. One source for the visible answer and JSON-LD. */
  answer: string | readonly FaqSegment[];
};

export function faqSegments(answer: FaqItem["answer"]): readonly FaqSegment[] {
  return typeof answer === "string" ? [answer] : answer;
}

/** Visible answer text. Link labels are included; hrefs are not. */
export function faqAnswerText(answer: FaqItem["answer"]) {
  return faqSegments(answer)
    .map((part) => (typeof part === "string" ? part : part.text))
    .join("");
}
