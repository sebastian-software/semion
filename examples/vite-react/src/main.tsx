import { useState } from "react";
import { createRoot } from "react-dom/client";

import { Icon } from "semion";
import "./styles.css";

function IconDemo() {
  const [saved, setSaved] = useState(false);

  return (
    <main className="demo">
      <div className="eyebrow">React + Vite</div>
      <h1>Icons from your own SVG folder</h1>
      <p>
        Each icon is a local SVG mask. The buttons provide the color for their
        icons, including hover, pressed, and disabled states.
      </p>
      <div className="icon-row">
        <button className="icon-button" type="button" aria-label="Search">
          <Icon name="search" aria-hidden="true" />
        </button>
        <button className="icon-button" type="button" aria-label="Settings">
          <Icon name="settings" aria-hidden="true" />
        </button>
        <button
          className="icon-button"
          type="button"
          aria-label={saved ? "Remove from saved" : "Save"}
          aria-pressed={saved}
          onClick={() => setSaved((value) => !value)}
        >
          <Icon name="heart" aria-hidden="true" />
        </button>
        <button
          className="icon-button"
          type="button"
          aria-label="Unavailable action"
          disabled
        >
          <Icon name="settings" aria-hidden="true" />
        </button>
      </div>
      <p className="hint">Try hover and press on the first three buttons.</p>
    </main>
  );
}

const root = document.getElementById("root");
if (root) createRoot(root).render(<IconDemo />);
