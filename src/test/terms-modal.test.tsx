import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import TermsModal, { TERMS_VERSION, isTermsAccepted } from "@/components/TermsModal";

beforeEach(() => {
  localStorage.clear();
  document.body.style.overflow = "";
});

describe("TermsModal", () => {
  it("renders the blocking dialog when terms are not accepted", () => {
    render(<TermsModal />);
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("links the terms text to the real terms page", () => {
    render(<TermsModal />);
    const link = screen.getByRole("link", { name: "Terms & Conditions" });
    expect(link.getAttribute("href")).toBe("/terms");
  });

  it("keeps the modal open when the checkbox is ticked", () => {
    render(<TermsModal />);
    fireEvent.click(screen.getByRole("checkbox"));
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(isTermsAccepted()).toBe(false);
  });

  it("disables the agree button until the checkbox is ticked", () => {
    render(<TermsModal />);
    const button = screen.getByRole("button", { name: "Agree & continue" }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    fireEvent.click(screen.getByRole("checkbox"));
    expect(button.disabled).toBe(false);
  });

  it("persists acceptance and closes the modal", () => {
    render(<TermsModal />);
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Agree & continue" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(localStorage.getItem("pl_terms_accepted")).toBe("1");
    expect(localStorage.getItem("pl_terms_version")).toBe(String(TERMS_VERSION));
    expect(isTermsAccepted()).toBe(true);
    expect(document.body.style.overflow).toBe("");
  });

  it("does not render for an already-accepted visitor", () => {
    localStorage.setItem("pl_terms_accepted", "1");
    localStorage.setItem("pl_terms_version", String(TERMS_VERSION));
    render(<TermsModal />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("re-prompts after a terms version bump", () => {
    localStorage.setItem("pl_terms_accepted", "1");
    localStorage.setItem("pl_terms_version", String(TERMS_VERSION - 1));
    expect(isTermsAccepted()).toBe(false);
    render(<TermsModal />);
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("renders Albanian copy when lang is sq", () => {
    render(<TermsModal lang="sq" />);
    expect(screen.getByRole("button", { name: "Prano dhe vazhdo" })).toBeTruthy();
  });
});
