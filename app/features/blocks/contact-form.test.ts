import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { CONTACT_ANSWER_LINES, renderContactForm } from "./contact-form.ts";

const attrs = { buttonLabel: "Send it", thanks: "Thanks <b>so</b> much." };
const classes = {
  root: "r",
  status: "st",
  form: "f",
  field: "fi",
  label: "l",
  input: "i",
  textarea: "t",
  trap: "trap",
  button: "b",
};
const contact = {
  entryId: "11111111-1111-4111-8111-111111111111",
  started: "tok.en",
  answer: undefined,
};

function html(options: Parameters<typeof renderContactForm>[1]) {
  return renderToStaticMarkup(renderContactForm(attrs, options, classes));
}

function tag(markup: string, pattern: RegExp): string {
  const found = markup.match(pattern);
  assert.ok(found, `no match for ${pattern}`);
  return found[0];
}

test("the live form posts to /_contact with an id the redirect can anchor to", () => {
  const form = tag(html(contact), /<form[^>]*>/);
  assert.match(form, /id="contact"/);
  assert.match(form, /method="post"/);
  assert.match(form, /action="\/_contact"/);
});

test("name is a labelled required text input with its limits and autocomplete", () => {
  const markup = html(contact);
  assert.match(markup, /<label[^>]*for="contact-name"[^>]*>Name<\/label>/);
  const input = tag(markup, /<input[^>]*id="contact-name"[^>]*>/);
  assert.match(input, /name="name"/);
  assert.match(input, /type="text"/);
  assert.match(input, /required=""/);
  assert.match(input, /maxLength="100"|maxlength="100"/);
  assert.match(input, /autoComplete="name"|autocomplete="name"/);
});

test("email is a labelled required email input", () => {
  const markup = html(contact);
  assert.match(markup, /<label[^>]*for="contact-email"[^>]*>Email<\/label>/);
  const input = tag(markup, /<input[^>]*id="contact-email"[^>]*>/);
  assert.match(input, /name="email"/);
  assert.match(input, /type="email"/);
  assert.match(input, /required=""/);
  assert.match(input, /maxLength="254"|maxlength="254"/);
  assert.match(input, /autoComplete="email"|autocomplete="email"/);
});

test("message is a labelled required textarea", () => {
  const markup = html(contact);
  assert.match(markup, /<label[^>]*for="contact-message"[^>]*>Message<\/label>/);
  const area = tag(markup, /<textarea[^>]*>/);
  assert.match(area, /id="contact-message"/);
  assert.match(area, /name="message"/);
  assert.match(area, /required=""/);
  assert.match(area, /maxLength="5000"|maxlength="5000"/);
});

test("entry and started travel as hidden fields", () => {
  const markup = html(contact);
  assert.match(
    markup,
    /<input[^>]*type="hidden"[^>]*name="entry"[^>]*value="11111111-1111-4111-8111-111111111111"/,
  );
  assert.match(markup, /<input[^>]*type="hidden"[^>]*name="started"[^>]*value="tok\.en"/);
});

test("the honeypot is out of sight, out of the tab order and unlabelled for screen readers", () => {
  const markup = html(contact);
  const wrapper = tag(markup, /<div[^>]*class="trap"[^>]*>/);
  assert.match(wrapper, /aria-hidden="true"/);
  const input = tag(markup, /<input[^>]*name="url"[^>]*>/);
  assert.match(input, /tabIndex="-1"|tabindex="-1"/);
  assert.match(input, /autoComplete="off"|autocomplete="off"/);
  assert.doesNotMatch(input, /required/);
  assert.doesNotMatch(input, /disabled/);
  assert.doesNotMatch(input, /value="[^"]/);
});

test("the submit button carries the block's text", () => {
  const button = tag(html(contact), /<button[^>]*>[^<]*<\/button>/);
  assert.match(button, /type="submit"/);
  assert.match(button, />Send it</);
  assert.doesNotMatch(button, /disabled/);
});

test("no answer means no status line", () => {
  assert.doesNotMatch(html(contact), /role="status"/);
});

test("sent shows the block's thanks text, escaped, in a status element above the form", () => {
  const markup = html({ ...contact, answer: "sent" });
  assert.match(markup, /<p[^>]*role="status"[^>]*>Thanks &lt;b&gt;so&lt;\/b&gt; much\.<\/p>/);
  assert.ok(markup.indexOf('role="status"') < markup.indexOf("<form"));
});

test("invalid, again and busy show their fixed sentences", () => {
  for (const code of ["invalid", "again", "busy"] as const) {
    const line = CONTACT_ANSWER_LINES[code];
    assert.ok(line.length > 10);
    assert.match(
      html({ ...contact, answer: code }),
      new RegExp(`role="status"[^>]*>${line.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}</p>`),
    );
  }
});

test("with no contact option the form is inert: no action, fields and button disabled", () => {
  const markup = html(undefined);
  const form = tag(markup, /<form[^>]*>/);
  assert.doesNotMatch(form, /action=/);
  assert.match(form, /id="contact"/);
  for (const name of ["contact-name", "contact-email"]) {
    assert.match(tag(markup, new RegExp(`<input[^>]*id="${name}"[^>]*>`)), /disabled=""/);
  }
  assert.match(tag(markup, /<textarea[^>]*>/), /disabled=""/);
  assert.match(tag(markup, /<button[^>]*>/), /disabled=""/);
  assert.doesNotMatch(markup, /name="entry"|name="started"|name="url"|role="status"/);
});
