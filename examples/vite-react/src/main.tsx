import { useState } from "react";
import type { CSSProperties } from "react";
import { createRoot } from "react-dom/client";

import { Icon } from "semion";
import searchIconUrl from "./icons/search.svg?no-inline";
import { SearchButton } from "./pipeline-example";
import { pipelineExamples } from "./pipeline-examples.generated";
import "./styles.css";

type IconKey = "search" | "settings" | "heart";
type SizeMode = "class" | "style";

const iconNames: IconKey[] = ["search", "settings", "heart"];
const htmlSafeSearchIconUrl = searchIconUrl
  .replaceAll("&", "&amp;")
  .replaceAll('"', "&quot;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;");
const renderedExampleHtml = pipelineExamples.rendered.replaceAll(
  "__SEMION_ASSET_URL__",
  htmlSafeSearchIconUrl,
);

function HighlightedCode({ html }: { html: string }) {
  return <div className="pipeline-highlight" dangerouslySetInnerHTML={{ __html: html }} />;
}

function DemoIcon({
  name,
  className,
  style,
}: {
  name: IconKey;
  className: string;
  style?: CSSProperties;
}) {
  switch (name) {
    case "search":
      return <Icon name="search" aria-hidden="true" className={className} style={style} />;
    case "settings":
      return <Icon name="settings" aria-hidden="true" className={className} style={style} />;
    case "heart":
      return <Icon name="heart" aria-hidden="true" className={className} style={style} />;
  }
}

function IconDemo() {
  const [selectedIcon, setSelectedIcon] = useState<IconKey>("search");
  const [sizeMode, setSizeMode] = useState<SizeMode>("class");
  const [pressed, setPressed] = useState(false);
  const [examplePressed, setExamplePressed] = useState(false);

  return (
    <>
      <header className="site-header">
        <a className="wordmark" href="#top" aria-label="Semion home">
          <span className="wordmark-mark" aria-hidden="true">s</span>
          <span>semion</span>
        </a>
        <nav aria-label="Main navigation">
          <a href="#workbench">Try it</a>
          <a href="#pipeline">How it works</a>
          <a href="#release">Package status</a>
        </nav>
        <a className="header-link" href="https://github.com/sebastian-software/semion">
          GitHub <span aria-hidden="true">↗</span>
        </a>
      </header>

      <main id="top">
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="eyebrow"><span className="eyebrow-dot" /> React + Vite · source preview</p>
            <h1 id="hero-title">Your SVGs.<br /><em>Named</em> in JSX.</h1>
            <p className="hero-deck">
              Semion turns a static icon name into a direct SVG asset import at
              build time. The browser gets a small masked element; the paths
              stay in the external file.
            </p>
            <div className="hero-links">
              <a className="button button-primary" href="#workbench">Open the workbench <span aria-hidden="true">↓</span></a>
              <a className="text-link" href="#pipeline">See the transform <span aria-hidden="true">↘</span></a>
            </div>
          </div>
          <aside className="hero-note" aria-label="Semion at a glance">
            <p className="note-kicker">A small Vite transform</p>
            <p className="note-title">No shared runtime icon registry.</p>
            <ul>
              <li><span>01</span> Static names resolve during build</li>
              <li><span>02</span> Used SVGs remain external assets</li>
              <li><span>03</span> Color and size stay in your CSS</li>
            </ul>
            <p className="name-note">Semion takes its name from Greek <i>sēmeion</i>, “sign”.</p>
          </aside>
        </section>

        <section className="workbench-section" id="workbench" aria-labelledby="workbench-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">01 / Live demo</p>
              <h2 id="workbench-title">Try a local icon.</h2>
            </div>
            <p>Pick a name, choose how to size it, then focus or press the preview.</p>
          </div>

          <div className="workbench">
            <div className="preview-side">
              <div className="preview-topline">
                <span><span className="live-dot" /> Live preview</span>
                <span className="preview-file">src/icons/{selectedIcon}.svg</span>
              </div>
              <div className="preview-canvas">
                <div className="orbit orbit-one" aria-hidden="true" />
                <div className="orbit orbit-two" aria-hidden="true" />
                <button
                  className={`preview-action${pressed ? " is-pressed" : ""}`}
                  type="button"
                  aria-label={pressed ? "Clear pressed preview state" : "Press the preview icon"}
                  aria-pressed={pressed}
                  onClick={() => setPressed((value) => !value)}
                >
                  <DemoIcon
                    name={selectedIcon}
                    className={`preview-icon${sizeMode === "class" ? " preview-icon-class" : ""}`}
                    {...(sizeMode === "style"
                      ? { style: { width: "2rem", height: "2rem" } }
                      : {})}
                  />
                </button>
                <p className="canvas-label">{selectedIcon}<span> · currentColor</span></p>
              </div>
              <div className="preview-footer">
                <span>Tab to focus</span><span>Press to toggle</span><span>Hover to recolor</span>
              </div>
            </div>

            <div className="controls-side">
              <fieldset className="control-group">
                <legend>Choose an SVG name</legend>
                <div className="icon-choices">
                  {iconNames.map((name) => (
                    <button
                      className={`choice${selectedIcon === name ? " is-selected" : ""}`}
                      type="button"
                      key={name}
                      aria-pressed={selectedIcon === name}
                      onClick={() => {
                        setSelectedIcon(name);
                        setPressed(false);
                      }}
                    >
                      <DemoIcon name={name} className="choice-icon" />
                      <span>{name}</span>
                    </button>
                  ))}
                </div>
              </fieldset>

              <fieldset className="control-group size-group">
                <legend>Set the size</legend>
                <div className="segmented-control">
                  <button
                    type="button"
                    aria-pressed={sizeMode === "class"}
                    className={sizeMode === "class" ? "is-selected" : ""}
                    onClick={() => setSizeMode("class")}
                  >
                    CSS class
                  </button>
                  <button
                    type="button"
                    aria-pressed={sizeMode === "style"}
                    className={sizeMode === "style" ? "is-selected" : ""}
                    onClick={() => setSizeMode("style")}
                  >
                    style prop
                  </button>
                </div>
                <code className="size-example">
                  {sizeMode === "class"
                    ? `<Icon name="${selectedIcon}" className="preview-icon" />`
                    : `<Icon name="${selectedIcon}" style={{ width: "2rem", height: "2rem" }} />`}
                </code>
              </fieldset>

              <div className="disabled-example">
                <button type="button" className="disabled-action" disabled>
                  <DemoIcon name="settings" className="disabled-icon" />
                  <span>Unavailable action</span>
                </button>
                <span className="disabled-label">disabled</span>
              </div>
              <p className="interaction-note">Color comes from the containing button. Try hover, keyboard focus, press, and disabled.</p>
            </div>
          </div>
        </section>

        <section className="pipeline-section" id="pipeline" aria-labelledby="pipeline-title">
          <div className="section-heading pipeline-heading">
            <div>
              <p className="eyebrow">02 / Under the hood</p>
              <h2 id="pipeline-title">One example, through the build.</h2>
            </div>
            <p>These samples come from <code>src/pipeline-example.tsx</code>. Ferriki highlights them at build time; step 2 is Semion's actual transform, and step 3 is React's rendered HTML with Vite's emitted SVG URL.</p>
          </div>
          <div className="pipeline">
            <article className="pipeline-step">
              <div className="step-heading"><span>01</span><h3>Author JSX</h3></div>
              <p>Use the SVG filename as a static name. Keep the button's behavior and styling in your app.</p>
              <HighlightedCode html={pipelineExamples.source} />
              <div className="pipeline-live-example">
                <span>Try this exact button</span>
                <SearchButton
                  pressed={examplePressed}
                  onPress={() => setExamplePressed((value) => !value)}
                />
              </div>
              <p className="step-footnote"><code>.button-icon</code> is defined in the demo stylesheet.</p>
            </article>

            <article className="pipeline-step pipeline-step-featured">
              <div className="step-heading"><span>02</span><h3>Vite rewrites it</h3></div>
              <p>The plugin imports the named SVG and forwards the icon's classes and accessibility attributes.</p>
              <HighlightedCode html={pipelineExamples.transformed} />
              <p className="step-footnote">Generated by Semion's transform from the JSX at left.</p>
            </article>

            <article className="pipeline-step">
              <div className="step-heading"><span>03</span><h3>Browser renders</h3></div>
              <p>React renders the same component. The mask points to the exact Vite asset URL, while the SVG paths remain in that separate file.</p>
              <HighlightedCode html={renderedExampleHtml} />
              <p className="step-footnote">Formatted from React's rendered output; the URL is Vite's emitted asset.</p>
            </article>
          </div>
        </section>

        <section className="details-section" aria-label="Semion capabilities">
          <div className="details-intro">
            <p className="eyebrow">03 / Made to fit your app</p>
            <h2>Keep icons out of your JavaScript bundle.</h2>
            <p>Semion resolves the filename at build time. Your app keeps control of the button, color, layout, and interaction.</p>
          </div>
          <div className="detail-list">
            <article>
              <span className="detail-index">A</span>
              <div><h3>Names from files</h3><p>Top-level SVG filenames become the finite <code>IconName</code> type after Vite generates the declaration.</p></div>
            </article>
            <article>
              <span className="detail-index">B</span>
              <div><h3>Normal CSS, familiar states</h3><p><code>currentColor</code> follows the parent. App classes set size and respond to hover, active, and disabled states.</p></div>
            </article>
            <article>
              <span className="detail-index">C</span>
              <div><h3>Independent SVG assets</h3><p>Each used SVG keeps a content-hashed Vite URL, so its path data stays out of JavaScript. HTTP/2 and HTTP/3 can multiplex many icon requests over one connection, and a CDN can cache each URL independently. The loading trade-off depends on the page and cache policy.</p></div>
            </article>
            <article>
              <span className="detail-index">D</span>
              <div><h3>TypeScript + OXC</h3><p>The Vite adapter uses the existing <code>oxc-parser</code> package. Semion is independent and does not ship a Rust addon.</p></div>
            </article>
          </div>
        </section>

        <section className="release-section" id="release" aria-labelledby="release-title">
          <div className="release-mark" aria-hidden="true">!</div>
          <div>
            <p className="eyebrow">Package status</p>
            <h2 id="release-title">This is a source preview.</h2>
            <p>The public npm package is still <code>semion@0.0.1</code>. That release requires a manual <code>import "semion/style.css"</code>. Automatic stylesheet injection shown on this page is in the current source preview; no newer npm release is published.</p>
          </div>
          <a className="button button-light" href="https://www.npmjs.com/package/semion">View npm package <span aria-hidden="true">↗</span></a>
        </section>
      </main>

      <footer className="site-footer">
        <a className="footer-brand" href="#top">semion <span>· SVG icons at build time</span></a>
        <div className="footer-links">
          <a href="https://github.com/sebastian-software/semion">Source on GitHub</a>
          <a href={`${import.meta.env.BASE_URL}THIRD_PARTY_NOTICES.md`}>Demo icon notices</a>
          <span>Semion: MIT OR Apache-2.0</span>
        </div>
      </footer>
    </>
  );
}

const root = document.getElementById("root");
if (root) createRoot(root).render(<IconDemo />);
