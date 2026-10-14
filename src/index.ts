import type { HTMLAttributes } from "react";

/**
 * The Vite plugin augments this interface with configured SVG filenames.
 */
export interface IconNameRegistry {}

export type IconName = [keyof IconNameRegistry] extends [never]
  ? string
  : keyof IconNameRegistry & string;

export type IconProps = Omit<HTMLAttributes<HTMLSpanElement>, "children"> & {
  name: IconName;
  children?: HTMLAttributes<HTMLSpanElement>["children"];
};

/**
 * Compile-time JSX marker. The Vite plugin replaces each use with a span.
 */
export function Icon(_props: IconProps): never {
  throw new Error(
    "The Icon marker requires semion/vite in your Vite configuration.",
  );
}
