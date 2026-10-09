import { describe, expect, it, beforeEach } from "vitest";
import { collectTargets, resolveActiveTargets, type RegionRegistration } from "@/components/input/targets";

function host(html: string): HTMLElement {
  document.body.innerHTML = html;
  return document.body;
}

describe("collectTargets", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("collects buttons, role=button and links in DOM order", () => {
    const root = host(`
      <div>
        <button id="a">A</button>
        <div role="button" id="b">B</div>
        <a href="#x" id="c">C</a>
      </div>`);
    expect(collectTargets(root).map((el) => el.id)).toEqual(["a", "b", "c"]);
  });

  it("skips disabled, aria-disabled and data-input-ignore elements", () => {
    const root = host(`
      <button id="ok">ok</button>
      <button id="dis" disabled>dis</button>
      <div role="button" id="aria" aria-disabled="true">aria</div>
      <button id="ign" data-input-ignore>ign</button>`);
    expect(collectTargets(root).map((el) => el.id)).toEqual(["ok"]);
  });

  it("skips elements hidden with display:none", () => {
    const root = host(`<button id="vis">v</button><button id="hid" style="display:none">h</button>`);
    expect(collectTargets(root).map((el) => el.id)).toEqual(["vis"]);
  });

  it("keeps only the innermost element of nested targets", () => {
    const root = host(`<div role="button" id="outer"><button id="inner">i</button></div>`);
    expect(collectTargets(root).map((el) => el.id)).toEqual(["inner"]);
  });
});

describe("resolveActiveTargets", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("orders play before aac when no dialog is present", () => {
    const root = host(`
      <div id="play"><button id="p1">p1</button></div>
      <div id="aac"><button id="a1">a1</button></div>`);
    const play: RegionRegistration = { name: "play", priority: 20, element: root.querySelector("#play") };
    const aac: RegionRegistration = { name: "aac", priority: 10, element: root.querySelector("#aac") };
    expect(resolveActiveTargets([aac, play]).map((el) => el.id)).toEqual(["p1", "a1"]);
  });

  it("uses only dialog targets when a dialog is present", () => {
    const root = host(`
      <div id="play"><button id="p1">p1</button></div>
      <div id="aac"><button id="a1">a1</button></div>
      <div id="dialog"><button id="d1">d1</button></div>`);
    const regions: RegionRegistration[] = [
      { name: "aac", priority: 10, element: root.querySelector("#aac") },
      { name: "play", priority: 20, element: root.querySelector("#play") },
      { name: "dialog", priority: 30, element: root.querySelector("#dialog") },
    ];
    expect(resolveActiveTargets(regions).map((el) => el.id)).toEqual(["d1"]);
  });
});
