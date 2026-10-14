# Decisions

## Project name

The selected name is Semion, written as lowercase `semion` in repository and
package identifiers. It is inspired by Ancient Greek `semeion`, meaning “sign”
or “identifying mark.” Semion is a shortened brand spelling, not an exact
Ancient Greek word.

## Transform implementation

The Vite plugin and rewrite are implemented in TypeScript. Parsing uses the
existing native `oxc-parser` npm package. This keeps the first prototype free
of a custom Rust transform core and its platform build and release work while
still using OXC's parser.
