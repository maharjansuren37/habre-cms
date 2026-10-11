import { createElement as h, type ReactElement } from "react";
// Type only: the renderer is shared with the browser bundle, so it never
// imports Zod (contact-message.ts) or anything `.server`.
import type { ContactAnswer } from "../contact/contact-message.ts";

/** What a visitor reads after a send, other than `sent` (which shows the
 *  block's own thanks text). Fixed English, as the spec decides. */
export const CONTACT_ANSWER_LINES = {
  invalid: "Your message could not be sent. Please check each field and try again.",
  again: "That was a little quick. Please wait a moment and send it again.",
  busy: "We are receiving a lot of messages right now. Please try again in a few minutes.",
} as const;

export type ContactFormAttrs = { buttonLabel: string; thanks: string };

/** What the public loaders hand the form; absent means the inert preview. */
export type ContactFormOptions = {
  entryId: string;
  started: string;
  answer: ContactAnswer | undefined;
};

/** CSS Module class names, passed in because `node --test` cannot import CSS. */
export type ContactFormClasses = {
  root: string;
  status: string;
  form: string;
  field: string;
  label: string;
  input: string;
  textarea: string;
  trap: string;
  button: string;
};

/**
 * The contact form block (item 19b). Plain `createElement`, so the unit tests
 * can render it. With `contact` it posts to 19a's `/_contact` and works with no
 * JavaScript; without it every control is disabled and there is no `action`
 * (the admin's preview, where `/_contact` does not exist).
 */
export function renderContactForm(
  attrs: ContactFormAttrs,
  contact: ContactFormOptions | undefined,
  classes: ContactFormClasses,
): ReactElement {
  const live = contact !== undefined;
  const disabled = live ? {} : { disabled: true };
  const line =
    contact?.answer === undefined
      ? null
      : contact.answer === "sent"
        ? attrs.thanks
        : CONTACT_ANSWER_LINES[contact.answer];

  return h(
    "div",
    { className: classes.root },
    line === null ? null : h("p", { role: "status", className: classes.status }, line),
    h(
      "form",
      {
        id: "contact",
        method: "post",
        className: classes.form,
        ...(live ? { action: "/_contact" } : {}),
      },
      h(
        "div",
        { className: classes.field },
        h("label", { htmlFor: "contact-name", className: classes.label }, "Name"),
        h("input", {
          id: "contact-name",
          name: "name",
          type: "text",
          required: true,
          maxLength: 100,
          autoComplete: "name",
          className: classes.input,
          ...disabled,
        }),
      ),
      h(
        "div",
        { className: classes.field },
        h("label", { htmlFor: "contact-email", className: classes.label }, "Email"),
        h("input", {
          id: "contact-email",
          name: "email",
          type: "email",
          required: true,
          maxLength: 254,
          autoComplete: "email",
          className: classes.input,
          ...disabled,
        }),
      ),
      h(
        "div",
        { className: classes.field },
        h("label", { htmlFor: "contact-message", className: classes.label }, "Message"),
        h("textarea", {
          id: "contact-message",
          name: "message",
          required: true,
          maxLength: 5000,
          rows: 6,
          className: classes.textarea,
          ...disabled,
        }),
      ),
      contact === undefined
        ? null
        : [
            h("input", { key: "entry", type: "hidden", name: "entry", value: contact.entryId }),
            h("input", { key: "started", type: "hidden", name: "started", value: contact.started }),
            h(
              "div",
              { key: "url", className: classes.trap, "aria-hidden": true },
              h("input", { type: "text", name: "url", tabIndex: -1, autoComplete: "off" }),
            ),
          ],
      h("button", { type: "submit", className: classes.button, ...disabled }, attrs.buttonLabel),
    ),
  );
}
